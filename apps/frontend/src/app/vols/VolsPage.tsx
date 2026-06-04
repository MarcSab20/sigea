// apps/frontend/src/app/vols/VolsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { volApi, Vol } from '@/services/manifeste.service';
import { T } from '@/lib/theme';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const BASES_FAC = [
  { id: 'BA101', code: 'BA 101', nom: 'Yaoundé',    region: 'Centre' },
  { id: 'BA102', code: 'BA 102', nom: 'Douala',     region: 'Littoral' },
  { id: 'BA201', code: 'BA 201', nom: 'Garoua',     region: 'Nord' },
  { id: 'BA301', code: 'BA 301', nom: 'Maroua',     region: 'Extrême-Nord' },
  { id: 'BA302', code: 'BA 302', nom: 'Ngaoundéré', region: 'Adamaoua' },
  { id: 'BA401', code: 'BA 401', nom: 'Bafoussam',  region: 'Ouest' },
  { id: 'BA501', code: 'BA 501', nom: 'Bertoua',    region: 'Est' },
];

const AERONEFS_FAC = [
  { immat: 'TJ-AAF', type: 'C-130 Hercule', places: 92,  cargo: 19000 },
  { immat: 'TJ-ABB', type: 'Agusta',        places: 12,  cargo: 1500  },
  { immat: 'TJ-ACC', type: 'CESSNA 2B',     places: 8,   cargo: 800   },
  { immat: 'TJ-AZZ', type: 'Z9',            places: 10,  cargo: 1200  },
  { immat: 'TJ-AMI', type: 'MI-17',         places: 24,  cargo: 4000  },
];

const GRADES_MILITAIRES = [
  'Général de Corps d\'Armée Aérienne','Général de Division Aérienne',
  'Général de Brigade Aérienne','Colonel','Lieutenant-Colonel',
  'Commandant','Capitaine','Lieutenant','Sous-Lieutenant',
  'Adjudant-Chef','Adjudant','Sergent-Chef','Sergent',
];

const TYPE_MISSIONS = [
  { value: 'PROJECTION',  label: 'Projection' },
  { value: 'PARA',        label: 'Parachutage' },
  { value: 'LIAISON',     label: 'Liaison' },
  { value: 'LOGISTIQUE',  label: 'Logistique' },
  { value: 'EVASAN',      label: 'EVASAN — Évacuation sanitaire' },
  { value: 'VIP',         label: 'VIP' },
  { value: 'OP_SENSIBLE', label: 'Opération sensible' },
];

interface EscaleCapacite {
  base_id: string;
  capacite_places: number;
  capacite_cargo_kg: number;
}

function Card({ children, style={} }: { children: React.ReactNode; style?: React.CSSProperties }): React.ReactElement {
  return <div style={{ background: T.bgCard, border: `1px solid ${T.border}`,
    borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>{children}</div>;
}

function Field({ label, value, onChange, type='text', required, options, placeholder, disabled, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; disabled?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string; hint?: string;
}): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    background: disabled ? T.bgAlt : (focused ? T.bgCard : T.bgInput),
    border: `1px solid ${focused ? T.green : T.border}`, borderRadius: 6,
    color: disabled ? T.textDim : T.text, fontSize: 13, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s', fontFamily: T.body,
    boxShadow: focused ? `0 0 0 3px ${T.green}20` : 'none',
    cursor: disabled ? 'not-allowed' : 'auto',
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600,
        color: T.textSub, marginBottom: 5 }}>
        {label}{required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
      </label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...base, appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234a4540' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32 }}>
          <option value="">— Sélectionner —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={base} />
      )}
      {hint && <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function SectionTitle({ title }: { title: string }): React.ReactElement {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub,
      textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14,
      marginTop: 6, paddingBottom: 8, borderBottom: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 3, height: 14, background: T.green, borderRadius: 2 }} />
      {title}
    </div>
  );
}

