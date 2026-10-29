// apps/frontend/src/app/listes/components/BlocsVisas.tsx
//
// Frise des cinq étapes du circuit.
//
// Chaque bloc apposé affiche l'empreinte courte du contenu visé. Ce n'est pas
// décoratif : deux visas successifs portant des empreintes DIFFÉRENTES
// signifient que la liste a changé entre les deux signatures. C'est lisible
// d'un coup d'œil, sans ouvrir d'historique, et c'est exactement la question
// que pose un contrôle.

import React from 'react';
import { Check, Circle, UserCheck } from 'lucide-react';
import type { BlocVisa } from '@/services/liste.service';

export default function BlocsVisas(
  { blocs, etapeCourante }: { blocs: BlocVisa[]; etapeCourante: string | null },
): React.ReactElement {
  return (
    <ol className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {blocs.map((b) => {
        const actif = b.etape === etapeCourante;
        return (
          <li
            key={b.etape}
            className={`rounded-lg border p-3 ${
              b.appose
                ? 'border-blue-200 bg-blue-50'
                : actif
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-2">
              {b.appose
                ? <Check className="h-4 w-4 text-blue-700" />
                : <Circle className={`h-4 w-4 ${actif ? 'text-amber-600' : 'text-slate-300'}`} />}
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                {b.libelle}
              </span>
            </div>

            {b.appose && b.signataire ? (
              <div className="mt-2 text-xs text-slate-700">
                <p className="font-semibold text-blue-900">{b.mention}</p>
                <p>{b.signataire.grade} {b.signataire.nom}</p>
                <p className="text-slate-500">{b.signataire.titre}</p>
                <p className="text-slate-500">
                  {b.date_heure
                    ? new Date(b.date_heure).toLocaleString('fr-FR',
                        { dateStyle: 'short', timeStyle: 'short' })
                    : ''}
                </p>
                {b.par_delegation && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] italic text-slate-600">
                    <UserCheck className="h-3 w-3" /> Par délégation
                  </p>
                )}
                {b.par_interim && (
                  <p className="mt-1 text-[11px] font-bold text-blue-800">P/I</p>
                )}
                {b.hash_court && (
                  <p className="mt-1 font-mono text-[10px] tracking-wider text-slate-500">
                    {b.hash_court}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs italic text-slate-400">
                {actif ? 'En cours' : 'En attente'}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}