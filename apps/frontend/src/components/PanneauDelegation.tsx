// apps/frontend/src/components/PanneauDelegation.tsx
//
// Désignation d'un délégataire par le commandant de base.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CET ÉCRAN DOIT FAIRE COMPRENDRE
// ═══════════════════════════════════════════════════════════════════════════
// Déléguer n'est pas se décharger. La signature portée sur le document restera
// celle du commandant de base, et c'est lui qui en répond. Le délégataire
// n'apparaît que dans une note d'archivage, non imprimée.
//
// Ce point est écrit noir sur blanc dans le panneau, avant le bouton. Un
// commandant qui délègue sans l'avoir compris signera des listes qu'il n'a pas
// lues en croyant avoir transmis sa responsabilité.
//
// La désignation est possible AVANT que la liste n'atteigne son étape : c'est
// même le cas nominal — on délègue parce qu'on part, donc par avance.

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { UserCheck, UserX, Loader2, Info } from 'lucide-react';
import { delegationService } from '@/services/delegation.service';

function messageErreur(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  return Array.isArray(m) ? m.join(' — ') : (m ?? err.message ?? 'Erreur inattendue');
}

const ROLE_LISIBLE: Record<string, string> = {
  comgmo:     'COMGMO',
  comsecbase: 'Commandant en second',
};

export default function PanneauDelegation(
  { listeId }: { listeId: string },
): React.ReactElement {
  const qc = useQueryClient();
  const [choix, setChoix] = useState('');
  const [motif, setMotif] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['delegation', listeId],
    queryFn: () => delegationService.candidats(listeId),
  });

  const rafraichir = (): void => {
    void qc.invalidateQueries({ queryKey: ['delegation', listeId] });
    void qc.invalidateQueries({ queryKey: ['listes', listeId] });
  };

  const deleguer = useMutation({
    mutationFn: () => delegationService.deleguer(listeId, choix, motif.trim()),
    onSuccess: () => {
      rafraichir();
      setChoix(''); setMotif('');
      toast.success('Délégation enregistrée.');
    },
    onError: (e) => toast.error(messageErreur(e)),
  });

  const revoquer = useMutation({
    mutationFn: () => delegationService.revoquer(listeId),
    onSuccess: () => { rafraichir(); toast.success('Délégation révoquée.'); },
    onError: (e) => toast.error(messageErreur(e)),
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </p>
    );
  }

  const enCours = data?.delegation;

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
        <UserCheck className="h-4 w-4" /> Délégation de la discrimination
      </h3>

      {enCours ? (
        <div className="mt-3">
          <p className="text-sm text-slate-800">
            Discrimination confiée à{' '}
            <strong>
              {enCours.delegue_a.grade} {enCours.delegue_a.nom} {enCours.delegue_a.prenom}
            </strong>{' '}
            <span className="text-slate-500">
              ({ROLE_LISIBLE[enCours.delegue_a.role] ?? enCours.delegue_a.role})
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Le{' '}
            {enCours.delegue_le
              ? new Date(enCours.delegue_le).toLocaleString('fr-FR',
                  { dateStyle: 'short', timeStyle: 'short' })
              : ''}
            {enCours.motif ? ` — ${enCours.motif}` : ''}
          </p>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Révoquer cette délégation ?')) revoquer.mutate();
            }}
            disabled={revoquer.isPending}
            className="mt-3 inline-flex items-center gap-2 rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {revoquer.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <UserX className="h-4 w-4" />}
            Révoquer
          </button>
          <p className="mt-2 text-xs text-slate-500">
            La révocation vaut pour l'avenir. Si le visa est déjà apposé, elle
            est sans effet : un acte signé ne se défait pas.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {!data?.candidats?.length ? (
            <p className="text-sm italic text-slate-500">
              Aucun COMGMO ni commandant en second actif sur votre base. La
              discrimination vous revient.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Officier désigné
                  </label>
                  <select
                    value={choix}
                    onChange={(e) => setChoix(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Sélectionner —</option>
                    {data.candidats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.grade} {c.nom} {c.prenom} — {ROLE_LISIBLE[c.role] ?? c.role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Motif (10 caractères minimum)
                  </label>
                  <input
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder="Déplacement, indisponibilité…"
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <Info className="h-4 w-4 shrink-0" />
                <p>
                  La signature portée sur le document restera la vôtre. Le nom du
                  délégataire figurera dans une note de délégation conservée pour
                  l'archivage, non imprimée. Vous demeurez responsable de ce qui
                  est signé en votre nom.
                </p>
              </div>

              <button
                type="button"
                onClick={() => deleguer.mutate()}
                disabled={!choix || motif.trim().length < 10 || deleguer.isPending}
                className="inline-flex items-center gap-2 rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {deleguer.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <UserCheck className="h-4 w-4" />}
                Désigner
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}