// ─── Liste vols ───────────────────────────────────────────────────────────────
function VolsListPage(): React.ReactElement {
  const navigate = useNavigate();
  const [vols, setVols] = useState<Vol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    volApi.list().then(setVols).catch(() => toast.error('Erreur chargement vols')).finally(() => setLoading(false));
  }, []);

  const getBase = (id: string): string => {
    const b = BASES_FAC.find(x => x.id === id || x.code.replace(' ','') === id.replace(' ',''));
    return b?.code ?? id?.slice(0, 6) ?? '—';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.display }}>
            Vols Planifiés
          </h1>
          <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>
            Missions aériennes des Forces Aériennes du Cameroun
          </p>
        </div>
        <button onClick={() => navigate('/vols/nouveau')} style={{
          padding: '10px 20px', background: T.green, border: 'none',
          borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nouveau Vol
        </button>
      </div>
      <Card>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textDim }}>Chargement…</div>
        ) : vols.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✈</div>
            <div style={{ fontSize: 14, color: T.textDim, marginBottom: 20 }}>Aucun vol planifié</div>
            <button onClick={() => navigate('/vols/nouveau')} style={{
              padding: '10px 24px', background: T.green, border: 'none',
              borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Planifier un vol
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid',
              gridTemplateColumns: '160px 1fr 180px 160px 60px 80px 100px',
              padding: '10px 20px', fontSize: 10, fontWeight: 600, color: T.textDim,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              borderBottom: `1px solid ${T.border}` }}>
              <span>N° Mission</span><span>Trajet · COMBORD</span><span>Date / Heure</span>
              <span>Type</span><span>PAX</span><span>Statut</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {vols.map(v => {
              const vAny = v as any;
              return (
                <div key={v.id} className="row-hover" style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr 180px 160px 60px 80px 100px',
                  padding: '13px 20px', borderBottom: `1px solid ${T.border}`,
                  alignItems: 'center', transition: 'background 0.1s' }}>
                  <span style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 600, color: T.green }}>
                    {v.numero_mission}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: T.text }}>
                      {v.immatriculation} · {getBase(v.base_depart_id)} → {getBase(v.base_arrivee_id)}
                    </div>
                    {vAny.combord_nom && (
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
                        COMBORD : {vAny.combord_grade} {vAny.combord_nom} {vAny.combord_prenom}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: T.textSub }}>
                    {new Date(v.date_heure).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                  <span style={{ fontSize: 11, color: T.textSub, background: T.bgAlt,
                    borderRadius: 4, padding: '2px 8px' }}>
                    {TYPE_MISSIONS.find(t => t.value === v.type_mission)?.label ?? v.type_mission}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                    {v.capacite_places}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600,
                    color: v.statut === 'PLANIFIE' ? T.blue : T.green,
                    background: v.statut === 'PLANIFIE' ? T.blueBg : T.greenBg,
                    borderRadius: 4, padding: '2px 6px' }}>
                    {v.statut}
                  </span>
                  <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                    <button onClick={() => navigate(`/manifestes/nouveau?vol=${v.id}`)} style={{
                      padding: '4px 8px', background: T.greenBg,
                      border: `1px solid ${T.greenBorder}`, borderRadius: 4,
                      color: T.green, fontSize: 10, cursor: 'pointer', fontWeight: 500 }}>
                      Manifeste
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Nouveau vol ──────────────────────────────────────────────────────────────
function NouveauVolPage(): React.ReactElement {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [escales, setEscales] = useState<EscaleCapacite[]>([]);

  const [form, setForm] = useState({
    numero_mission: '', immatriculation: '', date_heure: '',
    base_depart_id: '', base_arrivee_id: '', type_mission: '',
    capacite_places: '', capacite_cargo_kg: '',
    combord_grade: '', combord_nom: '', combord_prenom: '',
  });

  const set = (k: string) => (v: string): void => setForm(f => ({ ...f, [k]: v }));

  const handleAeronefChange = (immat: string): void => {
    const a = AERONEFS_FAC.find(x => x.immat === immat);
    setForm(f => ({
      ...f, immatriculation: immat,
      capacite_places:   a ? String(a.places) : '',
      capacite_cargo_kg: a ? String(a.cargo)  : '',
    }));
    // Réinitialiser les escales avec la nouvelle capacité
    setEscales([]);
  };

  const aeronef = AERONEFS_FAC.find(a => a.immat === form.immatriculation);

  const addEscale = (): void => {
    setEscales(prev => [...prev, {
      base_id: '',
      capacite_places: aeronef?.places ?? 0,
      capacite_cargo_kg: aeronef?.cargo ?? 0,
    }]);
  };

  const removeEscale = (i: number): void =>
    setEscales(prev => prev.filter((_, idx) => idx !== i));

  const updateEscale = (i: number, field: keyof EscaleCapacite, value: string | number): void =>
    setEscales(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

  // Bases disponibles pour escales (pas départ ni arrivée)
  const basesEscales = BASES_FAC.filter(b =>
    b.id !== form.base_depart_id && b.id !== form.base_arrivee_id &&
    !escales.find(e => e.base_id === b.id)
  );

  const isValid = form.numero_mission && form.immatriculation && form.date_heure &&
    form.base_depart_id && form.base_arrivee_id && form.type_mission &&
    form.combord_grade && form.combord_nom && form.combord_prenom &&
    escales.every(e => e.base_id);

  const handleSubmit = async (): Promise<void> => {
    if (!isValid) { toast.error('Remplissez tous les champs obligatoires'); return; }
    if (form.base_depart_id === form.base_arrivee_id) {
      toast.error('Base de départ et d\'arrivée différentes requises'); return;
    }
    setSubmitting(true);
    try {
      await api.post('/vols', {
        ...form,
        capacite_places:   Number(form.capacite_places),
        capacite_cargo_kg: Number(form.capacite_cargo_kg),
        escales: escales.length > 0 ? escales : undefined,
      });
      toast.success('Vol planifié avec succès');
      navigate('/vols');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Erreur de création'));
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.display }}>
          Planifier un Vol
        </h1>
        <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>
          Création d'une nouvelle mission aérienne
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Identification */}
          <Card style={{ padding: '22px 26px' }}>
            <SectionTitle title="Identification de la mission" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="Numéro de mission" value={form.numero_mission}
                onChange={set('numero_mission')} required placeholder="MIS-2026-XXXX" />
              <Field label="Type de mission" value={form.type_mission}
                onChange={set('type_mission')} required options={TYPE_MISSIONS} />
            </div>
            <Field label="Date et heure de départ" value={form.date_heure}
              onChange={set('date_heure')} type="datetime-local" required />
          </Card>

          {/* Commandant de bord */}
          <Card style={{ padding: '22px 26px',
            border: `1px solid ${T.greenBorder}`, background: T.greenBg }}>
            <SectionTitle title="Commandant de Bord (COMBORD)" />
            <div style={{ padding: '8px 12px', background: T.bgCard,
              border: `1px solid ${T.border}`, borderRadius: 6, marginBottom: 14,
              fontSize: 11, color: T.textSub, lineHeight: 1.6 }}>
              Le COMBORD valide en dernier après toute la chaîne (Chef Escale → COMESO →
              COMGMO → COMBASE). Sa signature finale rend le manifeste opérationnel.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <Field label="Grade" value={form.combord_grade} onChange={set('combord_grade')}
                required options={GRADES_MILITAIRES.map(g => ({ value: g, label: g }))} />
              <Field label="Nom" value={form.combord_nom} onChange={set('combord_nom')}
                required placeholder="NOM" />
              <Field label="Prénom(s)" value={form.combord_prenom} onChange={set('combord_prenom')}
                required placeholder="Prénoms" />
            </div>
          </Card>

          {/* Trajet */}
          <Card style={{ padding: '22px 26px' }}>
            <SectionTitle title="Trajet" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: '0 12px', alignItems: 'end' }}>
              <Field label="Base de départ" value={form.base_depart_id}
                onChange={set('base_depart_id')} required
                options={BASES_FAC.map(b => ({ value: b.id, label: `${b.code} — ${b.nom}` }))} />
              <div style={{ marginBottom: 14, textAlign: 'center', fontSize: 20,
                color: T.textDim, paddingTop: 20 }}>→</div>
              <Field label="Base d'arrivée" value={form.base_arrivee_id}
                onChange={set('base_arrivee_id')} required
                options={BASES_FAC.filter(b => b.id !== form.base_depart_id)
                  .map(b => ({ value: b.id, label: `${b.code} — ${b.nom}` }))} />
            </div>

            {/* Escales intermédiaires */}
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>
                  Escales intermédiaires ({escales.length})
                </div>
                <button onClick={addEscale} disabled={basesEscales.length === 0}
                  style={{ padding: '5px 12px', background: T.blueBg,
                    border: `1px solid ${T.blueBorder}`, borderRadius: 5,
                    color: T.blue, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                  + Ajouter une escale
                </button>
              </div>

              {escales.length === 0 ? (
                <div style={{ padding: '10px 14px', background: T.bgAlt,
                  borderRadius: 5, fontSize: 11, color: T.textDim, textAlign: 'center' }}>
                  Vol direct — aucune escale intermédiaire
                </div>
              ) : escales.map((e, i) => (
                <div key={i} style={{ padding: '12px 14px', background: T.bgAlt,
                  border: `1px solid ${T.border}`, borderRadius: 6,
                  marginBottom: 8, position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub }}>
                      Escale {i + 1}
                    </div>
                    <button onClick={() => removeEscale(i)} style={{
                      background: T.redBg, border: `1px solid ${T.redBorder}`,
                      borderRadius: 4, color: T.red, fontSize: 10, cursor: 'pointer',
                      padding: '2px 8px' }}>Supprimer</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600,
                        color: T.textSub, marginBottom: 5 }}>
                        Base <span style={{ color: T.red }}>*</span>
                      </label>
                      <select value={e.base_id}
                        onChange={ev => updateEscale(i, 'base_id', ev.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: T.bgCard,
                          border: `1px solid ${T.border}`, borderRadius: 5,
                          color: T.text, fontSize: 12, outline: 'none' }}>
                        <option value="">— Sélectionner —</option>
                        {[...basesEscales, ...(e.base_id ? [BASES_FAC.find(b => b.id === e.base_id)!] : [])].filter(Boolean)
                          .map(b => <option key={b.id} value={b.id}>{b.code} — {b.nom}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600,
                        color: T.textSub, marginBottom: 5 }}>
                        Capacité PAX <span style={{ color: T.red }}>*</span>
                      </label>
                      <input type="number" value={e.capacite_places}
                        onChange={ev => updateEscale(i, 'capacite_places', Number(ev.target.value))}
                        style={{ width: '100%', padding: '8px 10px', background: T.bgCard,
                          border: `1px solid ${T.border}`, borderRadius: 5,
                          color: T.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
                        Max : {form.capacite_places || '?'} places
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600,
                        color: T.textSub, marginBottom: 5 }}>
                        Capacité cargo (kg) <span style={{ color: T.red }}>*</span>
                      </label>
                      <input type="number" value={e.capacite_cargo_kg}
                        onChange={ev => updateEscale(i, 'capacite_cargo_kg', Number(ev.target.value))}
                        style={{ width: '100%', padding: '8px 10px', background: T.bgCard,
                          border: `1px solid ${T.border}`, borderRadius: 5,
                          color: T.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
                        Max : {form.capacite_cargo_kg || '?'} kg
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Aéronef + capacités */}
          <Card style={{ padding: '22px 26px' }}>
            <SectionTitle title="Aéronef et capacités" />
            <Field label="Aéronef" value={form.immatriculation}
              onChange={handleAeronefChange} required
              options={AERONEFS_FAC.map(a => ({
                value: a.immat,
                label: `${a.immat} — ${a.type} (${a.places} PAX / ${a.cargo.toLocaleString()} kg)`
              }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="Capacité PAX totale" value={form.capacite_places}
                onChange={set('capacite_places')} type="number" required
                disabled={!!aeronef}
                hint={aeronef ? `Standard ${aeronef.type}` : ''} />
              <Field label="Capacité cargo totale (kg)" value={form.capacite_cargo_kg}
                onChange={set('capacite_cargo_kg')} type="number" required
                disabled={!!aeronef}
                hint={aeronef ? `Standard ${aeronef.type}` : ''} />
            </div>
          </Card>

          {/* Alertes */}
          {form.type_mission === 'OP_SENSIBLE' && (
            <div style={{ padding: '12px 16px', background: T.amberBg,
              border: `1px solid ${T.amberBorder}`, borderRadius: 6,
              fontSize: 12, color: T.amber, display: 'flex', gap: 8 }}>
              ⚠ Mission sensible — circuit CEMAA activé automatiquement
            </div>
          )}
          {form.type_mission === 'EVASAN' && (
            <div style={{ padding: '12px 16px', background: T.redBg,
              border: `1px solid ${T.redBorder}`, borderRadius: 6,
              fontSize: 12, color: T.red, display: 'flex', gap: 8 }}>
              ✚ EVASAN — circuit accéléré, notification médecin de base
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => navigate('/vols')} style={{
              padding: '10px 24px', background: T.bgAlt,
              border: `1px solid ${T.border}`, borderRadius: 6,
              color: T.textSub, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
            <button onClick={handleSubmit} disabled={!isValid || submitting} style={{
              padding: '10px 28px',
              background: (!isValid || submitting) ? T.textMute : T.green,
              border: 'none', borderRadius: 6, color: '#fff', fontSize: 13,
              fontWeight: 600, cursor: (!isValid || submitting) ? 'not-allowed' : 'pointer',
              opacity: (!isValid || submitting) ? 0.6 : 1 }}>
              {submitting ? 'Planification…' : 'Planifier ce vol →'}
            </button>
          </div>
        </div>

        {/* Panneau de synthèse */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Fiche aéronef */}
          {aeronef && (
            <Card style={{ padding: '16px 18px', background: T.greenBg,
              border: `1px solid ${T.greenBorder}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.green,
                marginBottom: 8 }}>✈ {aeronef.immat}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>
                {aeronef.type}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: T.textDim }}>PAX max</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.green }}>{aeronef.places}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: T.textDim }}>Cargo max</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.green }}>
                  {aeronef.cargo.toLocaleString()} kg
                </span>
              </div>
            </Card>
          )}

          {/* Synthèse trajet */}
          {(form.base_depart_id || form.base_arrivee_id || escales.length > 0) && (
            <Card style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Itinéraire
              </div>
              {[
                form.base_depart_id && BASES_FAC.find(b => b.id === form.base_depart_id),
                ...escales.map(e => BASES_FAC.find(b => b.id === e.base_id)),
                form.base_arrivee_id && BASES_FAC.find(b => b.id === form.base_arrivee_id),
              ].filter(Boolean).map((b, i, arr) => (
                <React.Fragment key={i}>
                  <div style={{ padding: '6px 10px', background: i === 0 ? T.greenBg : i === arr.length-1 ? T.blueBg : T.amberBg,
                    border: `1px solid ${i === 0 ? T.greenBorder : i === arr.length-1 ? T.blueBorder : T.amberBorder}`,
                    borderRadius: 5, fontSize: 11, fontWeight: 600,
                    color: i === 0 ? T.green : i === arr.length-1 ? T.blue : T.amber }}>
                    {i === 0 ? '🛫' : i === arr.length-1 ? '🛬' : '⏸'} {(b as any).code} — {(b as any).nom}
                    {escales[i-1] && (
                      <div style={{ fontSize: 10, color: T.textDim, fontWeight: 400, marginTop: 2 }}>
                        {escales[i-1].capacite_places} PAX · {escales[i-1].capacite_cargo_kg} kg
                      </div>
                    )}
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ textAlign: 'center', fontSize: 14, color: T.textDim,
                      margin: '3px 0' }}>↓</div>
                  )}
                </React.Fragment>
              ))}
            </Card>
          )}

          {/* COMBORD synthèse */}
          {(form.combord_grade || form.combord_nom) && (
            <Card style={{ padding: '14px 16px', background: T.greenBg,
              border: `1px solid ${T.greenBorder}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.green,
                marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                COMBORD
              </div>
              <div style={{ fontSize: 12, color: T.text }}>
                {form.combord_grade && <div style={{ fontSize: 10, color: T.textDim }}>{form.combord_grade}</div>}
                <div style={{ fontWeight: 600 }}>
                  {form.combord_nom} {form.combord_prenom}
                </div>
              </div>
            </Card>
          )}

          {/* Guide */}
          <Card style={{ padding: '14px 16px', background: T.bgAlt }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub,
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              ℹ Guide
            </div>
            <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.7 }}>
              • Capacités auto-remplies par aéronef<br />
              • Escales : définissez les capacités allouées à chaque base intermédiaire<br />
              • Le COMBORD signe en dernier — sa signature rend le manifeste opérationnel<br />
              • Missions VIP/EVASAN/Sensible activent des circuits spéciaux
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function VolsPage(): React.ReactElement {
  return (
    <Routes>
      <Route index element={<VolsListPage />} />
      <Route path="nouveau" element={<NouveauVolPage />} />
    </Routes>
  );
}