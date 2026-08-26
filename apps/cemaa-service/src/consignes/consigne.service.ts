// apps/cemaa-service/src/consignes/consigne.service.ts
//
// Consignes d'autorité centrale — CEMAA et MAGE.
//
// Un SEUL service pour les deux autorités, paramétré par `autorite`.
// L'alternative — dupliquer le service — aurait garanti la divergence : la
// première correction de la vérification d'escale n'aurait été appliquée que
// d'un côté, et personne ne l'aurait vu avant un incident.
//
// Ce qui EST séparé, en revanche : la clé de chiffrement. Voir `cle()`.

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';
import { CemaaCryptoService } from '@sigea/shared-crypto';
import { AutoriteCentrale, StatutConsigne } from '@sigea/shared-types';
import { CONSIGNE_EVENTS } from '@sigea/shared-events';
import { EventPublisher } from '@sigea/shared-messaging';
import { CreateConsigneDto, UpdateConsigneDto, ConfirmerConsigneDto } from './dto/create-consigne.dto';
@Injectable()
export class ConsigneService {
  private readonly logger = new Logger(ConsigneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CemaaCryptoService,
    private readonly events: EventPublisher,
  ) {}

  async create(
    dto: CreateConsigneDto,
    agentId: string,
    autorite: AutoriteCentrale,
  ): Promise<unknown> {
    const cle = this.cle(autorite);

    // Le vol doit exister : sinon la consigne serait orpheline et son event
    // ne trouverait aucun manifeste à marquer.
    const vol = await this.prisma.vol.findUnique({
      where: { id: dto.vol_id },
      select: { id: true, statut: true },
    });
    if (!vol) throw new NotFoundException(`Vol ${dto.vol_id} introuvable`);
    if (vol.statut === 'ANNULE') {
      throw new BadRequestException('Vol annulé : consigne impossible');
    }

    // Si l'escale est précisée, elle doit appartenir à la route du vol.
    if (dto.escale_base_id) {
      await this.verifierEscale(dto.vol_id, dto.escale_base_id);
    }

    const encrypted = this.crypto.encrypt(dto.contenu, cle);

    const created = await this.prisma.consigneCemaa.create({
      data: {
        autorite,
        vol_id:           dto.vol_id,
        escale_base_id:   dto.escale_base_id ?? null,
        type:             dto.type,
        contenu_chiffre:  JSON.stringify(encrypted),
        places_bloquees:  dto.places_bloquees ?? 0,
        masse_bloquee_kg: dto.masse_bloquee_kg ?? 0,
        valide_par_cemaa: agentId,
      },
    });

    this.logger.log(`Consigne ${autorite} émise : ${created.id} (vol=${dto.vol_id})`);

    await this.publierEvenement(
      CONSIGNE_EVENTS[autorite].CREATED,
      autorite,
      created.id,
      dto.vol_id,
      dto.escale_base_id ?? null,
    );
    return created;
  }

  async update(
    id: string,
    dto: UpdateConsigneDto,
    agentId: string,
    autorite: AutoriteCentrale,
  ): Promise<unknown> {
    const consigne = await this.prisma.consigneCemaa.findUnique({ where: { id } });
    if (!consigne) throw new NotFoundException(`Consigne ${id} introuvable`);

    // Cloisonnement entre autorités.
    //
    // Le MAGE ne modifie pas une consigne CEMAA, et réciproquement. Deux
    // autorités disposant chacune d'un veto ne sauraient réécrire l'expression
    // du veto de l'autre : ce serait vider le second de sa substance.
    // La clé de déchiffrement diffère de toute façon — mais on refuse ici
    // explicitement, avec un message clair, plutôt que d'échouer plus loin
    // sur une erreur de déchiffrement incompréhensible.
    if (consigne.autorite !== autorite) {
      throw new BadRequestException(
        `Cette consigne émane de l'autorité ${consigne.autorite} : ` +
        `elle ne peut pas être modifiée depuis l'espace ${autorite}.`,
      );
    }

    const data: Record<string, unknown> = { valide_par_cemaa: agentId };
    if (dto.contenu !== undefined) {
      data['contenu_chiffre'] = JSON.stringify(
        this.crypto.encrypt(dto.contenu, this.cle(autorite)),
      );
    }
    if (dto.places_bloquees !== undefined)  data['places_bloquees']  = dto.places_bloquees;
    if (dto.masse_bloquee_kg !== undefined) data['masse_bloquee_kg'] = dto.masse_bloquee_kg;

    const updated = await this.prisma.consigneCemaa.update({ where: { id }, data });

    await this.publierEvenement(
      CONSIGNE_EVENTS[autorite].UPDATED,
      autorite,
      id,
      consigne.vol_id,
      consigne.escale_base_id,
    );
    return updated;
  }

