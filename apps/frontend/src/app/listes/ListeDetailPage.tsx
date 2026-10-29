// apps/frontend/src/app/listes/ListeDetailPage.tsx
//
// Écran unique de travail sur une liste, quel que soit le rôle.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI UN SEUL ÉCRAN, ET NON UN PAR RÔLE
// ═══════════════════════════════════════════════════════════════════════════
// Le secrétaire, l'Adjoint Air, le COMRMIA et le commandant de base regardent
// EXACTEMENT le même document — six tableaux de priorité, une liste d'attente,
// une frise de visas. Ce qui change entre eux n'est pas ce qu'ils voient mais
// ce qu'ils peuvent faire.
//
// Quatre écrans distincts auraient dérivé l'un de l'autre à la première
// évolution, et l'on aurait fini par ne plus présenter les mêmes colonnes au
// COMRMIA qu'à l'Adjoint Air — ce qui, sur un document signé, est une faute.
//
// Les capacités d'action sont donc dérivées de `avancement.etape_courante`
// croisée avec le rôle, en un seul endroit, juste en dessous. Et elles ne font
// que MASQUER des commandes : le serveur refuse de toute façon une action hors
// tour. Ne relâchez jamais l'un en comptant sur l'autre.

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, Users, UserPlus, FileText, Send, Undo2, AlertTriangle, MessageSquare,
} from 'lucide-react';
import { EtapeListe, NatureLigne, Priorite, RoleUtilisateur } from '@sigea/shared-types';
import { useAuthStore } from '@/stores/auth.store';
import {
  useListe, useAvancement, useTroncons, useDiscriminer, useReordonner,
  useRetirerLigne, useViser, useRenvoyer, useEtatMessagerie,
} from '@/hooks/useListes';
import { useQuery } from '@tanstack/react-query';
import { volService } from '@/services/vol.service';
import TableauPriorite from '../../components/TableauPriorite';
import BlocsVisas from '../../components/BlocsVisas';
import TronconsBarre from '../../components/TronconsBarre';
import PanneauSelection from '../../components/PanneauSelection';
import type { LigneListe } from '@/services/liste.service';

/** Rôles autorisés à discriminer, par étape. */
const ROLE_PAR_ETAPE: Record<string, string[]> = {
  [EtapeListe.SEC_ADJ_AIR]: [RoleUtilisateur.SEC_ADJ_AIR],
  [EtapeListe.ADJ_AIR]:     [RoleUtilisateur.ADJ_AIR],
  [EtapeListe.COMRMIA]:     [RoleUtilisateur.COMRMIA],
  [EtapeListe.COMBASE]:     [
    RoleUtilisateur.COMBASE, RoleUtilisateur.COMGMO, RoleUtilisateur.COMSECBASE,
  ],
  [EtapeListe.COMBORD]:     [RoleUtilisateur.COMBORD],
};

