// apps/frontend/src/app/manifestes/ManifestesPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Routes, Route, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { manifesteApi, volApi, Manifeste, Vol, Passager, Materiel, CreateManifesteDto } from '@/services/manifeste.service';
import { T } from '@/lib/theme';
import { toast } from 'sonner';
import ManifestePrint from '@/components/ManifestePrint';

// ─── Composants UI ─────────────────────────────────────────────────────────
function Card({ children, style={} }: { children: React.ReactNode; style?: React.CSSProperties }): React.ReactElement {
  return <div style={{ background: T.bgCard, border: `1px solid ${T.border}`,
    borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>{children}</div>;
}

function Field({ label, value, onChange, type='text', required, options, placeholder, disabled, rows }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; disabled?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string; rows?: number;
}): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: focused ? T.bgCard : T.bgInput,
    border: `1px solid ${focused ? T.green : T.border}`, borderRadius: 6, color: T.text,
    fontSize: 13, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
    fontFamily: T.body, boxShadow: focused ? `0 0 0 3px ${T.green}20` : 'none',
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
        {label}{required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
      </label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={base}>
          <option value="">— Sélectionner —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
          placeholder={placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...base, resize: 'vertical' }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={base} />
      )}
    </div>
  );
}

const CATEGORIES = ['TROUPES','TROUPES_PARA','CHEF_MIL','MISSION','PERMISSION','EVASAN','VIP','CIVIL','OP_SENSIBLE'];
const TYPES_LOG = ['AA','IA','INTERMINISTERIEL','INDIVIDUEL','SENSIBLE_CEMAA'];

const statusColor = (s: string): string =>
  s==='VALIDE'?T.green:s==='REJETE'?T.red:s==='SOUMIS'?T.amberLight:s==='EN_VALIDATION'?T.blue:T.textDim;

