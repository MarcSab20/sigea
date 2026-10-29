// apps/frontend/src/app/vols/VolsPage.tsx

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import {
  Plane, Plus, Trash2, ChevronUp, ChevronDown, Loader2, MapPin, X,
} from 'lucide-react';
import { RoleUtilisateur, TypeMission, ROLES_CREATION_VOL } from '@sigea/shared-types';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { referentielService, type BaseDB, type AeronefDB } from '@/services/referentiel.service';
import { volService, type Vol } from '@/services/vol.service';

const TYPES_MISSION: { value: TypeMission; label: string }[] = [
  { value: TypeMission.PROJECTION,  label: 'Projection' },
  { value: TypeMission.PARA,        label: 'Parachutage' },
  { value: TypeMission.LIAISON,     label: 'Liaison' },
  { value: TypeMission.LOGISTIQUE,  label: 'Logistique' },
  { value: TypeMission.EVASAN,      label: 'EVASAN — évacuation sanitaire' },
  { value: TypeMission.VIP,         label: 'VIP' },
  { value: TypeMission.OP_SENSIBLE, label: 'Opération sensible' },
];

interface Personnel {
  id: string; nom: string; prenom: string; grade: string;
  role: string; base_id: string; actif: boolean;
}

function messageErreur(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  return Array.isArray(m) ? m.join(' — ') : (m ?? err.message ?? 'Erreur inattendue');
}

const LIBELLE_STATUT: Record<string, { texte: string; classe: string }> = {
  PLANIFIE: { texte: 'Planifié — en attente du SCOPS', classe: 'bg-amber-100 text-amber-800' },
  DIFFUSE:  { texte: 'Diffusé', classe: 'bg-blue-100 text-blue-800' },
  EN_COURS: { texte: 'En cours', classe: 'bg-emerald-100 text-emerald-800' },
  CLOTURE:  { texte: 'Clôturé', classe: 'bg-slate-100 text-slate-700' },
  ANNULE:   { texte: 'Annulé', classe: 'bg-red-100 text-red-800' },
};

export default function VolsPage(): React.ReactElement {
  const { user } = useAuthStore();
  const [formulaire, setFormulaire] = useState(false);

  const { data: vols, isLoading } = useQuery({ queryKey: ['vols'], queryFn: volService.lister });

  const peutCreer = Boolean(
    user && (ROLES_CREATION_VOL as readonly string[]).includes(user.role),
  );

  return (
    <div className="p-6">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vols</h1>
          <p className="text-sm text-slate-500">
            Un vol planifié n'est visible que de sa base et du sous-chef opérations
            tant que les quotas ne sont pas alloués.
          </p>
        </div>
        {peutCreer && (
          <button
            type="button"
            onClick={() => setFormulaire(true)}
            className="inline-flex items-center gap-2 rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Plus className="h-4 w-4" /> Planifier un vol
          </button>
        )}
      </header>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </p>
      )}

      {!isLoading && !vols?.length && (
        <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm italic text-slate-400">
          Aucun vol visible dans votre périmètre.
        </p>
      )}

      <ul className="space-y-2">
        {vols?.map((v) => <CarteVol key={v.id} vol={v} />)}
      </ul>

      {formulaire && <FormulaireVol onFermer={() => setFormulaire(false)} />}
    </div>
  );
}

