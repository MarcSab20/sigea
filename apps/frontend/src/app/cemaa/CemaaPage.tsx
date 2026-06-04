// apps/frontend/src/app/cemaa/CemaaPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { volApi, Vol } from '@/services/manifeste.service';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';
import { toast } from 'sonner';

const BASES_FAC = [
  { id: 'BA101', code: 'BA 101', nom: 'Yaoundé' },
  { id: 'BA102', code: 'BA 102', nom: 'Douala' },
  { id: 'BA201', code: 'BA 201', nom: 'Garoua' },
  { id: 'BA301', code: 'BA 301', nom: 'Maroua' },
  { id: 'BA302', code: 'BA 302', nom: 'Ngaoundéré' },
  { id: 'BA401', code: 'BA 401', nom: 'Bafoussam' },
  { id: 'BA501', code: 'BA 501', nom: 'Bertoua' },
];

const CATEGORIES = ['TROUPES','TROUPES_PARA','CHEF_MIL','MISSION','OP_SENSIBLE','VIP'];
const TYPES_CONSIGNE = ['PERSONNEL','MATERIEL'];

interface ConsignePassager {
  nom: string; prenom: string; grade: string; categorie: string;
  matricule: string; unite: string; destination: string;
  nb_bagages: number; masse_bagages_kg: number;
  contact_urgence_nom: string; contact_urgence_tel: string;
  sensible: boolean;
}

interface ConsigneMateriel {
  designation: string; poids_kg: number; destination: string;
  proprietaire: string; sensible: boolean;
}

function Card({ children, style={} }: { children: React.ReactNode; style?: React.CSSProperties }): React.ReactElement {
  return <div style={{ background: T.bgCard, border: `1px solid ${T.border}`,
    borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>{children}</div>;
}

function Field({ label, value, onChange, type='text', required, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    width: '100%', padding: '8px 11px',
    background: focused ? T.bgCard : T.bgInput,
    border: `1px solid ${focused ? T.red : T.border}`,
    borderRadius: 5, color: T.text, fontSize: 12, outline: 'none',
    boxSizing: 'border-box', fontFamily: T.body,
    boxShadow: focused ? `0 0 0 3px ${T.red}15` : 'none',
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 600,
        color: T.textSub, marginBottom: 4 }}>
        {label}{required && <span style={{ color: T.red, marginLeft: 2 }}>*</span>}
      </label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...base, appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%234a4540' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 26 }}>
          <option value="">— Sélectionner —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={base} />
      )}
    </div>
  );
}

