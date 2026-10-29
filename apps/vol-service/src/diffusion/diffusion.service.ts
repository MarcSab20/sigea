// apps/vol-service/src/diffusion/diffusion.service.ts
//
// Allocation des quotas par le SCOPS, et diffusion du vol aux RMIA.
//
// ═══════════════════════════════════════════════════════════════════════════
// DÉCISION D'ARCHITECTURE À CONNAÎTRE
// ═══════════════════════════════════════════════════════════════════════════
// Ce service écrit dans ListeEmbarquement, qui appartient au domaine « listes ».
// L'orthodoxie microservices voudrait que vol-service publie VOL_DIFFUSE et que
// liste-service consomme l'évènement pour ouvrir les listes.
//
// Ce n'est pas ce que je fais ici, et c'est délibéré : un quota alloué sans
// liste ouverte est un état incohérent VISIBLE DE L'UTILISATEUR — le SCOPS a
// validé, les RMIA sont notifiées, et l'écran de saisie n'existe pas encore.
// Entre une frontière de service respectée et un invariant métier garanti, je
// choisis l'invariant : les deux services partagent déjà la même base et le
// même client Prisma, la transaction est donc réellement atomique.
//
// La conséquence à assumer : si les listes devaient un jour migrer vers une
// base distincte, ce point serait à reprendre par saga. Il est isolé ici, dans
// une seule méthode, précisément pour que cette reprise reste localisée.

