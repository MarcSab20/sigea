// apps/frontend/src/app/admin/admin.shared.tsx
//
// Types, constantes et briques d'interface partagés par les onglets de
// l'Administration.
//
// Ces éléments vivaient dans `AdminPage.tsx`. Les nouveaux onglets (Intérims,
// Mouvements) en ont besoin ; les dupliquer aurait garanti qu'ils divergent au
// premier ajustement de thème. Ils sont donc extraits ici, sans changement de
// comportement pour les onglets existants.

import React, { useState } from 'react';
import { T } from '@/lib/theme';
import './admin.css';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Utilisateur {
  id: string; nom: string; prenom: string; grade: string;
  login: string; role: string; base_id: string; actif: boolean;
  last_login?: string; createdAt: string;
  email?: string | null;

  /** ── État de sécurité ──
   *  Ces trois champs viennent d'être ajoutés au select de
   *  `personnels.service.ts`. Sans cette modification côté serveur, ils
   *  arrivent `undefined` et l'IHM se comporte comme avant : rien n'est
   *  signalé. Les rendre optionnels évite donc un écran cassé si le backend
   *  n'a pas encore été redéployé. */
  verrouille_securite?: boolean;
  motif_verrouillage?: string | null;
  nb_echecs_connexion?: number;
}

/** Personne réduite, telle que renvoyée par les `include` du service intérim. */
export interface Partie {
  id: string; nom: string; prenom: string; grade: string; role?: string;
}

export interface Interim {
  id: string;
  titulaire_id: string; suppleant_id: string;
  titulaire: Partie; suppleant: Partie;
  role_delegue: string;
  base_id: string; escadron_id?: string | null;
  motif?: string | null;
  date_debut: string; date_fin?: string | null;
  actif: boolean;
  cree_par: string;
  revoque_par?: string | null; revoque_le?: string | null;
  motif_revocation?: string | null;
  createdAt: string;
}

export interface Mouvement {
  id: string;
  utilisateur_id: string; utilisateur: Partie;
  successeur_id?: string | null; successeur?: Partie | null;
  type: 'MUTATION' | 'DEPART' | 'SUSPENSION' | 'REINTEGRATION';
  base_avant?: string | null;   base_apres?: string | null;
  role_avant?: string | null;   role_apres?: string | null;
  escadron_avant?: string | null; escadron_apres?: string | null;
  date_effet: string;
  motif?: string | null; reference?: string | null;
  decide_par: string; createdAt: string;
}

export interface Escadron { id: string; code: string; nom: string; base_id?: string; }

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Rôles applicatifs.
 *
 * ⚠ `comea` et `mage` ont été AJOUTÉS. Ils existent dans l'énumération
 * `RoleUtilisateur` (libs/shared-types/src/enums.ts) et sont utilisés par le
 * moteur de circuit, mais la liste de l'IHM ne les contenait pas : il était
 * donc impossible de créer un COMEA ou un MAGE depuis l'écran, et un compte
 * portant l'un de ces rôles s'affichait avec son identifiant brut.
 */
export const ROLES = [
  { value: 'chef_escale', label: "Chef d'Escale",   color: T.green },
  { value: 'comea',       label: 'COMEA',           color: T.green },
  { value: 'comeso',      label: 'COMESO',          color: T.blue },
  { value: 'comgmo',      label: 'COMGMO',          color: T.blue },
  { value: 'combord',     label: 'COMBORD',         color: T.amberLight },
  { value: 'combase',     label: 'COMBASE',         color: T.textSub },
  { value: 'cemaa',       label: 'CEMAA',           color: T.red },
  { value: 'mage',        label: 'MAGE',            color: T.red },
  { value: 'admin',       label: 'Administrateur',  color: T.red },
];

export const BASES_FAC = [
  { id: 'BA101', code: 'BA101', nom: 'Base Aérienne 101 Yaoundé',    region: 'Centre' },
  { id: 'BA201', code: 'BA201', nom: 'Base Aérienne 201 Douala',     region: 'Littoral' },
  { id: 'BA301', code: 'BA301', nom: 'Base Aérienne 301 Garoua',     region: 'Nord' },
  { id: 'BA401', code: 'BA401', nom: 'Base Aérienne 401 Maroua',     region: 'Extrême-Nord' },
  { id: 'BA302', code: 'BA302', nom: 'Base Aérienne 302 Ngaoundéré', region: 'Adamaoua' },
  { id: 'BA501', code: 'BA501', nom: 'Base Aérienne 501 Bamenda',    region: 'Nord-Ouest' },
  { id: 'BA102', code: 'BA102', nom: 'Base Aérienne 102 Bertoua',    region: 'Est' },
];