export default function CemaaPage(): React.ReactElement {
  const [vols, setVols] = useState<Vol[]>([]);
  const [volId, setVolId] = useState('');
  const [escaleBaseId, setEscaleBaseId] = useState('');
  const [typeConsigne, setTypeConsigne] = useState<'PERSONNEL' | 'MATERIEL'>('PERSONNEL');
  const [submitting, setSubmitting] = useState(false);
  const [consignesEnvoyees, setConsignesEnvoyees] = useState<{ id: string; type: string; vol: string; date: string }[]>([]);

  const [pax, setPax] = useState<ConsignePassager>({
    nom:'', prenom:'', grade:'', categorie:'OP_SENSIBLE', matricule:'',
    unite:'', destination:'', nb_bagages:0, masse_bagages_kg:0,
    contact_urgence_nom:'', contact_urgence_tel:'', sensible:true,
  });

  const [mat, setMat] = useState<ConsigneMateriel>({
    designation:'', poids_kg:0, destination:'', proprietaire:'', sensible:true,
  });

  useEffect(() => {
    volApi.list().then(setVols).catch(() => {});
  }, []);

  const volSelectionne = vols.find(v => v.id === volId);

  const handleEnvoyerConsigne = async (): Promise<void> => {
    if (!volId) { toast.error('Sélectionnez un vol'); return; }

    // Vérification disponibilité des places (si personnel)
    if (typeConsigne === 'PERSONNEL') {
      const volData = volSelectionne;
      if (!volData) return;
      // La vérification réelle sera faite côté backend
    }

    setSubmitting(true);
    try {
      const contenu = typeConsigne === 'PERSONNEL'
        ? { ...pax, type: 'passager' }
        : { ...mat, type: 'materiel' };

      await api.post('/cemaa/consignes', {
        vol_id: volId,
        escale_base_id: escaleBaseId || null,
        type: typeConsigne,
        contenu: JSON.stringify(contenu),
        places_bloquees: typeConsigne === 'PERSONNEL' ? 1 : 0,
        masse_bloquee_kg: typeConsigne === 'MATERIEL' ? mat.poids_kg : 0,
      });

      toast.success('Consigne CEMAA transmise — préremplissage forcé activé dans le manifeste');
      setConsignesEnvoyees(prev => [{
        id: Date.now().toString(),
        type: typeConsigne,
        vol: volSelectionne?.numero_mission ?? volId,
        date: new Date().toLocaleTimeString('fr-FR'),
      }, ...prev]);

      // Reset formulaire
      if (typeConsigne === 'PERSONNEL') {
        setPax({ nom:'', prenom:'', grade:'', categorie:'OP_SENSIBLE', matricule:'',
          unite:'', destination:'', nb_bagages:0, masse_bagages_kg:0,
          contact_urgence_nom:'', contact_urgence_tel:'', sensible:true });
      } else {
        setMat({ designation:'', poids_kg:0, destination:'', proprietaire:'', sensible:true });
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 409) {
        toast.error('Impossible — Capacité insuffisante pour ce vol');
      } else {
        toast.error(msg ?? 'Erreur transmission consigne');
      }
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      {/* En-tête CEMAA */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, background: T.red, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20, fontWeight: 700 }}>⬡</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.display }}>
              Espace CEMAA
            </h1>
            <p style={{ fontSize: 12, color: T.textDim }}>
              Commandement des Forces Aériennes — Consignes stratégiques
            </p>
          </div>
        </div>
        <div style={{ padding: '10px 16px', background: T.redBg,
          border: `1px solid ${T.redBorder}`, borderRadius: 6,
          fontSize: 12, color: T.red }}>
          ⬡ Zone réservée CEMAA · Les éléments injectés sont automatiquement intégrés
          dans les manifestes concernés avec verrouillage — non modifiables par les bases
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* Formulaire consigne */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Sélection vol */}
          <Card style={{ padding: '18px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14 }}>
              Rattachement
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="Vol concerné" value={volId} onChange={setVolId} required
                options={vols.map(v => ({
                  value: v.id,
                  label: `${v.numero_mission} — ${new Date(v.date_heure).toLocaleDateString('fr-FR')}`
                }))} />
              <Field label="Escale spécifique (optionnel)" value={escaleBaseId}
                onChange={setEscaleBaseId}
                options={BASES_FAC.map(b => ({ value: b.id, label: `${b.code} — ${b.nom}` }))} />
            </div>
            {volSelectionne && (
              <div style={{ padding: '10px 14px', background: T.bgAlt,
                borderRadius: 6, fontSize: 11, color: T.textSub }}>
                <strong>{volSelectionne.numero_mission}</strong> ·
                {volSelectionne.immatriculation} ·
                {new Date(volSelectionne.date_heure).toLocaleString('fr-FR')} ·
                <span style={{ color: volSelectionne.type_mission === 'OP_SENSIBLE' ? T.red : T.textDim }}>
                  {volSelectionne.type_mission}
                </span>
              </div>
            )}
          </Card>

          {/* Type de consigne */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['PERSONNEL', 'MATERIEL'] as const).map(t => (
              <button key={t} onClick={() => setTypeConsigne(t)} style={{
                flex: 1, padding: '10px', background: typeConsigne === t ? T.red : T.bgCard,
                border: `1px solid ${typeConsigne === t ? T.red : T.border}`,
                borderRadius: 6, color: typeConsigne === t ? '#fff' : T.textSub,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                {t === 'PERSONNEL' ? '👤 Personnel' : '📦 Matériel'}
              </button>
            ))}
          </div>

          {/* Formulaire personnel */}
          {typeConsigne === 'PERSONNEL' && (
            <Card style={{ padding: '18px 22px',
              border: `2px solid ${T.redBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>👤</span>
                Injection de personnel — Consigne CEMAA
              </div>
              <div style={{ padding: '8px 12px', background: T.amberBg,
                border: `1px solid ${T.amberBorder}`, borderRadius: 5,
                fontSize: 11, color: T.amber, marginBottom: 14 }}>
                ⚠ Le personnel injecté via consigne CEMAA est automatiquement verrouillé dans
                le manifeste — non supprimable par le Chef d'Escale
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 14px' }}>
                <Field label="Nom" value={pax.nom} onChange={v => setPax({...pax,nom:v})} required />
                <Field label="Prénom(s)" value={pax.prenom} onChange={v => setPax({...pax,prenom:v})} required />
                <Field label="Grade" value={pax.grade} onChange={v => setPax({...pax,grade:v})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Catégorie" value={pax.categorie} onChange={v => setPax({...pax,categorie:v})}
                  required options={CATEGORIES.map(c => ({ value:c, label:c.replace('_',' ') }))} />
                <Field label="Matricule" value={pax.matricule} onChange={v => setPax({...pax,matricule:v})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Unité" value={pax.unite} onChange={v => setPax({...pax,unite:v})} />
                <Field label="Destination" value={pax.destination} onChange={v => setPax({...pax,destination:v})} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 14px' }}>
                <Field label="Nb bagages" value={String(pax.nb_bagages)} type="number"
                  onChange={v => setPax({...pax,nb_bagages:Number(v)})} />
                <Field label="Masse bagages (kg)" value={String(pax.masse_bagages_kg)} type="number"
                  onChange={v => setPax({...pax,masse_bagages_kg:Number(v)})} />
                <div />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Contact urgence" value={pax.contact_urgence_nom}
                  onChange={v => setPax({...pax,contact_urgence_nom:v})} required />
                <Field label="Tél urgence" value={pax.contact_urgence_tel}
                  onChange={v => setPax({...pax,contact_urgence_tel:v})} required
                  placeholder="+237XXXXXXXXX" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input type="checkbox" checked={pax.sensible}
                  onChange={e => setPax({...pax,sensible:e.target.checked})}
                  id="pax-sensible" style={{ cursor: 'pointer' }} />
                <label htmlFor="pax-sensible" style={{ fontSize: 11, color: T.red,
                  cursor: 'pointer', fontWeight: 600 }}>
                  Élément sensible — chiffrement différencié, masqué aux autres acteurs
                </label>
              </div>
            </Card>
          )}

          {/* Formulaire matériel */}
          {typeConsigne === 'MATERIEL' && (
            <Card style={{ padding: '18px 22px', border: `2px solid ${T.redBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📦</span>
                Injection de matériel — Consigne CEMAA
              </div>
              <Field label="Désignation" value={mat.designation}
                onChange={v => setMat({...mat,designation:v})} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Poids (kg)" value={String(mat.poids_kg)} type="number"
                  onChange={v => setMat({...mat,poids_kg:Number(v)})} required />
                <Field label="Destination" value={mat.destination}
                  onChange={v => setMat({...mat,destination:v})} required />
              </div>
              <Field label="Propriétaire / Unité" value={mat.proprietaire}
                onChange={v => setMat({...mat,proprietaire:v})} required />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={mat.sensible}
                  onChange={e => setMat({...mat,sensible:e.target.checked})}
                  id="mat-sensible" style={{ cursor: 'pointer' }} />
                <label htmlFor="mat-sensible" style={{ fontSize: 11, color: T.red,
                  cursor: 'pointer', fontWeight: 600 }}>
                  Matériel classifié — non visible en clair par COMESO/COMGMO
                </label>
              </div>
            </Card>
          )}

          {/* Bouton envoi */}
          <button onClick={handleEnvoyerConsigne} disabled={!volId || submitting} style={{
            padding: '12px', background: (!volId || submitting) ? T.textMute : T.red,
            border: 'none', borderRadius: 6, color: '#fff', fontSize: 13,
            fontWeight: 700, cursor: (!volId || submitting) ? 'not-allowed' : 'pointer',
            opacity: (!volId || submitting) ? 0.6 : 1,
            letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {submitting ? 'Transmission…' : '⬡ Émettre la consigne CEMAA'}
          </button>
        </div>

        {/* Panneau droit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Règles */}
          <Card style={{ padding: '16px 18px', background: T.redBg,
            border: `1px solid ${T.redBorder}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 10 }}>
              Règles CEMAA
            </div>
            <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.8 }}>
              ✓ Préremplissage forcé dans le manifeste<br />
              ✓ Lignes verrouillées — non supprimables<br />
              ✓ Places/masse déduites automatiquement<br />
              ✗ Rejeté si capacité insuffisante<br />
              ⬡ Éléments sensibles : chiffrement AES-256<br />
              ⬡ Masqués aux acteurs non-CEMAA
            </div>
          </Card>

          {/* Consignes émises */}
          <Card style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10 }}>
              Consignes émises ({consignesEnvoyees.length})
            </div>
            {consignesEnvoyees.length === 0 ? (
              <div style={{ fontSize: 11, color: T.textMute, textAlign: 'center', padding: '16px 0' }}>
                Aucune consigne émise
              </div>
            ) : consignesEnvoyees.map(c => (
              <div key={c.id} style={{ padding: '8px 10px', background: T.bgAlt,
                borderRadius: 5, marginBottom: 6, borderLeft: `3px solid ${T.red}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>
                  {c.type === 'PERSONNEL' ? '👤' : '📦'} {c.type}
                </div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
                  Vol : {c.vol} · {c.date}
                </div>
              </div>
            ))}
          </Card>

          {/* Vols disponibles */}
          <Card style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10 }}>
              Vols disponibles ({vols.length})
            </div>
            {vols.slice(0, 5).map(v => (
              <div key={v.id} onClick={() => setVolId(v.id)}
                style={{ padding: '7px 10px', background: volId === v.id ? T.greenBg : T.bgAlt,
                  border: `1px solid ${volId === v.id ? T.greenBorder : T.border}`,
                  borderRadius: 5, marginBottom: 5, cursor: 'pointer',
                  transition: 'all 0.15s' }}>
                <div style={{ fontSize: 11, fontWeight: 600,
                  color: volId === v.id ? T.green : T.text }}>
                  {v.numero_mission}
                </div>
                <div style={{ fontSize: 10, color: T.textDim }}>
                  {new Date(v.date_heure).toLocaleDateString('fr-FR')} · {v.type_mission}
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}