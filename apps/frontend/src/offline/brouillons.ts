// apps/frontend/src/offline/brouillons.ts
//
// Cache local des manifestes saisis hors ligne.
//
// La file d'attente (outbox.ts) sait REJOUER les écritures. Elle ne sait pas
// les AFFICHER : tant qu'elle n'a pas été vidée, le serveur ignore tout de ces
// manifestes, et `GET /manifestes` ne les renvoie pas.
//
// Sans ce cache, un chef d'escale saisirait quarante passagers hors ligne et
// verrait sa liste vide au rechargement de la page. Il ressaisirait. C'est le
// scénario qui décrédibilise un mode dégradé plus sûrement qu'une panne.
//
// Le cache est un miroir d'affichage, jamais une source de vérité : dès que le
// serveur connaît le manifeste, l'entrée locale est supprimée.

// `import type` et non `import` : manifeste.service importe ce module, qui
// importe manifeste.service. Un import de valeur créerait un cycle à
// l'exécution ; `import type` est effacé à la compilation et le rompt.
import type { Manifeste, Passager, Materiel } from '@/services/manifeste.service';

const CLE = 'sigea-brouillons-locaux';

export interface BrouillonLocal extends Manifeste {
  /** Toujours vrai. Marqueur exploité par l'interface pour signaler l'état. */
  _local: true;
  passagers: Passager[];
  materiels: Materiel[];
}

function lireTout(): Record<string, BrouillonLocal> {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? '{}') as Record<string, BrouillonLocal>;
  } catch {
    // Cache illisible (écriture concurrente interrompue, quota atteint) : on
    // repart à vide plutôt que de faire planter la page. La file d'attente,
    // elle, est en IndexedDB et n'est pas affectée — aucune saisie n'est perdue.
    return {};
  }
}

function ecrireTout(tout: Record<string, BrouillonLocal>): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(tout));
  } catch {
    // Quota dépassé. On n'interrompt pas la saisie : l'opération est déjà dans
    // la file IndexedDB et sera transmise. Seul l'affichage local est dégradé.
    console.warn('[SIGEA] Cache des brouillons locaux saturé — affichage dégradé.');
  }
}

export function creer(m: BrouillonLocal): void {
  const tout = lireTout();
  tout[m.id] = m;
  ecrireTout(tout);
}

export function lire(id: string): BrouillonLocal | null {
  return lireTout()[id] ?? null;
}

export function lister(): BrouillonLocal[] {
  return Object.values(lireTout()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function ajouterPassager(manifeste_id: string, p: Passager): void {
  const tout = lireTout();
  const m = tout[manifeste_id];
  if (!m) return;
  m.passagers = [...(m.passagers ?? []), p];
  m._count = { passagers: m.passagers.length, materiels: (m.materiels ?? []).length };
  ecrireTout(tout);
}

export function ajouterMateriel(manifeste_id: string, mat: Materiel): void {
  const tout = lireTout();
  const m = tout[manifeste_id];
  if (!m) return;
  m.materiels = [...(m.materiels ?? []), mat];
  m._count = { passagers: (m.passagers ?? []).length, materiels: m.materiels.length };
  ecrireTout(tout);
}

/**
 * Retire un brouillon du cache, une fois le manifeste connu du serveur.
 *
 * Appelé à la synchronisation. À partir de là, c'est la version serveur qui
 * fait foi : conserver le miroir local exposerait à afficher deux fois le même
 * manifeste, ou à montrer une version périmée.
 */
export function supprimer(id: string): void {
  const tout = lireTout();
  delete tout[id];
  ecrireTout(tout);
}

/**
 * Purge les brouillons dont plus aucune opération n'est en attente.
 *
 * `identifiantsEnAttente` provient de la file : tout brouillon absent de cette
 * liste a été transmis (ou définitivement abandonné) et n'a plus lieu d'être
 * affiché localement.
 */
export function purger(identifiantsEnAttente: Set<string>): number {
  const tout = lireTout();
  let retires = 0;
  for (const id of Object.keys(tout)) {
    if (!identifiantsEnAttente.has(id)) { delete tout[id]; retires++; }
  }
  if (retires) ecrireTout(tout);
  return retires;
}