export const GRADES = [
  "Général de Corps d'Armée Aérienne", 'Général de Division Aérienne',
  'Général de Brigade Aérienne', 'Colonel', 'Lieutenant-Colonel',
  'Commandant', 'Capitaine', 'Lieutenant', 'Sous-Lieutenant',
  'Adjudant-Chef', 'Adjudant', 'Sergent-Chef', 'Sergent', 'Caporal-Chef', 'Caporal',
];

export const TYPES_MOUVEMENT = [
  { value: 'MUTATION',      label: 'Mutation',      color: T.blue,       icone: '⇄',
    aide: "Changement d'affectation. La nouvelle base est obligatoire." },
  { value: 'DEPART',        label: 'Départ',        color: T.red,        icone: '↦',
    aide: "Sortie des effectifs. Le compte est désactivé." },
  { value: 'SUSPENSION',    label: 'Suspension',    color: T.amberLight, icone: '‖',
    aide: "Suspension temporaire des fonctions. Le compte est désactivé, l'affectation est conservée." },
  { value: 'REINTEGRATION', label: 'Réintégration', color: T.green,      icone: '↺',
    aide: "Retour en fonction après suspension. Le compte est réactivé." },
];

/** Nombre d'échecs consécutifs avant verrouillage — MAX_ECHECS côté serveur
 *  (apps/auth-service/src/auth/auth.service.ts). Modifier les deux ensemble. */
export const MAX_ECHECS = 3;

/* ═══════════════════════════════════════════════════════════════════════════
   OUTILS
   ═══════════════════════════════════════════════════════════════════════════ */

export const libelleRole = (r?: string | null): string =>
  ROLES.find(x => x.value === r)?.label ?? r ?? '—';

export const couleurRole = (r?: string | null): string =>
  ROLES.find(x => x.value === r)?.color ?? T.textDim;

export const codeBase = (id?: string | null): string =>
  BASES_FAC.find(b => b.id === id)?.code ?? id ?? '—';

export const nomComplet = (p?: Partie | null): string =>
  p ? `${p.grade ? p.grade + ' ' : ''}${p.nom} ${p.prenom}`.trim() : '—';

export function dateFr(v?: string | null, avecHeure = false): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return avecHeure
    ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric',
                                 hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR');
}

/** Message d'erreur d'axios, ou repli. Les services renvoient `message` en
 *  clair ; l'afficher tel quel évite les « Erreur » opaques. */
export function messageErreur(e: unknown, repli = 'Erreur'): string {
  const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(m)) return m.join(' · ');
  return m ?? repli;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BRIQUES D'INTERFACE
   ═══════════════════════════════════════════════════════════════════════════ */

export function Card({ children, style = {} }: {
  children: React.ReactNode; style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style,
    }}>{children}</div>
  );
}

export function Field({
  label, value, onChange, type = 'text', required, options, placeholder, disabled, aide,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; disabled?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string; aide?: string;
}): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    background: disabled ? T.bgAlt : (focused ? T.bgCard : T.bgInput),
    border: `1px solid ${focused ? T.green : T.border}`, borderRadius: 6,
    color: disabled ? T.textDim : T.text, fontSize: 13, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color .2s, box-shadow .2s',
    fontFamily: T.body,
    boxShadow: focused ? `0 0 0 3px ${T.green}20` : 'none',
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
        {label}{required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
      </label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            ...base, appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234a4540' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32,
          }}>
          <option value="">— Sélectionner —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled} rows={3}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...base, resize: 'vertical', minHeight: 74, lineHeight: 1.55 }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={base} />
      )}
      {aide && (
        <div style={{ fontSize: 10.5, color: T.textDim, marginTop: 5, lineHeight: 1.5 }}>{aide}</div>
      )}
    </div>
  );
}

export function Badge({ label, color, titre }: {
  label: string; color: string; titre?: string;
}): React.ReactElement {
  return (
    <span title={titre} style={{
      fontSize: 10, fontWeight: 600, color, background: `${color}18`,
      border: `1px solid ${color}40`, borderRadius: 4, padding: '2px 8px',
      textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.05em',
      display: 'inline-block',
    }}>{label}</span>
  );
}