// ─── LISTE ────────────────────────────────────────────────────────────────────
function ManifestesListPage(): React.ReactElement {
  const navigate = useNavigate();
  const [manifestes, setManifestes] = useState<Manifeste[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    manifesteApi.list().then(setManifestes).catch(() => toast.error('Erreur')).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.display }}>Manifestes d'Escale</h1>
          <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>Gestion des manifestes de votre base</p>
        </div>
        <button onClick={() => navigate('/manifestes/nouveau')} style={{
          padding: '10px 20px', background: T.green, border: 'none', borderRadius: 6,
          color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Nouveau</button>
      </div>
      <Card>
        {loading ? <div style={{ padding: 48, textAlign: 'center', color: T.textDim }}>Chargement…</div> :
        manifestes.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: T.textDim, marginBottom: 20 }}>Aucun manifeste</div>
            <button onClick={() => navigate('/manifestes/nouveau')} style={{
              padding: '10px 24px', background: T.green, border: 'none', borderRadius: 6,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Créer maintenant</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px 130px 50px 60px 130px',
              padding: '8px 20px', fontSize: 10, fontWeight: 600, color: T.textDim,
              textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${T.border}` }}>
              <span>Réf.</span><span>Vol</span><span>Date</span><span>Statut</span>
              <span>PAX</span><span>Ver.</span><span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {manifestes.map(m => {
              const col = statusColor(m.statut);
              return (
                <div key={m.id} className="row-hover" onClick={() => navigate(`/manifestes/${m.id}`)}
                  style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px 130px 50px 60px 130px',
                    padding: '13px 20px', borderBottom: `1px solid ${T.border}`,
                    alignItems: 'center', transition: 'background 0.1s' }}>
                  <span style={{ fontSize: 11, fontFamily: T.mono, color: T.green, fontWeight: 500 }}>
                    #{m.id.slice(0,6).toUpperCase()}
                  </span>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                      {m.vol?.numero_mission ?? m.vol_id.slice(0,12)}
                    </span>
                    {m.flag_sensible && <span style={{ marginLeft: 8, fontSize: 10, color: T.amber,
                      background: T.amberBg, border: `1px solid ${T.amberBorder}`, borderRadius: 4,
                      padding: '1px 5px' }}>SENSIBLE</span>}
                  </div>
                  <span style={{ fontSize: 12, color: T.textDim }}>{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: col, background: `${col}18`,
                    border: `1px solid ${col}40`, borderRadius: 4, padding: '2px 8px', textTransform: 'uppercase' }}>
                    {m.statut.replace('_',' ')}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m._count?.passagers ?? 0}</span>
                  <span style={{ fontSize: 12, color: T.textDim }}>v{m.version}</span>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {m.statut === 'BROUILLON' && (
                      <button onClick={e => { e.stopPropagation(); navigate(`/manifestes/${m.id}/edit`); }} style={{
                        padding: '4px 10px', background: T.greenBg, border: `1px solid ${T.greenBorder}`,
                        borderRadius: 4, color: T.green, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                        Saisir
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); navigate(`/manifestes/${m.id}`); }} style={{
                      padding: '4px 10px', background: T.blueBg, border: `1px solid ${T.blueBorder}`,
                      borderRadius: 4, color: T.blue, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                      Voir
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

// ─── NOUVEAU MANIFESTE ────────────────────────────────────────────────────────
function NouveauManifestePage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [vols, setVols] = useState<Vol[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [volId, setVolId] = useState(searchParams.get('vol') ?? '');
  const [etapeVol, setEtapeVol] = useState('A');

  useEffect(() => {
    volApi.list().then(setVols).catch(() => {});
  }, []);

  const volSelectionne = vols.find(v => v.id === volId);

  const handleCreate = async (): Promise<void> => {
    if (!volId) { toast.error('Sélectionnez un vol'); return; }
    setSubmitting(true);
    try {
      const m = await manifesteApi.create({ vol_id: volId, etape_vol: etapeVol });
      toast.success('Manifeste créé');
      navigate(`/manifestes/${m.id}/edit`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erreur de création');
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.display }}>Nouveau Manifeste</h1>
        <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>Rattachement à un vol planifié</p>
      </div>
      <Card style={{ padding: '24px 28px' }}>
        {vols.length === 0 ? (
          <div style={{ padding: '16px', background: T.amberBg, border: `1px solid ${T.amberBorder}`,
            borderRadius: 6, marginBottom: 20, fontSize: 12, color: T.amber }}>
            ⚠ Aucun vol disponible — <button onClick={() => navigate('/vols/nouveau')} style={{
              background: 'none', border: 'none', color: T.blue, cursor: 'pointer',
              fontSize: 12, textDecoration: 'underline' }}>créer un vol d'abord</button>
          </div>
        ) : (
          <Field label="Vol de rattachement" value={volId} onChange={setVolId} required
            options={vols.map(v => ({
              value: v.id,
              label: `${v.numero_mission} · ${v.immatriculation} · ${new Date(v.date_heure).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`
            }))} />
        )}

        {volSelectionne && (
          <div style={{ padding: '14px 16px', background: T.greenBg,
            border: `1px solid ${T.greenBorder}`, borderRadius: 6, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                ['Aéronef', volSelectionne.immatriculation],
                ['Type', volSelectionne.type_mission],
                ['Capacité PAX', String(volSelectionne.capacite_places) + ' places'],
                ['Cargo', volSelectionne.capacite_cargo_kg + ' kg'],
                ['Départ', new Date(volSelectionne.date_heure).toLocaleString('fr-FR')],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 10, color: T.textDim, marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Field label="Étape du vol" value={etapeVol} onChange={setEtapeVol}
          options={[
            { value: 'A', label: 'A — Départ (manifeste maître)' },
            { value: 'B', label: 'B — 1ère escale intermédiaire' },
            { value: 'C', label: 'C — 2ème escale intermédiaire' },
            { value: 'D', label: 'D — Terminus' },
          ]} />

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={() => navigate('/manifestes')} style={{
            padding: '10px 24px', background: T.bgAlt, border: `1px solid ${T.border}`,
            borderRadius: 6, color: T.textSub, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleCreate} disabled={!volId || submitting} style={{
            padding: '10px 28px', background: (!volId || submitting) ? T.textMute : T.green,
            border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: (!volId || submitting) ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Création…' : 'Créer le manifeste →'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── SAISIE ────────────────────────────────────────────────────────────────────
function SaisieManifestePage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [manifeste, setManifeste] = useState<Manifeste | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'passagers' | 'materiels' | 'recap'>('passagers');
  const [submitting, setSubmitting] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  const [pax, setPax] = useState<Passager>({
    nom:'', prenom:'', grade:'', categorie:'TROUPES', matricule:'', unite:'',
    destination:'', nb_bagages:0, masse_bagages_kg:0, couleur_bagages:'',
    contact_urgence_nom:'', contact_urgence_tel:'', contact_urgence_qual:'', ref_autorisation:'',
  });
  const [mat, setMat] = useState<Materiel>({
    designation:'', type_mission_log:'AA', proprietaire:'', poids_kg:0,
    volume:0, destination:'', expediteur_nom:'', expediteur_fonction:'', expediteur_tel:'',
  });
  const [savingPax, setSavingPax] = useState(false);
  const [savingMat, setSavingMat] = useState(false);

  const refresh = async (): Promise<void> => {
    if (!id) return;
    const m = await manifesteApi.get(id);
    setManifeste(m);
  };

  useEffect(() => {
    if (!id) return;
    manifesteApi.get(id).then(m => { setManifeste(m); setLoading(false); })
      .catch(() => { toast.error('Manifeste introuvable'); setLoading(false); });
  }, [id]);

  const handleAddPax = async (): Promise<void> => {
    if (!id || !pax.nom || !pax.prenom || !pax.destination || !pax.contact_urgence_nom || !pax.contact_urgence_tel) {
      toast.error('Champs obligatoires manquants'); return;
    }
    setSavingPax(true);
    try {
      await manifesteApi.addPassager(id, pax);
      toast.success(`${pax.nom} ${pax.prenom} ajouté`);
      await refresh();
      setPax({ nom:'', prenom:'', grade:'', categorie:'TROUPES', matricule:'', unite:'',
        destination:'', nb_bagages:0, masse_bagages_kg:0, couleur_bagages:'',
        contact_urgence_nom:'', contact_urgence_tel:'', contact_urgence_qual:'', ref_autorisation:'' });
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    } finally { setSavingPax(false); }
  };

  const handleAddMat = async (): Promise<void> => {
    if (!id || !mat.designation || !mat.proprietaire || !mat.expediteur_nom) {
      toast.error('Champs obligatoires manquants'); return;
    }
    setSavingMat(true);
    try {
      await manifesteApi.addMateriel(id, mat);
      toast.success(`"${mat.designation}" ajouté`);
      await refresh();
      setMat({ designation:'', type_mission_log:'AA', proprietaire:'', poids_kg:0,
        volume:0, destination:'', expediteur_nom:'', expediteur_fonction:'', expediteur_tel:'' });
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
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
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: T.textDim }}>Chargement…</div>;
  if (!manifeste) return <div style={{ padding: 48, textAlign: 'center', color: T.red }}>Manifeste introuvable</div>;

  const readOnly = manifeste.statut !== 'BROUILLON';

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.display }}>
            Manifeste #{manifeste.id.slice(0,6).toUpperCase()}
          </h1>
          <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>
            {manifeste.vol?.numero_mission ?? manifeste.vol_id.slice(0,12)}
            {manifeste.flag_sensible && <span style={{ marginLeft: 8, color: T.amber }}>◆ SENSIBLE</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(manifeste.statut),
            background: `${statusColor(manifeste.statut)}18`, border: `1px solid ${statusColor(manifeste.statut)}40`,
            borderRadius: 6, padding: '5px 12px', textTransform: 'uppercase' }}>
            {manifeste.statut.replace('_', ' ')}
          </span>
          <button onClick={() => setShowPrint(true)} style={{
            padding: '8px 18px', background: T.bgAlt,
            border: `1px solid ${T.border}`, borderRadius: 6,
            color: T.textSub, fontSize: 13, cursor: 'pointer'
          }}>
            🖨 Imprimer
          </button>
          {!readOnly && (
            <button onClick={handleSoumettre} disabled={submitting} style={{
              padding: '8px 20px', background: T.green, border: 'none', borderRadius: 6,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Soumission…' : 'Soumettre ↗'}
            </button>
            
          )}
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16,
        borderBottom: `2px solid ${T.border}` }}>
        {(['passagers', 'materiels', 'recap'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'transparent',
            border: 'none', borderBottom: tab === t ? `2px solid ${T.green}` : '2px solid transparent',
            color: tab === t ? T.green : T.textSub, fontSize: 13,
            fontWeight: tab === t ? 600 : 400, cursor: 'pointer', marginBottom: -2,
            transition: 'all 0.15s',
          }}>
            {t === 'passagers' ? `Passagers (${manifeste.passagers?.length ?? 0})` :
             t === 'materiels' ? `Matériels (${manifeste.materiels?.length ?? 0})` : 'Récapitulatif'}
          </button>
        ))}
      </div>

      {/* Onglet passagers */}
      {tab === 'passagers' && (
        <div style={{ display: 'grid', gridTemplateColumns: readOnly ? '1fr' : '1fr 1fr', gap: 16 }}>
          {!readOnly && (
            <Card style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>
                Ajouter un passager
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Nom" value={pax.nom} onChange={v => setPax({...pax,nom:v})} required />
                <Field label="Prénom(s)" value={pax.prenom} onChange={v => setPax({...pax,prenom:v})} required />
                <Field label="Grade" value={pax.grade??''} onChange={v => setPax({...pax,grade:v})} />
                <Field label="Catégorie" value={pax.categorie} onChange={v => setPax({...pax,categorie:v})} required
                  options={CATEGORIES.map(c => ({ value:c, label:c.replace('_',' ') }))} />
                <Field label="Matricule" value={pax.matricule??''} onChange={v => setPax({...pax,matricule:v})} />
                <Field label="Unité" value={pax.unite??''} onChange={v => setPax({...pax,unite:v})} />
              </div>
              <Field label="Destination finale" value={pax.destination} onChange={v => setPax({...pax,destination:v})} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
                <Field label="Nb bagages" value={String(pax.nb_bagages)} type="number" onChange={v => setPax({...pax,nb_bagages:Number(v)})} required />
                <Field label="Masse (kg)" value={String(pax.masse_bagages_kg)} type="number" onChange={v => setPax({...pax,masse_bagages_kg:Number(v)})} required />
                <Field label="Couleur bagages" value={pax.couleur_bagages??''} onChange={v => setPax({...pax,couleur_bagages:v})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Contact urgence — nom" value={pax.contact_urgence_nom} onChange={v => setPax({...pax,contact_urgence_nom:v})} required />
                <Field label="Contact urgence — tél" value={pax.contact_urgence_tel} onChange={v => setPax({...pax,contact_urgence_tel:v})} required placeholder="+237XXXXXXXXX" />
              </div>
              <Field label="Réf. autorisation" value={pax.ref_autorisation??''} onChange={v => setPax({...pax,ref_autorisation:v})} />
              {pax.categorie === 'EVASAN' && (
                <div style={{ padding: '8px 12px', background: T.redBg, border: `1px solid ${T.redBorder}`,
                  borderRadius: 6, fontSize: 12, color: T.red, marginBottom: 12 }}>
                  ✚ EVASAN — circuit accéléré activé à la soumission
                </div>
              )}
              {pax.categorie === 'VIP' && (
                <div style={{ padding: '8px 12px', background: T.amberBg, border: `1px solid ${T.amberBorder}`,
                  borderRadius: 6, fontSize: 12, color: T.amber, marginBottom: 12 }}>
                  ◆ VIP — notification COMBASE + CEMAA automatique
                </div>
              )}
              <button onClick={handleAddPax} disabled={savingPax} style={{
                width: '100%', padding: '10px', background: T.green, border: 'none',
                borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: savingPax ? 'not-allowed' : 'pointer' }}>
                {savingPax ? 'Ajout…' : '+ Ajouter ce passager'}
              </button>
            </Card>
          )}
          <Card>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
              fontSize: 13, fontWeight: 600, color: T.text }}>
              Liste des passagers ({manifeste.passagers?.length ?? 0})
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {!manifeste.passagers?.length ? (
                <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>Aucun passager</div>
              ) : manifeste.passagers.map((p, i) => (
                <div key={p.id ?? i} style={{ padding: '12px 20px',
                  borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                      {p.grade && <span style={{ color: T.textDim, marginRight: 6 }}>{p.grade}</span>}
                      {p.nom} {p.prenom}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.verrouille && <span style={{ fontSize: 10, color: T.amber, background: T.amberBg,
                        border: `1px solid ${T.amberBorder}`, borderRadius: 4, padding: '1px 5px' }}>🔒 CEMAA</span>}
                      <span style={{ fontSize: 10, color: T.textDim, background: T.bgAlt,
                        borderRadius: 4, padding: '1px 5px' }}>{p.categorie}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.textDim, display: 'flex', gap: 16 }}>
                    <span>→ {p.destination}</span>
                    <span>{p.nb_bagages} bag. · {p.masse_bagages_kg} kg</span>
                    {p.matricule && <span>Mat: {p.matricule}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Onglet matériels */}
      {tab === 'materiels' && (
        <div style={{ display: 'grid', gridTemplateColumns: readOnly ? '1fr' : '1fr 1fr', gap: 16 }}>
          {!readOnly && (
            <Card style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>Ajouter un matériel</div>
              <Field label="Désignation" value={mat.designation} onChange={v => setMat({...mat,designation:v})} required />
              <Field label="Type logistique" value={mat.type_mission_log} onChange={v => setMat({...mat,type_mission_log:v})} required
                options={TYPES_LOG.map(t => ({ value:t, label:t.replace('_',' ') }))} />
              <Field label="Propriétaire / Unité" value={mat.proprietaire} onChange={v => setMat({...mat,proprietaire:v})} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Poids (kg)" value={String(mat.poids_kg)} type="number" onChange={v => setMat({...mat,poids_kg:Number(v)})} required />
                <Field label="Volume (m³)" value={String(mat.volume??0)} type="number" onChange={v => setMat({...mat,volume:Number(v)})} />
              </div>
              <Field label="Destination" value={mat.destination} onChange={v => setMat({...mat,destination:v})} required />
              <Field label="Expéditeur — nom" value={mat.expediteur_nom} onChange={v => setMat({...mat,expediteur_nom:v})} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Fonction" value={mat.expediteur_fonction} onChange={v => setMat({...mat,expediteur_fonction:v})} required />
                <Field label="Téléphone" value={mat.expediteur_tel} onChange={v => setMat({...mat,expediteur_tel:v})} required placeholder="+237XXXXXXXXX" />
              </div>
              <button onClick={handleAddMat} disabled={savingMat} style={{
                width: '100%', padding: '10px', background: T.green, border: 'none',
                borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: savingMat ? 'not-allowed' : 'pointer' }}>
                {savingMat ? 'Ajout…' : '+ Ajouter ce matériel'}
              </button>
            </Card>
          )}
          <Card>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
              fontSize: 13, fontWeight: 600, color: T.text }}>
              Liste des matériels ({manifeste.materiels?.length ?? 0})
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {!manifeste.materiels?.length ? (
                <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>Aucun matériel</div>
              ) : manifeste.materiels.map((m, i) => (
                <div key={m.id ?? i} style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m.designation}</span>
                    <span style={{ fontSize: 10, color: T.textDim, background: T.bgAlt,
                      borderRadius: 4, padding: '1px 5px' }}>{m.type_mission_log}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.textDim, display: 'flex', gap: 16 }}>
                    <span>{m.poids_kg} kg</span>
                    <span>→ {m.destination}</span>
                    <span>{m.proprietaire}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Récapitulatif */}
      {tab === 'recap' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>Synthèse</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { l:'Passagers', v: manifeste.passagers?.length ?? 0, c: T.blue },
                { l:'Matériels', v: manifeste.materiels?.length ?? 0, c: T.textSub },
                { l:'Masse bagages', v: `${(manifeste.passagers?.reduce((s,p)=>s+Number(p.masse_bagages_kg),0)??0).toFixed(1)} kg`, c: T.green },
                { l:'Version', v: `v${manifeste.version}`, c: T.textDim },
              ].map(s => (
                <div key={s.l} style={{ padding: '12px 16px', background: T.bgAlt,
                  borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase',
                    letterSpacing: '0.08em', marginBottom: 6 }}>{s.l}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>
              Circuit de validation
            </div>
            {['COMESO','COMGMO','COMBORD','COMBASE'].map((etape, i) => {
              const v = manifeste.validations?.find(x => x.etape === etape);
              const col = !v ? T.textMute : v.statut === 'APPROUVE' ? T.green : v.statut === 'REJETE' ? T.red : T.amberLight;
              return (
                <div key={etape} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: i < 3 ? `1px solid ${T.border}` : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${col}20`,
                    border: `2px solid ${col}`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 11, fontWeight: 700, color: col }}>
                    {!v ? i+1 : v.statut === 'APPROUVE' ? '✓' : v.statut === 'REJETE' ? '✗' : '…'}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{etape}</div>
                    <div style={{ fontSize: 11, color: col }}>
                      {!v ? 'En attente' : v.statut === 'APPROUVE' ? 'Validé' : v.statut === 'REJETE' ? 'Rejeté' : 'En cours'}
                    </div>
                  </div>
                </div>
              );
            })}
            {!readOnly && (
              <button onClick={handleSoumettre} disabled={submitting} style={{
                width: '100%', marginTop: 16, padding: '10px', background: T.green,
                border: 'none', borderRadius: 6, color: '#fff', fontSize: 13,
                fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Soumission…' : '↗ Soumettre au circuit de validation'}
              </button>
            )}
          </Card>
        </div>
      )}
    {/* Modal impression */}
      {showPrint && manifeste && (
        <ManifestePrint
          manifeste={manifeste}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}

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