// apps/frontend/src/components/BandeauEtape.tsx
//
// Dit à l'utilisateur où en est le dossier, et ce qu'il peut en faire.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE COMPOSANT EXISTE
// ═══════════════════════════════════════════════════════════════════════════
// L'écran de liste masque les commandes quand ce n'est pas le tour de
// l'utilisateur. C'est correct, mais muet : un Adjoint Air qui a visé la veille
// revient sur sa liste, ne trouve plus aucun bouton, et ne sait pas s'il a été
// dépossédé, si le dossier a avancé, ou si l'application est en panne.
//
// Le silence d'une interface est toujours interprété, et presque toujours mal.
// Ce bandeau dit explicitement les trois choses qui manquent : ce que
// l'utilisateur a déjà fait, où se trouve le dossier maintenant, et pourquoi il
// ne peut plus agir.
//
// La directive demande que les maillons inférieurs soient informés des
// décisions amont « à titre informatif, sans pouvoir réagir ». C'est
// exactement cet état qu'il faut rendre lisible.

import React from 'react';
import { Eye, Hourglass, PenLine, CheckCircle2, Undo2 } from 'lucide-react';
import {
  EtapeListe, StatutListe, LIBELLE_ETAPE_LISTE, rangEtapeListe,
} from '@sigea/shared-types';
import type { BlocVisa } from '@/services/liste.service';

interface Props {
  /** Étape qui détient le dossier. `null` lorsque le circuit est clos. */
  etape: EtapeListe | null;
  statut: StatutListe | string;
  /** Étape de l'utilisateur dans ce circuit. `null` s'il n'en a aucune. */
  monEtape: EtapeListe | null;
  monTour: boolean;
  blocs: BlocVisa[];
  motifRejet?: string | null;
}

export default function BandeauEtape(props: Props): React.ReactElement | null {
  const { etape, statut, monEtape, monTour, blocs, motifRejet } = props;

  // Un renvoi prime sur tout le reste : c'est l'information la plus urgente de
  // l'écran, et elle doit être lue avant même de savoir qui détient le dossier.
  if (motifRejet) {
    return (
      <Cadre ton="rouge" icone={<Undo2 className="h-5 w-5 shrink-0" />}>
        <strong>Liste renvoyée pour correction.</strong> {motifRejet}
      </Cadre>
    );
  }

  if (statut === StatutListe.CLOTUREE || !etape) {
    return (
      <Cadre ton="vert" icone={<CheckCircle2 className="h-5 w-5 shrink-0" />}>
        <strong>Circuit terminé.</strong> Le manifeste est définitif ; plus aucune
        modification n'est possible.
      </Cadre>
    );
  }

  if (monTour) {
    return (
      <Cadre ton="ambre" icone={<PenLine className="h-5 w-5 shrink-0" />}>
        <strong>Le dossier est entre vos mains.</strong>{' '}
        {etape === EtapeListe.SEC_ADJ_AIR
          ? "Constituez la liste, puis apposez votre visa pour la transmettre à l'Adjoint Air."
          : etape === EtapeListe.COMBASE
            ? 'Discriminez puis arrêtez la liste : le manifeste sera émis et les voyageurs informés.'
            : 'Discriminez puis apposez votre visa pour transmettre à l\'étape suivante.'}
      </Cadre>
    );
  }

  const monVisa = monEtape ? blocs.find((b) => b.etape === monEtape) : undefined;

  // Mon étape est derrière : j'ai visé, le dossier a avancé. C'est le cas que
  // le masquage silencieux rendait incompréhensible.
  if (monEtape && rangEtapeListe(monEtape) < rangEtapeListe(etape)) {
    return (
      <Cadre ton="bleu" icone={<Eye className="h-5 w-5 shrink-0" />}>
        <strong>Consultation seule.</strong>{' '}
        {monVisa?.appose
          ? `Vous avez apposé votre ${monVisa.mention?.toLowerCase() ?? 'visa'} le ` +
            `${monVisa.date_heure
                ? new Date(monVisa.date_heure).toLocaleDateString('fr-FR')
                : ''}. `
          : ''}
        Le dossier est désormais entre les mains de {LIBELLE_ETAPE_LISTE[etape].toLowerCase()}.
        Vous suivez ses décisions à titre d'information et ne pouvez plus les modifier.
        {' '}Si une correction s'impose, demandez-lui le renvoi de la liste.
      </Cadre>
    );
  }

  // Mon étape est devant : le dossier n'est pas encore arrivé.
  if (monEtape && rangEtapeListe(monEtape) > rangEtapeListe(etape)) {
    return (
      <Cadre ton="gris" icone={<Hourglass className="h-5 w-5 shrink-0" />}>
        <strong>En attente.</strong> Le dossier est à l'étape{' '}
        {LIBELLE_ETAPE_LISTE[etape].toLowerCase()} ; il vous parviendra après son visa.
        Vous pouvez le consulter dès maintenant, sans pouvoir le modifier.
      </Cadre>
    );
  }

  // Aucune étape dans ce circuit : autorité centrale, administrateur,
  // observateur. On le dit, plutôt que de laisser croire à un défaut de droits.
  return (
    <Cadre ton="gris" icone={<Eye className="h-5 w-5 shrink-0" />}>
      <strong>Consultation.</strong> Vous n'intervenez pas dans le circuit de cette
      liste. Elle est à l'étape {LIBELLE_ETAPE_LISTE[etape].toLowerCase()}.
    </Cadre>
  );
}

const TONS: Record<string, string> = {
  rouge: 'border-red-300 bg-red-50 text-red-900',
  ambre: 'border-amber-300 bg-amber-50 text-amber-900',
  bleu:  'border-blue-300 bg-blue-50 text-blue-900',
  vert:  'border-emerald-300 bg-emerald-50 text-emerald-900',
  gris:  'border-slate-300 bg-slate-50 text-slate-700',
};

function Cadre(
  { ton, icone, children }: { ton: keyof typeof TONS; icone: React.ReactNode; children: React.ReactNode },
): React.ReactElement {
  return (
    <div className={`mb-5 flex gap-3 rounded border p-3 text-sm ${TONS[ton]}`}>
      {icone}
      <p>{children}</p>
    </div>
  );
}