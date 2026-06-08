import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';
import { toast } from 'sonner';

interface Profile {
  nom: string; prenom: string; grade: string; login: string; role: string; base_id: string;
  email?: string; mfa_enrolled: boolean; last_login_at?: string; last_login_ip?: string;
  notif_connexion: boolean; notif_par_email: boolean;
  backup_codes_restants: number; notifs_non_lues: number;
}
interface Notif {
  id: string; type: string; niveau: string; message: string; ip?: string; lu: boolean; created_at: string;
}

const niveauColor = (n: string): string =>
  n === 'CRITIQUE' ? T.red : n === 'ALERTE' ? T.amberLight : T.blue;

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>{children}</div>;
}

export default function ProfilePage(): React.ReactElement {
  const [p, setP] = useState<Profile | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pr, nf] = await Promise.all([
        api.get<Profile>('/auth/profile'),
        api.get<Notif[]>('/auth/profile/notifications'),
      ]);
      setP(pr.data); setNotifs(nf.data);
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const togglePref = async (k: 'notif_connexion' | 'notif_par_email', v: boolean): Promise<void> => {
    if (!p) return;
    setP({ ...p, [k]: v });
    try { await api.patch('/auth/profile/preferences', { [k]: v }); toast.success('Préférence mise à jour'); }
    catch { toast.error('Erreur'); load(); }
  };

  const markRead = async (id: string): Promise<void> => {
    await api.patch(`/auth/profile/notifications/${id}/lu`);
    setNotifs(n => n.map(x => x.id === id ? { ...x, lu: true } : x));
  };

  const requestReset = async (): Promise<void> => {
    try { await api.post('/auth/profile/mfa-reset-request', { motif: 'Demande utilisateur' });
      toast.success('Demande de réinitialisation MFA transmise à l\'administrateur'); }
    catch { toast.error('Erreur'); }
  };

  if (loading || !p) return <div style={{ padding: 48, textAlign: 'center', color: T.textDim }}>Chargement…</div>;

  const Row = ({ l, v }: { l: string; v: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0',
      borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
      <span style={{ color: T.textDim }}>{l}</span>
      <span style={{ color: T.text, fontWeight: 500 }}>{v}</span>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.display }}>Mon profil</h1>
        <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>Sécurité, notifications et paramètres</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12 }}>Identité</div>
          <Row l="Nom" v={`${p.grade} ${p.nom} ${p.prenom}`} />
          <Row l="Identifiant" v={p.login} />
          <Row l="Rôle" v={p.role.replace('_', ' ')} />
          <Row l="Base" v={p.base_id.toUpperCase()} />
          <Row l="Dernière connexion" v={p.last_login_at ? new Date(p.last_login_at).toLocaleString('fr-FR') : '—'} />
          <Row l="Dernière IP" v={p.last_login_ip ?? '—'} />
          <div style={{ marginTop: 12, padding: '8px 12px', background: T.bgAlt, borderRadius: 6,
            fontSize: 11, color: T.textDim }}>
            L'identifiant et le mot de passe ne sont pas modifiables depuis le profil.
          </div>
        </Card>

        <Card style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12 }}>Sécurité MFA</div>
          <Row l="MFA enrôlé" v={p.mfa_enrolled ? 'Oui' : 'Non'} />
          <Row l="Codes de secours restants" v={String(p.backup_codes_restants)} />
          {p.backup_codes_restants === 0 && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: T.redBg,
              border: `1px solid ${T.redBorder}`, borderRadius: 6, fontSize: 11, color: T.red }}>
              Plus aucun code de secours. Demandez une réinitialisation MFA.
            </div>
          )}
          <button onClick={requestReset} style={{ width: '100%', marginTop: 14, padding: '10px',
            background: T.amberBg, border: `1px solid ${T.amberBorder}`, borderRadius: 6,
            color: T.amber, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Demander une réinitialisation MFA (validation admin)
          </button>

          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: '18px 0 10px' }}>Notifications</div>
          {[
            { k: 'notif_connexion' as const, label: 'Alertes de connexion suspecte' },
            { k: 'notif_par_email' as const, label: 'Notifications par e-mail' },
          ].map(o => (
            <label key={o.k} style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '7px 0', fontSize: 12, color: T.textSub, cursor: 'pointer' }}>
              {o.label}
              <input type="checkbox" checked={p[o.k]} onChange={e => togglePref(o.k, e.target.checked)} />
            </label>
          ))}
        </Card>
      </div>

      <Card>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
          fontSize: 13, fontWeight: 600, color: T.text }}>
          Notifications de sécurité ({notifs.filter(n => !n.lu).length} non lues)
        </div>
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {notifs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>Aucune notification</div>
          ) : notifs.map(n => (
            <div key={n.id} onClick={() => !n.lu && markRead(n.id)}
              style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}`,
                background: n.lu ? 'transparent' : T.bgAlt, cursor: n.lu ? 'default' : 'pointer',
                borderLeft: `3px solid ${niveauColor(n.niveau)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: niveauColor(n.niveau) }}>{n.type}</span>
                <span style={{ fontSize: 10, color: T.textDim }}>
                  {new Date(n.created_at).toLocaleString('fr-FR')}
                </span>
              </div>
              <div style={{ fontSize: 12, color: T.textSub }}>{n.message}</div>
              {n.ip && <div style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono, marginTop: 2 }}>IP : {n.ip}</div>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}