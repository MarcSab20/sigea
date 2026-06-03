import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { manifesteApi, volApi, referentielApi, Manifeste, Vol, Passager, Materiel, CreateManifesteDto } from '@/services/manifeste.service';
import { toast } from 'sonner';

const C = {
  bg:'#04080f', panel:'#070e1a', border:'#0f2035', borderHi:'#1a3a5f',
  green:'#00c896', greenDim:'#006448', amber:'#f59e0b', amberDim:'#78450a',
  red:'#ef4444', blue:'#3b82f6', blueDim:'#1e3a70', text:'#d4e4f7',
  textDim:'#4a7a9b', textMute:'#1e3a5f', input:'#050c18',
  mono:"'Source Code Pro', monospace", display:"'Rajdhani', sans-serif",
};

// ─── Composants de base ───────────────────────────────────────────────────────

function Panel({ children, style={} }: { children:React.ReactNode; style?:React.CSSProperties }): React.ReactElement {
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:4,
      position:'relative', overflow:'hidden', ...style }}>
      <div style={{ position:'absolute', top:0, left:16, right:16, height:1,
        background:`linear-gradient(90deg,transparent,${C.borderHi},transparent)` }} />
      {children}
    </div>
  );
}

function PH({ title, sub }: { title:string; sub?:string }): React.ReactElement {
  return (
    <div style={{ padding:'14px 18px 10px', borderBottom:`1px solid ${C.border}` }}>
      {sub && <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, letterSpacing:'0.25em',
        textTransform:'uppercase' as const }}>{sub}</div>}
      <div style={{ fontSize:13, fontFamily:C.display, fontWeight:600, color:C.text,
        letterSpacing:'0.08em', textTransform:'uppercase' as const, marginTop:1 }}>{title}</div>
    </div>
  );
}

interface FieldProps {
  label: string; value: string; onChange: (v:string)=>void;
  type?: string; required?: boolean; disabled?: boolean;
  options?: { value:string; label:string }[];
  placeholder?: string; mono?: boolean;
}

function Field({ label, value, onChange, type='text', required, disabled, options, placeholder, mono }: FieldProps): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    width:'100%', padding:'9px 12px', background:C.input,
    border:`1px solid ${focused ? C.borderHi : C.border}`,
    borderRadius:3, color:C.text, fontSize:12, outline:'none',
    fontFamily: mono ? C.mono : C.display, boxSizing:'border-box' as const,
    transition:'border-color 0.2s',
    boxShadow: focused ? `0 0 0 2px ${C.borderHi}40` : 'none',
  };
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:9, fontFamily:C.mono, letterSpacing:'0.2em',
        color:C.textDim, textTransform:'uppercase' as const, marginBottom:5 }}>
        {label}{required && <span style={{ color:C.red, marginLeft:3 }}>*</span>}
      </label>
      {options ? (
        <select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          style={{ ...base, appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234a7a9b' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
            backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center', paddingRight:28 }}>
          <option value="">— Sélectionner —</option>
          {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e=>onChange(e.target.value)}
          disabled={disabled} placeholder={placeholder}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} style={base} />
      )}
    </div>
  );
}

function Badge({ label, color }: { label:string; color:string }): React.ReactElement {
  return (
    <span style={{ fontSize:9, fontFamily:C.mono, fontWeight:700, letterSpacing:'0.12em',
      textTransform:'uppercase' as const, color, border:`1px solid ${color}`,
      borderRadius:2, padding:'1px 5px', background:`${color}18` }}>{label}</span>
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

// ─── Topbar commune ───────────────────────────────────────────────────────────
function Topbar({ title, onBack }: { title:string; onBack:()=>void }): React.ReactElement {
  const { user } = useAuthStore();
  return (
    <div style={{ height:52, background:C.panel, borderBottom:`1px solid ${C.border}`,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 20px', position:'sticky', top:0, zIndex:50 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ padding:'5px 12px', background:'transparent',
          border:`1px solid ${C.borderHi}`, borderRadius:3, color:C.textDim, fontSize:9,
          fontFamily:C.mono, cursor:'pointer', letterSpacing:'0.15em' }}>← RETOUR</button>
        <div style={{ width:1, height:28, background:C.border }} />
        <div style={{ fontSize:13, fontFamily:C.display, fontWeight:600, color:C.text,
          letterSpacing:'0.15em', textTransform:'uppercase' as const }}>{title}</div>
      </div>
      <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, letterSpacing:'0.15em' }}>
        {user?.role?.toUpperCase()} · BASE {user?.base_id?.toUpperCase()}
      </div>
    </div>
  );
}

