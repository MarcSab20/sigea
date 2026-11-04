// apps/frontend/src/app/potentialites/PotentialitesPage.tsx
//
// Vivier du secrétaire de l'Adjoint Air.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE PARTI PRIS : UN TABLEAU ORDONNÉ PAR JOUR DE VOL
// ═══════════════════════════════════════════════════════════════════════════
// Le secrétaire enregistre au fil de l'eau les demandeurs qui se présentent,
// hors de tout vol. Ce vivier n'a d'intérêt que s'il est retrouvable le jour
// venu : d'où le regroupement par jour souhaité, et non par ordre de saisie.
//
// Quand un vol est diffusé, le secrétaire arrive ici avec une date et un
// itinéraire en tête. Les trois filtres du haut — période, départ, arrivée —
// sont exactement ceux-là. Les demandeurs sans date souhaitée restent affichés
// par défaut : ne pas avoir précisé un jour ne doit pas écarter quelqu'un
// d'un vol, c'est une information qu'on ne lui a pas réclamée.

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import {
  UserPlus, Search, Paperclip, Download, Trash2, X, Archive, Loader2, CalendarDays,
} from 'lucide-react';
import { CategoriePassager, Priorite, NaturePiece } from '@sigea/shared-types';
import { referentielService, type BaseDB } from '@/services/referentiel.service';
import {
  potentialiteService, LIBELLE_NATURE,
  type Potentialite, type FiltrePotentialite, type PieceJointe,
} from '@/services/potentialite.service';
import { useAuthStore } from '@/stores/auth.store';

function messageErreur(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  return Array.isArray(m) ? m.join(' — ') : (m ?? err.message ?? 'Erreur inattendue');
}

const CHAMP = 'w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none';

