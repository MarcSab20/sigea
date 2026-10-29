// apps/frontend/src/app/listes/ListesPage.tsx
//
// Inventaire des listes visibles de l'utilisateur.
//
// ── Le tri qui compte ──
// Les dossiers « à traiter » remontent en tête, séparés visuellement du reste.
// Le drapeau vient du SERVEUR (`a_traiter`), calculé à partir de l'étape
// courante et du rôle effectif, intérims compris. Le recalculer ici produirait
// tôt ou tard une divergence : le client ne connaît pas les délégations.

import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Inbox, ChevronRight } from 'lucide-react';
import { useMesListes } from '@/hooks/useListes';
import type { ListeResume } from '@/services/liste.service';

const LIBELLE_STATUT: Record<string, string> = {
  OUVERTE:       'Constitution en cours',
  EN_VALIDATION: 'En validation',
  ARRETEE:       'Arrêtée — manifeste émis',
  CLOTUREE:      'Clôturée',
  REJETEE:       'Renvoyée pour correction',
};

export default function ListesPage(): React.ReactElement {
  const { data, isLoading } = useMesListes();

  const aTraiter = data?.filter((l) => l.a_traiter) ?? [];
  const autres   = data?.filter((l) => !l.a_traiter) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des listes…
      </div>
    );
  }

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Listes d'embarquement</h1>
        <p className="text-sm text-slate-500">
          Une liste par point d'embarquement. Elle circule du secrétaire de l'Adjoint Air
          au commandant de base, puis le manifeste part au commandant de bord.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
          <Inbox className="h-4 w-4" /> En attente de votre action
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            {aTraiter.length}
          </span>
        </h2>

        {!aTraiter.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm italic text-slate-400">
            Rien ne vous attend pour l'instant.
          </p>
        ) : (
          <ul className="space-y-2">
            {aTraiter.map((l) => <Carte key={l.id} liste={l} accent />)}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
          Autres dossiers suivis
        </h2>
        {!autres.length ? (
          <p className="text-sm italic text-slate-400">Aucun autre dossier.</p>
        ) : (
          <ul className="space-y-2">
            {autres.map((l) => <Carte key={l.id} liste={l} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Carte({ liste, accent }: { liste: ListeResume; accent?: boolean }): React.ReactElement {
  return (
    <li>
      <Link
        to={`/listes/${liste.id}`}
        className={`flex items-center justify-between rounded-lg border px-4 py-3 transition hover:shadow-sm ${
          accent ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'
        }`}
      >
        <div>
          <p className="font-medium text-slate-900">
            {liste.vol.numero_mission}
            <span className="ml-2 text-sm font-normal text-slate-600">
              escale {liste.etape.ordre} — {liste.etape.base.code_base}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            {new Date(liste.vol.date_heure).toLocaleString('fr-FR',
              { dateStyle: 'short', timeStyle: 'short' })}
            {' — '}{String(liste.rmia).replace('_', ' ')}
            {' — '}{liste._count.lignes} inscrit(s) / {liste.quota_places} place(s)
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {LIBELLE_STATUT[liste.statut] ?? liste.statut}
            {liste.etape_courante && (
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">
                {liste.etape_courante.replace(/_/g, ' ')}
              </span>
            )}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </Link>
    </li>
  );
}