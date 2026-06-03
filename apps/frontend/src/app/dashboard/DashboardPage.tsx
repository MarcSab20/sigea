import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/services/auth.service';
import { manifesteApi, Manifeste } from '@/services/manifeste.service';
import { toast } from 'sonner';

const C = {
  bg:'#04080f', panel:'#070e1a', panelB:'#0a1525', border:'#0f2035',
  borderHi:'#1a3a5f', green:'#00c896', greenDim:'#006448', greenGlow:'rgba(0,200,150,0.15)',
  amber:'#f59e0b', amberDim:'#78450a', red:'#ef4444', redDim:'#7a1414',
  blue:'#3b82f6', blueDim:'#1e3a70', text:'#d4e4f7', textDim:'#4a7a9b',
  textMute:'#1e3a5f', mono:"'Source Code Pro', monospace", display:"'Rajdhani', sans-serif",
};

const statusColor = (s: string): string => {
  if (['VALIDE','APPROUVE'].includes(s)) return C.green;
  if (['REJETE'].includes(s)) return C.red;
  if (['EN_VALIDATION','SOUMIS'].includes(s)) return C.amber;
  return C.blue;
};

const statusLabel: Record<string,string> = {
  BROUILLON:'BROUILLON', SOUMIS:'SOUMIS', EN_VALIDATION:'EN VALID.',
  VALIDE:'VALIDÉ', REJETE:'REJETÉ',
};

function Panel({ children, style={} }: { children: React.ReactNode; style?: React.CSSProperties }): React.ReactElement {
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:4,
      position:'relative', overflow:'hidden', ...style }}>
      <div style={{ position:'absolute', top:0, left:16, right:16, height:1,
        background:`linear-gradient(90deg,transparent,${C.borderHi},transparent)` }} />
      {children}
    </div>
  );
}