export function Modal({ title, onClose, children, largeur = 560 }: {
  title: string; onClose: () => void; children: React.ReactNode; largeur?: number;
}): React.ReactElement {
  return (
    <div
      className="ad-scope ad-voile"
      role="presentation"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
      <div className="ad-panneau" role="dialog" aria-modal="true" aria-label={title}
        style={{
          background: T.bgCard, borderRadius: 10, width: '100%', maxWidth: largeur,
          maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: `1px solid ${T.border}`,
        }}>
        <div style={{
          padding: '16px 24px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: T.bgCard, zIndex: 1,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{title}</div>
          <button onClick={onClose} aria-label="Fermer" className="ad-btn" style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
            color: T.textDim, lineHeight: 1,
          }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

export function StatMini({ label, value, color, onClick, actif }: {
  label: string; value: number | string; color: string;
  onClick?: () => void; actif?: boolean;
}): React.ReactElement {
  const contenu = (
    <>
      <div style={{
        fontSize: 10, color: T.textDim, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: T.display }}>{value}</div>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: color, opacity: actif ? 1 : 0.25, transition: 'opacity .22s ease',
      }} />
    </>
  );

  const style: React.CSSProperties = {
    padding: '14px 18px', background: T.bgCard,
    border: `1px solid ${actif ? color : T.border}`, borderRadius: 8,
    position: 'relative', overflow: 'hidden', textAlign: 'left', width: '100%',
  };

  // Une vignette cliquable est un bouton, pas un <div> avec un `onClick` :
  // c'est ce qui la rend atteignable au clavier.
  return onClick
    ? <button type="button" onClick={onClick} className="ad-btn ad-btn-lift"
              aria-pressed={actif} style={{ ...style, cursor: 'pointer' }}>{contenu}</button>
    : <div style={style}>{contenu}</div>;
}

/** Barre d'outils d'un tableau : recherche, filtres, actualisation, action. */
export function BarreOutils({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{
      padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
      display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
    }}>{children}</div>
  );
}

export function Recherche({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}): React.ReactElement {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        flex: 1, minWidth: 200, padding: '8px 12px', background: T.bgInput,
        border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
        fontSize: 13, outline: 'none', fontFamily: T.body,
      }} />
  );
}

export function Selecteur({ value, onChange, vide, options }: {
  value: string; onChange: (v: string) => void; vide: string;
  options: { value: string; label: string }[];
}): React.ReactElement {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        padding: '8px 12px', background: T.bgInput, border: `1px solid ${T.border}`,
        borderRadius: 6, color: T.text, fontSize: 12, outline: 'none', cursor: 'pointer',
      }}>
      <option value="">{vide}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function BoutonActualiser({ onClick, busy }: {
  onClick: () => void; busy?: boolean;
}): React.ReactElement {
  return (
    <button onClick={onClick} disabled={busy} className="ad-btn" style={{
      padding: '8px 14px', background: T.bgAlt, border: `1px solid ${T.border}`,
      borderRadius: 6, color: T.textDim, fontSize: 12, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 7,
    }}>
      <span className="ad-spin" data-busy={busy ? '1' : '0'}>↻</span>
      Actualiser
    </button>
  );
}

export function BoutonPrincipal({ onClick, children, disabled, couleur = T.green }: {
  onClick: () => void; children: React.ReactNode; disabled?: boolean; couleur?: string;
}): React.ReactElement {
  return (
    <button onClick={onClick} disabled={disabled} className="ad-btn ad-btn-lift" style={{
      padding: '8px 18px', background: disabled ? T.textMute : couleur, border: 'none',
      borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{children}</button>
  );
}

/** Squelettes de chargement, à la forme du contenu attendu : la page ne se
 *  réorganise pas à l'arrivée des données. */
export function Squelette({ lignes = 5, hauteur = 46 }: {
  lignes?: number; hauteur?: number;
}): React.ReactElement {
  return (
    <div style={{ padding: '10px 20px' }}>
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="ad-skel"
          style={{ height: hauteur, marginBottom: 8, opacity: 1 - i * 0.13 }} />
      ))}
    </div>
  );
}

export function Vide({ titre, aide, icone = '—' }: {
  titre: string; aide?: string; icone?: string;
}): React.ReactElement {
  return (
    <div style={{ padding: '54px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 30, color: T.textMute, marginBottom: 10, fontFamily: T.display }}>
        {icone}
      </div>
      <div style={{ fontSize: 13, color: T.textSub, fontWeight: 600 }}>{titre}</div>
      {aide && (
        <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 6, maxWidth: 400,
                      marginInline: 'auto', lineHeight: 1.6 }}>{aide}</div>
      )}
    </div>
  );
}

/** Entête de tableau. `cols` doit correspondre au `gridTemplateColumns` des
 *  lignes — les deux sont passés par l'appelant pour rester alignés. */
export function EnteteTable({ cols, colonnes }: {
  cols: string; colonnes: React.ReactNode[];
}): React.ReactElement {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, gap: 10,
      padding: '9px 20px', fontSize: 10, fontWeight: 600, color: T.textDim,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      borderBottom: `1px solid ${T.border}`,
    }}>
      {colonnes.map((c, i) => <span key={i}>{c}</span>)}
    </div>
  );
}