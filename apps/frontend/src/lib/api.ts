// apps/frontend/src/lib/api.ts

import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  // INDISPENSABLE : sans cette option, le navigateur n'envoie pas le cookie
  // de rafraîchissement et ne conserve pas celui que le serveur pose. Toute la
  // session en dépend.
  withCredentials: true,
});

function deviceFingerprint(): string {
  let id = localStorage.getItem('sigea-device-id');
  if (!id) {
    id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now());
    localStorage.setItem('sigea-device-id', id);
  }
  return id;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['x-device-fingerprint'] = deviceFingerprint();
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

/**
 * Rafraîchit le jeton d'accès.
 *
 * ── Aucun corps, aucun jeton transmis ──
 * Le jeton de rafraîchissement vit dans un cookie HttpOnly : le navigateur le
 * joint tout seul, et aucun script — pas même celui-ci — ne peut le lire.
 * C'est tout l'intérêt du dispositif.
 *
 * `axios` nu et non `api` : passer par l'instance relancerait l'intercepteur
 * de réponse sur un 401, et deux rafraîchissements s'appelleraient l'un
 * l'autre jusqu'à épuisement de la pile. `withCredentials` doit donc être
 * repassé explicitement.
 */
async function rafraichir(): Promise<string> {
  const { data } = await axios.post<{ access_token: string }>(
    `${api.defaults.baseURL}/auth/refresh`,
    {},
    { withCredentials: true, headers: { 'Content-Type': 'application/json' } },
  );
  useAuthStore.getState().setAccessToken(data.access_token);
  return data.access_token;
}

/**
 * Rétablit une session au démarrage de l'application.
 *
 * Appelée AVANT le premier rendu : sans elle, la première requête part sans
 * jeton, reçoit un 401, et l'utilisateur voit l'écran de connexion apparaître
 * puis disparaître — ou y reste si le rafraîchissement échoue.
 *
 * ── Pourquoi on tente toujours, même sans profil en mémoire ──
 * Le client ne peut PAS savoir s'il détient un cookie : il est HttpOnly. La
 * seule façon de le découvrir est de demander. Un échec coûte un aller-retour
 * et se solde par l'écran de connexion, ce qui est le comportement voulu.
 */
export async function restaurerSession(): Promise<boolean> {
  try {
    await rafraichir();
    return true;
  } catch {
    useAuthStore.getState().logout();
    return false;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Ne JAMAIS tenter de rafraîchir sur les points d'authentification
    // eux-mêmes : un 401 de connexion ou de vérification doit remonter à la
    // page, sinon l'écran reste en attente indéfiniment.
    const url: string = originalRequest?.url ?? '';
    const isAuthFlow =
      /\/auth\/(login|refresh|verify-otp|activate-otp|verify-backup-code)/.test(url);

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthFlow) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const token = await rafraichir();
        refreshQueue.forEach((cb) => cb(token));
        refreshQueue = [];
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Ouvre un document protégé.
 *
 * ── Pourquoi ce détour ──
 * Un `<a href="/api/pdf/...">` ne transmet AUCUN en-tête, donc aucun jeton :
 * le serveur répond 401 et l'onglet reste blanc. C'était la cause de la page
 * vierge à l'impression du manifeste.
 *
 * On récupère donc le document par axios — qui porte le jeton — puis on
 * l'ouvre depuis une URL locale. Celle-ci est révoquée après une minute : la
 * révoquer immédiatement couperait le chargement de l'onglet à peine ouvert,
 * la conserver indéfiniment garderait un document nominatif en mémoire pour
 * toute la session.
 */
export async function ouvrirDocument(chemin: string, nomFichier?: string): Promise<void> {
  const { data } = await api.get<Blob>(chemin, { responseType: 'blob' });
  const url = URL.createObjectURL(data);

  if (nomFichier) {
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const onglet = window.open(url, '_blank');
  if (!onglet) {
    // Fenêtre bloquée par le navigateur : on retombe sur un téléchargement,
    // plutôt que de ne rien faire et de laisser croire à une panne.
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = 'document.pdf';
    lien.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}