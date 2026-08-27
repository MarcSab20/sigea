import { Injectable } from '@nestjs/common';
import { PrismaService } from '@sigea/shared-database';

@Injectable()
export class PersonnelsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Annuaire du personnel, consommé par l'onglet Administration → Utilisateurs.
   *
   * ── Champs de sécurité ───────────────────────────────────────────────────
   * `verrouille_securite`, `motif_verrouillage` et `nb_echecs_connexion` sont
   * ajoutés au select. Sans eux, l'IHM ne peut pas signaler un compte bloqué :
   * l'administrateur devait jusqu'ici parcourir le journal d'alertes de
   * l'onglet Sécurité pour découvrir qu'un agent était enfermé dehors.
   *
   * Ces trois champs ne sont pas des données sensibles au sens du
   * cloisonnement — ils décrivent l'état d'un compte, pas son contenu — et la
   * route est déjà réservée aux profils habilités par la passerelle.
   *
   * `password_hash`, les secrets OTP et les codes de secours restent, eux,
   * hors de ce select : ils n'ont jamais à quitter le service.
   */
  async findAll(): Promise<unknown[]> {
    const users = await this.prisma.utilisateur.findMany({
      orderBy: { nom: 'asc' },
      select: {
        id: true, nom: true, prenom: true, grade: true, login: true,
        role: true, base_id: true, actif: true, email: true,
        last_login_at: true, createdAt: true,

        // ── État de sécurité du compte ──
        verrouille_securite: true,
        motif_verrouillage: true,
        nb_echecs_connexion: true,
      },
    });
    return users.map(u => ({ ...u, last_login: u.last_login_at }));
  }
}