import {
  Injectable, BadRequestException, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import {
  StatutVol, StatutListe, EtapeListe, Rmia, JwtPayload,
} from '@sigea/shared-types';
import { EventPublisher } from '@sigea/shared-messaging';
import { VOL_EVENTS, LISTE_EVENTS } from '@sigea/shared-events';
import { AllocationQuotaDto, AjustementQuotaDto } from '../vols/dto/allocation-quota.dto';

@Injectable()
export class DiffusionService {
  private readonly logger = new Logger(DiffusionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
  ) {}

  /**
   * Alloue les quotas de tous les points d'embarquement et diffuse le vol.
   *
   * Un point d'EMBARQUEMENT est un point d'itinéraire d'ordre strictement
   * inférieur au dernier : personne n'embarque à la destination finale. Exiger
   * un quota pour ce dernier point serait demander au SCOPS de statuer sur une
   * question qui ne se pose pas.
   */
  async allouer(vol_id: string, dto: AllocationQuotaDto, user: JwtPayload): Promise<unknown> {
    const vol = await this.prisma.vol.findUnique({
      where: { id: vol_id },
      include: {
        itineraire: {
          select: { id: true, ordre: true, base_id: true, rmia: true },
          orderBy: { ordre: 'asc' },
        },
      },
    });
    if (!vol) throw new NotFoundException(`Vol ${vol_id} introuvable`);

    if (vol.statut === StatutVol.ANNULE) {
      throw new BadRequestException('Vol annulé : aucune allocation possible');
    }
    if (vol.statut !== StatutVol.PLANIFIE) {
      throw new ConflictException(
        'Ce vol a déjà été diffusé. Utilisez le réajustement de quota pour le modifier.',
      );
    }
    if (vol.itineraire.length < 2) {
      throw new BadRequestException(
        "Itinéraire incomplet : impossible d'allouer des quotas.",
      );
    }

    const pointsEmbarquement = vol.itineraire.slice(0, -1);
    const attendus = new Set(pointsEmbarquement.map((e) => e.id));
    const fournis  = new Set(dto.quotas.map((q) => q.etape_id));

    const manquants = [...attendus].filter((id) => !fournis.has(id));
    if (manquants.length) {
      const libelles = pointsEmbarquement
        .filter((e) => manquants.includes(e.id))
        .map((e) => `ordre ${e.ordre}`)
        .join(', ');
      throw new BadRequestException(
        `Allocation incomplète : aucun quota pour ${libelles}. ` +
          "Tous les points d'embarquement doivent être servis en une fois.",
      );
    }
    const surnumeraires = [...fournis].filter((id) => !attendus.has(id));
    if (surnumeraires.length) {
      throw new BadRequestException(
        "Un quota a été fourni pour un point qui n'est pas un point d'embarquement " +
          'de ce vol (dernier point de l\'itinéraire, ou point d\'un autre vol).',
      );
    }

    // Plafond physique. Le contrôle fin — place réellement disponible par
    // tronçon, transit compris — relève des listes, où les intervalles de
    // trajet sont connus. Ici, on ne peut et ne doit vérifier que le plafond
    // absolu : aucun point ne peut à lui seul remplir plus que l'appareil.
    for (const q of dto.quotas) {
      if (q.quota_places > vol.capacite_places) {
        throw new BadRequestException(
          `Quota de ${q.quota_places} places supérieur à la capacité du vol (${vol.capacite_places}).`,
        );
      }
      if (q.quota_masse_kg > Number(vol.capacite_cargo_kg)) {
        throw new BadRequestException(
          `Quota de ${q.quota_masse_kg} kg supérieur à la capacité du vol (${vol.capacite_cargo_kg} kg).`,
        );
      }
    }

    const maintenant = new Date();
    const parEtape = new Map(vol.itineraire.map((e) => [e.id, e]));

    const resultat = await this.prisma.$transaction(async (tx) => {
      // Compare-and-swap sur le statut : si un autre SCOPS a diffusé ce vol
      // entre la lecture et ici, count vaut 0 et rien n'est écrit.
      const cas = await tx.vol.updateMany({
        where: { id: vol_id, statut: StatutVol.PLANIFIE },
        data: {
          statut:      StatutVol.DIFFUSE,
          diffuse_par: user.sub,
          diffuse_le:  maintenant,
        },
      });
      if (cas.count === 0) {
        throw new ConflictException('Vol déjà diffusé par un autre opérateur');
      }

      const listes: {
        liste_id: string; etape_id: string; ordre: number; base_id: string; rmia: Rmia;
        quota_places: number; quota_masse_kg: number;
      }[] = [];

      for (const q of dto.quotas) {
        const point = parEtape.get(q.etape_id)!;

        await tx.etapeItineraire.update({
          where: { id: q.etape_id },
          data: {
            quota_places:     q.quota_places,
            quota_masse_kg:   q.quota_masse_kg,
            quota_alloue_par: user.sub,
            quota_alloue_le:  maintenant,
          },
        });

        // Le quota est RECOPIÉ sur la liste. Une jointure donnerait toujours la
        // valeur courante : un réajustement ultérieur du SCOPS changerait alors
        // la capacité d'une liste déjà visée, sous les pieds de ses signataires.
        const liste = await tx.listeEmbarquement.create({
          data: {
            vol_id,
            etape_id:       q.etape_id,
            rmia:           point.rmia,
            statut:         StatutListe.OUVERTE,
            etape_courante: EtapeListe.SEC_ADJ_AIR,
            quota_places:   q.quota_places,
            quota_masse_kg: q.quota_masse_kg,
          },
          select: { id: true },
        });

        listes.push({
          liste_id: liste.id, etape_id: q.etape_id, ordre: point.ordre,
          base_id: point.base_id, rmia: point.rmia as Rmia,
          quota_places: q.quota_places, quota_masse_kg: q.quota_masse_kg,
        });
      }

      return listes;
    });

    // Destinataires : les RMIA des points d'EMBARQUEMENT. La RMIA du point
    // d'arrivée final n'a personne à inscrire ; la notifier produirait du bruit
    // sur un écran qui doit rester un écran d'action.
    const destinataires = [...new Set(resultat.map((l) => l.rmia))];
    const ts = new Date().toISOString();

    await this.events.publish(VOL_EVENTS.VOL_DIFFUSE, {
      vol_id,
      numero_mission:     vol.numero_mission,
      diffuse_par:        user.sub,
      rmia_destinataires: destinataires,
      listes: resultat.map(({ liste_id, etape_id, ordre, base_id, rmia }) => ({
        liste_id, etape_id, ordre, base_id, rmia,
      })),
      timestamp: ts,
    });

    for (const l of resultat) {
      await this.events.publish(LISTE_EVENTS.LISTE_OUVERTE, {
        liste_id: l.liste_id, vol_id, etape_id: l.etape_id, ordre: l.ordre,
        base_id: l.base_id, rmia: l.rmia,
        quota_places: l.quota_places, quota_masse_kg: l.quota_masse_kg,
        timestamp: ts,
      });
    }

    this.logger.log(
      `Vol diffusé : ${vol.numero_mission} par ${user.sub} — ` +
        `${resultat.length} liste(s) ouverte(s), RMIA : ${destinataires.join(', ')}`,
    );

    return this.prisma.vol.findUnique({
      where: { id: vol_id },
      include: {
        itineraire: {
          include: {
            base:   { select: { code_base: true, nom: true } },
            listes: { select: { id: true, statut: true, etape_courante: true } },
          },
          orderBy: { ordre: 'asc' },
        },
      },
    });
  }

  /**
   * Réajuste le quota d'un point déjà diffusé.
   *
   * ── Pourquoi on refuse de descendre sous l'existant ──
   * Réduire un quota en deçà du nombre de personnes déjà portées sur la liste
   * hiérarchisée reviendrait à désigner implicitement ceux qui sautent. Ce n'est
   * pas au SCOPS d'arbitrer entre deux noms : c'est une discrimination, et elle
   * appartient à l'ADJ_AIR, au COMRMIA et au COMBASE. Le SCOPS doit donc
   * d'abord faire retirer les lignes, puis réduire.
   */
  async ajuster(
    vol_id: string, etape_id: string, dto: AjustementQuotaDto, user: JwtPayload,
  ): Promise<unknown> {
    const point = await this.prisma.etapeItineraire.findFirst({
      where: { id: etape_id, vol_id },
      include: {
        vol:   { select: { statut: true, capacite_places: true, capacite_cargo_kg: true, numero_mission: true } },
        listes: {
          select: {
            id: true, statut: true,
            _count: { select: { lignes: true } },
          },
        },
      },
    });
    if (!point) throw new NotFoundException("Point d'itinéraire introuvable sur ce vol");

    if (point.vol.statut !== StatutVol.DIFFUSE) {
      throw new ConflictException(
        `Réajustement impossible : le vol est au statut ${point.vol.statut}.`,
      );
    }
    if (dto.quota_places > point.vol.capacite_places) {
      throw new BadRequestException(
        `Quota supérieur à la capacité du vol (${point.vol.capacite_places} places).`,
      );
    }
    if (dto.quota_masse_kg > Number(point.vol.capacite_cargo_kg)) {
      throw new BadRequestException(
        `Quota supérieur à la capacité du vol (${point.vol.capacite_cargo_kg} kg).`,
      );
    }

    const liste = point.listes[0];
    if (liste && liste.statut !== StatutListe.OUVERTE) {
      throw new ConflictException(
        'La liste de ce point est engagée dans le circuit de validation : ' +
          'le quota ne peut plus être modifié sans renvoi préalable au secrétaire.',
      );
    }

    const retenues = liste
      ? await this.prisma.ligneListe.count({
          where: { liste_id: liste.id, nature: 'HIERARCHISEE' },
        })
      : 0;
    if (dto.quota_places < retenues) {
      throw new BadRequestException(
        `${retenues} personne(s) figurent déjà sur la liste hiérarchisée. ` +
          `Faites-les retirer avant de descendre le quota à ${dto.quota_places}.`,
      );
    }

    const avant = {
      places: point.quota_places, masse: point.quota_masse_kg ? Number(point.quota_masse_kg) : null,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.etapeItineraire.update({
        where: { id: etape_id },
        data: {
          quota_places:     dto.quota_places,
          quota_masse_kg:   dto.quota_masse_kg,
          quota_alloue_par: user.sub,
          quota_alloue_le:  new Date(),
        },
      });
      if (liste) {
        await tx.listeEmbarquement.update({
          where: { id: liste.id },
          data:  { quota_places: dto.quota_places, quota_masse_kg: dto.quota_masse_kg },
        });
      }
    });

    await this.events.publish(VOL_EVENTS.VOL_QUOTA_AJUSTE, {
      vol_id, etape_id, rmia: point.rmia as Rmia,
      quota_places_avant:   avant.places,
      quota_places_apres:   dto.quota_places,
      quota_masse_kg_avant: avant.masse,
      quota_masse_kg_apres: dto.quota_masse_kg,
      ajuste_par: user.sub,
      timestamp:  new Date().toISOString(),
    });

    this.logger.log(
      `Quota réajusté : vol=${point.vol.numero_mission} ordre=${point.ordre} ` +
        `${avant.places ?? '—'} → ${dto.quota_places} places par ${user.sub} (${dto.motif})`,
    );

    return { etape_id, quota_places: dto.quota_places, quota_masse_kg: dto.quota_masse_kg };
  }
}