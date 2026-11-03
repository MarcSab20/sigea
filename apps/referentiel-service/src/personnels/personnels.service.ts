// apps/referentiel-service/src/personnels/personnels.service.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// FICHIER REMIS À SA PLACE
// ═══════════════════════════════════════════════════════════════════════════
// Une version plus récente de ce service vivait dans
// `apps/frontend/src/app/admin/personnels.service.ts` — un service NestJS,
// injectant PrismaService, déposé dans l'application React.
//
// Il n'était importé par aucun composant (deux commentaires seulement le
// mentionnent), mais `tsc` le compilait avec le reste du frontend et échouait
// à résoudre `@sigea/shared-database`, qui n'est pas une dépendance du client.
// C'est la cause des deux erreurs de compilation du frontend.
//
// Les enrichissements qu'il portait — champs d'état de sécurité — sont repris
// ici. Le fichier du frontend est à supprimer.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';

@Injectable()
export class PersonnelsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Annuaire du personnel, consommé par l'onglet Administration → Utilisateurs
   * et par le sélecteur de commandant de bord de l'écran de planification.
   *
   * ── Champs d'état de sécurité ──
   * `verrouille_securite`, `motif_verrouillage` et `nb_echecs_connexion` sont
   * au select. Sans eux, l'IHM ne peut pas signaler un compte bloqué :
   * l'administrateur devait parcourir le journal d'alertes pour découvrir
   * qu'un agent était enfermé dehors.
   *
   * Ils ne sont pas sensibles au sens du cloisonnement — ils décrivent l'état
   * d'un compte, pas son contenu — et la route est déjà réservée aux profils
   * habilités par la passerelle.
   *
   * ── Ajout : `rmia` ──
   * Indispensable depuis le cloisonnement régional. Sans elle, l'écran
   * d'administration ne peut pas montrer qu'un compte de la chaîne RMIA est
   * mal rattaché — défaut invisible, qui se traduit seulement par un officier
   * devant un écran vide, sans message d'erreur.
   *
   * `password_hash`, les secrets OTP et les codes de secours restent hors de
   * ce select : ils n'ont jamais à quitter le service.
   */
  async findAll(): Promise<unknown[]> {
    const users = await this.prisma.utilisateur.findMany({
      orderBy: { nom: 'asc' },
      select: {
        id: true, nom: true, prenom: true, grade: true, login: true,
        role: true, base_id: true, rmia: true, escadron_id: true,
        actif: true, email: true, telephone: true,
        last_login_at: true, createdAt: true,

        // ── État de sécurité du compte ──
        verrouille_securite: true,
        motif_verrouillage: true,
        nb_echecs_connexion: true,
      },
    });

    // `last_login` est conservé comme alias : des écrans existants le lisent
    // sous ce nom. Le renommer imposerait une reprise de l'IHM sans aucun gain.
    return users.map((u) => ({ ...u, last_login: u.last_login_at }));
  }
}