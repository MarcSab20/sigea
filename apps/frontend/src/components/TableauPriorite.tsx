// apps/frontend/src/app/listes/components/TableauPriorite.tsx
//
// Un tableau de priorité, P1 à P6.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI DES BOUTONS, ET NON DU GLISSER-DÉPOSER
// ═══════════════════════════════════════════════════════════════════════════
// Le glisser-déposer suppose une souris précise, un écran large et une page
// stable. Ces listes sont manipulées sur des postes anciens, parfois sur
// tablette, et parfois à côté d'un aéronef. Un déplacement raté y est bien plus
// coûteux qu'un clic de trop : il change l'ordre d'embarquement sans que
// l'opérateur s'en aperçoive.
//
// Des boutons « monter », « descendre », « en tête » donnent le même résultat,
// sont utilisables au doigt, et chaque action est explicite. Ils n'exigent
// par ailleurs aucune dépendance supplémentaire — le projet n'embarque pas de
// bibliothèque de glisser-déposer, et en ajouter une pour cela serait
// disproportionné.
//
// Le tableau est TOUJOURS rendu, même vide : un tableau absent se lit comme un
// oubli, un tableau vide comme une absence de candidat.

import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUp, UserMinus, ArrowDownToLine } from 'lucide-react';
import { NatureLigne, Priorite } from '@sigea/shared-types';
import type { LigneListe } from '@/services/liste.service';

interface Props {
  priorite: Priorite;
  libelle: string;
  lignes: LigneListe[];
  /** Vrai si l'utilisateur est à une étape habilitée à discriminer. */
  discriminable: boolean;
  /** Vrai si l'utilisateur constitue la liste (SEC_ADJ_AIR, liste ouverte). */
  saisissable: boolean;
  onDeplacer: (ligneId: string, nouveauRang: number) => void;
  onChangerNature: (ligne: LigneListe, nature: NatureLigne) => void;
  onChangerPriorite: (ligne: LigneListe, priorite: Priorite) => void;
  onRetirerSaisie: (ligneId: string) => void;
}

export default function TableauPriorite(props: Props): React.ReactElement {
  const { priorite, libelle, lignes, discriminable, saisissable } = props;

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-800">
          {libelle}
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
            {lignes.length}
          </span>
        </h3>
        <span className="text-xs uppercase tracking-wide text-slate-400">{priorite}</span>
      </header>

      {!lignes.length ? (
        <p className="px-4 py-3 text-sm italic text-slate-400">
          Aucun candidat à cette priorité.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 w-12">Rang</th>
              <th className="px-4 py-2">Identité</th>
              <th className="px-4 py-2">Unité</th>
              <th className="px-4 py-2">Destination</th>
              <th className="px-4 py-2 w-20 text-center">Bag. / kg</th>
              {(discriminable || saisissable) && <th className="px-4 py-2 w-56 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {lignes.map((l, i) => {
              const imposee = l.origine !== 'SAISIE';
              return (
                <tr key={l.id} className={imposee ? 'bg-amber-50/60' : ''}>
                  <td className="px-4 py-2 font-medium text-slate-700">{l.rang}</td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-slate-900">
                      {l.grade ? `${l.grade} ` : ''}{l.nom} {l.prenom}
                    </span>
                    {l.matricule && (
                      <span className="ml-2 text-xs text-slate-500">{l.matricule}</span>
                    )}
                    {imposee && (
                      <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                        Imposé {l.origine}
                      </span>
                    )}
                    {l.motif_decision && (
                      <p className="mt-0.5 text-xs italic text-slate-500">
                        {l.discrimine_etape} : {l.motif_decision}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{l.unite ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{l.destination}</td>
                  <td className="px-4 py-2 text-center text-slate-600">
                    {l.nb_bagages} / {Number(l.masse_bagages_kg)}
                  </td>

                  {(discriminable || saisissable) && (
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {discriminable && !imposee && (
                          <>
                            <IconBtn
                              titre="Placer en tête"
                              disabled={i === 0}
                              onClick={() => props.onDeplacer(l.id, 1)}
                            >
                              <ChevronsUp className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn
                              titre="Monter"
                              disabled={i === 0}
                              onClick={() => props.onDeplacer(l.id, l.rang - 1)}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn
                              titre="Descendre"
                              disabled={i === lignes.length - 1}
                              onClick={() => props.onDeplacer(l.id, l.rang + 1)}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </IconBtn>

                            <select
                              title="Changer la priorité"
                              value={l.priorite}
                              onChange={(e) =>
                                props.onChangerPriorite(l, e.target.value as Priorite)}
                              className="rounded border border-slate-300 px-1 py-1 text-xs"
                            >
                              {['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>

                            <IconBtn
                              titre="Déclasser en liste d'attente"
                              onClick={() => props.onChangerNature(l, NatureLigne.ATTENTE)}
                            >
                              <ArrowDownToLine className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn
                              titre="Retirer de la liste"
                              danger
                              onClick={() => props.onChangerNature(l, NatureLigne.RETIREE)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </IconBtn>
                          </>
                        )}

                        {saisissable && !imposee && (
                          <IconBtn
                            titre="Supprimer l'inscription"
                            danger
                            onClick={() => props.onRetirerSaisie(l.id)}
                          >
                            <UserMinus className="h-4 w-4" />
                          </IconBtn>
                        )}

                        {imposee && (
                          <span className="text-xs italic text-amber-800">
                            Hors discrimination
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function IconBtn(
  { titre, onClick, disabled, danger, children }: {
    titre: string; onClick: () => void;
    disabled?: boolean; danger?: boolean; children: React.ReactNode;
  },
): React.ReactElement {
  return (
    <button
      type="button"
      title={titre}
      aria-label={titre}
      onClick={onClick}
      disabled={disabled}
      className={`rounded p-1 transition disabled:opacity-30 ${
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}