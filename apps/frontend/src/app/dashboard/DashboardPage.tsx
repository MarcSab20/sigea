import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { manifesteApi, Manifeste } from '@/services/manifeste.service';
import { T } from '@/lib/theme';
import { toast } from 'sonner';
import CameroonMap from '@/components/CameroonMap';

function Card({ children, style={} }: { children: React.ReactNode; style?: React.CSSProperties }): React.ReactElement {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }): React.ReactElement {
  return (
    <Card style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 11, color: T.textDim, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1,
        fontFamily: T.display }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 6 }}>{sub}</div>}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: color, opacity: 0.3 }} />
    </Card>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }): React.ReactElement {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, background: bg,
      border: `1px solid ${color}40`, borderRadius: 4, padding: '2px 8px',
      letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

const statusStyle = (s: string): { color: string; bg: string } => {
  if (s === 'VALIDE')        return { color: T.green,      bg: T.greenBg };
  if (s === 'REJETE')        return { color: T.red,        bg: T.redBg };
  if (s === 'SOUMIS')        return { color: T.amberLight, bg: T.amberBg };
  if (s === 'EN_VALIDATION') return { color: T.blue,       bg: T.blueBg };
  return { color: T.textDim, bg: T.bgAlt };
};

export default function DashboardPage(): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [manifestes, setManifestes] = useState<Manifeste[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const data = await manifesteApi.list();
      setManifestes(data);
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const r = setInterval(fetchData, 30000);
    return () => clearInterval(r);
  }, [fetchData]);

  const handleSoumettre = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    try {
      await manifesteApi.soumettre(id);
      toast.success('Manifeste soumis');
      fetchData();
    } catch { toast.error('Erreur soumission'); }
  };

  const stats = [
    { label: 'Total',         value: manifestes.length,                                             color: T.blue,       sub: 'manifestes actifs' },
    { label: 'Brouillons',    value: manifestes.filter(m => m.statut === 'BROUILLON').length,       color: T.textDim,    sub: 'en cours de saisie' },
    { label: 'Soumis',        value: manifestes.filter(m => m.statut === 'SOUMIS').length,          color: T.amberLight, sub: 'en attente' },
    { label: 'En validation', value: manifestes.filter(m => m.statut === 'EN_VALIDATION').length,   color: T.blue,       sub: 'circuit actif' },
    { label: 'Validés',       value: manifestes.filter(m => m.statut === 'VALIDE').length,          color: T.green,      sub: 'signés' },
    { label: 'Rejetés',       value: manifestes.filter(m => m.statut === 'REJETE').length,          color: T.red,        sub: 'à corriger' },
  ];

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text,
          fontFamily: T.display, letterSpacing: '0.05em' }}>
          Tableau de Bord
        </h1>
        <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>
          Base · {user?.base_id?.toUpperCase()} — {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
          })}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <StatCard key={i} label={s.label} value={loading ? 0 : s.value}
            color={s.color} sub={s.sub} />
        ))}
      </div>

        {/* Manifestes */}
        <Card>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                Manifestes d'Escale
              </div>
              <div style={{ fontSize: 11, color: T.textDim }}>
                Base {user?.base_id?.toUpperCase()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={fetchData} style={{ padding: '6px 12px', background: T.bgAlt,
                border: `1px solid ${T.border}`, borderRadius: 6, color: T.textDim,
                fontSize: 12, cursor: 'pointer' }}>↻</button>
              <button onClick={() => navigate('/manifestes/nouveau')} style={{
                padding: '6px 16px', background: T.green, border: 'none',
                borderRadius: 6, color: '#fff', fontSize: 12,
                fontWeight: 600, cursor: 'pointer' }}>+ Nouveau</button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>
              Chargement…
            </div>
          ) : error ? (
            <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, fontSize: 12, color: T.red }}>{error}</div>
              <button onClick={fetchData} style={{ padding: '5px 12px', background: T.amberBg,
                border: `1px solid ${T.amberBorder}`, borderRadius: 4,
                color: T.amber, fontSize: 11, cursor: 'pointer' }}>Réessayer</button>
            </div>
          ) : manifestes.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 13, color: T.textDim, marginBottom: 16 }}>
                Aucun manifeste — créez le premier
              </div>
              <button onClick={() => navigate('/manifestes/nouveau')} style={{
                padding: '10px 24px', background: T.green, border: 'none',
                borderRadius: 6, color: '#fff', fontSize: 13,
                fontWeight: 600, cursor: 'pointer' }}>
                Créer un manifeste
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid',
                gridTemplateColumns: '100px 1fr 120px 130px 50px 120px',
                padding: '8px 20px', fontSize: 10, fontWeight: 600, color: T.textDim,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                borderBottom: `1px solid ${T.border}` }}>
                <span>Réf.</span><span>Vol</span><span>Date</span>
                <span>Statut</span><span>PAX</span>
                <span style={{ textAlign: 'right' }}>Actions</span>
              </div>
              {manifestes.slice(0, 8).map(m => {
                const ss = statusStyle(m.statut);
                return (
                  <div key={m.id} className="row-hover"
                    onClick={() => navigate(`/manifestes/${m.id}`)}
                    style={{ display: 'grid',
                      gridTemplateColumns: '100px 1fr 120px 130px 50px 120px',
                      padding: '12px 20px',
                      borderBottom: `1px solid ${T.border}`,
                      alignItems: 'center', transition: 'background 0.1s',
                      background: T.bgCard }}>
                    <span style={{ fontSize: 11, fontFamily: T.mono,
                      color: T.green, fontWeight: 500 }}>
                      #{m.id.slice(0, 6).toUpperCase()}
                    </span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                        {m.vol?.numero_mission ?? m.vol_id.slice(0, 12)}
                      </span>
                      {m.flag_sensible && (
                        <Badge label="Sensible" color={T.amber} bg={T.amberBg} />
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: T.textDim }}>
                      {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    <Badge label={m.statut.replace('_', ' ')}
                      color={ss.color} bg={ss.bg} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                      {m._count?.passagers ?? 0}
                    </span>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {m.statut === 'BROUILLON' && (
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/manifestes/${m.id}/edit`); }}
                          style={{ padding: '4px 10px', background: T.greenBg,
                            border: `1px solid ${T.greenBorder}`, borderRadius: 4,
                            color: T.green, fontSize: 11, cursor: 'pointer',
                            fontWeight: 500 }}>
                          Saisir
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/manifestes/${m.id}`); }}
                        style={{ padding: '4px 10px', background: T.blueBg,
                          border: `1px solid ${T.blueBorder}`, borderRadius: 4,
                          color: T.blue, fontSize: 11, cursor: 'pointer',
                          fontWeight: 500 }}>
                        Voir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

      {/* ── CARTE CAMEROUN ────────────────────────────────────────────────── */}
      <Card style={{ padding: '20px 24px' }}>
        <CameroonMap />
      </Card>

      
    </div>
  );
}