function CarteVol({ vol }: { vol: Vol }): React.ReactElement {
  const statut = LIBELLE_STATUT[vol.statut] ?? { texte: vol.statut, classe: 'bg-slate-100' };
  return (
    <li className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-medium text-slate-900">
            <Plane className="h-4 w-4 text-blue-700" />
            {vol.numero_mission}
            <span className={`rounded px-2 py-0.5 text-xs font-normal ${statut.classe}`}>
              {statut.texte}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {vol.itineraire.map((p) => p.base.code_base).join(' → ')}
          </p>
          <p className="text-xs text-slate-500">
            {new Date(vol.date_heure).toLocaleString('fr-FR',
              { dateStyle: 'full', timeStyle: 'short' })}
            {' — '}{vol.immatriculation}
            {' — '}{vol.capacite_places} places / {Number(vol.capacite_cargo_kg)} kg
            {' — CDB '}{vol.combord_grade} {vol.combord_nom}
          </p>
        </div>

        {/* Quotas : lisibles dès l'allocation, point par point. */}
        {vol.statut !== 'PLANIFIE' && (
          <ul className="flex flex-wrap gap-2 text-xs">
            {vol.itineraire.slice(0, -1).map((p) => (
              <li key={p.id} className="rounded border border-slate-200 px-2 py-1 text-slate-600">
                {p.base.code_base} :{' '}
                {p.quota_places ?? '—'} pl. / {p.quota_masse_kg ? Number(p.quota_masse_kg) : '—'} kg
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

// ─── Formulaire de planification ───────────────────────────────────────────

function FormulaireVol({ onFermer }: { onFermer: () => void }): React.ReactElement {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data: bases } = useQuery({ queryKey: ['bases'], queryFn: referentielService.bases });
  const { data: aeronefs } = useQuery({ queryKey: ['aeronefs'], queryFn: referentielService.aeronefs });
  const { data: personnels } = useQuery({
    queryKey: ['personnels'],
    queryFn: () => api.get<Personnel[]>('/referentiel/personnels').then((r) => r.data),
  });

  const combords = useMemo(
    () => (personnels ?? []).filter((p) => p.role === RoleUtilisateur.COMBORD && p.actif),
    [personnels],
  );

  const [numero, setNumero] = useState('');
  const [immat, setImmat] = useState('');
  const [dateHeure, setDateHeure] = useState('');
  const [typeMission, setTypeMission] = useState<TypeMission | ''>('');
  const [places, setPlaces] = useState('');
  const [cargo, setCargo] = useState('');
  const [combordId, setCombordId] = useState('');
  const [etapes, setEtapes] = useState<string[]>([]);

  const baseDepart = bases?.find((b) => b.id === user?.base_id);
  const aeronef = aeronefs?.find((a) => a.immatriculation === immat);

  const creation = useMutation({
    mutationFn: (dto: Record<string, unknown>) => volService.creer(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vols'] });
      toast.success('Vol planifié. Le sous-chef opérations va allouer les quotas.');
      onFermer();
    },
    onError: (e) => toast.error(messageErreur(e)),
  });

  /** Capacités pré-remplies à la sélection de l'appareil, et modifiables. */
  function choisirAeronef(valeur: string): void {
    setImmat(valeur);
    const a = aeronefs?.find((x) => x.immatriculation === valeur);
    if (a) {
      setPlaces(String(a.capacite_places));
      setCargo(String(Number(a.capacite_cargo_kg)));
    }
  }

  function ajouterEtape(baseId: string): void {
    if (!baseId) return;
    // Un point consécutif identique est refusé ICI aussi, pas seulement côté
    // serveur : signaler l'erreur au moment du clic évite un aller-retour et
    // une erreur en fin de saisie, quand tout le reste est déjà rempli.
    const precedent = etapes.length ? etapes[etapes.length - 1] : user?.base_id;
    if (baseId === precedent) {
      toast.error('Deux points consécutifs ne peuvent pas être la même base.');
      return;
    }
    setEtapes((e) => [...e, baseId]);
  }

  function deplacer(index: number, delta: number): void {
    const cible = index + delta;
    if (cible < 0 || cible >= etapes.length) return;
    const copie = [...etapes];
    [copie[index], copie[cible]] = [copie[cible], copie[index]];
    setEtapes(copie);
  }

  const itineraireComplet = useMemo(
    () => [user?.base_id ?? '', ...etapes],
    [etapes, user?.base_id],
  );

  const consecutifInvalide = useMemo(() => {
    for (let i = 1; i < itineraireComplet.length; i++) {
      if (itineraireComplet[i] === itineraireComplet[i - 1]) return i;
    }
    return null;
  }, [itineraireComplet]);

  const complet = Boolean(
    numero && immat && dateHeure && typeMission && places && cargo
    && combordId && etapes.length && consecutifInvalide === null,
  );

  function envoyer(): void {
    const cdb = combords.find((c) => c.id === combordId);
    if (!cdb) {
      toast.error('Sélectionnez un commandant de bord.');
      return;
    }
    creation.mutate({
      numero_mission: numero.trim().toUpperCase(),
      immatriculation: immat,
      date_heure: new Date(dateHeure).toISOString(),
      type_mission: typeMission,
      capacite_places: Number(places),
      capacite_cargo_kg: Number(cargo),
      combord_id: cdb.id,
      combord_grade: cdb.grade,
      combord_nom: cdb.nom,
      combord_prenom: cdb.prenom,
      itineraire: etapes.map((base_id) => ({ base_id })),
    });
  }

  const nomBase = (id: string): string => {
    const b = bases?.find((x) => x.id === id);
    return b ? `${b.code_base} — ${b.nom}` : id;
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20">
      <div className="flex w-full max-w-2xl flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Planifier un vol</h2>
            <p className="text-sm text-slate-500">
              Le départ est votre base d'affectation ; elle ne se choisit pas.
            </p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="N° de mission" obligatoire>
              <input value={numero} onChange={(e) => setNumero(e.target.value.toUpperCase())}
                     placeholder="MIS-2026-014" className={CLASSE_INPUT} />
            </Champ>

            <Champ label="Date et heure de départ" obligatoire>
              <input type="datetime-local" value={dateHeure}
                     onChange={(e) => setDateHeure(e.target.value)} className={CLASSE_INPUT} />
            </Champ>

            <Champ label="Aéronef" obligatoire>
              <select value={immat} onChange={(e) => choisirAeronef(e.target.value)}
                      className={CLASSE_INPUT}>
                <option value="">— Sélectionner —</option>
                {aeronefs?.filter((a) => a.actif).map((a: AeronefDB) => (
                  <option key={a.immatriculation} value={a.immatriculation}>
                    {a.immatriculation} — {a.type} ({a.capacite_places} pl.)
                  </option>
                ))}
              </select>
            </Champ>

            <Champ label="Type de mission" obligatoire>
              <select value={typeMission}
                      onChange={(e) => setTypeMission(e.target.value as TypeMission)}
                      className={CLASSE_INPUT}>
                <option value="">— Sélectionner —</option>
                {TYPES_MISSION.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Champ>

            <Champ
              label="Places retenues" obligatoire
              aide={aeronef ? `Maximum appareil : ${aeronef.capacite_places}` : undefined}
            >
              <input type="number" min={1} value={places}
                     onChange={(e) => setPlaces(e.target.value)} className={CLASSE_INPUT} />
            </Champ>

            <Champ
              label="Masse retenue (kg)" obligatoire
              aide={aeronef ? `Maximum appareil : ${Number(aeronef.capacite_cargo_kg)} kg` : undefined}
            >
              <input type="number" min={0} step="0.01" value={cargo}
                     onChange={(e) => setCargo(e.target.value)} className={CLASSE_INPUT} />
            </Champ>
          </div>

          <Champ
            label="Commandant de bord" obligatoire
            aide="Sans compte rattaché, le visa final du manifeste ne pourra pas être apposé."
          >
            <select value={combordId} onChange={(e) => setCombordId(e.target.value)}
                    className={CLASSE_INPUT}>
              <option value="">— Sélectionner —</option>
              {combords.map((c) => (
                <option key={c.id} value={c.id}>{c.grade} {c.nom} {c.prenom}</option>
              ))}
            </select>
            {!combords.length && personnels && (
              <p className="mt-1 text-xs text-red-600">
                Aucun compte au rôle « commandant de bord » n'est actif. Un administrateur
                doit en créer un avant toute planification.
              </p>
            )}
          </Champ>

          {/* ── Itinéraire ── */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
              <MapPin className="h-4 w-4" /> Itinéraire
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Une base peut revenir plusieurs fois — c'est le cas de l'aller-retour.
              Seuls deux points <em>consécutifs</em> identiques sont refusés.
            </p>

            <ol className="space-y-2">
              <li className="flex items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="w-6 text-center font-medium text-slate-500">1</span>
                <span className="flex-1 text-slate-800">
                  {baseDepart ? `${baseDepart.code_base} — ${baseDepart.nom}` : 'Votre base'}
                </span>
                <span className="text-xs italic text-slate-500">Départ imposé</span>
              </li>

              {etapes.map((baseId, i) => (
                <li key={`${baseId}-${i}`}
                    className="flex items-center gap-3 rounded border border-slate-200 px-3 py-2 text-sm">
                  <span className="w-6 text-center font-medium text-slate-500">{i + 2}</span>
                  <span className="flex-1 text-slate-800">{nomBase(baseId)}</span>
                  {i === etapes.length - 1 && (
                    <span className="text-xs italic text-slate-500">Destination finale</span>
                  )}
                  <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0}
                          aria-label="Monter"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => deplacer(i, 1)}
                          disabled={i === etapes.length - 1} aria-label="Descendre"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Retirer"
                          onClick={() => setEtapes((e) => e.filter((_, j) => j !== i))}
                          className="rounded p-1 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-3 flex gap-2">
              <select
                value=""
                onChange={(e) => ajouterEtape(e.target.value)}
                className={CLASSE_INPUT}
              >
                <option value="">— Ajouter un point —</option>
                {bases?.map((b: BaseDB) => (
                  <option key={b.id} value={b.id}>{b.code_base} — {b.nom}</option>
                ))}
              </select>
            </div>

            {consecutifInvalide !== null && (
              <p className="mt-2 text-xs text-red-600">
                Les points {consecutifInvalide} et {consecutifInvalide + 1} portent la même base.
              </p>
            )}
          </section>
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
              : <Plus className="h-4 w-4" />}
            Planifier
          </button>
        </footer>
      </div>
    </div>
  );
}

const CLASSE_INPUT =
  'w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none';

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