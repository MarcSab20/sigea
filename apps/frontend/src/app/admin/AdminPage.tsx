// apps/frontend/src/app/admin/AdminPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Utilisateur {
  id: string; nom: string; prenom: string; grade: string;
  login: string; role: string; base_id: string; actif: boolean;
  last_login?: string; createdAt: string;
}

interface Base {
  id: string; code_base: string; nom: string; region: string;
  admin_id?: string; createdAt: string;
  _count?: { utilisateurs: number };
}

interface AuditLog {
  id: string; user_id: string; base_id: string; role: string;
  action: string; resource?: string; method?: string; path?: string;
  ip?: string; content_hash: string; timestamp: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const ROLES = [
  { value: 'chef_escale', label: 'Chef d\'Escale',    color: T.green },
  { value: 'comeso',      label: 'COMESO',            color: T.blue },
  { value: 'comgmo',      label: 'COMGMO',            color: T.blue },
  { value: 'combord',     label: 'COMBORD',           color: T.amberLight },
  { value: 'combase',     label: 'COMBASE',           color: T.textSub },
  { value: 'cemaa',       label: 'CEMAA',             color: T.red },
  { value: 'admin',       label: 'Administrateur',    color: T.red },
];

const BASES_FAC = [
  { id: 'BA101', code: 'BA101', nom: 'Base Aérienne 101 Yaoundé',    region: 'Centre' },
  { id: 'BA102', code: 'BA102', nom: 'Base Aérienne 102 Douala',     region: 'Littoral' },
  { id: 'BA201', code: 'BA201', nom: 'Base Aérienne 201 Garoua',     region: 'Nord' },
  { id: 'BA301', code: 'BA301', nom: 'Base Aérienne 301 Maroua',     region: 'Extrême-Nord' },
  { id: 'BA302', code: 'BA302', nom: 'Base Aérienne 302 Ngaoundéré', region: 'Adamaoua' },
  { id: 'BA401', code: 'BA401', nom: 'Base Aérienne 401 Bafoussam',  region: 'Ouest' },
  { id: 'BA501', code: 'BA501', nom: 'Base Aérienne 501 Bertoua',    region: 'Est' },
];

const GRADES = [
  'Général de Corps d\'Armée Aérienne', 'Général de Division Aérienne',
  'Général de Brigade Aérienne', 'Colonel', 'Lieutenant-Colonel',
  'Commandant', 'Capitaine', 'Lieutenant', 'Sous-Lieutenant',
  'Adjudant-Chef', 'Adjudant', 'Sergent-Chef', 'Sergent', 'Caporal-Chef', 'Caporal',
];

// ─── Composants UI partagés ───────────────────────────────────────────────────
function Card({ children, style={} }: { children: React.ReactNode; style?: React.CSSProperties }): React.ReactElement {
  return <div style={{ background: T.bgCard, border: `1px solid ${T.border}`,
    borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>{children}</div>;
}

function Field({ label, value, onChange, type='text', required, options, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; disabled?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    background: disabled ? T.bgAlt : (focused ? T.bgCard : T.bgInput),
    border: `1px solid ${focused ? T.green : T.border}`, borderRadius: 6,
    color: disabled ? T.textDim : T.text, fontSize: 13, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s', fontFamily: T.body,
    boxShadow: focused ? `0 0 0 3px ${T.green}20` : 'none',
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
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }): React.ReactElement {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`,
      border: `1px solid ${color}40`, borderRadius: 4, padding: '2px 8px',
      textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
      {label}
    </span>
  );
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: T.bgCard, borderRadius: 10, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: `1px solid ${T.border}` }}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: T.bgCard, zIndex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            fontSize: 20, cursor: 'pointer', color: T.textDim, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: number | string; color: string }): React.ReactElement {
  return (
    <div style={{ padding: '14px 18px', background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: T.display }}>{value}</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: color, opacity: 0.25 }} />
    </div>
  );
}

// ─── Sous-navigation admin ────────────────────────────────────────────────────
const ADMIN_TABS = [
  { key: 'utilisateurs', label: 'Utilisateurs',    icon: '👤' },
  { key: 'bases',        label: 'Bases aériennes', icon: '🏛' },
  { key: 'securite',     label: 'Sécurité MFA',    icon: '🛡' },
  { key: 'audit',        label: 'Journal d\'audit', icon: '📜' },
  { key: 'systeme',      label: 'Système',         icon: '⚙' },
];

// ─── PAGE UTILISATEURS ────────────────────────────────────────────────────────
function UtilisateursTab(): React.ReactElement {
  const [users, setUsers] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterBase, setFilterBase] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<Utilisateur | null>(null);
  const [form, setForm] = useState({
    nom: '', prenom: '', grade: '', login: '', role: '',
    base_id: '', password: '', confirm_password: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get<Utilisateur[]>('/referentiel/personnels');
      setUsers(data.data);
    } catch { toast.error('Erreur chargement utilisateurs'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const set = (k: string) => (v: string): void => setForm(f => ({ ...f, [k]: v }));

  const openCreate = (): void => {
    setEditUser(null);
    setForm({ nom:'', prenom:'', grade:'', login:'', role:'', base_id:'', password:'', confirm_password:'' });
    setShowModal(true);
  };

  const openEdit = (u: Utilisateur): void => {
    setEditUser(u);
    setForm({ nom: u.nom, prenom: u.prenom, grade: u.grade, login: u.login,
      role: u.role, base_id: u.base_id, password: '', confirm_password: '' });
    setShowModal(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!form.nom || !form.prenom || !form.login || !form.role || !form.base_id) {
      toast.error('Champs obligatoires manquants'); return;
    }
    if (!editUser && !form.password) {
      toast.error('Mot de passe requis pour la création'); return;
    }
    if (form.password && form.password !== form.confirm_password) {
      toast.error('Les mots de passe ne correspondent pas'); return;
    }
    if (form.password && form.password.length < 12) {
      toast.error('Mot de passe trop court — minimum 12 caractères'); return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        nom: form.nom, prenom: form.prenom, grade: form.grade,
        login: form.login, role: form.role, base_id: form.base_id,
      };
      if (form.password) payload.password = form.password;

      if (editUser) {
        await api.patch(`/admin/utilisateurs/${editUser.id}`, payload);
        toast.success('Utilisateur mis à jour');
      } else {
        await api.post('/admin/utilisateurs', payload);
        toast.success('Utilisateur créé');
      }
      setShowModal(false);
      fetchUsers();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erreur');
    } finally { setSaving(false); }
  };

  const handleToggleActif = async (u: Utilisateur): Promise<void> => {
    try {
      await api.patch(`/admin/utilisateurs/${u.id}`, { actif: !u.actif });
      toast.success(u.actif ? 'Compte désactivé' : 'Compte activé');
      fetchUsers();
    } catch { toast.error('Erreur'); }
  };

  const filtered = users.filter(u =>
    (!search || `${u.nom} ${u.prenom} ${u.login}`.toLowerCase().includes(search.toLowerCase())) &&
    (!filterRole || u.role === filterRole) &&
    (!filterBase || u.base_id === filterBase)
  );

  const roleInfo = (role: string) => ROLES.find(r => r.value === role);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <StatMini label="Total utilisateurs" value={users.length} color={T.blue} />
        <StatMini label="Comptes actifs" value={users.filter(u => u.actif).length} color={T.green} />
        <StatMini label="Comptes inactifs" value={users.filter(u => !u.actif).length} color={T.red} />
        <StatMini label="Bases couvertes" value={new Set(users.map(u => u.base_id)).size} color={T.amberLight} />
      </div>

      <Card>
        {/* Barre d'outils */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, prénom, login…"
            style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: T.bgInput,
              border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
              fontSize: 13, outline: 'none', fontFamily: T.body }} />
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            style={{ padding: '8px 12px', background: T.bgInput, border: `1px solid ${T.border}`,
              borderRadius: 6, color: T.text, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
            <option value="">Tous les rôles</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select value={filterBase} onChange={e => setFilterBase(e.target.value)}
            style={{ padding: '8px 12px', background: T.bgInput, border: `1px solid ${T.border}`,
              borderRadius: 6, color: T.text, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
            <option value="">Toutes les bases</option>
            {BASES_FAC.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
          <button onClick={openCreate} style={{ padding: '8px 18px', background: T.green,
            border: 'none', borderRadius: 6, color: '#fff', fontSize: 13,
            fontWeight: 600, cursor: 'pointer' }}>
            + Nouvel utilisateur
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textDim }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textDim }}>
            Aucun utilisateur trouvé
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid',
              gridTemplateColumns: '1fr 140px 100px 120px 80px 100px',
              padding: '8px 20px', fontSize: 10, fontWeight: 600, color: T.textDim,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              borderBottom: `1px solid ${T.border}` }}>
              <span>Nom / Prénom</span><span>Login</span><span>Rôle</span>
              <span>Base</span><span>Statut</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {filtered.map(u => {
              const ri = roleInfo(u.role);
              return (
                <div key={u.id} style={{ display: 'grid',
                  gridTemplateColumns: '1fr 140px 100px 120px 80px 100px',
                  padding: '12px 20px', borderBottom: `1px solid ${T.border}`,
                  alignItems: 'center', opacity: u.actif ? 1 : 0.5 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                      {u.grade && <span style={{ fontSize: 11, color: T.textDim, marginRight: 6 }}>{u.grade}</span>}
                      {u.nom} {u.prenom}
                    </div>
                    {u.last_login && (
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
                        Dernière connexion : {new Date(u.last_login).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSub }}>
                    {u.login}
                  </span>
                  <Badge label={ri?.label ?? u.role} color={ri?.color ?? T.textDim} />
                  <span style={{ fontSize: 11, color: T.textSub }}>
                    {BASES_FAC.find(b => b.id === u.base_id)?.code ?? u.base_id}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600,
                    color: u.actif ? T.green : T.red }}>
                    {u.actif ? '● Actif' : '○ Inactif'}
                  </span>
                  <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                    <button onClick={() => openEdit(u)} style={{ padding: '4px 10px',
                      background: T.blueBg, border: `1px solid ${T.blueBorder}`,
                      borderRadius: 4, color: T.blue, fontSize: 11, cursor: 'pointer' }}>
                      Modifier
                    </button>
                    <button onClick={() => handleToggleActif(u)} style={{ padding: '4px 10px',
                      background: u.actif ? T.redBg : T.greenBg,
                      border: `1px solid ${u.actif ? T.redBorder : T.greenBorder}`,
                      borderRadius: 4, color: u.actif ? T.red : T.green,
                      fontSize: 11, cursor: 'pointer' }}>
                      {u.actif ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal créer/modifier utilisateur */}
      {showModal && (
        <Modal
          title={editUser ? `Modifier — ${editUser.nom} ${editUser.prenom}` : 'Nouvel utilisateur'}
          onClose={() => setShowModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Field label="Nom" value={form.nom} onChange={set('nom')} required />
            <Field label="Prénom(s)" value={form.prenom} onChange={set('prenom')} required />
          </div>
          <Field label="Grade" value={form.grade} onChange={set('grade')}
            options={GRADES.map(g => ({ value: g, label: g }))} />
          <Field label="Login (identifiant)" value={form.login} onChange={set('login')}
            required placeholder="nom.prenom.base"
            disabled={!!editUser} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Field label="Rôle" value={form.role} onChange={set('role')} required
              options={ROLES.map(r => ({ value: r.value, label: r.label }))} />
            <Field label="Base d'affectation" value={form.base_id} onChange={set('base_id')} required
              options={BASES_FAC.map(b => ({ value: b.id, label: `${b.code} — ${b.nom.split(' ').slice(-1)[0]}` }))} />
          </div>

          <div style={{ padding: '10px 14px', background: T.amberBg,
            border: `1px solid ${T.amberBorder}`, borderRadius: 6,
            fontSize: 11, color: T.amber, marginBottom: 14 }}>
            {editUser
              ? 'Laissez le mot de passe vide pour ne pas le modifier'
              : 'Mot de passe : minimum 12 caractères, complexité requise'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Field label={editUser ? 'Nouveau mot de passe' : 'Mot de passe'}
              value={form.password} onChange={set('password')}
              type="password" required={!editUser}
              placeholder="••••••••••••" />
            <Field label="Confirmer le mot de passe" value={form.confirm_password}
              onChange={set('confirm_password')} type="password"
              required={!editUser} placeholder="••••••••••••" />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setShowModal(false)} style={{ padding: '9px 20px',
              background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 6,
              color: T.textSub, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '9px 24px',
              background: saving ? T.textMute : T.green, border: 'none',
              borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Enregistrement…' : editUser ? 'Mettre à jour' : 'Créer l\'utilisateur'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PAGE BASES ───────────────────────────────────────────────────────────────
function BasesTab(): React.ReactElement {
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBase, setEditBase] = useState<Base | null>(null);
  const [form, setForm] = useState({ code_base: '', nom: '', region: '' });
  const [saving, setSaving] = useState(false);

  const fetchBases = useCallback(async () => {
    try {
      const data = await api.get<Base[]>('/referentiel/bases');
      setBases(data.data);
    } catch { toast.error('Erreur chargement bases'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBases(); }, [fetchBases]);

  const set = (k: string) => (v: string): void => setForm(f => ({ ...f, [k]: v }));

  const openCreate = (): void => {
    setEditBase(null);
    setForm({ code_base: '', nom: '', region: '' });
    setShowModal(true);
  };

  const openEdit = (b: Base): void => {
    setEditBase(b);
    setForm({ code_base: b.code_base, nom: b.nom, region: b.region });
    setShowModal(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!form.code_base || !form.nom || !form.region) {
      toast.error('Champs obligatoires manquants'); return;
    }
    setSaving(true);
    try {
      if (editBase) {
        await api.patch(`/admin/bases/${editBase.id}`, form);
        toast.success('Base mise à jour');
      } else {
        await api.post('/admin/bases', form);
        toast.success('Base créée');
      }
      setShowModal(false);
      fetchBases();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erreur');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <StatMini label="Bases enregistrées" value={bases.length} color={T.blue} />
        <StatMini label="Régions couvertes" value={new Set(bases.map(b => b.region)).size} color={T.green} />
        <StatMini label="Personnel total" value={bases.reduce((s,b) => s+(b._count?.utilisateurs??0),0)} color={T.amberLight} />
        <StatMini label="Déployées" value={bases.length} color={T.green} />
      </div>

      <Card>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            Bases aériennes ({bases.length})
          </div>
          <button onClick={openCreate} style={{ padding: '8px 18px', background: T.green,
            border: 'none', borderRadius: 6, color: '#fff', fontSize: 13,
            fontWeight: 600, cursor: 'pointer' }}>
            + Nouvelle base
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textDim }}>Chargement…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, padding: 20 }}>
            {bases.map(b => (
              <div key={b.id} style={{ padding: '16px 20px', background: T.bgAlt,
                border: `1px solid ${T.border}`, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.green,
                      fontFamily: T.display, letterSpacing: '0.05em' }}>
                      {b.code_base}
                    </div>
                    <div style={{ fontSize: 13, color: T.text, marginTop: 2 }}>{b.nom}</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                      📍 {b.region}
                    </div>
                  </div>
                  <button onClick={() => openEdit(b)} style={{ padding: '5px 12px',
                    background: T.blueBg, border: `1px solid ${T.blueBorder}`,
                    borderRadius: 5, color: T.blue, fontSize: 11, cursor: 'pointer' }}>
                    Modifier
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: T.textDim }}>
                  <span>👤 {b._count?.utilisateurs ?? '?'} personnel(s)</span>
                  <span>Créée le {new Date(b.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showModal && (
        <Modal
          title={editBase ? `Modifier ${editBase.code_base}` : 'Nouvelle base aérienne'}
          onClose={() => setShowModal(false)}>
          <Field label="Code base" value={form.code_base} onChange={set('code_base')}
            required placeholder="BA101" disabled={!!editBase} />
          <Field label="Nom complet" value={form.nom} onChange={set('nom')}
            required placeholder="Base Aérienne 101 Yaoundé" />
          <Field label="Région" value={form.region} onChange={set('region')}
            required placeholder="Centre" />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setShowModal(false)} style={{ padding: '9px 20px',
              background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 6,
              color: T.textSub, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '9px 24px',
              background: saving ? T.textMute : T.green, border: 'none',
              borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Enregistrement…' : editBase ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PAGE AUDIT ───────────────────────────────────────────────────────────────
function AuditTab(): React.ReactElement {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterBase, setFilterBase] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.get<AuditLog[]>('/admin/audit-logs');
      setLogs(data.data);
    } catch { toast.error('Erreur chargement audit'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(l =>
    (!filterAction || l.action.includes(filterAction)) &&
    (!filterBase || l.base_id === filterBase) &&
    (!search || `${l.user_id} ${l.action} ${l.path ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  );

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const actionColor = (action: string): string => {
    if (action.includes('create') || action.includes('soumettre')) return T.green;
    if (action.includes('delete') || action.includes('rejeter')) return T.red;
    if (action.includes('valider') || action.includes('approuve')) return T.blue;
    if (action.includes('CROSS_BASE')) return T.red;
    return T.textDim;
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <StatMini label="Entrées total" value={logs.length} color={T.blue} />
        <StatMini label="Aujourd'hui" value={logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length} color={T.green} />
        <StatMini label="Alertes cross-base" value={logs.filter(l => l.action.includes('CROSS_BASE')).length} color={T.red} />
        <StatMini label="Actions create" value={logs.filter(l => l.action.includes('create')).length} color={T.amberLight} />
      </div>

      <Card>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher dans les logs…"
            style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: T.bgInput,
              border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
              fontSize: 12, outline: 'none', fontFamily: T.body }} />
          <select value={filterBase} onChange={e => { setFilterBase(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', background: T.bgInput, border: `1px solid ${T.border}`,
              borderRadius: 6, color: T.text, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
            <option value="">Toutes les bases</option>
            {BASES_FAC.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
          <button onClick={fetchLogs} style={{ padding: '8px 14px', background: T.bgAlt,
            border: `1px solid ${T.border}`, borderRadius: 6, color: T.textDim,
            fontSize: 12, cursor: 'pointer' }}>↻ Actualiser</button>
          <span style={{ fontSize: 11, color: T.textDim }}>
            {filtered.length} entrées
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textDim }}>Chargement…</div>
        ) : paginated.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textDim }}>
            Aucun log trouvé
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid',
              gridTemplateColumns: '160px 1fr 100px 80px 120px',
              padding: '8px 20px', fontSize: 10, fontWeight: 600, color: T.textDim,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              borderBottom: `1px solid ${T.border}` }}>
              <span>Horodatage</span><span>Action · Ressource</span>
              <span>Rôle</span><span>Base</span><span>Intégrité</span>
            </div>
            {paginated.map(log => (
              <div key={log.id} style={{ display: 'grid',
                gridTemplateColumns: '160px 1fr 100px 80px 120px',
                padding: '10px 20px', borderBottom: `1px solid ${T.border}`,
                alignItems: 'center',
                background: log.action.includes('CROSS_BASE') ? T.redBg : 'transparent' }}>
                <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textDim }}>
                  {new Date(log.timestamp).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
                  })}
                </span>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600,
                    color: actionColor(log.action) }}>
                    {log.action}
                  </span>
                  {log.path && (
                    <span style={{ fontSize: 10, color: T.textDim, marginLeft: 8,
                      fontFamily: T.mono }}>{log.method} {log.path}</span>
                  )}
                </div>
                <Badge label={log.role} color={ROLES.find(r => r.value === log.role)?.color ?? T.textDim} />
                <span style={{ fontSize: 11, color: T.textSub,
                  fontFamily: T.mono }}>{log.base_id?.slice(0,6)}</span>
                <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMute }}
                  title={log.content_hash}>
                  {log.content_hash.slice(0,12)}…
                </span>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ padding: '12px 20px', display: 'flex', gap: 8,
                alignItems: 'center', justifyContent: 'center',
                borderTop: `1px solid ${T.border}` }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  style={{ padding: '5px 12px', background: T.bgAlt,
                    border: `1px solid ${T.border}`, borderRadius: 4,
                    color: T.textSub, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
                    opacity: page === 1 ? 0.5 : 1 }}>← Préc.</button>
                <span style={{ fontSize: 12, color: T.textDim }}>
                  Page {page} / {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))}
                  disabled={page === totalPages}
                  style={{ padding: '5px 12px', background: T.bgAlt,
                    border: `1px solid ${T.border}`, borderRadius: 4,
                    color: T.textSub, fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    opacity: page === totalPages ? 0.5 : 1 }}>Suiv. →</button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── PAGE SYSTÈME ─────────────────────────────────────────────────────────────
