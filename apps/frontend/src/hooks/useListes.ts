// apps/frontend/src/hooks/useListes.ts
//
// Hooks react-query du domaine « listes ».
//
// ── Pourquoi des clés de cache aussi fines ──
// Un visa change à la fois la liste, son avancement, et l'occupation des
// tronçons du vol entier. Invalider une clé racine « listes » suffirait à
// rafraîchir l'écran courant, mais rechargerait aussi les quinze autres listes
// de l'inventaire à chaque clic. Les clés par identifiant évitent ce coût sur
// des connexions qui, sur certaines bases, se comptent en kilobits.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import type { EtapeListe, NatureLigne, Priorite } from '@sigea/shared-types';
import {
  listeService, circuitService, potentialiteService, messagerieService,
} from '@/services/liste.service';

export const clesListes = {
  toutes:      ['listes'] as const,
  detail:      (id: string) => ['listes', id] as const,
  avancement:  (id: string) => ['listes', id, 'avancement'] as const,
  troncons:    (volId: string) => ['vols', volId, 'troncons'] as const,
  potentialites: (q: string) => ['potentialites', q] as const,
  messagerie:  (id: string) => ['messagerie', id] as const,
};

/**
 * Extrait le message d'erreur de l'API.
 *
 * Les messages du serveur sont rédigés pour être lus par un officier
 * (« Quota atteint : 3 places disponibles, facteur limitant : capacité de
 * l'aéronef sur ce tronçon »). Les remplacer par un « Une erreur est survenue »
 * générique détruirait précisément l'information utile.
 */
function messageErreur(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  if (Array.isArray(m)) return m.join(' — ');
  return m ?? err.message ?? 'Erreur inattendue';
}

// ─── Lecture ───────────────────────────────────────────────────────────────

export function useMesListes() {
  return useQuery({
    queryKey: clesListes.toutes,
    queryFn: listeService.mesListes,
    // 30 s : un visa posé par un collègue doit apparaître sans rechargement
    // manuel, mais interroger le serveur à chaque focus serait excessif.
    staleTime: 30_000,
  });
}

export function useListe(id: string | undefined) {
  return useQuery({
    queryKey: clesListes.detail(id ?? ''),
    queryFn: () => listeService.consulter(id!),
    enabled: Boolean(id),
  });
}

export function useAvancement(id: string | undefined) {
  return useQuery({
    queryKey: clesListes.avancement(id ?? ''),
    queryFn: () => circuitService.avancement(id!),
    enabled: Boolean(id),
  });
}

export function useTroncons(volId: string | undefined) {
  return useQuery({
    queryKey: clesListes.troncons(volId ?? ''),
    queryFn: () => listeService.troncons(volId!),
    enabled: Boolean(volId),
  });
}

export function usePotentialites(q: string) {
  return useQuery({
    queryKey: clesListes.potentialites(q),
    queryFn: () => potentialiteService.lister({ q: q || undefined, statut: 'DISPONIBLE', taille: 100 }),
  });
}

export function useEtatMessagerie(listeId: string | undefined) {
  return useQuery({
    queryKey: clesListes.messagerie(listeId ?? ''),
    queryFn: () => messagerieService.etat(listeId!),
    enabled: Boolean(listeId),
    // Les envois sont asynchrones : l'écran doit suivre la file sans que
    // l'utilisateur ait à recharger.
    refetchInterval: 15_000,
  });
}

// ─── Écriture ──────────────────────────────────────────────────────────────

/**
 * Invalide tout ce qu'une écriture sur une liste peut avoir changé.
 *
 * Les tronçons en font partie, et c'est le piège à éviter : ils dépendent de
 * TOUTES les listes du vol. Inscrire quelqu'un à Yaoundé modifie la place
 * disponible à Douala — oublier cette invalidation ferait afficher au
 * secrétaire de Douala un nombre de places qui n'existe plus.
 */
function useInvalider(listeId: string, volId?: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clesListes.detail(listeId) });
    void qc.invalidateQueries({ queryKey: clesListes.avancement(listeId) });
    void qc.invalidateQueries({ queryKey: clesListes.toutes });
    if (volId) void qc.invalidateQueries({ queryKey: clesListes.troncons(volId) });
  };
}

export function useSelectionner(listeId: string, volId?: string) {
  const invalider = useInvalider(listeId, volId);
  return useMutation({
    mutationFn: (vars: {
      selections: { potentialite_id: string; debarquement_ordre: number; priorite?: Priorite }[];
    }) => listeService.selectionner(listeId, vars.selections),
    onSuccess: (r) => {
      invalider();
      if (r.bascules_en_attente.length) {
        toast.warning(
          `${r.inscrits} inscription(s). ${r.bascules_en_attente.length} personne(s) ` +
            `basculée(s) en liste d'attente faute de place.`,
        );
      } else {
        toast.success(`${r.inscrits} inscription(s) enregistrée(s).`);
      }
    },
    onError: (e) => toast.error(messageErreur(e)),
  });
}

export function useDiscriminer(listeId: string, volId?: string) {
  const invalider = useInvalider(listeId, volId);
  return useMutation({
    mutationFn: (vars: {
      ligneId: string;
      nature?: NatureLigne; priorite?: Priorite; rang?: number; motif: string;
    }) => listeService.discriminer(listeId, vars.ligneId, vars),
    onSuccess: () => { invalider(); toast.success('Décision enregistrée.'); },
    onError: (e) => toast.error(messageErreur(e)),
  });
}

export function useReordonner(listeId: string, volId?: string) {
  const invalider = useInvalider(listeId, volId);
  return useMutation({
    mutationFn: (vars: {
      nature: NatureLigne; priorite: Priorite; ordre: string[]; motif: string;
    }) => listeService.reordonner(listeId, vars),
    onSuccess: () => invalider(),
    onError: (e) => toast.error(messageErreur(e)),
  });
}

export function useRetirerLigne(listeId: string, volId?: string) {
  const invalider = useInvalider(listeId, volId);
  return useMutation({
    mutationFn: (ligneId: string) => listeService.retirerLigne(listeId, ligneId),
    onSuccess: () => { invalider(); toast.success('Inscription retirée.'); },
    onError: (e) => toast.error(messageErreur(e)),
  });
}

export function useViser(listeId: string, volId?: string) {
  const invalider = useInvalider(listeId, volId);
  return useMutation({
    mutationFn: (vars: { commentaire?: string; note_delegation?: string }) =>
      circuitService.viser(listeId, vars),
    onSuccess: () => { invalider(); toast.success('Visa apposé.'); },
    onError: (e) => toast.error(messageErreur(e)),
  });
}

export function useRenvoyer(listeId: string, volId?: string) {
  const invalider = useInvalider(listeId, volId);
  return useMutation({
    mutationFn: (vars: { motif: string; etape_retour?: EtapeListe }) =>
      circuitService.renvoyer(listeId, vars),
    onSuccess: () => { invalider(); toast.success('Liste renvoyée.'); },
    onError: (e) => toast.error(messageErreur(e)),
  });
}

export function useCreerPotentialite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Record<string, unknown>) => potentialiteService.creer(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['potentialites'] });
      toast.success('Potentialité enregistrée.');
    },
    onError: (e) => toast.error(messageErreur(e)),
  });
}