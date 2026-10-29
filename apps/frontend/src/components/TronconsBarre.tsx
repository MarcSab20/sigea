// apps/frontend/src/app/listes/components/TronconsBarre.tsx
//
// Occupation de chaque tronçon du vol, toutes listes confondues.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CET ÉCRAN EXISTE
// ═══════════════════════════════════════════════════════════════════════════
// C'est la représentation du problème que la directive pose à propos de Douala.
// Un passager inscrit à Yaoundé pour Garoua occupe un siège sur le tronçon
// Douala→Garoua, alors qu'il ne figure sur aucune liste de Douala. Sans cette
// vue, le secrétaire de Douala voit son quota et croit disposer de places qui
// sont déjà prises.
//
// Un reste négatif s'affiche en rouge : c'est une sur-réservation, légitime
// seulement après une imposition d'autorité centrale, et qui appelle alors
// l'arbitrage du commandant de bord.

import React from 'react';
import type { Troncon } from '@/services/liste.service';

interface Props {
  troncons: Troncon[];
  /** Codes de base, indexés par ordre d'itinéraire (1..n). */
  points: { ordre: number; code_base: string }[];
  /** Ordre du point d'embarquement de la liste consultée, pour le surligner. */
  ordreCourant?: number;
}

export default function TronconsBarre({ troncons, points, ordreCourant }: Props): React.ReactElement {
  const nom = (ordre: number): string =>
    points.find((p) => p.ordre === ordre)?.code_base ?? `P${ordre}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
        Occupation par tronçon
      </h3>

      <ul className="space-y-3">
        {troncons.map((t) => {
          const surcharge = t.places_restantes < 0 || t.masse_restante_kg < 0;
          const taux = t.capacite_places
            ? Math.min(100, Math.round((t.places_occupees / t.capacite_places) * 100))
            : 0;
          const courant = ordreCourant === t.ordre;

          return (
            <li key={t.ordre} className={courant ? 'rounded bg-blue-50 p-2 -m-2' : ''}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-800">
                  {nom(t.ordre)} → {nom(t.ordre + 1)}
                  {courant && (
                    <span className="ml-2 text-xs font-normal text-blue-700">
                      (votre embarquement)
                    </span>
                  )}
                </span>
                <span className={surcharge ? 'font-semibold text-red-600' : 'text-slate-600'}>
                  {t.places_occupees}/{t.capacite_places} places —
                  {' '}{t.masse_occupee_kg}/{t.capacite_masse_kg} kg
                </span>
              </div>

              <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-100">
                <div
                  className={`h-full transition-all ${
                    surcharge ? 'bg-red-500' : taux > 85 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${surcharge ? 100 : taux}%` }}
                />
              </div>

              {surcharge && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  Sur-réservation : {Math.abs(t.places_restantes)} place(s) et
                  {' '}{Math.abs(Math.min(0, t.masse_restante_kg))} kg en excès.
                  Le commandant de bord devra arbitrer.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}