export default function ListeDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const { data: detail, isLoading } = useListe(id);
  const { data: avancement } = useAvancement(id);
  const volId = detail?.liste.vol.id;
  const { data: vol } = useQuery({
    queryKey: ['vols', volId],
    queryFn: () => volService.consulter(volId!),
    enabled: Boolean(volId),
  });
  const { data: troncons } = useTroncons(volId);
  const { data: messagerie } = useEtatMessagerie(
    detail?.liste.statut === 'ARRETEE' || detail?.liste.statut === 'CLOTUREE' ? id : undefined,
  );

  const discriminer = useDiscriminer(id ?? '', volId);
  const reordonner  = useReordonner(id ?? '', volId);
  const retirer     = useRetirerLigne(id ?? '', volId);
  const viser       = useViser(id ?? '', volId);
  const renvoyer    = useRenvoyer(id ?? '', volId);

  const [panneau, setPanneau] = useState(false);
  const [noteDelegation, setNoteDelegation] = useState('');

  if (isLoading || !detail) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la liste…
      </div>
    );
  }

  const { liste, disponibilite, tableaux } = detail;
  const etape = liste.etape_courante;
  const monTour = Boolean(
    etape && user && (ROLE_PAR_ETAPE[etape] ?? []).includes(user.role),
  );

  const saisissable = monTour && etape === EtapeListe.SEC_ADJ_AIR;
  const discriminable = monTour && etape !== EtapeListe.SEC_ADJ_AIR;

  // La note de délégation n'est exigée que du COMGMO et du COMSECBASE agissant
  // à l'étape COMBASE : la signature imprimée restera celle du commandant de
  // base, et la note conserve qui a réellement discriminé.
  const delegue = etape === EtapeListe.COMBASE &&
    (user?.role === RoleUtilisateur.COMGMO || user?.role === RoleUtilisateur.COMSECBASE);

  const bloque = (avancement?.escales_amont_en_attente.length ?? 0) > 0 &&
    etape === EtapeListe.COMBASE;

  const destinations = (vol?.itineraire ?? [])
    .filter((p) => p.ordre > liste.point.ordre)
    .map((p) => ({ ordre: p.ordre, code_base: p.base.code_base }));

  function demanderMotif(invite: string): string | null {
    const m = window.prompt(invite);
    if (m === null) return null;
    if (m.trim().length < 3) {
      window.alert('Un motif d\'au moins 3 caractères est requis.');
      return null;
    }
    return m.trim();
  }

  function deplacer(ligneId: string, rang: number): void {
    discriminer.mutate({ ligneId, rang: Math.max(1, rang), motif: 'Réordonnancement' });
  }

  function changerNature(ligne: LigneListe, nature: NatureLigne): void {
    const invite = nature === NatureLigne.RETIREE
      ? `Motif du retrait de ${ligne.nom} ${ligne.prenom} :`
      : `Motif du déclassement de ${ligne.nom} ${ligne.prenom} en liste d'attente :`;
    const motif = demanderMotif(invite);
    if (motif) discriminer.mutate({ ligneId: ligne.id, nature, motif });
  }

  function changerPriorite(ligne: LigneListe, priorite: Priorite): void {
    const motif = demanderMotif(
      `Motif du changement de priorité de ${ligne.nom} ${ligne.prenom} vers ${priorite} :`,
    );
    if (motif) discriminer.mutate({ ligneId: ligne.id, priorite, motif });
  }

  function apposerVisa(): void {
    if (delegue && noteDelegation.trim().length < 10) {
      window.alert(
        'Une note de délégation d\'au moins 10 caractères est requise : elle sera '
        + 'conservée pour l\'archivage, même si elle n\'apparaît pas sur le document.',
      );
      return;
    }
    const commentaire = window.prompt('Commentaire (facultatif) :') ?? undefined;
    viser.mutate({
      commentaire: commentaire || undefined,
      note_delegation: delegue ? noteDelegation.trim() : undefined,
    });
  }

  function renvoyerListe(): void {
    const motif = demanderMotif('Motif du renvoi (il sera communiqué au secrétaire) :');
    if (motif) renvoyer.mutate({ motif });
  }

  return (
    <div className="p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/listes" className="text-sm text-blue-700 hover:underline">
            ← Toutes les listes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {liste.vol.numero_mission}
            <span className="ml-3 text-base font-normal text-slate-600">
              escale {liste.point.ordre} — {String(liste.rmia).replace('_', ' ')}
            </span>
          </h1>
          <p className="text-sm text-slate-500">
            Départ {new Date(liste.vol.date_heure).toLocaleString('fr-FR',
              { dateStyle: 'full', timeStyle: 'short' })}
            {' — '}quota {liste.quota_places} place(s) / {liste.quota_masse_kg} kg
            {' — '}version {liste.version}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/pdf/liste/${liste.id}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" /> Imprimer la liste
          </a>
          {saisissable && (
            <button
              type="button"
              onClick={() => setPanneau(true)}
              className="inline-flex items-center gap-2 rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              <UserPlus className="h-4 w-4" /> Sélectionner des voyageurs
            </button>
          )}
        </div>
      </header>

      {liste.motif_rejet && (
        <div className="mb-5 flex gap-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <Undo2 className="h-5 w-5 shrink-0" />
          <p><strong>Liste renvoyée.</strong> {liste.motif_rejet}</p>
        </div>
      )}

      {bloque && (
        <div className="mb-5 flex gap-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            L'arrêté est impossible tant que les escales amont ne sont pas arrêtées :
            {' '}{avancement?.escales_amont_en_attente.map((e) => `point ${e.ordre}`).join(', ')}.
          </p>
        </div>
      )}

      {avancement && avancement.consignes_bloquantes.length > 0 && (
        <div className="mb-5 flex gap-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            {avancement.consignes_bloquantes.length} consigne(s) d'autorité centrale en
            attente de confirmation. Le visa du commandant de bord restera bloqué.
          </p>
        </div>
      )}

      {avancement && (
        <section className="mb-6">
          <BlocsVisas blocs={avancement.blocs} etapeCourante={etape} />
        </section>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Disponibilité à cet embarquement
          </h3>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {disponibilite.places} <span className="text-base font-normal">place(s)</span>
          </p>
          <p className="text-sm text-slate-600">{disponibilite.masse_kg} kg restants</p>
          <p className="mt-1 text-xs text-slate-500">
            Facteur limitant :{' '}
            {disponibilite.facteur_limitant === 'QUOTA'
              ? 'quota alloué par le SCOPS'
              : "capacité de l'aéronef sur ce tronçon"}
          </p>
        </div>

        <div className="lg:col-span-2">
          {troncons && vol && (
            <TronconsBarre
              troncons={troncons}
              points={vol.itineraire.map((p) => ({ ordre: p.ordre, code_base: p.base.code_base }))}
              ordreCourant={liste.point.ordre}
            />
          )}
        </div>
      </div>

      {/* ── Les six tableaux de priorité ── */}
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Users className="h-5 w-5" /> Liste hiérarchisée
      </h2>

      {tableaux.map((t) => (
        <TableauPriorite
          key={t.priorite}
          priorite={t.priorite}
          libelle={t.libelle}
          lignes={t.lignes}
          discriminable={discriminable}
          saisissable={saisissable}
          onDeplacer={deplacer}
          onChangerNature={changerNature}
          onChangerPriorite={changerPriorite}
          onRetirerSaisie={(ligneId) => retirer.mutate(ligneId)}
        />
      ))}

      {/* ── Liste d'attente : absente pour le commandant de bord ── */}
      {detail.liste_attente && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-slate-50">
          <header className="border-b border-slate-200 px-4 py-2">
            <h3 className="text-sm font-semibold text-slate-800">
              Liste d'attente
              <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-normal text-slate-600">
                {detail.liste_attente.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Communiquée aux autorités de validation. Ne figure sur aucun manifeste.
            </p>
          </header>

          {!detail.liste_attente.length ? (
            <p className="px-4 py-3 text-sm italic text-slate-400">Aucune personne en attente.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {detail.liste_attente.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-800">
                      {l.grade ? `${l.grade} ` : ''}{l.nom} {l.prenom}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      {l.unite ?? '—'} — {l.destination} — {l.priorite}
                    </span>
                  </span>
                  {discriminable && (
                    <button
                      type="button"
                      onClick={() => {
                        const motif = demanderMotif(
                          `Motif du repêchage de ${l.nom} ${l.prenom} :`,
                        );
                        if (motif) {
                          discriminer.mutate({
                            ligneId: l.id, nature: NatureLigne.HIERARCHISEE, motif,
                          });
                        }
                      }}
                      className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                    >
                      Repêcher
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── État des messages, après arrêté ── */}
      {messagerie && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
            <MessageSquare className="h-4 w-4" /> Information des voyageurs
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            {messagerie.envoyes} envoyé(s), {messagerie.en_attente} en attente,
            {' '}{messagerie.echecs} en échec — opérateur : {messagerie.operateur}
          </p>
          {messagerie.echecs > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-red-700">
              {messagerie.detail_echecs.map((e) => (
                <li key={e.id}>
                  {e.telephone} — {e.nb_tentatives} tentative(s) — {e.erreur}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Barre d'action ── */}
      {monTour && (
        <section className="sticky bottom-0 -mx-6 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          {delegue && (
            <div className="mb-3">
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Note de délégation (obligatoire, conservée pour l'archivage)
              </label>
              <input
                value={noteDelegation}
                onChange={(e) => setNoteDelegation(e.target.value)}
                placeholder="Discrimination exercée sur délégation du commandant de base…"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                La signature portée sur le document restera celle du commandant de base.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {etape !== EtapeListe.SEC_ADJ_AIR && (
              <button
                type="button"
                onClick={renvoyerListe}
                disabled={renvoyer.isPending}
                className="inline-flex items-center gap-2 rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Undo2 className="h-4 w-4" /> Renvoyer pour correction
              </button>
            )}
            <button
              type="button"
              onClick={apposerVisa}
              disabled={viser.isPending || bloque}
              className="inline-flex items-center gap-2 rounded bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {viser.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              {etape === EtapeListe.COMBASE
                ? 'Arrêter la liste et émettre le manifeste'
                : 'Apposer mon visa'}
            </button>
          </div>
        </section>
      )}

      {panneau && volId && (
        <PanneauSelection
          listeId={liste.id}
          volId={volId}
          destinations={destinations}
          disponibilite={disponibilite}
          onFermer={() => setPanneau(false)}
        />
      )}
    </div>
  );
}