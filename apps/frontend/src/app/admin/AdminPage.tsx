// apps/frontend/src/app/admin/AdminPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';
import { toast } from 'sonner';

// Briques et constantes extraites : elles sont désormais partagées avec les
// onglets Intérims et Mouvements. Les dupliquer aurait garanti qu'elles
// divergent au premier ajustement de thème.
import {
  Card, Field, Badge, Modal, StatMini,
  ROLES, BASES_FAC, GRADES, MAX_ECHECS,
  messageErreur, dateFr,
  type Utilisateur,
} from './admin.shared';
import InterimTab from './InterimTab';
import MouvementsTab from './MouvementsTab';
import EscadronsTab from './EscadronsTab';
import './admin.css';

// ─── Types ────────────────────────────────────────────────────────────────────
// `Utilisateur` est importé depuis admin.shared : il porte désormais les trois
// champs d'état de sécurité (verrouille_securite, motif_verrouillage,
// nb_echecs_connexion) ajoutés au select de personnels.service.ts.

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

// Constantes (ROLES, BASES_FAC, GRADES) et composants partagés (Card, Field,
// Badge, Modal, StatMini) : voir admin.shared.tsx.

// ─── Sous-navigation admin ────────────────────────────────────────────────────
const ADMIN_TABS = [
  { key: 'utilisateurs', label: 'Utilisateurs',    icon: '👤' },
  { key: 'interims',     label: 'Intérims',        icon: '⇌' },
  { key: 'mouvements',   label: 'Mouvements',      icon: '⇄' },
  { key: 'bases',        label: 'Bases aériennes', icon: '🏛' },
  { key: 'escadrons',    label: 'Escadrons',       icon: '◈' },
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
  /** Filtre « comptes verrouillés uniquement ». */
  const [seulVerrous, setSeulVerrous] = useState(false);
  /** Compte dont on prépare le déverrouillage. */
  const [aDebloquer, setADebloquer] = useState<Utilisateur | null>(null);
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

  const verrouilles = users.filter(u => u.verrouille_securite);

  const filtered = users.filter(u =>
    (!search || `${u.nom} ${u.prenom} ${u.login}`.toLowerCase().includes(search.toLowerCase())) &&
    (!filterRole || u.role === filterRole) &&
    (!filterBase || u.base_id === filterBase) &&
    (!seulVerrous || u.verrouille_securite)
  );

  const roleInfo = (role: string) => ROLES.find(r => r.value === role);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        <StatMini label="Total utilisateurs" value={users.length} color={T.blue} />
        <StatMini label="Comptes actifs" value={users.filter(u => u.actif).length} color={T.green} />
        <StatMini label="Comptes inactifs" value={users.filter(u => !u.actif).length} color={T.red} />
        {/* Cliquable : c'est le chemin le plus court entre « il y a un problème »
            et « voici les comptes concernés ». */}
        <StatMini label="Comptes verrouillés" value={verrouilles.length} color={T.amberLight}
                  actif={seulVerrous}
                  onClick={() => setSeulVerrous(v => !v)} />
        <StatMini label="Bases couvertes" value={new Set(users.map(u => u.base_id)).size} color={T.textSub} />
      </div>

      {/* ── Bandeau d'alerte ────────────────────────────────────────────────
          Sans lui, un compte verrouillé n'était visible que dans le journal
          d'alertes de l'onglet Sécurité — il fallait penser à aller l'y
          chercher. L'agent, lui, attend devant un écran de refus. */}
      {verrouilles.length > 0 && !seulVerrous && (
        <div className="ad-alerte" style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18,
          padding: '13px 18px', background: T.amberBg,
          border: `1px solid ${T.amberBorder}`, borderLeft: `3px solid ${T.amberLight}`,
          borderRadius: 8,
        }}>
          <span className="ad-pastille" style={{
            width: 10, height: 10, borderRadius: '50%',
            background: T.amberLight, color: T.amberLight, flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.amber }}>
              {verrouilles.length === 1
                ? '1 compte est verrouillé et son titulaire ne peut plus se connecter'
                : `${verrouilles.length} comptes sont verrouillés et leurs titulaires ne peuvent plus se connecter`}
            </div>
            <div style={{ fontSize: 11.5, color: T.amber, marginTop: 4, lineHeight: 1.6 }}>
              Le verrouillage est automatique après {MAX_ECHECS} échecs de connexion consécutifs.
              Seul un administrateur peut le lever.
            </div>
          </div>
          <button onClick={() => setSeulVerrous(true)} className="ad-btn ad-btn-lift" style={{
            padding: '8px 16px', background: T.amberLight, border: 'none', borderRadius: 6,
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>Voir les comptes</button>
        </div>
      )}

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
          <button onClick={() => setSeulVerrous(v => !v)} className="ad-btn"
            aria-pressed={seulVerrous} style={{
              padding: '8px 14px',
              background: seulVerrous ? T.amberBg : T.bgInput,
              border: `1px solid ${seulVerrous ? T.amberBorder : T.border}`,
              borderRadius: 6, color: seulVerrous ? T.amber : T.textDim,
              fontSize: 12, fontWeight: seulVerrous ? 600 : 400, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}>
            <span className={seulVerrous ? 'ad-cadenas' : undefined}>🔒</span>
            Verrouillés ({verrouilles.length})
          </button>
          <button onClick={openCreate} className="ad-btn ad-btn-lift" style={{ padding: '8px 18px',
            background: T.green, border: 'none', borderRadius: 6, color: '#fff', fontSize: 13,
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
              gridTemplateColumns: '1fr 130px 100px 90px 76px 130px 180px',
              gap: 8,
              padding: '8px 20px', fontSize: 10, fontWeight: 600, color: T.textDim,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              borderBottom: `1px solid ${T.border}` }}>
              <span>Nom / Prénom</span><span>Login</span><span>Rôle</span>
              <span>Base</span><span>Statut</span><span>Sécurité</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {filtered.map((u, n) => {
              const ri = roleInfo(u.role);
              const verrou = Boolean(u.verrouille_securite);
              const echecs = u.nb_echecs_connexion ?? 0;
              return (
                <div key={u.id} className="ad-row ad-row-hover" style={{
                  '--ad-i': n,
                  color: verrou ? T.amberLight : 'transparent',
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 100px 90px 76px 130px 180px',
                  gap: 8,
                  padding: '12px 20px', borderBottom: `1px solid ${T.border}`,
                  background: verrou ? T.amberBg : undefined,
                  alignItems: 'center', opacity: u.actif ? 1 : 0.5 } as React.CSSProperties}>
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

                  {/* ── Colonne Sécurité ──
                      Trois états seulement : verrouillé, échecs en cours, rien.
                      Un compte sain n'affiche rien — l'absence de signal EST
                      l'information, et la colonne reste lisible d'un coup d'œil. */}
                  <span style={{ fontSize: 10.5 }}>
                    {verrou ? (
                      <span title={u.motif_verrouillage ?? 'Compte verrouillé'}
                        style={{ color: T.amber, fontWeight: 700,
                                 display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span className="ad-cadenas">🔒</span> Verrouillé
                      </span>
                    ) : echecs > 0 ? (
                      <span title={`${echecs} échec(s) consécutif(s) — verrouillage au ${MAX_ECHECS}ᵉ`}
                        style={{ color: T.amberLight, display: 'inline-flex',
                                 alignItems: 'center', gap: 6 }}>
                        <span className="ad-jauge">
                          {Array.from({ length: MAX_ECHECS }, (_, k) => (
                            <i key={k} data-on={k < echecs ? '1' : '0'} />
                          ))}
                        </span>
                        {echecs}/{MAX_ECHECS}
                      </span>
                    ) : (
                      <span style={{ color: T.textMute }}>—</span>
                    )}
                  </span>

                  <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                    {verrou && (
                      <button onClick={() => setADebloquer(u)} className="ad-btn ad-btn-lift"
                        style={{ padding: '4px 10px', background: T.amberLight,
                          border: 'none', borderRadius: 4, color: '#fff',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        Déverrouiller
                      </button>
                    )}
                    <button onClick={() => openEdit(u)} className="ad-btn" style={{ padding: '4px 10px',
                      background: T.blueBg, border: `1px solid ${T.blueBorder}`,
                      borderRadius: 4, color: T.blue, fontSize: 11, cursor: 'pointer' }}>
                      Modifier
                    </button>
                    <button onClick={() => handleToggleActif(u)} className="ad-btn" style={{ padding: '4px 10px',
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

      {/* Fenêtre de déverrouillage */}
      {aDebloquer && (
        <ModaleDeverrouillage
          user={aDebloquer}
          onFermer={() => setADebloquer(null)}
          onFait={() => { setADebloquer(null); fetchUsers(); }}
        />
      )}

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

/* ═══════════════════════════════════════════════════════════════════════════
   DÉVERROUILLAGE D'UN COMPTE
   ───────────────────────────────────────────────────────────────────────────
   POST /auth/admin/utilisateurs/:id/deverrouiller  { motif? }

   Le service remet `verrouille_securite` à faux, efface le motif et RAZ le
   compteur d'échecs, puis journalise un COMPTE_DEVERROUILLE de niveau INFO.
   L'agent peut se reconnecter aussitôt avec son mot de passe habituel : le
   verrouillage ne l'a pas changé.

   Le motif est facultatif côté serveur. L'écran le demande quand même, parce
   qu'il atterrit dans le journal de sécurité et qu'un déverrouillage sans
   explication est exactement ce qu'un audit vous reprochera.
   ═══════════════════════════════════════════════════════════════════════════ */

function ModaleDeverrouillage({ user, onFermer, onFait }: {
  user: Utilisateur; onFermer: () => void; onFait: () => void;
}): React.ReactElement {
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const debloquer = async (): Promise<void> => {
    setEnvoi(true);
    try {
      await api.post(`/auth/admin/utilisateurs/${user.id}/deverrouiller`,
        motif.trim() ? { motif: motif.trim() } : {});
      toast.success(`Compte de ${user.nom} ${user.prenom} déverrouillé`);
      onFait();
    } catch (e) {
      toast.error(messageErreur(e, 'Le déverrouillage a échoué'));
    } finally { setEnvoi(false); }
  };

  return (
    <Modal title="Déverrouiller le compte" onClose={onFermer} largeur={540}>
      <div style={{
        padding: '13px 16px', background: T.bgAlt, border: `1px solid ${T.border}`,
        borderRadius: 6, marginBottom: 16, fontSize: 12.5, lineHeight: 1.7, color: T.textSub,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          {user.grade ? user.grade + ' ' : ''}{user.nom} {user.prenom}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.textDim }}>{user.login}</div>
        {user.motif_verrouillage && (
          <div style={{
            marginTop: 11, paddingTop: 10, borderTop: `1px dashed ${T.border}`,
            fontSize: 11.5,
          }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.07em',
                           fontSize: 9.5, color: T.textDim }}>Motif du verrouillage</span>
            <div style={{ marginTop: 4, color: T.amber }}>{user.motif_verrouillage}</div>
          </div>
        )}
        {user.last_login && (
          <div style={{ marginTop: 8, fontSize: 11, color: T.textDim }}>
            Dernière connexion réussie : {dateFr(user.last_login, true)}
          </div>
        )}
      </div>

      <div style={{
        padding: '11px 14px', background: T.greenBg, border: `1px solid ${T.greenBorder}`,
        borderRadius: 6, fontSize: 11.5, color: T.green, marginBottom: 16, lineHeight: 1.65,
      }}>
        Après déverrouillage, l&apos;agent se reconnecte avec <strong>son mot de passe
        habituel</strong> : le verrouillage ne l&apos;a pas modifié. Le compteur d&apos;échecs
        est remis à zéro.
        <br />
        Si l&apos;agent a réellement oublié son mot de passe, déverrouillez puis
        utilisez « Modifier » pour lui en attribuer un nouveau. Si c&apos;est son second
        facteur qui est en cause, passez par l&apos;onglet Sécurité MFA.
      </div>

      <Field label="Motif du déverrouillage" value={motif} onChange={setMotif}
             type="textarea"
             placeholder="Identité vérifiée par téléphone, demande du chef de service…"
             aide="Facultatif, mais consigné au journal de sécurité. Un déverrouillage sans motif est difficile à justifier en audit." />

      <div style={{
        padding: '11px 14px', background: T.amberBg, border: `1px solid ${T.amberBorder}`,
        borderRadius: 6, fontSize: 11, color: T.amber, marginBottom: 16, lineHeight: 1.6,
      }}>
        Assurez-vous d&apos;avoir identifié l&apos;agent par un canal indépendant avant de
        lever le verrou : trois échecs consécutifs peuvent aussi être une tentative
        d&apos;intrusion, auquel cas il vaut mieux laisser le compte fermé.
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onFermer} className="ad-btn" style={{
          padding: '9px 20px', background: T.bgAlt, border: `1px solid ${T.border}`,
          borderRadius: 6, color: T.textSub, fontSize: 13, cursor: 'pointer',
        }}>Annuler</button>
        <button onClick={debloquer} disabled={envoi} className="ad-btn ad-btn-lift" style={{
          padding: '9px 24px', background: envoi ? T.textMute : T.amberLight,
          border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: envoi ? 'not-allowed' : 'pointer',
        }}>{envoi ? 'Déverrouillage…' : 'Déverrouiller le compte'}</button>
      </div>
    </Modal>
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
      {activeTab === 'interims' && <InterimTab />}
      {activeTab === 'mouvements' && <MouvementsTab />}
      {activeTab === 'bases' && <BasesTab />}
      {activeTab === 'escadrons' && <EscadronsTab />}
      {activeTab === 'securite' && <SecuriteMfaTab />}
      {activeTab === 'audit' && <AuditTab />}
      {activeTab === 'systeme' && <SystemeTab />}
    </div>
  );
}