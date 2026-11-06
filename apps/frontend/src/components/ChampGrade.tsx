// apps/frontend/src/components/ChampGrade.tsx
//
// Sélection d'un grade, par armée puis par grade.
//
// ═══════════════════════════════════════════════════════════════════════════
// DEUX LISTES PLUTÔT QU'UNE
// ═══════════════════════════════════════════════════════════════════════════
// Une liste unique compterait soixante-quinze entrées, dont une quinzaine de
// doublons de libellé — « Capitaine » y figurerait trois fois sans qu'on sache
// laquelle choisir. L'armée d'abord ramène le choix à dix-neuf lignes, ordonnées
// par ancienneté comme dans un tableau d'avancement.
//
// Les grades sont présentés par CATÉGORIE — militaires du rang, sous-officiers,
// officiers — parce que c'est ainsi qu'un militaire se repère. Un classement
// alphabétique obligerait à parcourir toute la liste.
//
// Le composant renvoie le LIBELLÉ seul, ce que le reste de l'application
// attend : `grade` est une chaîne sur Potentialite, LigneListe et Passager.
// L'armée n'est qu'une aide à la saisie.

import React, { useMemo, useState } from 'react';
import {
  Armee, ARMEES_ORDONNEES, GRADES_PAR_ARMEE, LIBELLE_ARMEE, trouverGrade,
} from '@sigea/shared-types';

interface Props {
  valeur: string;
  onChange: (grade: string) => void;
  /** Armée présumée. L'Armée de l'air par défaut : c'est le cas le plus fréquent. */
  armeeParDefaut?: Armee;
  obligatoire?: boolean;
  classe?: string;
}

export default function ChampGrade(props: Props): React.ReactElement {
  /**
   * L'armée est déduite de la valeur existante quand c'est possible.
   *
   * En édition, le grade est déjà renseigné mais l'armée ne l'est pas : la
   * retrouver évite d'afficher une liste qui ne contient pas la valeur
   * courante, ce qui donnerait un sélecteur paraissant vide alors que la
   * donnée est là.
   */
  const armeeInitiale = useMemo<Armee>(() => {
    if (!props.valeur) return props.armeeParDefaut ?? Armee.AIR;
    for (const a of ARMEES_ORDONNEES) {
      if (trouverGrade(props.valeur, a)) return a;
    }
    return props.armeeParDefaut ?? Armee.AIR;
  }, [props.valeur, props.armeeParDefaut]);

  const [armee, setArmee] = useState<Armee>(armeeInitiale);

  const grades = GRADES_PAR_ARMEE[armee];

  // Regroupement par catégorie, dans l'ordre d'ancienneté. `Map` et non objet :
  // elle conserve l'ordre d'insertion, là où un objet réordonnerait les clés
  // numériques — sans incidence ici, mais la garantie est gratuite.
  const parCategorie = useMemo(() => {
    const m = new Map<string, typeof grades[number][]>();
    for (const g of grades) {
      if (!m.has(g.categorie)) m.set(g.categorie, []);
      m.get(g.categorie)!.push(g);
    }
    return [...m.entries()];
  }, [grades]);

  const classe = props.classe
    ?? 'w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none';

  // La valeur courante n'appartient pas à l'armée sélectionnée : on la conserve
  // comme option supplémentaire plutôt que de la perdre silencieusement. Une
  // saisie ancienne ou un grade civil ne doit pas disparaître d'un formulaire
  // qu'on rouvre pour corriger autre chose.
  const horsListe = props.valeur && !trouverGrade(props.valeur, armee);

  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        value={armee}
        onChange={(e) => {
          const nouvelle = e.target.value as Armee;
          setArmee(nouvelle);
          // Le grade n'est PAS réinitialisé : changer d'armée est souvent une
          // correction, et le grade homonyme existe dans la nouvelle liste une
          // fois sur deux. L'effacer obligerait à le resaisir pour rien.
        }}
        className={classe}
        aria-label="Armée"
      >
        {ARMEES_ORDONNEES.map((a) => (
          <option key={a} value={a}>{LIBELLE_ARMEE[a]}</option>
        ))}
      </select>

      <select
        value={props.valeur}
        onChange={(e) => props.onChange(e.target.value)}
        className={classe}
        aria-label="Grade"
        required={props.obligatoire}
      >
        <option value="">— Grade —</option>
        {horsListe && (
          <option value={props.valeur}>{props.valeur} (hors liste)</option>
        )}
        {parCategorie.map(([categorie, liste]) => (
          <optgroup key={categorie} label={categorie}>
            {liste.map((g) => (
              <option key={g.libelle} value={g.libelle}>{g.libelle}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}