    /**
   * L'autorité émettrice atteste — ou dément — que sa consigne a été exécutée.
   *
   * C'est le seul acte que CEMAA et MAGE posent sur le circuit. Ce n'est PAS
   * une signature : aucun tampon n'est apposé, aucune étape n'est franchie.
   * C'est un accusé d'exécution, qui lève (ou maintient) le blocage du
   * manifeste à l'étape ETAPE_BLOQUEE_PAR_CONSIGNE.
   *
   * ── Seul l'émetteur juge ──
   * Le MAGE ne confirme pas une consigne du CEMAA, et réciproquement. Une
   * autorité qui pourrait valider l'exécution de la consigne d'une autre
   * viderait le contrôle de son sens : c'est celui qui a ordonné qui constate.
   *
   * ── NON_REALISEE n'est pas définitif ──
   * Le manifeste reste bloqué, le chef d'escale corrige, l'autorité statue de
   * nouveau. D'où l'absence de contrainte d'immuabilité : contrairement à un
   * tampon, une confirmation se révise tant que le circuit n'est pas clos.
   */
  async confirmerRealisation(
    id: string,
    dto: ConfirmerConsigneDto,
    agentId: string,
    autorite: AutoriteCentrale,
  ): Promise<unknown> {
    const consigne = await this.prisma.consigneCemaa.findUnique({
      where: { id },
      select: { id: true, autorite: true, vol_id: true, statut_realisation: true },
    });
    if (!consigne) throw new NotFoundException(`Consigne ${id} introuvable`);

    if (consigne.autorite !== autorite) {
      throw new ForbiddenException(
        `Cette consigne émane de l'autorité ${consigne.autorite}. ` +
        "Seul son émetteur peut constater son exécution.",
      );
    }

    if (dto.statut === StatutConsigne.NON_REALISEE && !dto.observation?.trim()) {
      // Sans observation, le chef d'escale ne sait pas quoi corriger — et le
      // blocage devient une impasse plutôt qu'une consigne.
      throw new BadRequestException(
        "Déclarer une consigne NON EXÉCUTÉE impose de préciser ce qui manque.",
      );
    }

    const maj = await this.prisma.consigneCemaa.update({
      where: { id },
      data: {
        statut_realisation:      dto.statut,
        confirme_par:            agentId,
        confirme_le:             new Date(),
        observation_realisation: dto.observation?.trim() ?? null,
      },
    });

    this.logger.warn(
      `Consigne ${autorite} ${id} : ${consigne.statut_realisation} → ${dto.statut} ` +
      `(vol=${consigne.vol_id}, par=${agentId})`,
    );
    return maj;
  }