/** Jour en toutes lettres, pour les en-têtes de groupe. */
function jourLisible(iso: string | null): string {
  if (!iso) return 'Sans date souhaitée';
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function PotentialitesPage(): React.ReactElement {
  const qc = useQueryClient();
  const [filtre, setFiltre] = useState<FiltrePotentialite>({ statut: 'DISPONIBLE', taille: 200 });
  const [formulaire, setFormulaire] = useState(false);
  const [fiche, setFiche] = useState<string | null>(null);

  const { data: bases } = useQuery({ queryKey: ['bases'], queryFn: referentielService.bases });
  const { data, isLoading } = useQuery({
    queryKey: ['potentialites', filtre],
    queryFn: () => potentialiteService.lister(filtre),
  });

  /**
   * Regroupement par jour souhaité.
   *
   * Fait ici et non côté serveur : le tri l'est déjà, et grouper en SQL
   * imposerait une requête par jour ou un post-traitement de toute façon. À
   * l'échelle d'un vivier régional — quelques centaines de lignes — c'est
   * sans effet mesurable.
   */
  const groupes = useMemo(() => {
    const parJour = new Map<string, Potentialite[]>();
    for (const p of data?.elements ?? []) {
      const cle = p.date_vol_souhaitee ? p.date_vol_souhaitee.slice(0, 10) : '';
      if (!parJour.has(cle)) parJour.set(cle, []);
      parJour.get(cle)!.push(p);
    }
    // Les sans-date en dernier : ce sont les moins actionnables.
    return [...parJour.entries()].sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return a < b ? -1 : 1;
    });
  }, [data]);

  const archiver = useMutation({
    mutationFn: (vars: { id: string; motif: string }) =>
      potentialiteService.archiver(vars.id, vars.motif),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['potentialites'] });
      toast.success('Potentialité archivée.');
    },
    onError: (e) => toast.error(messageErreur(e)),
  });

  return (
    <div className="p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Liste des potentialités</h1>
          <p className="text-sm text-slate-500">
            Enregistrez les demandeurs au fil de leur présentation. Dès qu'un vol est
            diffusé, vous puiserez ici les noms de la liste hiérarchisée.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormulaire(true)}
          className="inline-flex items-center gap-2 rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          <UserPlus className="h-4 w-4" /> Enregistrer un demandeur
        </button>
      </header>

      {/* ── Filtres de rapprochement avec un vol ── */}
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Recherche
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={filtre.q ?? ''}
                onChange={(e) => setFiltre((f) => ({ ...f, q: e.target.value || undefined }))}
                placeholder="Nom, prénom, matricule, CNI, unité…"
                className={`${CHAMP} pl-9`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Du
            </label>
            <input
              type="date" className={`${CHAMP} mt-1`}
              value={filtre.date_debut?.slice(0, 10) ?? ''}
              onChange={(e) => setFiltre((f) => ({
                ...f, date_debut: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined,
              }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Au
            </label>
            <input
              type="date" className={`${CHAMP} mt-1`}
              value={filtre.date_fin?.slice(0, 10) ?? ''}
              onChange={(e) => setFiltre((f) => ({
                ...f, date_fin: e.target.value ? `${e.target.value}T23:59:59.000Z` : undefined,
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Départ
            </label>
            <select
              className={`${CHAMP} mt-1`}
              value={filtre.base_depart_id ?? ''}
              onChange={(e) => setFiltre((f) => ({ ...f, base_depart_id: e.target.value || undefined }))}
            >
              <option value="">Toutes</option>
              {bases?.map((b: BaseDB) => (
                <option key={b.id} value={b.id}>{b.code_base}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <label className="flex items-center gap-2">
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={filtre.base_arrivee_id ?? ''}
              onChange={(e) => setFiltre((f) => ({ ...f, base_arrivee_id: e.target.value || undefined }))}
            >
              <option value="">Destination : toutes</option>
              {bases?.map((b: BaseDB) => (
                <option key={b.id} value={b.id}>{b.code_base}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filtre.inclure_sans_date !== '0'}
              onChange={(e) => setFiltre((f) => ({
                ...f, inclure_sans_date: e.target.checked ? '1' : '0',
              }))}
            />
            Inclure les demandeurs sans date souhaitée
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filtre.statut !== 'DISPONIBLE'}
              onChange={(e) => setFiltre((f) => ({
                ...f, statut: e.target.checked ? undefined : 'DISPONIBLE',
              }))}
            />
            Afficher aussi les retenus et les archivés
          </label>
          <span className="ml-auto font-medium text-slate-700">
            {data?.total ?? 0} demandeur(s)
          </span>
        </div>
      </section>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement du vivier…
        </p>
      )}

      {!isLoading && !groupes.length && (
        <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm italic text-slate-400">
          Aucun demandeur ne correspond à ces critères.
        </p>
      )}

      {groupes.map(([jour, lignes]) => (
        <section key={jour || 'sans-date'} className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
            <CalendarDays className="h-4 w-4" />
            {jourLisible(lignes[0].date_vol_souhaitee)}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal">
              {lignes.length}
            </span>
          </h2>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Identité</th>
                  <th className="px-4 py-2">Unité</th>
                  <th className="px-4 py-2">Trajet souhaité</th>
                  <th className="px-4 py-2">Catégorie</th>
                  <th className="px-4 py-2 text-center">Prio</th>
                  <th className="px-4 py-2 text-center">Bag./kg</th>
                  <th className="px-4 py-2 text-center">Pièces</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lignes.map((p) => (
                  <tr key={p.id} className={p.statut !== 'DISPONIBLE' ? 'bg-slate-50 text-slate-500' : ''}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-900">
                        {p.grade ? `${p.grade} ` : ''}{p.nom} {p.prenom}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {p.matricule ?? p.cni ?? '—'} · {p.telephone}
                      </span>
                    </td>
                    <td className="px-4 py-2">{p.unite ?? '—'}</td>
                    <td className="px-4 py-2">
                      {p.base_depart?.code_base ?? '?'} → {p.base_arrivee?.code_base ?? '?'}
                    </td>
                    <td className="px-4 py-2">{p.categorie}</td>
                    <td className="px-4 py-2 text-center font-medium text-blue-800">
                      {p.priorite_proposee}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {p.nb_bagages} / {Number(p.masse_bagages_kg)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setFiche(p.id)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {p._count?.pieces ?? 0}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {p.statut === 'DISPONIBLE' && (
                        <button
                          type="button"
                          title="Archiver"
                          onClick={() => {
                            const motif = window.prompt(
                              `Motif de l'archivage de ${p.nom} ${p.prenom} :`,
                            );
                            if (motif && motif.trim().length >= 3) {
                              archiver.mutate({ id: p.id, motif: motif.trim() });
                            }
                          }}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                      {p.statut === 'RETENUE' && (
                        <span className="text-xs italic text-blue-700">Sur une liste</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {formulaire && <FormulaireDemandeur bases={bases ?? []} onFermer={() => setFormulaire(false)} />}
      {fiche && <PanneauPieces potentialiteId={fiche} onFermer={() => setFiche(null)} />}
    </div>
  );
}

// ─── Formulaire d'enregistrement ───────────────────────────────────────────

function FormulaireDemandeur(
  { bases, onFermer }: { bases: BaseDB[]; onFermer: () => void },
): React.ReactElement {
  const qc = useQueryClient();
  const [f, setF] = useState<Record<string, string>>({
    categorie: CategoriePassager.MISSION, priorite_proposee: Priorite.P4,
    nb_bagages: '0', masse_bagages_kg: '0',
  });

  const creation = useMutation({
    mutationFn: (dto: Record<string, unknown>) => potentialiteService.creer(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['potentialites'] });
      toast.success('Demandeur enregistré. Vous pouvez joindre ses pièces.');
      onFermer();
    },
    onError: (e) => toast.error(messageErreur(e)),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const complet = f.nom?.length > 1 && f.prenom?.length > 1 && f.telephone?.length > 7;
  const { user } = useAuthStore();  
  function envoyer(): void {
    creation.mutate({
      nom: f.nom, prenom: f.prenom,
      grade: f.grade || undefined, matricule: f.matricule || undefined,
      cni: f.cni || undefined, unite: f.unite || undefined,
      telephone: f.telephone,
      categorie: f.categorie,
      priorite_proposee: f.priorite_proposee,
      date_vol_souhaitee: f.date_vol_souhaitee
        ? `${f.date_vol_souhaitee}T00:00:00.000Z` : undefined,
      base_depart_id:  f.base_depart_id  || undefined,
      base_arrivee_id: f.base_arrivee_id || undefined,
      motif: f.motif || undefined,
      ref_autorisation: f.ref_autorisation || undefined,
      nb_bagages: Number(f.nb_bagages || 0),
      masse_bagages_kg: Number(f.masse_bagages_kg || 0),
      contact_urgence_nom: f.contact_urgence_nom || undefined,
      contact_urgence_tel: f.contact_urgence_tel || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20">
      <div className="flex w-full max-w-2xl flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nouveau demandeur</h2>
            <p className="text-sm text-slate-500">
              L'enregistrement n'emporte aucun droit à embarquer.
            </p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Nom" obligatoire><input className={CHAMP} onChange={set('nom')} /></Champ>
            <Champ label="Prénom" obligatoire><input className={CHAMP} onChange={set('prenom')} /></Champ>
            <Champ label="Grade"><input className={CHAMP} onChange={set('grade')} /></Champ>
            <Champ label="Unité"><input className={CHAMP} onChange={set('unite')} /></Champ>
            <Champ label="Matricule"><input className={CHAMP} onChange={set('matricule')} /></Champ>
            <Champ label="CNI"><input className={CHAMP} onChange={set('cni')} /></Champ>
            <Champ label="Téléphone" obligatoire
                   aide="Seul canal d'information du voyageur le jour du vol.">
              <input className={CHAMP} onChange={set('telephone')} placeholder="677 12 34 56" />
            </Champ>
            <Champ label="Catégorie">
              <select className={CHAMP} value={f.categorie} onChange={set('categorie')}>
                {Object.values(CategoriePassager).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Champ>
          </div>

          <fieldset className="rounded border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Besoin de transport
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Champ label="Jour souhaité">
                <input type="date" className={CHAMP} onChange={set('date_vol_souhaitee')} />
              </Champ>
              <Champ label="Départ" aide="Bases de votre région militaire uniquement.">
                <select className={CHAMP} onChange={set('base_depart_id')}>
                  <option value="">—</option>
                  {bases
                    .filter((b) => b.rmia === user?.rmia)
                    .map((b) => <option key={b.id} value={b.id}>{b.code_base}</option>)}
                </select>
              </Champ>
              <Champ label="Destination">
                <select className={CHAMP} onChange={set('base_arrivee_id')}>
                  <option value="">—</option>
                  {bases.map((b) => <option key={b.id} value={b.id}>{b.code_base}</option>)}
                </select>
              </Champ>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Ces trois informations permettent de retrouver ce demandeur le jour
              où un vol correspondant est diffusé.
            </p>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-4">
            <Champ label="Priorité proposée">
              <select className={CHAMP} value={f.priorite_proposee} onChange={set('priorite_proposee')}>
                {Object.values(Priorite).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Champ>
            <Champ label="Bagages"><input type="number" min={0} className={CHAMP} value={f.nb_bagages} onChange={set('nb_bagages')} /></Champ>
            <Champ label="Masse (kg)"><input type="number" min={0} step="0.1" className={CHAMP} value={f.masse_bagages_kg} onChange={set('masse_bagages_kg')} /></Champ>
            <Champ label="Réf. autorisation"><input className={CHAMP} onChange={set('ref_autorisation')} /></Champ>
          </div>

          <Champ label="Motif du déplacement">
            <input className={CHAMP} onChange={set('motif')} />
          </Champ>

          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Contact d'urgence"><input className={CHAMP} onChange={set('contact_urgence_nom')} /></Champ>
            <Champ label="Téléphone du contact"><input className={CHAMP} onChange={set('contact_urgence_tel')} /></Champ>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onFermer}
                  className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Annuler
          </button>
          <button
            type="button" onClick={envoyer} disabled={!complet || creation.isPending}
            className="inline-flex items-center gap-2 rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {creation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <UserPlus className="h-4 w-4" />}
            Enregistrer
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Panneau des pièces justificatives ─────────────────────────────────────

function PanneauPieces(
  { potentialiteId, onFermer }: { potentialiteId: string; onFermer: () => void },
): React.ReactElement {
  const qc = useQueryClient();
  const [nature, setNature] = useState<NaturePiece>(NaturePiece.ORDRE_MISSION);
  const [envoi, setEnvoi] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['potentialite', potentialiteId],
    queryFn: () => potentialiteService.consulter(potentialiteId),
  });

  async function deposer(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setEnvoi(true);
    try {
      await potentialiteService.deposerPiece(potentialiteId, nature, fichier);
      void qc.invalidateQueries({ queryKey: ['potentialite', potentialiteId] });
      void qc.invalidateQueries({ queryKey: ['potentialites'] });
      toast.success('Pièce déposée.');
    } catch (err) {
      toast.error(messageErreur(err));
    } finally {
      setEnvoi(false);
      // Réinitialisation : sans cela, redéposer le même fichier après une
      // erreur ne déclencherait aucun évènement, la valeur n'ayant pas changé.
      e.target.value = '';
    }
  }

  const supprimer = useMutation({
    mutationFn: (id: string) => potentialiteService.supprimerPiece(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['potentialite', potentialiteId] });
      void qc.invalidateQueries({ queryKey: ['potentialites'] });
      toast.success('Pièce retirée.');
    },
    onError: (e) => toast.error(messageErreur(e)),
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20">
      <div className="flex w-full max-w-xl flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Pièces justificatives</h2>
            {data && (
              <p className="text-sm text-slate-500">
                {data.grade ? `${data.grade} ` : ''}{data.nom} {data.prenom}
              </p>
            )}
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Nature de la pièce
              </label>
              <select
                className={`${CHAMP} mt-1`} value={nature}
                onChange={(e) => setNature(e.target.value as NaturePiece)}
              >
                {Object.values(NaturePiece).map((n) => (
                  <option key={n} value={n}>{LIBELLE_NATURE[n] ?? n}</option>
                ))}
              </select>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
              {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              Joindre
              <input
                type="file" className="hidden" disabled={envoi}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff"
                onChange={(e) => void deposer(e)}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            PDF ou image, 8 Mo au maximum. Les autorités de discrimination
            pourront consulter ces pièces avant de statuer.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </p>
          )}

          {!isLoading && !data?.pieces?.length && (
            <p className="py-6 text-center text-sm italic text-slate-400">
              Aucune pièce jointe pour l'instant.
            </p>
          )}

          <ul className="divide-y divide-slate-100">
            {data?.pieces?.map((piece: PieceJointe) => (
              <li key={piece.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{piece.nom_fichier}</p>
                  <p className="text-xs text-slate-500">
                    {LIBELLE_NATURE[piece.nature] ?? piece.nature}
                    {' · '}{(piece.taille_octets / 1024).toFixed(0)} ko
                    {' · '}{new Date(piece.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                  <p className="font-mono text-[10px] tracking-wider text-slate-400">
                    {piece.sha256.slice(0, 16).toUpperCase()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button" title="Télécharger"
                    onClick={() => void potentialiteService.ouvrirPiece(piece)}
                    className="rounded p-2 text-blue-700 hover:bg-blue-50"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button" title="Retirer"
                    onClick={() => {
                      if (window.confirm(`Retirer « ${piece.nom_fichier} » ?`)) {
                        supprimer.mutate(piece.id);
                      }
                    }}
                    className="rounded p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Champ(
  { label, obligatoire, aide, children }: {
    label: string; obligatoire?: boolean; aide?: string; children: React.ReactNode;
  },
): React.ReactElement {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}{obligatoire && <span className="ml-1 text-red-600">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {aide && <p className="mt-1 text-xs text-slate-500">{aide}</p>}
    </div>
  );
}