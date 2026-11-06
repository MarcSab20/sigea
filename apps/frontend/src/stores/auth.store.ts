// apps/frontend/src/stores/auth.store.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// AUCUN JETON N'EST PERSISTÉ
// ═══════════════════════════════════════════════════════════════════════════
// Le jeton d'ACCÈS vit en mémoire : dix minutes, reconstitué au démarrage par
// `restaurerSession()`.
//
// Le jeton de RAFRAÎCHISSEMENT n'est pas ici du tout. Il est dans un cookie
// HttpOnly posé par auth-service, que ce code ne peut ni lire ni écrire —
// c'est précisément ce qui le protège d'une extension malveillante ou d'une
// injection de script.
//
// Seul le PROFIL est persisté : il alimente les gardes de route, la barre
// latérale et le filtre des bases de départ. Sans lui, chaque rechargement
// afficherait une interface vide le temps du rafraîchissement.
//
// ── Conséquence à connaître ──
// Le profil persisté peut survivre à une session expirée. Il ne constitue donc
// JAMAIS une preuve d'authentification : seul le jeton d'accès en est une, et
// le serveur reste l'unique juge. Les gardes de route s'en servent pour éviter
// un clignotement d'écran, pas pour autoriser quoi que ce soit.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Profil d'affichage renvoyé par la connexion.
 *
 * Distinct de JwtPayload à dessein : ce que le serveur renvoie est un profil
 * — nom, grade, RMIA — et non la charge utile du jeton. Les confondre faisait
 * attendre au store des champs qu'il ne recevait jamais.
 */
export interface UtilisateurSession {
  id:      string;
  role:    string;
  /** NULLE pour la chaîne RMIA, qui relève d'une région et non d'une base. */
  base_id: string | null;
  /** Alimente le filtre des bases de départ. Sans elle, le sélecteur reste vide. */
  rmia:    string | null;
  nom:     string;
  prenom:  string;
  grade:   string;
  escadron_id?: string | null;
  interims?: Array<{ id: string; role: string; titulaire: string }>;
}

interface AuthState {
  accessToken: string | null;
  user:        UtilisateurSession | null;
  setAccessToken: (token: string) => void;
  setUser:        (user: UtilisateurSession) => void;
  logout:         () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user:        null,
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser:        (user)        => set({ user }),
      // Le cookie, lui, est effacé par `POST /auth/logout` : ce store ne peut
      // pas y toucher. Les deux doivent donc être appelés ensemble à la
      // déconnexion, faute de quoi la session resterait rétablissable.
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'sigea-auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
);