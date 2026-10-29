// apps/frontend/src/app/listes/components/PanneauSelection.tsx
//
// Sélection depuis le vivier de potentialités.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA CONTRAINTE QUI STRUCTURE CET ÉCRAN
// ═══════════════════════════════════════════════════════════════════════════
// Le point de débarquement est OBLIGATOIRE pour chaque personne retenue, et il
// n'a pas de valeur par défaut raisonnable. C'est lui qui détermine les
// tronçons occupés, donc la place consommée aux escales suivantes — le serveur
// le refusera s'il est absent, et il a raison de le faire.
//
// L'écran applique donc une destination par défaut commune, modifiable ligne
// par ligne : dans la grande majorité des cas, un lot de voyageurs va au même
// endroit, et exiger vingt saisies identiques serait punitif. La destination
// « souhaitée » enregistrée au vivier sert d'indication, jamais de valeur
// opposable.

import React, { useMemo, useState } from 'react';
import { Search, UserPlus, Loader2, X } from 'lucide-react';
import type { Priorite } from '@sigea/shared-types';
import { usePotentialites, useSelectionner } from '@/hooks/useListes';
import type { Potentialite, Disponibilite } from '@/services/liste.service';

interface Props {
  listeId: string;
  volId: string;
  /** Points de l'itinéraire postérieurs à l'embarquement. */
  destinations: { ordre: number; code_base: string }[];
  disponibilite: Disponibilite;
  onFermer: () => void;
}

export default function PanneauSelection(props: Props): React.ReactElement {
  const [recherche, setRecherche] = useState('');
  const [choisis, setChoisis] = useState<Record<string, number>>({});
  const [destinationParDefaut, setDestinationParDefaut] = useState<number>(
    props.destinations[props.destinations.length - 1]?.ordre ?? 2,
  );

  const { data, isLoading } = usePotentialites(recherche);
  const selectionner = useSelectionner(props.listeId, props.volId);

  const elements = data?.elements ?? [];
  const nbChoisis = Object.keys(choisis).length;

  // Avertissement en amont de l'envoi. Le serveur bascule automatiquement
  // l'excédent en liste d'attente ; prévenir ici évite la surprise.
  const depassement = useMemo(
    () => Math.max(0, nbChoisis - props.disponibilite.places),
    [nbChoisis, props.disponibilite.places],
  );

  function basculer(p: Potentialite): void {
    setChoisis((c) => {
      const copie = { ...c };
      if (copie[p.id]) delete copie[p.id];
      else copie[p.id] = destinationParDefaut;
      return copie;
    });
  }

  function envoyer(): void {
    const selections = Object.entries(choisis).map(([potentialite_id, ordre]) => ({
      potentialite_id,
      debarquement_ordre: ordre,
    }));
    selectionner.mutate({ selections }, { onSuccess: () => { setChoisis({}); props.onFermer(); } });
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Liste des potentialités</h2>
          <p className="text-sm text-slate-500">
            {props.disponibilite.places} place(s) et {props.disponibilite.masse_kg} kg
            disponibles — facteur limitant :{' '}
            {props.disponibilite.facteur_limitant === 'QUOTA'
              ? 'quota alloué par le SCOPS'
              : "capacité de l'aéronef sur ce tronçon"}.
          </p>
        </div>
        <button type="button" onClick={props.onFermer}
                className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="space-y-3 border-b border-slate-200 px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, prénom, matricule, CNI…"
            className="w-full rounded border border-slate-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          Destination appliquée aux sélections :
          <select
            value={destinationParDefaut}
            onChange={(e) => {
              const ordre = Number(e.target.value);
              setDestinationParDefaut(ordre);
              // On réapplique aux choix déjà faits : changer la destination
              // par défaut après coup est le geste naturel quand on s'aperçoit
              // de son erreur, et ne rien recalculer serait trompeur.
              setChoisis((c) =>
                Object.fromEntries(Object.keys(c).map((k) => [k, ordre])));
            }}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {props.destinations.map((d) => (
              <option key={d.ordre} value={d.ordre}>
                {d.code_base} (point {d.ordre})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement du vivier…
          </p>
        )}

        {!isLoading && !elements.length && (
          <p className="py-6 text-center text-sm italic text-slate-400">
            Aucune potentialité disponible. Enregistrez les demandeurs qui se
            présentent pour pouvoir les retenir dès qu'un quota est alloué.
          </p>
        )}

        <ul className="divide-y divide-slate-100">
          {elements.map((p) => {
            const retenu = Boolean(choisis[p.id]);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => basculer(p)}
                  className={`flex w-full items-center justify-between py-2.5 text-left transition ${
                    retenu ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="px-2">
                    <span className="block font-medium text-slate-900">
                      {p.grade ? `${p.grade} ` : ''}{p.nom} {p.prenom}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {p.unite ?? 'Unité non précisée'} — {p.categorie}
                      {p.destination_souhaitee ? ` — souhaite : ${p.destination_souhaitee}` : ''}
                      {' — '}{Number(p.masse_bagages_kg)} kg
                    </span>
                  </span>
                  <span className="flex items-center gap-2 px-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                      {p.priorite_proposee}
                    </span>
                    <input type="checkbox" readOnly checked={retenu} className="h-4 w-4" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="border-t border-slate-200 px-5 py-4">
        {depassement > 0 && (
          <p className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            {depassement} personne(s) au-delà du quota seront placées en liste d'attente.
            Elles resteront communiquées aux autorités de validation.
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">{nbChoisis} sélectionné(s)</span>
          <button
            type="button"
            onClick={envoyer}
            disabled={!nbChoisis || selectionner.isPending}
            className="inline-flex items-center gap-2 rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {selectionner.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <UserPlus className="h-4 w-4" />}
            Porter sur la liste
          </button>
        </div>
      </footer>
    </div>
  );
}