function PanelHeader({ title, sub, action }: { title:string; sub?:string; action?: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ padding:'14px 18px 10px', borderBottom:`1px solid ${C.border}`,
      display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <div>
        <div style={{ fontSize:9, fontFamily:C.mono, letterSpacing:'0.25em', color:C.textDim,
          textTransform:'uppercase' as const }}>{sub ?? 'MODULE'}</div>
        <div style={{ fontSize:13, fontFamily:C.display, fontWeight:600, color:C.text,
          letterSpacing:'0.08em', textTransform:'uppercase' as const, marginTop:1 }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

function Badge({ label, color }: { label:string; color:string }): React.ReactElement {
  return (
    <span style={{ fontSize:9, fontFamily:C.mono, fontWeight:700, letterSpacing:'0.12em',
      textTransform:'uppercase' as const, color, border:`1px solid ${color}`,
      borderRadius:2, padding:'1px 5px', background:`${color}18`, whiteSpace:'nowrap' as const }}>
      {label}
    </span>
  );
}

function Spinner(): React.ReactElement {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
      <div style={{ width:24, height:24, border:`2px solid ${C.borderHi}`,
        borderTopColor:C.green, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    </div>
  );
}

export default function DashboardPage(): React.ReactElement {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [time, setTime] = useState(new Date());
  const [manifestes, setManifestes] = useState<Manifeste[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const data = await manifesteApi.list();
      setManifestes(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(() => setTime(new Date()), 1000);
    const r = setInterval(fetchData, 30000); // refresh 30s
    return () => { clearInterval(t); clearInterval(r); };
  }, [fetchData]);

  const handleLogout = async (): Promise<void> => {
    try { await authApi.logout(); } catch { /* silent */ }
    logout();
    navigate('/login', { replace: true });
  };

  const handleSoumettre = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    try {
      await manifesteApi.soumettre(id);
      toast.success('Manifeste soumis au circuit de validation');
      fetchData();
    } catch {
      toast.error('Erreur lors de la soumission');
    }
  };

  const pad = (n: number): string => n.toString().padStart(2,'0');
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const dateStr = time.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).toUpperCase();

  // Stats calculées depuis les vraies données
  const stats = [
    { label:'Manifestes actifs', value: manifestes.length, unit:'total', color:C.blue },
    { label:'Brouillons',  value: manifestes.filter(m=>m.statut==='BROUILLON').length,  unit:'en cours', color:C.textDim },
    { label:'Soumis',      value: manifestes.filter(m=>m.statut==='SOUMIS').length,      unit:'en attente', color:C.amber },
    { label:'En validation',value: manifestes.filter(m=>m.statut==='EN_VALIDATION').length, unit:'circuit', color:C.amber },
    { label:'Validés',     value: manifestes.filter(m=>m.statut==='VALIDE').length,      unit:'signés', color:C.green },
    { label:'Rejetés',     value: manifestes.filter(m=>m.statut==='REJETE').length,      unit:'à corriger', color:C.red },
  ];

  const alertes = [
    ...manifestes.filter(m=>m.flag_sensible).map(m=>({
      id:m.id, type:'CEMAA' as const,
      message:`Manifeste sensible ${m.id.slice(0,8).toUpperCase()} — Validation CEMAA requise`,
      heure: new Date(m.updatedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
      urgence: false,
    })),
  ];

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:C.display, color:C.text, overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500;600&display=swap');
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes scan   { 0%{top:0}100%{top:100%} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#04080f}
        ::-webkit-scrollbar-thumb{background:#1a3a5f;border-radius:2px}
        .row-hover:hover{background:rgba(26,58,95,0.25)!important;cursor:pointer}
        button:hover{filter:brightness(1.2)}
      `}</style>

      <div style={{ position:'fixed', top:0, left:0, right:0, height:1, zIndex:100,
        background:`linear-gradient(90deg,transparent,${C.green},transparent)`,
        opacity:0.15, animation:'scan 12s linear infinite', pointerEvents:'none' }} />

      {/* TOPBAR */}
      <div style={{ height:52, background:C.panel, borderBottom:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, border:`1.5px solid ${C.green}`, borderRadius:4,
            display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
            <span style={{ fontSize:13, color:C.green }}>✈</span>
            <div style={{ position:'absolute', top:-3, right:-3, width:6, height:6,
              borderRadius:'50%', background:C.green, animation:'pulse 2s infinite' }} />
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, letterSpacing:'0.15em', color:C.text,
              fontFamily:C.display, lineHeight:1 }}>SIGEA</div>
            <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, letterSpacing:'0.2em' }}>
              FORCES AÉRIENNES DU CAMEROUN
            </div>
          </div>
          <div style={{ width:1, height:30, background:C.border, margin:'0 8px' }} />
          <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, letterSpacing:'0.15em', textTransform:'uppercase' as const }}>
            BASE AÉRIENNE · {user?.base_id?.toUpperCase() ?? 'BA-101'}
          </div>
        </div>

        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:20, fontFamily:C.mono, fontWeight:600, color:C.green,
            letterSpacing:'0.1em', lineHeight:1 }}>{timeStr}</div>
          <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, letterSpacing:'0.15em', marginTop:1 }}>{dateStr}</div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, fontFamily:C.display, fontWeight:600, color:C.text,
              letterSpacing:'0.1em', textTransform:'uppercase' as const }}>
              {user?.role?.replace('_',' ') ?? 'OPÉRATEUR'}
            </div>
            <div style={{ fontSize:9, fontFamily:C.mono, color:C.green, letterSpacing:'0.15em' }}>
              ● SESSION ACTIVE
            </div>
          </div>
          <button onClick={handleLogout} style={{ padding:'6px 14px', background:'transparent',
            border:`1px solid ${C.borderHi}`, borderRadius:3, color:C.textDim, fontSize:9,
            fontFamily:C.mono, letterSpacing:'0.2em', textTransform:'uppercase' as const, cursor:'pointer' }}>
            DÉCONNEXION
          </button>
        </div>
      </div>

      <div style={{ padding:'16px 20px', maxWidth:1600, margin:'0 auto' }}>

        {/* ALERTES */}
        {alertes.filter(a=>a.urgence).length > 0 && (
          <div style={{ marginBottom:12 }}>
            {alertes.filter(a=>a.urgence).map(a=>(
              <div key={a.id} style={{ background:`${C.red}12`, border:`1px solid ${C.red}`,
                borderRadius:4, padding:'10px 16px', marginBottom:6, display:'flex',
                alignItems:'center', gap:12 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:C.red, animation:'pulse 1s infinite', flexShrink:0 }} />
                <div style={{ flex:1, fontSize:11, fontFamily:C.mono, color:C.red, letterSpacing:'0.08em' }}>
                  ⚠ {a.message}
                </div>
                <span style={{ fontSize:9, fontFamily:C.mono, color:`${C.red}99` }}>{a.heure}</span>
              </div>
            ))}
          </div>
        )}

        {/* STATS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:14 }}>
          {stats.map((s,i)=>(
            <Panel key={i} style={{ padding:'14px 16px' }}>
              <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, letterSpacing:'0.2em',
                textTransform:'uppercase' as const, marginBottom:6 }}>{s.label}</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
                <span style={{ fontSize:26, fontFamily:C.mono, fontWeight:600, color:s.color, lineHeight:1 }}>
                  {loading ? '—' : s.value}
                </span>
                <span style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, textTransform:'uppercase' as const }}>
                  {s.unit}
                </span>
              </div>
              <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2,
                background:`linear-gradient(90deg,${s.color}40,${s.color},${s.color}40)`, opacity:0.6 }} />
            </Panel>
          ))}
        </div>

        {/* GRILLE */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:12 }}>

          {/* Gauche — manifestes */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Panel>
              <PanelHeader title="Manifestes d'Escale" sub={`Base · ${user?.base_id?.toUpperCase() ?? 'BA-101'}`}
                action={
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>navigate('/manifestes/nouveau')} style={{
                      padding:'5px 14px', background:C.greenDim, border:`1px solid ${C.green}`,
                      borderRadius:3, color:C.green, fontSize:9, fontFamily:C.mono,
                      letterSpacing:'0.2em', cursor:'pointer', textTransform:'uppercase' as const }}>
                      + NOUVEAU
                    </button>
                    <button onClick={fetchData} style={{
                      padding:'5px 10px', background:'transparent', border:`1px solid ${C.borderHi}`,
                      borderRadius:3, color:C.textDim, fontSize:9, fontFamily:C.mono, cursor:'pointer' }}>
                      ↻
                    </button>
                  </div>
                }
              />
              {loading ? <Spinner /> : error ? (
                <div style={{ padding:20, textAlign:'center', fontSize:11, fontFamily:C.mono, color:C.red }}>
                  {error}
                  <button onClick={fetchData} style={{ marginLeft:12, color:C.amber, background:'none',
                    border:`1px solid ${C.amber}`, borderRadius:2, padding:'2px 8px',
                    fontSize:9, fontFamily:C.mono, cursor:'pointer' }}>RÉESSAYER</button>
                </div>
              ) : manifestes.length === 0 ? (
                <div style={{ padding:40, textAlign:'center' }}>
                  <div style={{ fontSize:11, fontFamily:C.mono, color:C.textMute, letterSpacing:'0.2em',
                    textTransform:'uppercase' as const, marginBottom:16 }}>AUCUN MANIFESTE</div>
                  <button onClick={()=>navigate('/manifestes/nouveau')} style={{
                    padding:'8px 20px', background:C.greenDim, border:`1px solid ${C.green}`,
                    borderRadius:3, color:C.green, fontSize:10, fontFamily:C.mono,
                    letterSpacing:'0.2em', cursor:'pointer', textTransform:'uppercase' as const }}>
                    CRÉER LE PREMIER MANIFESTE
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 110px 120px 60px 80px 110px',
                    padding:'8px 18px', borderBottom:`1px solid ${C.border}`,
                    fontSize:8, fontFamily:C.mono, color:C.textDim, letterSpacing:'0.2em',
                    textTransform:'uppercase' as const }}>
                    <span>REF</span><span>VOL · MISSION</span><span>DATE</span>
                    <span>STATUT</span><span>PAX</span><span>VERSION</span>
                    <span style={{textAlign:'right'}}>ACTIONS</span>
                  </div>
                  {manifestes.map((m,i)=>{
                    const col = statusColor(m.statut);
                    const date = new Date(m.createdAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'});
                    return (
                      <div key={m.id} className="row-hover"
                        onClick={()=>navigate(`/manifestes/${m.id}`)}
                        style={{ display:'grid', gridTemplateColumns:'80px 1fr 110px 120px 60px 80px 110px',
                          padding:'11px 18px', borderBottom:`1px solid ${C.border}55`,
                          alignItems:'center', transition:'background 0.15s',
                          animation:`fadeUp ${0.1+i*0.05}s ease forwards` }}>
                        <span style={{ fontSize:9, fontFamily:C.mono, color:C.green }}>
                          #{m.id.slice(0,6).toUpperCase()}
                        </span>
                        <div>
                          <span style={{ fontSize:11, fontFamily:C.display, fontWeight:600, color:C.text }}>
                            {m.vol?.numero_mission ?? m.vol_id.slice(0,8).toUpperCase()}
                          </span>
                          {m.vol?.immatriculation && (
                            <span style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, marginLeft:8 }}>
                              {m.vol.immatriculation}
                            </span>
                          )}
                          {m.flag_sensible && (
                            <span style={{ marginLeft:6, fontSize:8, fontFamily:C.mono,
                              color:C.amber, border:`1px solid ${C.amber}`, borderRadius:2,
                              padding:'0px 4px', background:`${C.amber}15` }}>SENSIBLE</span>
                          )}
                        </div>
                        <span style={{ fontSize:10, fontFamily:C.mono, color:C.textDim }}>{date}</span>
                        <Badge label={statusLabel[m.statut] ?? m.statut} color={col} />
                        <span style={{ fontSize:12, fontFamily:C.mono, fontWeight:600, color:C.text }}>
                          {m._count?.passagers ?? 0}
                        </span>
                        <span style={{ fontSize:10, fontFamily:C.mono, color:C.textDim }}>v{m.version}</span>
                        <div style={{ display:'flex', gap:5, justifyContent:'flex-end' }}>
                          <button onClick={e=>{e.stopPropagation();navigate(`/manifestes/${m.id}`);}} style={{
                            padding:'3px 8px', background:C.blueDim, border:`1px solid ${C.blue}`,
                            borderRadius:2, color:C.blue, fontSize:8, fontFamily:C.mono, cursor:'pointer' }}>
                            VOIR
                          </button>
                          {m.statut === 'BROUILLON' && (
                            <button onClick={e=>handleSoumettre(m.id,e)} style={{
                              padding:'3px 8px', background:C.greenDim, border:`1px solid ${C.green}`,
                              borderRadius:2, color:C.green, fontSize:8, fontFamily:C.mono, cursor:'pointer' }}>
                              SOUMETTRE
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* Droite */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* ALERTES PANEL */}
            <Panel>
              <PanelHeader title="Notifications" sub="Temps Réel"
                action={
                  <div style={{ width:32, height:32, borderRadius:'50%', border:`1px solid ${alertes.length>0?C.amber:C.border}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontFamily:C.mono, fontWeight:700,
                    color:alertes.length>0?C.amber:C.textMute }}>
                    {alertes.length}
                  </div>
                }
              />
              <div style={{ padding:'8px 0', minHeight:80 }}>
                {alertes.length === 0 ? (
                  <div style={{ padding:'20px 18px', textAlign:'center', fontSize:10,
                    fontFamily:C.mono, color:C.textMute, letterSpacing:'0.15em' }}>
                    SYSTÈME NOMINAL
                  </div>
                ) : alertes.slice(0,4).map((a,i)=>{
                  const col = a.type==='EVASAN'?C.red:a.type==='VIP'?C.amber:a.type==='DANGER'?C.red:C.blue;
                  return (
                    <div key={a.id} style={{ padding:'10px 18px', borderBottom:`1px solid ${C.border}55`,
                      display:'flex', gap:10, alignItems:'flex-start' }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:col,
                        flexShrink:0, marginTop:3, animation:a.urgence?'pulse 1s infinite':'none' }} />
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', gap:6, marginBottom:3, alignItems:'center' }}>
                          <Badge label={a.type} color={col} />
                          <span style={{ fontSize:9, fontFamily:C.mono, color:C.textDim }}>{a.heure}</span>
                        </div>
                        <div style={{ fontSize:10, fontFamily:C.mono, color:C.text, lineHeight:1.5 }}>
                          {a.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* ACTIONS RAPIDES */}
            <Panel>
              <PanelHeader title="Actions" sub="Navigation rapide" />
              <div style={{ padding:12 }}>
                {[
                  { label:'Nouveau manifeste', color:C.green, path:'/manifestes/nouveau' },
                  { label:'Tous les manifestes', color:C.blue, path:'/manifestes' },
                  { label:'Vols planifiés', color:C.textDim, path:'/vols' },
                  { label:'Administration', color:C.textMute, path:'/admin' },
                ].map((btn,i)=>(
                  <button key={i} onClick={()=>navigate(btn.path)} style={{
                    width:'100%', padding:'10px 14px', marginBottom:8,
                    background:`${btn.color}10`, border:`1px solid ${btn.color}40`,
                    borderRadius:3, color:btn.color, fontSize:11, fontFamily:C.display,
                    fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' as const,
                    cursor:'pointer', textAlign:'left' as const, transition:'all 0.2s',
                  }}>
                    {btn.label}
                  </button>
                ))}
              </div>
            </Panel>

            {/* ÉTAT SYSTÈME */}
            <Panel>
              <PanelHeader title="État Système" sub="Infrastructure" />
              <div style={{ padding:'10px 18px' }}>
                {[
                  { svc:'Gateway API',       ok:!error },
                  { svc:'Auth Service',      ok:true },
                  { svc:'Manifeste Service', ok:!error },
                  { svc:'Base de données',   ok:!error },
                  { svc:'Notification WS',   ok:false },
                ].map((s,i)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'5px 0', borderBottom:`1px solid ${C.border}55` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ width:5, height:5, borderRadius:'50%',
                        background:s.ok?C.green:C.red, animation:s.ok?'pulse 3s infinite':'none' }} />
                      <span style={{ fontSize:9, fontFamily:C.mono, color:s.ok?C.text:C.textDim,
                        letterSpacing:'0.08em' }}>{s.svc}</span>
                    </div>
                    <span style={{ fontSize:8, fontFamily:C.mono, color:s.ok?C.green:C.red }}>
                      {s.ok?'OK':'ERR'}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <div style={{ marginTop:16, padding:'8px 0', borderTop:`1px solid ${C.border}`,
          display:'flex', justifyContent:'space-between', fontSize:8,
          fontFamily:C.mono, color:C.textMute, letterSpacing:'0.15em' }}>
          <span>SIGEA v1.0 · FAC/DSIC · CONFIDENTIEL DÉFENSE</span>
          <span>SESSION: {user?.sub?.slice(0,8).toUpperCase()}…</span>
          <span>TOUTES ACTIONS AUDITÉES · SHA-256</span>
        </div>
      </div>
    </div>
  );
}