// apps/frontend/src/app/validations/ValidationsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { manifesteApi, Manifeste } from '@/services/manifeste.service';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';
import { toast } from 'sonner';

function Card({ children, style={} }: { children: React.ReactNode; style?: React.CSSProperties }): React.ReactElement {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

const ETAPE_ORDER = ['COMESO', 'COMGMO', 'COMBORD', 'CEMAA_SENSIBLE', 'COMBASE'];
const ETAPE_ROLE: Record<string, string> = {
  COMESO: 'comeso', COMGMO: 'comgmo', COMBORD: 'combord',
  CEMAA_SENSIBLE: 'cemaa', COMBASE: 'combase',
};

function EtapeProgress({ validations, flagSensible }: {
  validations: Manifeste['validations']; flagSensible: boolean;
}): React.ReactElement {
  const etapes = flagSensible ? ETAPE_ORDER : ETAPE_ORDER.filter(e => e !== 'CEMAA_SENSIBLE');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {etapes.map((etape, i) => {
        const v = validations?.find(x => x.etape === etape);
        const color = !v ? T.textMute :
          v.statut === 'APPROUVE' ? T.green :
          v.statut === 'REJETE'   ? T.red : T.amberLight;
        const bg = !v ? T.bgAlt :
          v.statut === 'APPROUVE' ? T.greenBg :
          v.statut === 'REJETE'   ? T.redBg : T.amberBg;
        return (
          <React.Fragment key={etape}>
            {i > 0 && <div style={{ width: 16, height: 1, background: T.border }} />}
            <div title={etape} style={{ fontSize: 9, fontWeight: 700, color, background: bg,
              border: `1px solid ${color}60`, borderRadius: 4, padding: '2px 5px',
              letterSpacing: '0.05em' }}>
              {etape === 'CEMAA_SENSIBLE' ? 'CEMAA' : etape}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function ValidationsPage(): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [manifestes, setManifestes] = useState<Manifeste[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Manifeste | null>(null);
  const [motif, setMotif] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const data = await manifesteApi.list();
      // Filtrer uniquement les manifestes en cours de validation
      setManifestes(data.filter(m =>
        ['SOUMIS', 'EN_VALIDATION'].includes(m.statut)
      ));
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const r = setInterval(fetchData, 20000); return () => clearInterval(r); }, [fetchData]);

  // Détermine l'étape courante pour ce rôle
  const getEtapePourRole = (role: string): string | null => {
    return Object.entries(ETAPE_ROLE).find(([, r]) => r === role)?.[0] ?? null;
  };

  const etapeRole = getEtapePourRole(user?.role ?? '');

  // Manifestes où l'action de ce rôle est attendue
  const aValider = manifestes.filter(m => {
    if (!etapeRole) return false;
    const v = m.validations?.find(x => x.etape === etapeRole);
    return !v || v.statut === 'EN_ATTENTE';
  });

  const handleValider = async (manifeste: Manifeste, statut: 'APPROUVE' | 'REJETE'): Promise<void> => {
    if (statut === 'REJETE' && !motif.trim()) {
      toast.error('Un motif est obligatoire pour le rejet'); return;
    }
    setProcessing(true);
    try {
      await api.post(`/validations/${manifeste.id}`, {
        statut, commentaire: motif, role: user?.role,
      });
      toast.success(statut === 'APPROUVE' ? 'Validation enregistrée' : 'Rejet enregistré');
      setSelected(null);
      setMotif('');
      fetchData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erreur de validation');
    } finally { setProcessing(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.display }}>
          Circuit de Validation
        </h1>
        <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>
          Rôle actif : <strong>{user?.role?.replace('_', ' ').toUpperCase()}</strong>
          {etapeRole && <span> · Étape : <strong>{etapeRole}</strong></span>}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 16 }}>
        {/* Liste */}
        <Card>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
              Manifestes en attente de validation
              {aValider.length > 0 && (
                <span style={{ marginLeft: 8, background: T.amberBg, color: T.amber,
                  border: `1px solid ${T.amberBorder}`, borderRadius: 12,
                  fontSize: 11, fontWeight: 700, padding: '1px 8px' }}>
                  {aValider.length}
                </span>
              )}
            </div>
            <button onClick={fetchData} style={{ padding: '6px 12px', background: T.bgAlt,
              border: `1px solid ${T.border}`, borderRadius: 6, color: T.textDim,
              fontSize: 12, cursor: 'pointer' }}>↻ Actualiser</button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>Chargement…</div>
          ) : manifestes.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 14, color: T.green, fontWeight: 600 }}>
                Aucun manifeste en attente
              </div>
              <div style={{ fontSize: 12, color: T.textDim, marginTop: 8 }}>
                Tous les manifestes sont traités
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid',
                gridTemplateColumns: '90px 1fr 200px 110px 100px',
                padding: '8px 20px', fontSize: 10, fontWeight: 600, color: T.textDim,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                borderBottom: `1px solid ${T.border}` }}>
                <span>Réf.</span><span>Vol</span><span>Circuit</span>
                <span>Statut</span><span style={{ textAlign: 'right' }}>Action</span>
              </div>
              {manifestes.map(m => {
                const canAct = aValider.includes(m);
                return (
                  <div key={m.id} className="row-hover"
                    onClick={() => setSelected(m)}
                    style={{ display: 'grid',
                      gridTemplateColumns: '90px 1fr 200px 110px 100px',
                      padding: '13px 20px', borderBottom: `1px solid ${T.border}`,
                      alignItems: 'center', transition: 'background 0.1s',
                      background: selected?.id === m.id ? T.bgAlt : 'transparent',
                      borderLeft: canAct ? `3px solid ${T.amber}` : `3px solid transparent`,
                    }}>
                    <span style={{ fontSize: 11, fontFamily: T.mono, color: T.green }}>
                      #{m.id.slice(0, 6).toUpperCase()}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                        {m.vol?.numero_mission ?? m.vol_id.slice(0, 12)}
                      </div>
                      {m.flag_sensible && (
                        <span style={{ fontSize: 10, color: T.amber, background: T.amberBg,
                          border: `1px solid ${T.amberBorder}`, borderRadius: 4,
                          padding: '1px 5px' }}>SENSIBLE</span>
                      )}
                    </div>
                    <EtapeProgress validations={m.validations} flagSensible={m.flag_sensible} />
                    <span style={{ fontSize: 11, fontWeight: 600,
                      color: m.statut === 'SOUMIS' ? T.amberLight : T.blue }}>
                      {m.statut.replace('_', ' ')}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      {canAct && (
                        <button onClick={e => { e.stopPropagation(); setSelected(m); }} style={{
                          padding: '5px 12px', background: T.amberBg,
                          border: `1px solid ${T.amberBorder}`, borderRadius: 5,
                          color: T.amber, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          Traiter
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Panneau validation */}
        {selected && (
          <Card style={{ alignSelf: 'flex-start', position: 'sticky', top: 80 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                Validation — #{selected.id.slice(0, 6).toUpperCase()}
              </div>
              <button onClick={() => { setSelected(null); setMotif(''); }} style={{
                background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
                color: T.textDim }}>×</button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* Infos manifeste */}
              <div style={{ padding: '12px 14px', background: T.bgAlt,
                borderRadius: 6, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: T.textSub, marginBottom: 6 }}>
                  <strong>Vol :</strong> {selected.vol?.numero_mission ?? selected.vol_id.slice(0, 12)}
                </div>
                <div style={{ fontSize: 12, color: T.textSub, marginBottom: 6 }}>
                  <strong>PAX :</strong> {selected._count?.passagers ?? 0} passagers
                </div>
                <div style={{ fontSize: 12, color: T.textSub }}>
                  <strong>Statut :</strong> {selected.statut}
                </div>
              </div>

              {/* Étapes */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>
                  Progression du circuit
                </div>
                <EtapeProgress validations={selected.validations} flagSensible={selected.flag_sensible} />
              </div>

              {/* Motif */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600,
                  color: T.textSub, marginBottom: 6 }}>
                  Commentaire / Motif de rejet
                </label>
                <textarea value={motif} onChange={e => setMotif(e.target.value)}
                  placeholder="Facultatif pour validation, obligatoire pour rejet…"
                  rows={3} style={{ width: '100%', padding: '9px 12px',
                    background: T.bgInput, border: `1px solid ${T.border}`,
                    borderRadius: 6, color: T.text, fontSize: 12, outline: 'none',
                    resize: 'vertical', fontFamily: T.body, boxSizing: 'border-box' }} />
              </div>

              {/* Boutons */}
              {etapeRole && aValider.includes(selected) ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => handleValider(selected, 'REJETE')}
                    disabled={processing} style={{
                      flex: 1, padding: '10px', background: T.redBg,
                      border: `1px solid ${T.redBorder}`, borderRadius: 6,
                      color: T.red, fontSize: 13, fontWeight: 600,
                      cursor: processing ? 'not-allowed' : 'pointer' }}>
                    ✗ Rejeter
                  </button>
                  <button onClick={() => handleValider(selected, 'APPROUVE')}
                    disabled={processing} style={{
                      flex: 1, padding: '10px', background: T.green,
                      border: 'none', borderRadius: 6, color: '#fff',
                      fontSize: 13, fontWeight: 600,
                      cursor: processing ? 'not-allowed' : 'pointer' }}>
                    ✓ Valider
                  </button>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', background: T.bgAlt,
                  borderRadius: 6, fontSize: 12, color: T.textDim, textAlign: 'center' }}>
                  Pas d'action disponible pour votre rôle sur ce manifeste
                </div>
              )}

              <button onClick={() => navigate(`/manifestes/${selected.id}`)}
                style={{ width: '100%', marginTop: 10, padding: '8px',
                  background: T.blueBg, border: `1px solid ${T.blueBorder}`,
                  borderRadius: 6, color: T.blue, fontSize: 12,
                  cursor: 'pointer', fontWeight: 500 }}>
                Voir le manifeste complet
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}