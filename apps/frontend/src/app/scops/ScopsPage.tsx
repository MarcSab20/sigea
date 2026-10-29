// apps/frontend/src/app/scops/ScopsPage.tsx
//
// Écran du sous-chef opérations : allouer les quotas et diffuser.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE PARTI PRIS D'ERGONOMIE
// ═══════════════════════════════════════════════════════════════════════════
// Un seul écran, deux colonnes : la file des vols à diffuser à gauche, le
// formulaire d'allocation à droite. Pas de navigation intermédiaire.
//
// C'est délibéré : le SCOPS traite plusieurs vols d'affilée, souvent en début
// de journée. Un parcours « liste → fiche → retour liste » lui coûterait deux
// clics et un rechargement par vol. Ici, il clique un vol, saisit, valide, et
// le vol disparaît de la file.
//
// Le dernier point d'itinéraire N'A PAS de champ de saisie : personne n'y
// embarque. Afficher un champ grisé laisserait croire à un oubli ; ne rien
// afficher du tout laisserait croire à un bug. On affiche donc la ligne, avec
// la mention « destination finale ».

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Plane, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { volService, type Vol } from '@/services/vol.service';

interface SaisieQuota {
  places: string;
  masse: string;
}

function messageErreur(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  return Array.isArray(m) ? m.join(' — ') : (m ?? err.message ?? 'Erreur inattendue');
}

function formaterDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ScopsPage(): React.ReactElement {
  const qc = useQueryClient();
  const [volActif, setVolActif] = useState<Vol | null>(null);
  const [saisies, setSaisies] = useState<Record<string, SaisieQuota>>({});
  const [observation, setObservation] = useState('');

  const { data: vols, isLoading } = useQuery({
    queryKey: ['vols', 'a-diffuser'],
    queryFn: volService.aDiffuser,
    refetchInterval: 60_000,
  });

  const diffusion = useMutation({
    mutationFn: (vars: {
      volId: string;
      quotas: { etape_id: string; quota_places: number; quota_masse_kg: number }[];
    }) => volService.diffuser(vars.volId, vars.quotas, observation || undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vols'] });
      toast.success('Vol diffusé. Les régions concernées peuvent constituer leurs listes.');
      setVolActif(null);
      setSaisies({});
      setObservation('');
    },
    onError: (e) => toast.error(messageErreur(e)),
  });

  function choisirVol(v: Vol): void {
    setVolActif(v);
    // Pré-remplissage à zéro plutôt qu'à vide : le SCOPS doit statuer sur
    // CHAQUE escale, y compris pour n'y allouer aucune place. Un champ vide
    // serait ambigu — pas encore saisi, ou rien à allouer ?
    const initial: Record<string, SaisieQuota> = {};
    for (const p of v.itineraire.slice(0, -1)) {
      initial[p.id] = { places: '0', masse: '0' };
    }
    setSaisies(initial);
  }

  function modifier(etapeId: string, champ: keyof SaisieQuota, valeur: string): void {
    setSaisies((s) => ({ ...s, [etapeId]: { ...s[etapeId], [champ]: valeur } }));
  }

  function envoyer(): void {
    if (!volActif) return;
    const quotas = volActif.itineraire.slice(0, -1).map((p) => ({
      etape_id: p.id,
      quota_places: Number(saisies[p.id]?.places ?? 0),
      quota_masse_kg: Number(saisies[p.id]?.masse ?? 0),
    }));

    const invalide = quotas.find(
      (q) => !Number.isFinite(q.quota_places) || !Number.isFinite(q.quota_masse_kg)
        || q.quota_places < 0 || q.quota_masse_kg < 0,
    );
    if (invalide) {
      toast.error('Les quotas doivent être des nombres positifs.');
      return;
    }
    diffusion.mutate({ volId: volActif.id, quotas });
  }

  // Alerte de cohérence, purement indicative : le serveur plafonne déjà chaque
  // quota à la capacité du vol. Mais le SCOPS doit voir, AVANT de valider, que
  // la somme de ses allocations dépasse l'appareil — c'est légitime quand des
  // passagers débarquent en route, et suspect sinon.
  const totalPlaces = Object.values(saisies).reduce((s, q) => s + Number(q.places || 0), 0);
  const surAllocation = volActif ? totalPlaces > volActif.capacite_places : false;

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Diffusion des vols</h1>
        <p className="text-sm text-slate-500">
          Allouez les places et la masse disponibles à chaque point d'embarquement.
          La diffusion ouvre les listes aux régions militaires concernées.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* ── File des vols à diffuser ── */}
        <aside className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              En attente d'allocation
            </h2>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          )}

          {!isLoading && !vols?.length && (
            <p className="p-4 text-sm italic text-slate-500">
              Aucun vol en attente. Les vols apparaissent ici dès qu'un commandant
              de base ou d'escadron les planifie.
            </p>
          )}

          <ul className="divide-y divide-slate-100">
            {vols?.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => choisirVol(v)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    volActif?.id === v.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    <Plane className="h-4 w-4 text-blue-700" />
                    {v.numero_mission}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formaterDate(v.date_heure)} — {v.immatriculation}
                  </span>
                  <span className="text-xs text-slate-600">
                    {v.itineraire.map((p) => p.base.code_base).join(' → ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Formulaire d'allocation ── */}
        <section className="rounded-lg border border-slate-200 bg-white">
          {!volActif ? (
            <p className="p-8 text-center text-sm italic text-slate-500">
              Sélectionnez un vol pour allouer ses quotas.
            </p>
          ) : (
            <>
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {volActif.numero_mission}
                </h2>
                <p className="text-sm text-slate-500">
                  {volActif.aeronef?.type} {volActif.immatriculation} —
                  capacité {volActif.capacite_places} places,
                  {' '}{Number(volActif.capacite_cargo_kg)} kg —
                  départ {formaterDate(volActif.date_heure)}
                </p>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2">Point</th>
                    <th className="px-5 py-2">Base</th>
                    <th className="px-5 py-2">RMIA</th>
                    <th className="px-5 py-2 w-32">Places</th>
                    <th className="px-5 py-2 w-36">Masse (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {volActif.itineraire.map((p, i) => {
                    const dernier = i === volActif.itineraire.length - 1;
                    return (
                      <tr key={p.id} className={dernier ? 'bg-slate-50' : ''}>
                        <td className="px-5 py-3 font-medium text-slate-700">{p.ordre}</td>
                        <td className="px-5 py-3">
                          {p.base.code_base}
                          <span className="ml-2 text-xs text-slate-500">{p.base.nom}</span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600">
                          {String(p.rmia).replace('_', ' ')}
                        </td>
                        {dernier ? (
                          <td colSpan={2} className="px-5 py-3 text-xs italic text-slate-500">
                            Destination finale — aucun embarquement
                          </td>
                        ) : (
                          <>
                            <td className="px-5 py-2">
                              <input
                                type="number" min={0} inputMode="numeric"
                                value={saisies[p.id]?.places ?? '0'}
                                onChange={(e) => modifier(p.id, 'places', e.target.value)}
                                className="w-24 rounded border border-slate-300 px-2 py-1 text-right"
                              />
                            </td>
                            <td className="px-5 py-2">
                              <input
                                type="number" min={0} step="0.01" inputMode="decimal"
                                value={saisies[p.id]?.masse ?? '0'}
                                onChange={(e) => modifier(p.id, 'masse', e.target.value)}
                                className="w-28 rounded border border-slate-300 px-2 py-1 text-right"
                              />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {surAllocation && (
                <div className="mx-5 mt-4 flex gap-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <p>
                    La somme des places allouées ({totalPlaces}) dépasse la capacité de
                    l'appareil ({volActif.capacite_places}). C'est normal si des passagers
                    débarquent en route et libèrent leur siège ; vérifiez sinon vos quotas.
                  </p>
                </div>
              )}

              <div className="px-5 py-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Observation (facultative)
                </label>
                <textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Contrainte particulière, priorité d'emport…"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setVolActif(null)}
                  className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={envoyer}
                  disabled={diffusion.isPending}
                  className="inline-flex items-center gap-2 rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {diffusion.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                  Diffuser le vol
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}