// apps/frontend/src/app/manifestes/ManifestesPage.tsx
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CETTE PAGE EST RÉÉCRITE
// ═══════════════════════════════════════════════════════════════════════════
// L'ancienne version comptait trois écrans — liste, création, saisie — bâtis
// sur un modèle qui n'existe plus : le manifeste y était créé à la main,
// passait par un statut BROUILLON, et portait cinq blocs de signature.
//
// Depuis la directive, le manifeste est l'EXTRAIT de la liste hiérarchisée,
// émis automatiquement à l'arrêté du commandant de base. Personne ne le
// saisit. Il ne reste que deux écrans : consulter, et — pour le seul
// commandant de bord — discriminer puis viser.
//
// C'est ce décalage qui provoquait la page blanche : `SaisieManifestePage`
// lisait `manifeste.id` sur une réponse dont la forme avait changé.

import React, { useState } from 'react';
import { Routes, Route, useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import {
  Loader2, FileText, Users, Package, UserMinus, RotateCcw, Send, CheckCircle2, Plane,
} from 'lucide-react';
import { RoleUtilisateur } from '@sigea/shared-types';
import { useAuthStore } from '@/stores/auth.store';
import { ouvrirDocument } from '@/lib/api';
import {
  manifesteService,
  type ManifesteResume, type PassagerManifeste, type ManifesteDetail,
} from '@/services/manifeste.service';

function messageErreur(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  return Array.isArray(m) ? m.join(' — ') : (m ?? err.message ?? 'Erreur inattendue');
}

const LIBELLE_STATUT: Record<string, { texte: string; classe: string }> = {
  EMIS:      { texte: 'Émis — en attente du visa du bord', classe: 'bg-amber-100 text-amber-800' },
  DEFINITIF: { texte: 'Définitif',                          classe: 'bg-emerald-100 text-emerald-800' },
  ANNULE:    { texte: 'Annulé',                             classe: 'bg-red-100 text-red-800' },
};

export default function ManifestesPage(): React.ReactElement {
  return (
    <Routes>
      <Route index element={<ListeDesManifestes />} />
      <Route path=":id" element={<DetailManifeste />} />
    </Routes>
  );
}

// ─── Inventaire ────────────────────────────────────────────────────────────

function ListeDesManifestes(): React.ReactElement {
  const { data, isLoading, error } = useQuery({
    queryKey: ['manifestes'],
    queryFn: manifesteService.lister,
  });

  return (
    <div className="p-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-900">Manifestes</h1>
        <p className="text-sm text-slate-500">
          Chaque manifeste est l'extrait d'une liste hiérarchisée, émis à l'arrêté
          du commandant de base. Il ne porte qu'un visa : celui du commandant de bord.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>Chargement impossible.</strong> {messageErreur(error)}
        </div>
      )}

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </p>
      )}

      {!isLoading && !data?.length && (
        <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm italic text-slate-400">
          Aucun manifeste dans votre périmètre. Ils apparaissent dès qu'un commandant
          de base arrête une liste.
        </p>
      )}

      <ul className="space-y-2">
        {data?.map((m: ManifesteResume) => {
          const s = LIBELLE_STATUT[m.statut] ?? { texte: m.statut, classe: 'bg-slate-100' };
          return (
            <li key={m.id}>
              <Link
                to={`/manifestes/${m.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:shadow-sm"
              >
                <div>
                  <p className="flex items-center gap-2 font-medium text-slate-900">
                    <Plane className="h-4 w-4 text-blue-700" />
                    {m.numero_manifeste}
                    <span className={`rounded px-2 py-0.5 text-xs font-normal ${s.classe}`}>
                      {s.texte}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {m.vol.numero_mission} — escale {m.etape.ordre} — {m.base.code_base}
                    {' · '}{new Date(m.vol.date_heure).toLocaleString('fr-FR',
                      { dateStyle: 'short', timeStyle: 'short' })}
                    {' · '}{m._count.passagers} passager(s)
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Détail ────────────────────────────────────────────────────────────────

function DetailManifeste(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['manifestes', id],
    queryFn: () => manifesteService.consulter(id!),
    enabled: Boolean(id),
  });

  const rafraichir = (): void => {
    void qc.invalidateQueries({ queryKey: ['manifestes', id] });
    void qc.invalidateQueries({ queryKey: ['manifestes'] });
  };

  const retirer = useMutation({
    mutationFn: (v: { passagerId: string; motif: string }) =>
      manifesteService.retirerPassager(id!, v.passagerId, v.motif),
    onSuccess: () => { rafraichir(); toast.success('Passager retiré.'); },
    onError: (e) => toast.error(messageErreur(e)),
  });

  const reintegrer = useMutation({
    mutationFn: (passagerId: string) => manifesteService.reintegrerPassager(id!, passagerId),
    onSuccess: () => { rafraichir(); toast.success('Passager réintégré.'); },
    onError: (e) => toast.error(messageErreur(e)),
  });

  const viser = useMutation({
    mutationFn: (commentaire?: string) =>
      manifesteService.viser(data!.liste!.id, commentaire),
    onSuccess: () => {
      rafraichir();
      toast.success('Visa apposé. Le manifeste est définitif.');
    },
    onError: (e) => toast.error(messageErreur(e)),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement du manifeste…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <button type="button" onClick={() => navigate('/manifestes')}
                className="text-sm text-blue-700 hover:underline">
          ← Tous les manifestes
        </button>
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>Manifeste indisponible.</strong>{' '}
          {error ? messageErreur(error) : 'Réponse inattendue du serveur.'}
        </div>
      </div>
    );
  }

  const { manifeste, tableaux, passagers_retires, materiels, equipages, totaux } = data;

  /**
   * Le commandant de bord de CE vol, et lui seul, peut discriminer.
   *
   * Deux conditions : le rôle, et l'identité. Le serveur applique la même
   * règle ; ce test ne fait que masquer des commandes inutiles. Ne relâchez
   * jamais l'un en comptant sur l'autre.
   */
  const estLeCombord =
    user?.role === RoleUtilisateur.COMBORD && manifeste.vol.combord_id === user.id;
  const modifiable = estLeCombord && manifeste.statut === 'EMIS';

  const statut = LIBELLE_STATUT[manifeste.statut] ?? { texte: manifeste.statut, classe: 'bg-slate-100' };

  function demanderMotif(invite: string): string | null {
    const m = window.prompt(invite);
    if (m === null) return null;
    if (m.trim().length < 3) {
      window.alert("Un motif d'au moins 3 caractères est requis.");
      return null;
    }
    return m.trim();
  }

  return (
    <div className="p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/manifestes" className="text-sm text-blue-700 hover:underline">
            ← Tous les manifestes
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold text-slate-900">
            {manifeste.numero}
            <span className={`rounded px-2 py-0.5 text-sm font-normal ${statut.classe}`}>
              {statut.texte}
            </span>
            {manifeste.flag_sensible && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-sm font-medium text-red-800">
                SENSIBLE
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500">
            {manifeste.vol.numero_mission} — {manifeste.vol.immatriculation} — escale{' '}
            {manifeste.point.ordre} ({manifeste.base.code_base})
            {' · '}
            {new Date(manifeste.vol.date_heure).toLocaleString('fr-FR',
              { dateStyle: 'full', timeStyle: 'short' })}
          </p>
          <p className="text-sm text-slate-500">
            Route : {manifeste.vol.itineraire.map((p) => p.base.code_base).join(' → ')}
            {' · '}CDB : {manifeste.vol.combord_grade} {manifeste.vol.combord_nom}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void ouvrirDocument(`/pdf/manifeste/${manifeste.id}`)}
          className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <FileText className="h-4 w-4" /> Imprimer le manifeste
        </button>
      </header>

      {manifeste.statut === 'DEFINITIF' && (
        <div className="mb-5 flex gap-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>
            <strong>Manifeste définitif.</strong> Visa apposé le{' '}
            {manifeste.definitif_le
              ? new Date(manifeste.definitif_le).toLocaleString('fr-FR',
                  { dateStyle: 'short', timeStyle: 'short' })
              : ''}
            . Le document est opposable et ne peut plus être modifié.
          </p>
        </div>
      )}

      {estLeCombord && manifeste.statut === 'EMIS' && (
        <div className="mb-5 flex gap-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Send className="h-5 w-5 shrink-0" />
          <p>
            <strong>Le manifeste est entre vos mains.</strong> Retirez s'il y a lieu
            les passagers qui ne montent pas, puis apposez votre visa. La liste
            d'attente ne vous est pas communiquée : seuls les retenus figurent ici.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <span><strong className="text-slate-900">{totaux.passagers}</strong> passager(s)</span>
        <span><strong className="text-slate-900">{totaux.masse_bagages_kg}</strong> kg de bagages</span>
        <span><strong className="text-slate-900">{totaux.masse_fret_kg}</strong> kg de fret</span>
        <span className="text-slate-600">
          Masse totale : {Number((totaux.masse_bagages_kg + totaux.masse_fret_kg).toFixed(2))} kg
        </span>
      </div>

      {/* ── Passagers, par priorité ── */}
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Users className="h-5 w-5" /> Passagers embarqués
      </h2>

      {tableaux.map((t) => (
        <section key={t.priorite} className="mb-4 rounded-lg border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
            <h3 className="text-sm font-semibold text-slate-800">
              {t.libelle}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                {t.lignes.length}
              </span>
            </h3>
          </header>

          {!t.lignes.length ? (
            <p className="px-4 py-2 text-sm italic text-slate-400">Aucun passager à cette priorité.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 w-12">Rang</th>
                  <th className="px-4 py-2">Identité</th>
                  <th className="px-4 py-2">Unité</th>
                  <th className="px-4 py-2">Destination</th>
                  <th className="px-4 py-2 text-center">Bag. / kg</th>
                  {modifiable && <th className="px-4 py-2 w-24 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {t.lignes.map((p: PassagerManifeste) => {
                  const imposee = p.origine !== 'SAISIE';
                  return (
                    <tr key={p.id} className={imposee ? 'bg-amber-50/60' : ''}>
                      <td className="px-4 py-2 font-medium text-slate-700">{p.rang}</td>
                      <td className="px-4 py-2">
                        <span className="font-medium text-slate-900">
                          {p.grade ? `${p.grade} ` : ''}{p.nom} {p.prenom}
                        </span>
                        {p.matricule && (
                          <span className="ml-2 text-xs text-slate-500">{p.matricule}</span>
                        )}
                        {imposee && (
                          <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                            Imposé {p.origine}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{p.unite ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{p.destination}</td>
                      <td className="px-4 py-2 text-center text-slate-600">
                        {p.nb_bagages} / {Number(p.masse_bagages_kg)}
                      </td>
                      {modifiable && (
                        <td className="px-4 py-2 text-right">
                          {imposee ? (
                            <span className="text-xs italic text-amber-800">Hors discrimination</span>
                          ) : (
                            <button
                              type="button"
                              title="Retirer du manifeste"
                              onClick={() => {
                                const motif = demanderMotif(
                                  `Motif du retrait de ${p.nom} ${p.prenom} :`,
                                );
                                if (motif) retirer.mutate({ passagerId: p.id, motif });
                              }}
                              className="rounded p-1 text-red-600 hover:bg-red-50"
                            >
                              <UserMinus className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {/* ── Retirés : conservés pour tracer la décision ── */}
      {passagers_retires.length > 0 && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-slate-50">
          <header className="border-b border-slate-200 px-4 py-2">
            <h3 className="text-sm font-semibold text-slate-800">
              Retirés par le commandant de bord ({passagers_retires.length})
            </h3>
            <p className="text-xs text-slate-500">
              Conservés pour tracer la décision. N'apparaissent pas sur le document imprimé.
            </p>
          </header>
          <ul className="divide-y divide-slate-200">
            {passagers_retires.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  <span className="font-medium text-slate-700 line-through">
                    {p.grade ? `${p.grade} ` : ''}{p.nom} {p.prenom}
                  </span>
                  {p.motif_retrait && (
                    <span className="ml-2 text-xs italic text-slate-500">{p.motif_retrait}</span>
                  )}
                </span>
                {modifiable && (
                  <button
                    type="button"
                    onClick={() => reintegrer.mutate(p.id)}
                    className="inline-flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Réintégrer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Fret ── */}
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Package className="h-5 w-5" /> Fret
      </h2>
      <section className="mb-6 rounded-lg border border-slate-200 bg-white">
        {!materiels.length ? (
          <p className="px-4 py-3 text-sm italic text-slate-400">Aucun fret déclaré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Désignation</th>
                <th className="px-4 py-2">Propriétaire</th>
                <th className="px-4 py-2">Destination</th>
                <th className="px-4 py-2 text-center">Poids (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {materiels.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2">
                    {m.designation}
                    {m.classe_iata && (
                      <span className="ml-2 text-xs font-bold text-red-700">
                        IATA {m.classe_iata}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{m.proprietaire}</td>
                  <td className="px-4 py-2 text-slate-600">{m.destination}</td>
                  <td className="px-4 py-2 text-center">{Number(m.poids_kg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Équipage ── */}
      {equipages.length > 0 && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Équipage
          </h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {equipages.map((e, i) => (
              <li key={e.id ?? i}>{e.grade} {e.nom} {e.prenom} — {e.fonction}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Visa ── */}
      {modifiable && data.liste && (
        <section className="sticky bottom-0 -mx-6 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-end gap-3">
            <p className="mr-auto text-xs text-slate-500">
              Votre visa est la seule signature du manifeste. Une fois apposé,
              le document devient définitif.
            </p>
            <button
              type="button"
              onClick={() => {
                const commentaire = window.prompt('Commentaire (facultatif) :') ?? undefined;
                viser.mutate(commentaire || undefined);
              }}
              disabled={viser.isPending}
              className="inline-flex items-center gap-2 rounded bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {viser.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              Apposer mon visa
            </button>
          </div>
        </section>
      )}
    </div>
  );
}