// ─── LISTE DES MANIFESTES ─────────────────────────────────────────────────────
function ManifestesListPage(): React.ReactElement {
  const navigate = useNavigate();
  const [manifestes, setManifestes] = useState<Manifeste[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    manifesteApi.list().then(setManifestes).catch(()=>toast.error('Erreur chargement')).finally(()=>setLoading(false));
  }, []);

  const statusColor = (s:string):string => s==='VALIDE'?C.green:s==='REJETE'?C.red:s==='BROUILLON'?C.textDim:C.amber;

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Source+Code+Pro:wght@400;500&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1a3a5f}
        .row-hover:hover{background:rgba(26,58,95,0.25)!important;cursor:pointer}button:hover{filter:brightness(1.2)}
        select,input{color-scheme:dark}`}</style>
      <Topbar title="Manifestes d'Escale" onBack={()=>navigate('/')} />
      <div style={{ padding:'20px', maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
          <button onClick={()=>navigate('/manifestes/nouveau')} style={{
            padding:'8px 20px', background:C.greenDim, border:`1px solid ${C.green}`,
            borderRadius:3, color:C.green, fontSize:10, fontFamily:C.mono,
            letterSpacing:'0.2em', cursor:'pointer', textTransform:'uppercase' as const }}>
            + NOUVEAU MANIFESTE
          </button>
        </div>
        <Panel>
          {loading ? <Spinner /> : manifestes.length === 0 ? (
            <div style={{ padding:60, textAlign:'center' }}>
              <div style={{ fontSize:11, fontFamily:C.mono, color:C.textMute, letterSpacing:'0.2em',
                textTransform:'uppercase' as const, marginBottom:20 }}>AUCUN MANIFESTE</div>
              <button onClick={()=>navigate('/manifestes/nouveau')} style={{
                padding:'10px 24px', background:C.greenDim, border:`1px solid ${C.green}`,
                borderRadius:3, color:C.green, fontSize:10, fontFamily:C.mono,
                letterSpacing:'0.2em', cursor:'pointer', textTransform:'uppercase' as const }}>
                CRÉER MAINTENANT
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 120px 130px 60px 60px 120px',
                padding:'8px 18px', borderBottom:`1px solid ${C.border}`,
                fontSize:8, fontFamily:C.mono, color:C.textDim, letterSpacing:'0.2em', textTransform:'uppercase' as const }}>
                <span>REF</span><span>VOL</span><span>DATE</span><span>STATUT</span>
                <span>PAX</span><span>VER.</span><span style={{textAlign:'right'}}>ACTIONS</span>
              </div>
              {manifestes.map((m,i)=>{
                const col = statusColor(m.statut);
                return (
                  <div key={m.id} className="row-hover"
                    onClick={()=>navigate(`/manifestes/${m.id}`)}
                    style={{ display:'grid', gridTemplateColumns:'90px 1fr 120px 130px 60px 60px 120px',
                      padding:'12px 18px', borderBottom:`1px solid ${C.border}55`,
                      alignItems:'center', transition:'background 0.15s',
                      animation:`fadeUp ${0.1+i*0.04}s ease forwards` }}>
                    <span style={{ fontSize:9, fontFamily:C.mono, color:C.green }}>
                      #{m.id.slice(0,6).toUpperCase()}
                    </span>
                    <div>
                      <span style={{ fontSize:12, fontFamily:C.display, fontWeight:600, color:C.text }}>
                        {m.vol?.numero_mission ?? m.vol_id.slice(0,12)}
                      </span>
                      {m.flag_sensible && <Badge label="SENSIBLE" color={C.amber} />}
                    </div>
                    <span style={{ fontSize:10, fontFamily:C.mono, color:C.textDim }}>
                      {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    <Badge label={m.statut.replace('_',' ')} color={col} />
                    <span style={{ fontSize:12, fontFamily:C.mono, color:C.text }}>{m._count?.passagers??0}</span>
                    <span style={{ fontSize:10, fontFamily:C.mono, color:C.textDim }}>v{m.version}</span>
                    <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                      <button onClick={e=>{e.stopPropagation();navigate(`/manifestes/${m.id}`);}} style={{
                        padding:'4px 10px', background:C.blueDim, border:`1px solid ${C.blue}`,
                        borderRadius:2, color:C.blue, fontSize:8, fontFamily:C.mono, cursor:'pointer' }}>
                        VOIR
                      </button>
                      {m.statut==='BROUILLON' && (
                        <button onClick={e=>{e.stopPropagation();navigate(`/manifestes/${m.id}/edit`);}} style={{
                          padding:'4px 10px', background:C.greenDim, border:`1px solid ${C.green}`,
                          borderRadius:2, color:C.green, fontSize:8, fontFamily:C.mono, cursor:'pointer' }}>
                          SAISIR
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
    </div>
  );
}

// ─── CRÉATION DE MANIFESTE ────────────────────────────────────────────────────
function NouveauManifestePage(): React.ReactElement {
  const navigate = useNavigate();
  const [vols, setVols] = useState<Vol[]>([]);
  const [loadingVols, setLoadingVols] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [volId, setVolId] = useState('');
  const [etapeVol, setEtapeVol] = useState('A');

  useEffect(() => {
    volApi.list()
      .then(setVols)
      .catch(()=>{ /* vols indisponibles — saisie manuelle */ })
      .finally(()=>setLoadingVols(false));
  }, []);

  const volSelectionne = vols.find(v=>v.id===volId);

  const handleCreate = async (): Promise<void> => {
    if (!volId) { toast.error('Sélectionnez un vol'); return; }
    setSubmitting(true);
    try {
      const dto: CreateManifesteDto = { vol_id: volId, etape_vol: etapeVol };
      const m = await manifesteApi.create(dto);
      toast.success('Manifeste créé — accès à la saisie');
      navigate(`/manifestes/${m.id}/edit`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erreur de création');
    } finally {
      setSubmitting(false);
    }
  };

  const typeColors: Record<string,string> = {
    PROJECTION:C.blue, PARA:C.blue, LIAISON:C.textDim, LOGISTIQUE:C.textDim,
    EVASAN:C.red, VIP:C.amber, OP_SENSIBLE:C.amber,
  };

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Source+Code+Pro:wght@400;500&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;margin:0;padding:0}select,input{color-scheme:dark}button:hover{filter:brightness(1.2)}`}</style>
      <Topbar title="Nouveau Manifeste" onBack={()=>navigate('/manifestes')} />

      <div style={{ padding:'24px 20px', maxWidth:900, margin:'0 auto', animation:'fadeUp 0.3s ease forwards' }}>

        {/* ÉTAPE 1 — Sélection du vol */}
        <Panel style={{ marginBottom:16 }}>
          <PH title="Étape 1 — Sélection du Vol" sub="Référence opérationnelle" />
          <div style={{ padding:'20px 24px' }}>
            {loadingVols ? (
              <div style={{ fontSize:10, fontFamily:C.mono, color:C.textDim, marginBottom:16 }}>
                Chargement des vols…
              </div>
            ) : vols.length === 0 ? (
              <div style={{ padding:'12px 16px', background:`${C.amber}10`, border:`1px solid ${C.amberDim}`,
                borderRadius:3, fontSize:10, fontFamily:C.mono, color:C.amber, marginBottom:16,
                letterSpacing:'0.08em' }}>
                ⚠ Aucun vol disponible — contactez l'opérateur vol pour créer un vol
              </div>
            ) : (
              <Field label="Vol de rattachement" value={volId} onChange={setVolId} required
                options={vols.map(v=>({
                  value:v.id,
                  label:`${v.numero_mission} · ${v.immatriculation} · ${new Date(v.date_heure).toLocaleDateString('fr-FR')} ${new Date(v.date_heure).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`
                }))} />
            )}

            {/* Fiche vol sélectionné */}
            {volSelectionne && (
              <div style={{ marginTop:4, padding:'14px 16px', background:`${C.green}08`,
                border:`1px solid ${C.greenDim}`, borderRadius:3 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                  {[
                    { label:'Mission', value:volSelectionne.numero_mission },
                    { label:'Aéronef', value:volSelectionne.immatriculation },
                    { label:'Type', value:volSelectionne.type_mission },
                    { label:'Date / Heure', value:new Date(volSelectionne.date_heure).toLocaleString('fr-FR') },
                    { label:'Capacité PAX', value:`${volSelectionne.capacite_places} places` },
                    { label:'Capacité Cargo', value:`${volSelectionne.capacite_cargo_kg} kg` },
                  ].map(f=>(
                    <div key={f.label}>
                      <div style={{ fontSize:8, fontFamily:C.mono, color:C.textDim,
                        letterSpacing:'0.2em', textTransform:'uppercase' as const, marginBottom:2 }}>{f.label}</div>
                      <div style={{ fontSize:11, fontFamily:C.mono, color:C.text }}>{f.value}</div>
                    </div>
                  ))}
                </div>
                {volSelectionne.flag_sensible && (
                  <div style={{ marginTop:12, padding:'8px 12px', background:`${C.amber}15`,
                    border:`1px solid ${C.amber}`, borderRadius:3, fontSize:10,
                    fontFamily:C.mono, color:C.amber }}>
                    ◆ VOL SENSIBLE — Circuit de validation CEMAA activé automatiquement
                  </div>
                )}
              </div>
            )}

            {/* Étape vol (multi-escales) */}
            <div style={{ marginTop:16 }}>
              <Field label="Étape du vol (multi-escales)" value={etapeVol} onChange={setEtapeVol}
                options={[
                  { value:'A', label:'A — Départ (manifeste maître)' },
                  { value:'B', label:'B — 1ère escale intermédiaire' },
                  { value:'C', label:'C — 2ème escale intermédiaire' },
                  { value:'D', label:'D — Terminus (arrivée finale)' },
                ]} />
              {etapeVol !== 'A' && (
                <div style={{ padding:'10px 14px', background:`${C.blue}10`,
                  border:`1px solid ${C.blueDim}`, borderRadius:3,
                  fontSize:10, fontFamily:C.mono, color:C.blue, marginTop:4 }}>
                  ℹ Manifeste enfant — référencez l'ID du manifeste maître si disponible
                </div>
              )}
            </div>
          </div>
        </Panel>

        {/* RÉCAPITULATIF + ACTION */}
        <Panel>
          <PH title="Validation & Création" sub="Récapitulatif" />
          <div style={{ padding:'20px 24px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
              <div style={{ padding:'12px 16px', background:`${C.border}80`, borderRadius:3 }}>
                <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim,
                  textTransform:'uppercase' as const, letterSpacing:'0.2em', marginBottom:6 }}>Vol rattaché</div>
                <div style={{ fontSize:12, fontFamily:C.mono, color: volId ? C.green : C.textMute }}>
                  {volId ? (volSelectionne?.numero_mission ?? volId.slice(0,8)) : 'Non sélectionné'}
                </div>
              </div>
              <div style={{ padding:'12px 16px', background:`${C.border}80`, borderRadius:3 }}>
                <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim,
                  textTransform:'uppercase' as const, letterSpacing:'0.2em', marginBottom:6 }}>Étape vol</div>
                <div style={{ fontSize:12, fontFamily:C.mono, color:C.text }}>Étape {etapeVol}</div>
              </div>
            </div>

            <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
              <button onClick={()=>navigate('/manifestes')} style={{
                padding:'10px 24px', background:'transparent', border:`1px solid ${C.borderHi}`,
                borderRadius:3, color:C.textDim, fontSize:10, fontFamily:C.mono,
                letterSpacing:'0.2em', cursor:'pointer', textTransform:'uppercase' as const }}>
                ANNULER
              </button>
              <button onClick={handleCreate} disabled={!volId || submitting} style={{
                padding:'10px 28px', background: (!volId||submitting) ? `${C.greenDim}50` : C.greenDim,
                border:`1px solid ${(!volId||submitting)?C.textMute:C.green}`,
                borderRadius:3, color:(!volId||submitting)?C.textMute:C.green, fontSize:10,
                fontFamily:C.mono, letterSpacing:'0.2em', cursor:(!volId||submitting)?'not-allowed':'pointer',
                textTransform:'uppercase' as const, display:'flex', alignItems:'center', gap:8 }}>
                {submitting ? (
                  <><div style={{ width:12, height:12, border:`2px solid ${C.textMute}`,
                    borderTopColor:C.green, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                  CRÉATION…</>
                ) : 'CRÉER LE MANIFESTE →'}
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── SAISIE MANIFESTE (passagers + matériels) ─────────────────────────────────
function SaisieManifestePage(): React.ReactElement {
  const { id } = useParams<{ id:string }>();
  const navigate = useNavigate();
  const [manifeste, setManifeste] = useState<Manifeste|null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'passagers'|'materiels'|'recap'>('passagers');
  const [submitting, setSubmitting] = useState(false);

  // Formulaire passager
  const [pax, setPax] = useState<Passager>({
    nom:'', prenom:'', grade:'', categorie:'TROUPES', matricule:'', unite:'', destination:'',
    nb_bagages:0, masse_bagages_kg:0, couleur_bagages:'', contact_urgence_nom:'',
    contact_urgence_tel:'', contact_urgence_qual:'', ref_autorisation:'',
  });

  // Formulaire matériel
  const [mat, setMat] = useState<Materiel>({
    designation:'', type_mission_log:'AA', proprietaire:'', poids_kg:0,
    volume:0, destination:'', expediteur_nom:'', expediteur_fonction:'', expediteur_tel:'',
  });

  const [savingPax, setSavingPax] = useState(false);
  const [savingMat, setSavingMat] = useState(false);

  useEffect(() => {
    if (!id) return;
    manifesteApi.get(id).then(setManifeste).catch(()=>toast.error('Manifeste introuvable')).finally(()=>setLoading(false));
  }, [id]);

  const handleAddPax = async (): Promise<void> => {
    if (!id || !pax.nom || !pax.prenom || !pax.destination || !pax.contact_urgence_nom || !pax.contact_urgence_tel) {
      toast.error('Champs obligatoires manquants'); return;
    }
    setSavingPax(true);
    try {
      await manifesteApi.addPassager(id, pax);
      toast.success(`Passager ${pax.nom} ${pax.prenom} ajouté`);
      const updated = await manifesteApi.get(id);
      setManifeste(updated);
      setPax({ nom:'', prenom:'', grade:'', categorie:'TROUPES', matricule:'', unite:'', destination:'',
        nb_bagages:0, masse_bagages_kg:0, couleur_bagages:'', contact_urgence_nom:'',
        contact_urgence_tel:'', contact_urgence_qual:'', ref_autorisation:'' });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erreur ajout passager');
    } finally { setSavingPax(false); }
  };

  const handleAddMat = async (): Promise<void> => {
    if (!id || !mat.designation || !mat.proprietaire || !mat.expediteur_nom) {
      toast.error('Champs obligatoires manquants'); return;
    }
    setSavingMat(true);
    try {
      await manifesteApi.addMateriel(id, mat);
      toast.success(`Matériel "${mat.designation}" ajouté`);
      const updated = await manifesteApi.get(id);
      setManifeste(updated);
      setMat({ designation:'', type_mission_log:'AA', proprietaire:'', poids_kg:0,
        volume:0, destination:'', expediteur_nom:'', expediteur_fonction:'', expediteur_tel:'' });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erreur ajout matériel');
    } finally { setSavingMat(false); }
  };

  const handleSoumettre = async (): Promise<void> => {
    if (!id) return;
    setSubmitting(true);
    try {
      await manifesteApi.soumettre(id);
      toast.success('Manifeste soumis au circuit de validation');
      navigate(`/manifestes/${id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erreur soumission');
    } finally { setSubmitting(false); }
  };

  const CATEGORIES = ['TROUPES','TROUPES_PARA','CHEF_MIL','MISSION','PERMISSION','EVASAN','VIP','CIVIL','OP_SENSIBLE'];
  const TYPES_LOG = ['AA','IA','INTERMINISTERIEL','INDIVIDUEL','SENSIBLE_CEMAA'];

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:24, height:24, border:`2px solid ${C.borderHi}`, borderTopColor:C.green,
        borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!manifeste) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:11, fontFamily:C.mono, color:C.red }}>MANIFESTE INTROUVABLE</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Source+Code+Pro:wght@400;500&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;margin:0;padding:0}select,input{color-scheme:dark}button:hover{filter:brightness(1.2)}`}</style>
      <Topbar title={`Saisie Manifeste #${manifeste.id.slice(0,6).toUpperCase()}`} onBack={()=>navigate('/manifestes')} />

      <div style={{ padding:'20px', maxWidth:1100, margin:'0 auto' }}>

        {/* INFO VOL */}
        <Panel style={{ marginBottom:14 }}>
          <div style={{ padding:'12px 18px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div>
              <span style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, letterSpacing:'0.2em' }}>VOL </span>
              <span style={{ fontSize:12, fontFamily:C.mono, color:C.green }}>
                {manifeste.vol?.numero_mission ?? manifeste.vol_id.slice(0,8).toUpperCase()}
              </span>
            </div>
            <div style={{ width:1, height:20, background:C.border }} />
            <div>
              <span style={{ fontSize:9, fontFamily:C.mono, color:C.textDim }}>AÉRONEF </span>
              <span style={{ fontSize:12, fontFamily:C.mono, color:C.text }}>{manifeste.vol?.immatriculation ?? '—'}</span>
            </div>
            <div style={{ width:1, height:20, background:C.border }} />
            <div>
              <span style={{ fontSize:9, fontFamily:C.mono, color:C.textDim }}>PAX </span>
              <span style={{ fontSize:12, fontFamily:C.mono, color:C.text }}>{manifeste.passagers?.length ?? 0}</span>
              {manifeste.vol && <span style={{ fontSize:9, fontFamily:C.mono, color:C.textDim }}>/{manifeste.vol.capacite_places}</span>}
            </div>
            <div style={{ width:1, height:20, background:C.border }} />
            <div>
              <span style={{ fontSize:9, fontFamily:C.mono, color:C.textDim }}>STATUT </span>
              <span style={{ fontSize:10, fontFamily:C.mono, color: manifeste.statut==='BROUILLON'?C.textDim:C.amber }}>
                {manifeste.statut}
              </span>
            </div>
            {manifeste.flag_sensible && (
              <span style={{ fontSize:9, fontFamily:C.mono, fontWeight:700, color:C.amber,
                border:`1px solid ${C.amber}`, borderRadius:2, padding:'1px 6px', background:`${C.amber}15` }}>
                ◆ SENSIBLE
              </span>
            )}
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              {manifeste.statut === 'BROUILLON' && (
                <button onClick={handleSoumettre} disabled={submitting} style={{
                  padding:'6px 18px', background:C.greenDim, border:`1px solid ${C.green}`,
                  borderRadius:3, color:C.green, fontSize:9, fontFamily:C.mono,
                  letterSpacing:'0.2em', cursor:'pointer', textTransform:'uppercase' as const }}>
                  {submitting ? 'SOUMISSION…' : 'SOUMETTRE AU CIRCUIT ↗'}
                </button>
              )}
            </div>
          </div>
        </Panel>

        {/* ONGLETS */}
        <div style={{ display:'flex', gap:4, marginBottom:14 }}>
          {(['passagers','materiels','recap'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:'8px 20px', background: tab===t ? C.panelB : 'transparent',
              border:`1px solid ${tab===t ? C.borderHi : C.border}`,
              borderRadius:'3px 3px 0 0', color: tab===t ? C.text : C.textDim,
              fontSize:10, fontFamily:C.mono, letterSpacing:'0.2em', cursor:'pointer',
              textTransform:'uppercase' as const, transition:'all 0.15s',
              borderBottom: tab===t ? `1px solid ${C.panelB}` : `1px solid ${C.border}`,
            }}>
              {t==='passagers' ? `PASSAGERS (${manifeste.passagers?.length??0})` :
               t==='materiels' ? `MATÉRIELS (${manifeste.materiels?.length??0})` : 'RÉCAPITULATIF'}
            </button>
          ))}
        </div>

        {/* ONGLET PASSAGERS */}
        {tab === 'passagers' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, animation:'fadeUp 0.2s ease forwards' }}>
            {/* Formulaire */}
            <Panel>
              <PH title="Ajouter un Passager" sub="Saisie Chef d'Escale" />
              <div style={{ padding:'16px 20px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                  <Field label="Nom" value={pax.nom} onChange={v=>setPax({...pax,nom:v})} required mono />
                  <Field label="Prénom(s)" value={pax.prenom} onChange={v=>setPax({...pax,prenom:v})} required mono />
                  <Field label="Grade / Qualité" value={pax.grade??''} onChange={v=>setPax({...pax,grade:v})} mono />
                  <Field label="Catégorie" value={pax.categorie} onChange={v=>setPax({...pax,categorie:v})} required
                    options={CATEGORIES.map(c=>({value:c,label:c.replace('_',' ')}))} />
                  <Field label="Matricule (si MIL)" value={pax.matricule??''} onChange={v=>setPax({...pax,matricule:v})} mono />
                  <Field label="Unité" value={pax.unite??''} onChange={v=>setPax({...pax,unite:v})} mono />
                </div>
                <Field label="Destination finale" value={pax.destination} onChange={v=>setPax({...pax,destination:v})} required mono />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0 16px' }}>
                  <Field label="Nb bagages" value={String(pax.nb_bagages)} type="number"
                    onChange={v=>setPax({...pax,nb_bagages:Number(v)})} required />
                  <Field label="Masse bagages (kg)" value={String(pax.masse_bagages_kg)} type="number"
                    onChange={v=>setPax({...pax,masse_bagages_kg:Number(v)})} required />
                  <Field label="Couleur bagages" value={pax.couleur_bagages??''} onChange={v=>setPax({...pax,couleur_bagages:v})} mono />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                  <Field label="Contact urgence — nom" value={pax.contact_urgence_nom} onChange={v=>setPax({...pax,contact_urgence_nom:v})} required mono />
                  <Field label="Contact urgence — tél" value={pax.contact_urgence_tel} onChange={v=>setPax({...pax,contact_urgence_tel:v})} required mono placeholder="+237XXXXXXXXX" />
                </div>
                <Field label="Réf. autorisation (ordre de mission)" value={pax.ref_autorisation??''} onChange={v=>setPax({...pax,ref_autorisation:v})} mono />
                {(pax.categorie==='EVASAN') && (
                  <div style={{ padding:'8px 12px', background:`${C.red}12`, border:`1px solid ${C.red}`,
                    borderRadius:3, fontSize:10, fontFamily:C.mono, color:C.red, marginBottom:12 }}>
                    ✚ EVASAN — Circuit accéléré activé à la soumission
                  </div>
                )}
                {(pax.categorie==='VIP') && (
                  <div style={{ padding:'8px 12px', background:`${C.amber}12`, border:`1px solid ${C.amber}`,
                    borderRadius:3, fontSize:10, fontFamily:C.mono, color:C.amber, marginBottom:12 }}>
                    ◆ VIP — Notification COMBASE + CEMAA automatique
                  </div>
                )}
                <button onClick={handleAddPax} disabled={savingPax} style={{
                  width:'100%', padding:'10px', background:C.greenDim, border:`1px solid ${C.green}`,
                  borderRadius:3, color:C.green, fontSize:10, fontFamily:C.mono,
                  letterSpacing:'0.2em', cursor:'pointer', textTransform:'uppercase' as const,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {savingPax ? <>
                    <div style={{ width:12, height:12, border:`2px solid ${C.textMute}`, borderTopColor:C.green,
                      borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />AJOUT…
                  </> : '+ AJOUTER CE PASSAGER'}
                </button>
              </div>
            </Panel>

            {/* Liste passagers */}
            <Panel>
              <PH title={`Liste Passagers (${manifeste.passagers?.length??0})`} sub="Embarqués" />
              <div style={{ maxHeight:600, overflowY:'auto' }}>
                {!manifeste.passagers?.length ? (
                  <div style={{ padding:40, textAlign:'center', fontSize:10, fontFamily:C.mono,
                    color:C.textMute, letterSpacing:'0.15em' }}>AUCUN PASSAGER</div>
                ) : manifeste.passagers.map((p,i)=>(
                  <div key={p.id??i} style={{ padding:'10px 18px', borderBottom:`1px solid ${C.border}55`,
                    animation:`fadeUp ${0.1+i*0.04}s ease forwards` }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                      <div style={{ fontSize:12, fontFamily:C.display, fontWeight:600, color:C.text }}>
                        {p.grade && <span style={{ color:C.textDim, marginRight:6 }}>{p.grade}</span>}
                        {p.nom} {p.prenom}
                      </div>
                      <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                        {p.verrouille && <span style={{ fontSize:8, fontFamily:C.mono, color:C.amber, border:`1px solid ${C.amber}`, borderRadius:2, padding:'0 4px' }}>🔒 CEMAA</span>}
                        {p.sensible && <span style={{ fontSize:8, fontFamily:C.mono, color:C.red, border:`1px solid ${C.red}`, borderRadius:2, padding:'0 4px' }}>SENSIBLE</span>}
                        <span style={{ fontSize:9, fontFamily:C.mono, color:C.textDim }}>{p.categorie}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, display:'flex', gap:16 }}>
                      <span>→ {p.destination}</span>
                      <span>{p.nb_bagages} bag. · {p.masse_bagages_kg}kg</span>
                      {p.matricule && <span>Mat: {p.matricule}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {/* ONGLET MATÉRIELS */}
        {tab === 'materiels' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, animation:'fadeUp 0.2s ease forwards' }}>
            <Panel>
              <PH title="Ajouter un Matériel" sub="Saisie logistique" />
              <div style={{ padding:'16px 20px' }}>
                <Field label="Désignation" value={mat.designation} onChange={v=>setMat({...mat,designation:v})} required mono />
                <Field label="Type mission logistique" value={mat.type_mission_log} onChange={v=>setMat({...mat,type_mission_log:v})} required
                  options={TYPES_LOG.map(t=>({value:t,label:t.replace('_',' ')}))} />
                <Field label="Propriétaire / Unité" value={mat.proprietaire} onChange={v=>setMat({...mat,proprietaire:v})} required mono />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                  <Field label="Poids (kg)" value={String(mat.poids_kg)} type="number" onChange={v=>setMat({...mat,poids_kg:Number(v)})} required />
                  <Field label="Volume (m³)" value={String(mat.volume??0)} type="number" onChange={v=>setMat({...mat,volume:Number(v)})} />
                </div>
                <Field label="Destination" value={mat.destination} onChange={v=>setMat({...mat,destination:v})} required mono />
                <Field label="Expéditeur — nom" value={mat.expediteur_nom} onChange={v=>setMat({...mat,expediteur_nom:v})} required mono />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                  <Field label="Fonction expéditeur" value={mat.expediteur_fonction} onChange={v=>setMat({...mat,expediteur_fonction:v})} required mono />
                  <Field label="Tél expéditeur" value={mat.expediteur_tel} onChange={v=>setMat({...mat,expediteur_tel:v})} required mono placeholder="+237XXXXXXXXX" />
                </div>
                {mat.type_mission_log === 'SENSIBLE_CEMAA' && (
                  <div style={{ padding:'8px 12px', background:`${C.amber}12`, border:`1px solid ${C.amber}`,
                    borderRadius:3, fontSize:10, fontFamily:C.mono, color:C.amber, marginBottom:12 }}>
                    ⬡ SENSIBLE CEMAA — Validation CEMAA requise avant COMBASE
                  </div>
                )}
                <button onClick={handleAddMat} disabled={savingMat} style={{
                  width:'100%', padding:'10px', background:C.greenDim, border:`1px solid ${C.green}`,
                  borderRadius:3, color:C.green, fontSize:10, fontFamily:C.mono,
                  letterSpacing:'0.2em', cursor:'pointer', textTransform:'uppercase' as const,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {savingMat ? <>
                    <div style={{ width:12, height:12, border:`2px solid ${C.textMute}`, borderTopColor:C.green,
                      borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />AJOUT…
                  </> : '+ AJOUTER CE MATÉRIEL'}
                </button>
              </div>
            </Panel>

            <Panel>
              <PH title={`Liste Matériels (${manifeste.materiels?.length??0})`} sub="Chargement" />
              <div style={{ maxHeight:600, overflowY:'auto' }}>
                {!manifeste.materiels?.length ? (
                  <div style={{ padding:40, textAlign:'center', fontSize:10, fontFamily:C.mono,
                    color:C.textMute, letterSpacing:'0.15em' }}>AUCUN MATÉRIEL</div>
                ) : manifeste.materiels.map((m,i)=>(
                  <div key={m.id??i} style={{ padding:'10px 18px', borderBottom:`1px solid ${C.border}55` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, fontFamily:C.display, fontWeight:600, color:C.text }}>
                        {m.designation}
                      </span>
                      <div style={{ display:'flex', gap:5 }}>
                        {m.verrouille && <span style={{ fontSize:8, fontFamily:C.mono, color:C.amber, border:`1px solid ${C.amber}`, borderRadius:2, padding:'0 4px' }}>🔒 CEMAA</span>}
                        <span style={{ fontSize:9, fontFamily:C.mono, color:C.textDim }}>{m.type_mission_log}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, display:'flex', gap:16 }}>
                      <span>{m.poids_kg} kg</span>
                      <span>→ {m.destination}</span>
                      <span>{m.proprietaire}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {/* ONGLET RÉCAPITULATIF */}
        {tab === 'recap' && (
          <Panel style={{ animation:'fadeUp 0.2s ease forwards' }}>
            <PH title="Récapitulatif du Manifeste" sub="Avant soumission" />
            <div style={{ padding:'20px 24px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
                {[
                  { label:'Passagers', value:manifeste.passagers?.length??0, color:C.blue },
                  { label:'Matériels', value:manifeste.materiels?.length??0, color:C.textDim },
                  { label:'Masse totale',
                    value:`${(manifeste.passagers?.reduce((s,p)=>s+Number(p.masse_bagages_kg),0)??0).toFixed(1)}kg`,
                    color:C.green },
                  { label:'Version', value:`v${manifeste.version}`, color:C.textDim },
                ].map(s=>(
                  <div key={s.label} style={{ padding:'14px 16px', background:`${C.border}80`, borderRadius:3 }}>
                    <div style={{ fontSize:9, fontFamily:C.mono, color:C.textDim, letterSpacing:'0.2em',
                      textTransform:'uppercase' as const, marginBottom:6 }}>{s.label}</div>
                    <div style={{ fontSize:22, fontFamily:C.mono, fontWeight:600, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {manifeste.statut === 'BROUILLON' && (
                <div style={{ padding:'16px', background:`${C.green}08`, border:`1px solid ${C.greenDim}`,
                  borderRadius:3, marginBottom:16 }}>
                  <div style={{ fontSize:10, fontFamily:C.mono, color:C.green, letterSpacing:'0.08em',
                    marginBottom:8 }}>✓ PRÊT POUR SOUMISSION</div>
                  <div style={{ fontSize:10, fontFamily:C.mono, color:C.textDim, lineHeight:1.6 }}>
                    La soumission lancera le circuit : COMESO → COMGMO → COMBORD → COMBASE
                    {manifeste.flag_sensible && ' → CEMAA (vol sensible)'}.
                  </div>
                </div>
              )}

              {manifeste.statut === 'BROUILLON' && (
                <button onClick={handleSoumettre} disabled={submitting} style={{
                  padding:'12px 32px', background:C.greenDim, border:`1px solid ${C.green}`,
                  borderRadius:3, color:C.green, fontSize:11, fontFamily:C.mono,
                  letterSpacing:'0.2em', cursor:'pointer', textTransform:'uppercase' as const,
                  display:'flex', alignItems:'center', gap:10 }}>
                  {submitting ? 'SOUMISSION EN COURS…' : '↗ SOUMETTRE AU CIRCUIT DE VALIDATION'}
                </button>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

// ─── ROUTER MANIFESTES ────────────────────────────────────────────────────────
export default function ManifestesPage(): React.ReactElement {
  return (
    <Routes>
      <Route index element={<ManifestesListPage />} />
      <Route path="nouveau" element={<NouveauManifestePage />} />
      <Route path=":id/edit" element={<SaisieManifestePage />} />
      <Route path=":id" element={<SaisieManifestePage />} />
    </Routes>
  );
}