  /**
   * Consignes en attente de constat, pour l'autorité courante.
   *
   * C'est la file de travail de l'espace CEMAA / MAGE : sans cet écran,
   * l'autorité ne saurait pas qu'un manifeste l'attend, et le blocage
   * ressemblerait à une panne.
   */
  async enAttenteDeConstat(autorite: AutoriteCentrale): Promise<unknown[]> {
    return this.prisma.consigneCemaa.findMany({
      where: { autorite, statut_realisation: { in: ['EMISE', 'NON_REALISEE'] } },
      select: {
        id: true, type: true, date: true, statut_realisation: true,
        observation_realisation: true, places_bloquees: true, masse_bloquee_kg: true,
        vol: {
          select: {
            numero_mission: true, date_heure: true, immatriculation: true,
            statut: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Métadonnées des consignes d'un vol, filtrées par autorité.
   *
   * `autorite` optionnel : omis, on renvoie tout — c'est ce dont a besoin
   * l'affichage du manifeste, qui doit signaler qu'une consigne existe sans
   * en révéler le contenu. Renseigné, on borne à l'espace de l'autorité.
   *
   * Le contenu chiffré n'est jamais déchiffré ici, quelle que soit l'autorité.
   */
  async findByVol(vol_id: string, autorite?: AutoriteCentrale): Promise<unknown[]> {
    return this.prisma.consigneCemaa.findMany({
      where: { vol_id, ...(autorite ? { autorite } : {}) },
      orderBy: { date: 'desc' },
    });
  }

  // ── Interne ──

  /**
   * Clé de chiffrement, PROPRE À CHAQUE AUTORITÉ.
   *
   * C'est la décision de sécurité de ce lot. Une clé partagée aurait été plus
   * simple, mais elle aurait signifié qu'une compromission de la clé CEMAA
   * expose aussi les consignes du MAGE. Deux autorités disposant chacune d'un
   * veto indépendant doivent avoir des compartiments indépendants : c'est la
   * définition même de la séparation des compartiments.
   *
   * Conséquence d'exploitation : `MAGE_ENCRYPTION_KEY` doit être générée et
   * distribuée séparément, et ne doit JAMAIS valoir la clé CEMAA — le contrôle
   * ci-dessous le refuse explicitement.
   */
  private cle(autorite: AutoriteCentrale): Buffer {
    const variable =
      autorite === AutoriteCentrale.MAGE ? 'MAGE_ENCRYPTION_KEY' : 'CEMAA_ENCRYPTION_KEY';
    const hex = process.env[variable] ?? '';

    if (!hex) {
      // Sans clé, on refuse plutôt que de « chiffrer » avec une clé vide :
      // une consigne en clair serait une fuite de données sensibles.
      throw new BadRequestException(`${variable} non configurée`);
    }
    const cle = Buffer.from(hex, 'hex');
    if (cle.length !== 32) {
      throw new BadRequestException(
        `${variable} invalide : ${cle.length} octets décodés, 32 attendus (AES-256).`,
      );
    }
    if (
      autorite === AutoriteCentrale.MAGE &&
      process.env.CEMAA_ENCRYPTION_KEY &&
      hex === process.env.CEMAA_ENCRYPTION_KEY
    ) {
      throw new BadRequestException(
        'MAGE_ENCRYPTION_KEY est identique à CEMAA_ENCRYPTION_KEY : ' +
        'la séparation des compartiments serait illusoire. Générez une clé distincte.',
      );
    }
    return cle;
  }

  private async verifierEscale(vol_id: string, base_id: string): Promise<void> {
    // L'escale ciblée doit être une base de la route : départ, arrivée, ou
    // escale intermédiaire déclarée.
    const vol = await this.prisma.vol.findUnique({
      where: { id: vol_id },
      select: {
        base_depart_id: true, base_arrivee_id: true,
        escales: { select: { base_id: true } },
      },
    });
    if (!vol) throw new NotFoundException(`Vol ${vol_id} introuvable`);

    const bases = new Set<string>([
      vol.base_depart_id, vol.base_arrivee_id,
      ...vol.escales.map((e) => e.base_id),
    ]);
    if (!bases.has(base_id)) {
      throw new BadRequestException(`La base ${base_id} n'est pas sur la route du vol`);
    }
  }

  /**
   * Publie l'évènement de consigne en y joignant les manifestes CIBLÉS.
   * Si escale_base_id est renseigné, seuls les manifestes de cette escale
   * reçoivent l'indication ; sinon, tous les manifestes du vol.
   */
  private async publierEvenement(
    routingKey: string,
    autorite: AutoriteCentrale,
    consigne_id: string,
    vol_id: string,
    escale_base_id: string | null,
  ): Promise<void> {
    const manifestes = await this.prisma.manifeste.findMany({
      where: {
        vol_id,
        ...(escale_base_id ? { base_id: escale_base_id } : {}),
      },
      select: { id: true, base_id: true },
    });

    await this.events.publish(routingKey, {
      consigne_id,
      autorite,
      vol_id,
      escale_base_id,
      manifestes,
      timestamp: new Date().toISOString(),
    });
  }
}