function SystemeTab(): React.ReactElement {
  const [svcStatus, setSvcStatus] = useState<Record<string, 'ok'|'error'|'loading'>>({});

  const SERVICES = [
    { name: 'API Gateway',          url: '/health',          port: 3000 },
    { name: 'Auth Service',         url: '/auth/health',     port: 3001 },
    { name: 'Référentiel Service',  url: '/referentiel/health', port: 3002 },
    { name: 'Vol Service',          url: '/vols/health',     port: 3003 },
    { name: 'Manifeste Service',    url: '/manifestes/health', port: 3004 },
    { name: 'Validation Service',   url: '/validations/health', port: 3005 },
    { name: 'CEMAA Service',        url: '/cemaa/health',    port: 3006 },
    { name: 'Notification Service', url: '/notifications/health', port: 3007 },
    { name: 'PDF Service',          url: '/pdf/health',      port: 3008 },
  ];

  const checkService = async (svc: { name: string; url: string; port: number }): Promise<'ok'|'error'> => {
    try {
      await api.get(svc.url);
      return 'ok';
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      // 401/403/404 = service UP mais endpoint protégé ou inexistant — service OK quand même
      if (status === 401 || status === 403 || status === 404 || status === 405) return 'ok';
      return 'error';
    }
  };

  const checkAll = useCallback(async () => {
    const init: Record<string, 'ok'|'error'|'loading'> = {};
    SERVICES.forEach(s => { init[s.name] = 'loading'; });
    setSvcStatus({ ...init });

    // Vérifier en parallèle
    await Promise.all(SERVICES.map(async svc => {
      const result = await checkService(svc);
      setSvcStatus(prev => ({ ...prev, [svc.name]: result }));
    }));
  }, []);

  useEffect(() => { checkAll(); }, [checkAll]);

  const okCount = Object.values(svcStatus).filter(s => s === 'ok').length;
  const errCount = Object.values(svcStatus).filter(s => s === 'error').length;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <StatMini label="Services opérationnels" value={okCount} color={T.green} />
        <StatMini label="Services en erreur" value={errCount} color={T.red} />
        <StatMini label="Total services" value={SERVICES.length} color={T.blue} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Statut services */}
        <Card>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
              Statut des microservices
            </div>
            <button onClick={checkAll} style={{ padding: '6px 14px', background: T.bgAlt,
              border: `1px solid ${T.border}`, borderRadius: 5, color: T.textDim,
              fontSize: 12, cursor: 'pointer' }}>↻ Vérifier</button>
          </div>
          <div style={{ padding: '8px 0' }}>
            {SERVICES.map(svc => {
              const status = svcStatus[svc.name] ?? 'loading';
              return (
                <div key={svc.name} style={{ display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', padding: '10px 20px',
                  borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%',
                      background: status === 'ok' ? T.green : status === 'error' ? T.red : T.amberLight,
                      animation: status === 'loading' ? 'pulse 1s infinite' : status === 'ok' ? 'pulse 3s infinite' : 'none',
                      flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: T.text }}>{svc.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textDim }}>
                      :{svc.port}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600,
                      color: status === 'ok' ? T.green : status === 'error' ? T.red : T.amberLight }}>
                      {status === 'loading' ? '…' : status === 'ok' ? 'OK' : 'ERR'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Informations système */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14 }}>
              Informations SIGEA
            </div>
            {[
              ['Version', 'SIGEA v1.0.0'],
              ['Environnement', 'Production — Intranet FAC'],
              ['Base de données', 'PostgreSQL 16 + Prisma ORM'],
              ['Cache', 'Redis 7'],
              ['Message broker', 'RabbitMQ 3'],
              ['Authentification', 'JWT RS256 + TOTP MFA'],
              ['Chiffrement', 'AES-256-GCM (données sensibles)'],
              ['Audit', 'SHA-256 par entrée'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: `1px solid ${T.border}`,
                fontSize: 12 }}>
                <span style={{ color: T.textDim }}>{l}</span>
                <span style={{ color: T.text, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </Card>

          <Card style={{ padding: '16px 20px',
            background: T.amberBg, border: `1px solid ${T.amberBorder}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.amber, marginBottom: 8 }}>
              ⚠ Actions administratives
            </div>
            <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.7, marginBottom: 14 }}>
              Ces actions sont irréversibles et tracées dans le journal d'audit.
            </div>
            {[
              { label: 'Exporter les logs d\'audit', action: () => toast.info('Export en développement') },
              { label: 'Purger les sessions expirées', action: () => toast.info('Purge en développement') },
            ].map((btn, i) => (
              <button key={i} onClick={btn.action} style={{ display: 'block', width: '100%',
                padding: '8px 14px', marginBottom: 8, background: T.bgCard,
                border: `1px solid ${T.border}`, borderRadius: 5,
                color: T.textSub, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                {btn.label}
              </button>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE SÉCURITÉ MFA ─────────────────────────────────────────────────────────
interface ResetRequest {
  id: string; user_id: string; motif?: string; statut: string; created_at: string;
  utilisateur?: { nom: string; prenom: string; login: string; base_id: string };
}
interface SecAlert {
  id: string; user_id: string; type: string; niveau: string; message: string;
  ip?: string; created_at: string;
  utilisateur?: { nom: string; prenom: string; login: string; base_id: string };
}

function SecuriteMfaTab(): React.ReactElement {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [alerts, setAlerts] = useState<SecAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([
        api.get<ResetRequest[]>('/auth/admin/mfa-reset-requests'),
        api.get<SecAlert[]>('/auth/admin/security-alerts'),
      ]);
      setRequests(r.data); setAlerts(a.data);
    } catch { toast.error('Erreur de chargement sécurité'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    setBusy(label);
    try { await fn(); toast.success('Action effectuée'); await load(); }
    catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erreur');
    } finally { setBusy(null); }
  };

  const niveauColor = (n: string): string =>
    n === 'CRITIQUE' ? T.red : n === 'ALERTE' ? T.amberLight : T.blue;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <StatMini label="Demandes en attente" value={requests.length} color={T.amberLight} />
        <StatMini label="Alertes critiques" value={alerts.filter(a => a.niveau === 'CRITIQUE').length} color={T.red} />
        <StatMini label="Alertes totales" value={alerts.length} color={T.blue} />
      </div>

      {/* Demandes de réinitialisation MFA */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            Demandes de réinitialisation MFA ({requests.length})
          </div>
          <button onClick={load} style={{ padding: '6px 14px', background: T.bgAlt,
            border: `1px solid ${T.border}`, borderRadius: 6, color: T.textDim,
            fontSize: 12, cursor: 'pointer' }}>↻ Actualiser</button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>Chargement…</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>Aucune demande en attente</div>
        ) : requests.map(r => (
          <div key={r.id} style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                {r.utilisateur ? `${r.utilisateur.nom} ${r.utilisateur.prenom}` : r.user_id}
                <span style={{ fontSize: 11, color: T.textDim, marginLeft: 8, fontFamily: T.mono }}>
                  {r.utilisateur?.login}
                </span>
              </div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                {r.motif ?? 'Sans motif'} · {new Date(r.created_at).toLocaleString('fr-FR')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={busy === r.id}
                onClick={() => act(r.id, () => api.post(`/auth/admin/mfa-reset-requests/${r.id}/approuver`))}
                style={{ padding: '6px 14px', background: T.green, border: 'none',
                  borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer' }}>Approuver</button>
              <button disabled={busy === r.id}
                onClick={() => act(r.id, () => api.post(`/auth/admin/mfa-reset-requests/${r.id}/rejeter`))}
                style={{ padding: '6px 14px', background: T.redBg,
                  border: `1px solid ${T.redBorder}`, borderRadius: 5, color: T.red,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Rejeter</button>
            </div>
          </div>
        ))}
      </Card>

      {/* Journal des alertes de sécurité */}
      <Card>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
          fontSize: 13, fontWeight: 600, color: T.text }}>
          Alertes de sécurité (niveau 1 / critique)
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>Chargement…</div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>Aucune alerte</div>
        ) : (
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {alerts.map(a => (
              <div key={a.id} style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}`,
                borderLeft: `3px solid ${niveauColor(a.niveau)}`,
                background: a.niveau === 'CRITIQUE' ? T.redBg : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: niveauColor(a.niveau) }}>
                      {a.type}
                    </span>
                    <span style={{ fontSize: 11, color: T.textSub, marginLeft: 8 }}>
                      {a.utilisateur ? `${a.utilisateur.nom} ${a.utilisateur.prenom} (${a.utilisateur.login})` : a.user_id}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: T.textDim }}>
                    {new Date(a.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: T.textSub, marginTop: 3 }}>{a.message}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  {a.ip && <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono }}>IP : {a.ip}</span>}
                  <div style={{ flex: 1 }} />
                  <button disabled={busy === a.id + 'u'}
                    onClick={() => act(a.id + 'u', () => api.post(`/auth/admin/utilisateurs/${a.user_id}/deverrouiller`, { motif: 'Levée admin' }))}
                    style={{ padding: '4px 10px', background: T.greenBg,
                      border: `1px solid ${T.greenBorder}`, borderRadius: 4, color: T.green,
                      fontSize: 11, cursor: 'pointer' }}>Déverrouiller</button>
                  <button disabled={busy === a.id + 'r'}
                    onClick={() => act(a.id + 'r', () => api.post(`/auth/admin/utilisateurs/${a.user_id}/reset-mfa`))}
                    style={{ padding: '4px 10px', background: T.amberBg,
                      border: `1px solid ${T.amberBorder}`, borderRadius: 4, color: T.amber,
                      fontSize: 11, cursor: 'pointer' }}>Réinitialiser MFA</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── PAGE PRINCIPALE ADMIN ────────────────────────────────────────────────────
export default function AdminPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState('utilisateurs');

  return (
    <div>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.display }}>
          Administration
        </h1>
        <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>
          Gestion des utilisateurs, bases, audit et système SIGEA
        </p>
      </div>

      {/* Sous-navigation */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24,
        borderBottom: `2px solid ${T.border}` }}>
        {ADMIN_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '10px 22px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.key ? `2px solid ${T.green}` : '2px solid transparent',
            color: activeTab === tab.key ? T.green : T.textSub,
            fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
            cursor: 'pointer', marginBottom: -2, transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {activeTab === 'utilisateurs' && <UtilisateursTab />}
      {activeTab === 'bases' && <BasesTab />}
      {activeTab === 'securite' && <SecuriteMfaTab />}
      {activeTab === 'audit' && <AuditTab />}
      {activeTab === 'systeme' && <SystemeTab />}
    </div>
  );
}