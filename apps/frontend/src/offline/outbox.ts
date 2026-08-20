// apps/frontend/src/offline/outbox.ts
//
// Mode dégradé — file d'attente des écritures faites hors connexion.
//
// ═══ PÉRIMÈTRE, ET POURQUOI IL EST ÉTROIT ═══
//
// Seule la SAISIE d'un manifeste en brouillon fonctionne hors ligne : créer le
// manifeste, y ajouter des passagers et des matériels. Tout le reste —
// soumission, validation, rejet, consignes CEMAA — exige la connexion.
//
// Ce n'est pas une limitation technique mais une décision de conception. Une
// signature est un acte engageant, horodaté, séquencé et concurrent. La
// rejouer douze heures plus tard depuis un poste isolé signifierait signer un
// document dont on ignore l'état réel : un COMGMO pourrait viser un manifeste
// qu'un autre validateur a rejeté entre-temps. La machine à états refuserait
// le rejeu, mais l'opérateur croirait avoir signé. Mieux vaut refuser
// franchement que promettre puis échouer.
//
// Les escales de Garoua, Maroua ou Bertoua n'ont pas la connectivité de
// Yaoundé. L'objectif est que la perte du lien n'empêche pas de saisir, pas de
// faire tourner le circuit de validation en aveugle.
//
// IndexedDB est pilotée directement, sans dépendance : le besoin se limite à
// un magasin clé-valeur ordonné.

import { api } from '@/lib/api';

const BASE = 'sigea-offline';
const MAGASIN = 'outbox';
const VERSION = 1;

/**
 * Préfixe des identifiants attribués localement, avant que le serveur n'ait
 * délivré le vrai. Volontairement reconnaissable à l'œil dans une URL ou un
 * log : si un tel identifiant atteint le serveur, c'est un défaut de
 * résolution, et il doit sauter aux yeux.
 */
export const PREFIXE_LOCAL = 'local-';

export const estIdentifiantLocal = (id: string): boolean => id.startsWith(PREFIXE_LOCAL);

/** Opérations admises hors ligne. Toute autre est refusée à l'empilement. */
export type TypeOperation = 'MANIFESTE_CREER' | 'PASSAGER_AJOUTER' | 'MATERIEL_AJOUTER';

export interface OperationEnAttente {
  id: string;
  type: TypeOperation;
  methode: 'POST' | 'PATCH' | 'DELETE';
  /** Peut contenir un identifiant local, résolu au moment du rejeu. */
  url: string;
  corps?: unknown;
  /**
   * Identifiant local attribué par CETTE opération, le cas échéant.
   * Renseigné uniquement pour MANIFESTE_CREER : c'est la clé qui permet de
   * réécrire les opérations dépendantes une fois le vrai identifiant connu.
   */
  id_local?: string;
  cree_le: number;
  tentatives: number;
  derniere_erreur?: string;
  /** Description lisible, affichée dans le bandeau de synchronisation. */
  libelle: string;
}

export interface EtatSynchronisation {
  en_attente: number;
  en_echec: number;
  synchronisation_en_cours: boolean;
}

/** Au-delà, l'opération part en arbitrage humain et n'est plus rejouée seule. */
const MAX_TENTATIVES = 5;

// ─── Accès IndexedDB ───────────────────────────────────────────────────────

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BASE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MAGASIN)) {
        const store = db.createObjectStore(MAGASIN, { keyPath: 'id' });
        // L'ordre d'empilement fait foi au rejeu : créer un manifeste puis y
        // ajouter un passager n'est pas commutatif.
        store.createIndex('cree_le', 'cree_le', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Ouverture IndexedDB impossible'));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await ouvrir();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, mode);
    const req = fn(tx.objectStore(MAGASIN));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Opération IndexedDB en échec'));
    tx.oncomplete = () => db.close();
  });
}

// ─── API publique ──────────────────────────────────────────────────────────

