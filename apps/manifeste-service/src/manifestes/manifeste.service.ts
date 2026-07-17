// apps/manifeste-service/src/manifestes/manifeste.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import {
  StatutManifeste, CategoriePassager, EtapeValidation, StatutValidation,
  composerTampon, ETAPE_SEQUENCE,
} from '@sigea/shared-types';
import { EVENTS, ALERT_EVENTS } from '@sigea/shared-events';
import { EventPublisher } from '@sigea/shared-messaging';

@Injectable()
export class ManifesteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
  ) {}

  async create(data: {
    vol_id: string; base_id: string; cree_par: string;
    etape_vol?: string; manifeste_maitre_id?: string;
  }): Promise<unknown> {
    // Le manifeste hérite de la sensibilité du vol : c'est elle qui déclenche
    // le verrou CEMAA en fin de circuit. Sans cette reprise, un vol sensible
    // produisait des manifestes ordinaires, contournant le verrou.
    const vol = await this.prisma.vol.findUnique({
      where: { id: data.vol_id },
      select: { id: true, flag_sensible: true, statut: true },
    });
    if (!vol) throw new NotFoundException(`Vol ${data.vol_id} introuvable`);
    if (vol.statut === 'ANNULE') {
      throw new BadRequestException('Impossible de créer un manifeste sur un vol annulé');
    }

    return this.prisma.manifeste.create({
      data: {
        vol_id:              data.vol_id,
        base_id:             data.base_id,
        cree_par:            data.cree_par,
        etape_vol:           data.etape_vol ?? 'A',
        manifeste_maitre_id: data.manifeste_maitre_id ?? null,
        statut:              StatutManifeste.BROUILLON,
        flag_sensible:       vol.flag_sensible,
        etape_courante:      null,
        version:             1,
      },
    });
  }

  async findAllByBase(base_id: string): Promise<unknown[]> {
    return this.prisma.manifeste.findMany({
      where: { base_id },
      orderBy: { createdAt: 'desc' },
      include: { vol: true, _count: { select: { passagers: true, materiels: true } } },
    });
  }

  async findOne(id: string, base_id: string): Promise<unknown> {
    const manifeste = await this.prisma.manifeste.findFirst({
      where: { id, base_id },
      include: {
        passagers: true, materiels: true, marchandises: true,
        equipages: true, validations: true, vol: true,
        base: { select: { code_base: true, nom: true, numero: true } },
      },
    });
    if (!manifeste) throw new NotFoundException(`Manifeste ${id} introuvable`);
    return manifeste;
  }

  /**
   * Soumission = signature du chef d'escale.
   *
   * Les deux sont indissociables : « un manifeste arrive au niveau de la
   * validation lorsque le chef d'escale a validé le manifeste et l'a soumis ».
   * Le VU CHEF_ESCALE est donc apposé ICI, dans la même transaction que le
   * changement de statut — un manifeste soumis sans son visa serait un
   * document invalide, et un visa sans soumission un visa fantôme.
   *
   * C'est aussi pourquoi ValidationStateMachine.valider() refuse
   * explicitement l'étape CHEF_ESCALE : elle est déjà franchie ici.
   */
  async soumettre(id: string, user: { sub: string; base_id: string }): Promise<unknown> {
    const manifeste = await this.prisma.manifeste.findFirst({
      where: { id, base_id: user.base_id },
      include: {
        passagers:    { select: { categorie: true } },
        marchandises: { select: { id: true } },
        base:         { select: { numero: true, code_base: true } },
        vol:          { select: { immatriculation: true, statut: true } },
      },
    });
    if (!manifeste) throw new NotFoundException(`Manifeste ${id} introuvable`);

    // Un manifeste rejeté est corrigé puis resoumis : c'est le cycle normal.
    if (
      manifeste.statut !== StatutManifeste.BROUILLON &&
      manifeste.statut !== StatutManifeste.REJETE
    ) {
      throw new BadRequestException(
        `Un manifeste ${manifeste.statut} ne peut pas être soumis`,
      );
    }
    if (manifeste.vol.statut === 'ANNULE') {
      throw new BadRequestException('Vol annulé : soumission impossible');
    }
    // Un manifeste vide n'a rien à faire dans le circuit de signature.
    if (manifeste.passagers.length === 0 && manifeste.marchandises.length === 0) {
      const materiels = await this.prisma.materiel.count({ where: { manifeste_id: id } });
      if (materiels === 0) {
        throw new BadRequestException(
          'Manifeste vide : aucun passager, matériel ou marchandise à transporter',
        );
      }
    }

    const signataire = await this.prisma.utilisateur.findUnique({
      where:  { id: user.sub },
      select: { nom: true, prenom: true, grade: true },
    });
    if (!signataire) throw new NotFoundException("Chef d'escale introuvable");

    const tampon = composerTampon({
      etape:             EtapeValidation.CHEF_ESCALE,
      base_numero:       manifeste.base.numero,
      base_code:         manifeste.base.code_base,
      signataire_nom:    signataire.nom,
      signataire_prenom: signataire.prenom,
      signataire_grade:  signataire.grade,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      // Resoumission après rejet : on repart d'une ardoise propre.
      await tx.validationEtape.deleteMany({ where: { manifeste_id: id } });

      await tx.validationEtape.create({
        data: {
          manifeste_id:  id,
          etape:         EtapeValidation.CHEF_ESCALE,
          statut:        StatutValidation.APPROUVE,
          validateur_id: user.sub,
          ...tampon,
        },
      });

      return tx.manifeste.update({
        where: { id },
        data: {
          statut:         StatutManifeste.SOUMIS,
          // Le circuit démarre à l'étape suivant celle du chef d'escale.
          etape_courante: ETAPE_SEQUENCE[1],
          version:        manifeste.statut === StatutManifeste.REJETE
            ? { increment: 1 }
            : undefined,
        },
      });
    });

    // ── Évènements (hors transaction : ne jamais faire échouer une
    //    soumission déjà persistée à cause du bus de messages) ──
    const ts = new Date().toISOString();
    const ctx = { manifeste_id: id, base_id: manifeste.base_id, vol_id: manifeste.vol_id, timestamp: ts };

    await this.events.publish(EVENTS.MANIFESTE_SUBMITTED, {
      ...ctx, etape_courante: ETAPE_SEQUENCE[1],
    });

    if (manifeste.passagers.some((p) => p.categorie === CategoriePassager.EVASAN)) {
      await this.events.publish(ALERT_EVENTS.EVASAN, ctx);
    }
    if (manifeste.passagers.some((p) => p.categorie === CategoriePassager.VIP)) {
      await this.events.publish(ALERT_EVENTS.VIP, ctx);
    }
    if (manifeste.marchandises.length > 0) {
      await this.events.publish(ALERT_EVENTS.DANGEROUS_GOODS, ctx);
    }

    return updated;
  }
}