/** Le navigateur se déclare-t-il en ligne ? Indicatif, jamais garanti. */
export function estEnLigne(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function nouvelIdentifiantLocal(): string {
  const suffixe = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${PREFIXE_LOCAL}${suffixe}`;
}

export async function empiler(
  op: Omit<OperationEnAttente, 'id' | 'cree_le' | 'tentatives'>,
): Promise<string> {
  const entree: OperationEnAttente = {
    ...op,
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    cree_le: Date.now(),
    tentatives: 0,
  };
  await transaction('readwrite', (s) => s.add(entree));
  window.dispatchEvent(new CustomEvent('sigea:outbox'));
  return entree.id;
}

export async function lister(): Promise<OperationEnAttente[]> {
  const tout = await transaction<OperationEnAttente[]>('readonly', (s) => s.getAll());
  return tout.sort((a, b) => a.cree_le - b.cree_le);
}

export async function etat(): Promise<EtatSynchronisation> {
  const ops = await lister();
  return {
    en_attente: ops.filter((o) => o.tentatives < MAX_TENTATIVES).length,
    en_echec: ops.filter((o) => o.tentatives >= MAX_TENTATIVES).length,
    synchronisation_en_cours: enCours,
  };
}

export async function purgerEchecs(): Promise<number> {
  const echecs = (await lister()).filter((o) => o.tentatives >= MAX_TENTATIVES);
  for (const o of echecs) await transaction('readwrite', (s) => s.delete(o.id));
  window.dispatchEvent(new CustomEvent('sigea:outbox'));
  return echecs.length;
}

// ─── Rejeu ─────────────────────────────────────────────────────────────────

let enCours = false;

/**
 * Réécrit les opérations en attente qui référencent un identifiant local
 * fraîchement résolu.
 *
 * C'est le point délicat du mode dégradé. Hors ligne, un manifeste reçoit un
 * identifiant local ; les passagers ajoutés dans la foulée pointent sur cet
 * identifiant. Au rejeu, le serveur délivre le VRAI identifiant, et toutes les
 * opérations dépendantes doivent être réécrites avant d'être envoyées — sinon
 * elles partiraient sur une URL contenant « local-… » et échoueraient en 404.
 */
async function resoudreIdentifiant(id_local: string, id_reel: string): Promise<void> {
  for (const op of await lister()) {
    if (!op.url.includes(id_local)) continue;
    await transaction('readwrite', (s) =>
      s.put({ ...op, url: op.url.replace(id_local, id_reel) }),
    );
  }
}

/**
 * Rejoue la file dans l'ordre d'empilement.
 *
 * ARRÊT AU PREMIER ÉCHEC RÉSEAU, volontairement : les opérations sont
 * dépendantes (créer un manifeste, puis y ajouter des passagers). Continuer
 * après un échec produirait une cascade de 404 et viderait la file
 * d'opérations pourtant valides.
 *
 * Une erreur 4xx (hors 408/429) est en revanche DÉFINITIVE : le serveur a
 * compris et refusé. La rejouer ne changerait rien. L'opération part en
 * arbitrage humain plutôt qu'en boucle de retry.
 */
export async function synchroniser(): Promise<{ envoyees: number; echecs: number }> {
  if (enCours || !estEnLigne()) return { envoyees: 0, echecs: 0 };
  enCours = true;
  window.dispatchEvent(new CustomEvent('sigea:outbox'));

  let envoyees = 0;
  let echecs = 0;

  try {
    for (const op of await lister()) {
      if (op.tentatives >= MAX_TENTATIVES) { echecs++; continue; }

      // Filet : une opération dont l'identifiant local n'a pas été résolu ne
      // doit jamais partir. Elle échouerait en 404 et consommerait ses
      // tentatives pour rien.
      if (op.url.includes(PREFIXE_LOCAL)) {
        await transaction('readwrite', (s) =>
          s.put({
            ...op,
            tentatives: MAX_TENTATIVES,
            derniere_erreur:
              "Le manifeste parent n'a pas pu être créé sur le serveur : cette saisie " +
              'ne peut pas être rattachée.',
          }),
        );
        echecs++;
        continue;
      }

      try {
        const reponse = await api.request({ method: op.methode, url: op.url, data: op.corps });

        // Résolution de l'identifiant AVANT de retirer l'opération de la file :
        // si le navigateur est fermé entre les deux, on préfère une opération
        // rejouée deux fois (le serveur la rejettera) à des dépendances
        // devenues orphelines.
        if (op.id_local) {
          const idReel = (reponse.data as { id?: string })?.id;
          if (idReel) await resoudreIdentifiant(op.id_local, idReel);
        }

        await transaction('readwrite', (s) => s.delete(op.id));
        envoyees++;
      } catch (e) {
        const statut = (e as { response?: { status?: number } }).response?.status;
        const message =
          (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (e as Error).message;

        const definitif =
          statut !== undefined && statut >= 400 && statut < 500 && statut !== 408 && statut !== 429;

        await transaction('readwrite', (s) =>
          s.put({
            ...op,
            tentatives: definitif ? MAX_TENTATIVES : op.tentatives + 1,
            derniere_erreur: message,
          }),
        );
        echecs++;

        if (!definitif) break; // panne réseau : inutile d'insister sur la suite
      }
    }
  } finally {
    enCours = false;
    window.dispatchEvent(new CustomEvent('sigea:outbox'));
  }

  return { envoyees, echecs };
}

/**
 * Branche la synchronisation automatique au retour du réseau.
 *
 * Renvoie une fonction de désinscription. Les références des écouteurs sont
 * conservées en variables : passer une nouvelle fonction fléchée à
 * `removeEventListener` ne retirerait rien et accumulerait un écouteur à
 * chaque montage de composant.
 */
export function activerSynchronisationAuto(
  surChangement?: (e: EtatSynchronisation) => void,
): () => void {
  const notifier = async (): Promise<void> => { surChangement?.(await etat()); };
  const auRetour = (): void => { void synchroniser().then(notifier); };
  const surOutbox = (): void => { void notifier(); };

  window.addEventListener('online', auRetour);
  window.addEventListener('offline', surOutbox);
  window.addEventListener('sigea:outbox', surOutbox);

  // Filet : l'évènement `online` ne se déclenche pas si le lien se rétablit
  // sans que le navigateur change d'état — portail captif, réseau instable.
  const minuteur = window.setInterval(auRetour, 60_000);

  auRetour();

  return () => {
    window.removeEventListener('online', auRetour);
    window.removeEventListener('offline', surOutbox);
    window.removeEventListener('sigea:outbox', surOutbox);
    window.clearInterval(minuteur);
  };
}
