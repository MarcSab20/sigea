// apps/frontend/src/components/EspaceAutoritePage.tsx
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI EST RÉTABLI, ET CE QUI CHANGE
// ═══════════════════════════════════════════════════════════════════════════
// Le sélecteur de vol avait disparu, et avec lui toute possibilité d'émettre :
// le bouton reste désactivé tant que `volId` est vide. Un espace d'autorité
// qui ne peut rien émettre n'est pas un écran dégradé, c'est un écran mort.
//
// Il est rétabli, alimenté par `volService` et non plus par une liste de bases
// codée en dur. Le choix de l'escale découle alors de l'ITINÉRAIRE du vol
// sélectionné : proposer les sept bases du pays pour un vol qui en dessert
// trois invitait à désigner une escale inexistante, que le serveur rejetait
// sans que l'écran puisse l'expliquer.
//
// Les consignes émises sont désormais relues depuis le serveur. L'ancienne
// version les tenait dans un état local, perdu à chaque rechargement — on ne
// savait donc jamais ce qui avait réellement été transmis.
//
// La teinte suit la propriété `accent` et n'est plus codée en rouge : les deux
// espaces, CEMAA et MAGE, doivent se distinguer au premier regard. Confondre
// l'un avec l'autre, sur des consignes nominatives chiffrées séparément,
// serait une faute.

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';
import { volService, type Vol } from '@/services/vol.service';

const CATEGORIES = ['TROUPES', 'TROUPES_PARA', 'CHEF_MIL', 'MISSION', 'OP_SENSIBLE', 'VIP'];

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

interface ConsigneEmise {
  id: string;
  type: string;
  autorite: string;
  statut_realisation: string;
  escale_base_id: string | null;
  places_bloquees: number;
  masse_bloquee_kg: string | number;
  date: string;
}

function messageErreur(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  return Array.isArray(m) ? m.join(' — ') : (m ?? err.message ?? 'Erreur inattendue');
}

function Card(
  { children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties },
): React.ReactElement {
  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style,
    }}>{children}</div>
  );
}

function Field({
  label, value, onChange, type = 'text', required, options, placeholder, teinte,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string; teinte: string;
}): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    width: '100%', padding: '8px 11px',
    background: focused ? T.bgCard : T.bgInput,
    border: `1px solid ${focused ? teinte : T.border}`,
    borderRadius: 5, color: T.text, fontSize: 12, outline: 'none',
    boxSizing: 'border-box', fontFamily: T.body,
    boxShadow: focused ? `0 0 0 3px ${teinte}15` : 'none',
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 600,
        color: T.textSub, marginBottom: 4,
      }}>
        {label}{required && <span style={{ color: teinte, marginLeft: 2 }}>*</span>}
      </label>
      {options ? (
        <select
          value={value} onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            ...base, appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%234a4540' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            paddingRight: 26,
          }}
        >
          <option value="">— Sélectionner —</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={base}
        />
      )}
    </div>
  );
}

export interface EspaceAutoriteProps {
  /** Discriminant transmis au serveur et affiché dans les libellés. */
  autorite:   'CEMAA' | 'MAGE';
  titre:      string;
  sousTitre:  string;
  /** Préfixe des routes API : '/cemaa' ou '/mage'. */
  prefixeApi: string;
  /** Teinte dominante — DOIT différer d'un espace à l'autre. */
  accent:     'red' | 'amber';
  /** Glyphe d'en-tête. */
  sigle:      string;
}

export default function EspaceAutoritePage({
  autorite, titre, sousTitre, prefixeApi, accent, sigle,
}: EspaceAutoriteProps): React.ReactElement {
  const qc = useQueryClient();

  // La teinte est dérivée de la propriété, jamais écrite en dur : l'ancienne
  // version affichait du rouge dans les deux espaces, et rien ne distinguait
  // l'espace MAGE de l'espace CEMAA à l'écran.
  const teinte  = accent === 'red' ? T.red : T.amber;
  const teinteBg     = accent === 'red' ? T.redBg : T.amberBg;
  const teinteBorder = accent === 'red' ? T.redBorder : T.amberBorder;

  const [volId, setVolId] = useState('');
  const [escaleBaseId, setEscaleBaseId] = useState('');
  const [typeConsigne, setTypeConsigne] = useState<'PERSONNEL' | 'MATERIEL'>('PERSONNEL');

  const [pax, setPax] = useState<ConsignePassager>({
    nom: '', prenom: '', grade: '', categorie: 'OP_SENSIBLE', matricule: '',
    unite: '', destination: '', nb_bagages: 0, masse_bagages_kg: 0,
    contact_urgence_nom: '', contact_urgence_tel: '', sensible: true,
  });

  const [mat, setMat] = useState<ConsigneMateriel>({
    designation: '', poids_kg: 0, destination: '', proprietaire: '', sensible: true,
  });

  const { data: vols } = useQuery({ queryKey: ['vols'], queryFn: volService.lister });

  // Consignes du vol sélectionné, relues depuis le serveur. L'état local de
  // l'ancienne version disparaissait à chaque rechargement : l'autorité ne
  // savait plus ce qu'elle avait transmis.
  const consignes = useQuery({
    queryKey: ['consignes', prefixeApi, volId],
    queryFn: () =>
      api.get<ConsigneEmise[]>(`${prefixeApi}/consignes/vol/${volId}`).then((r) => r.data),
    enabled: Boolean(volId),
  });

  const volChoisi = useMemo(
    () => (vols ?? []).find((v: Vol) => v.id === volId) ?? null,
    [vols, volId],
  );

  /**
   * Escales proposées : celles du vol, et elles seules.
   *
   * Le premier point est exclu — une consigne qui vise le départ vise le vol
   * entier, et c'est ce que signifie « aucune escale précisée ».
   */
  const escales = useMemo(
    () => (volChoisi?.itineraire ?? []).filter((p) => p.ordre > 1),
    [volChoisi],
  );

  const emission = useMutation({
    mutationFn: () => {
      const contenu = typeConsigne === 'PERSONNEL'
        ? { ...pax, type: 'passager' }
        : { ...mat, type: 'materiel' };

      return api.post(`${prefixeApi}/consignes`, {
        vol_id: volId,
        escale_base_id: escaleBaseId || null,
        type: typeConsigne,
        contenu: JSON.stringify(contenu),
        places_bloquees:  typeConsigne === 'PERSONNEL' ? 1 : 0,
        masse_bloquee_kg: typeConsigne === 'MATERIEL' ? mat.poids_kg : 0,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['consignes', prefixeApi, volId] });
      toast.success(`Consigne ${autorite} transmise.`);
      if (typeConsigne === 'PERSONNEL') {
        setPax({
          nom: '', prenom: '', grade: '', categorie: 'OP_SENSIBLE', matricule: '',
          unite: '', destination: '', nb_bagages: 0, masse_bagages_kg: 0,
          contact_urgence_nom: '', contact_urgence_tel: '', sensible: true,
        });
      } else {
        setMat({ designation: '', poids_kg: 0, destination: '', proprietaire: '', sensible: true });
      }
    },
    onError: (e) => {
      const status = (e as AxiosError)?.response?.status;
      // Le 409 a un sens métier précis : la capacité du vol est atteinte. Le
      // message générique du serveur ne le dirait pas aussi clairement.
      toast.error(status === 409
        ? 'Impossible — capacité insuffisante sur ce vol.'
        : messageErreur(e));
    },
  });

  const complet = typeConsigne === 'PERSONNEL'
    ? Boolean(volId && pax.nom && pax.prenom && pax.destination
        && pax.contact_urgence_nom && pax.contact_urgence_tel)
    : Boolean(volId && mat.designation && mat.poids_kg > 0
        && mat.destination && mat.proprietaire);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, background: teinte, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20, fontWeight: 700,
          }}>{sigle}</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.display }}>
              {titre}
            </h1>
            <p style={{ fontSize: 12, color: T.textDim }}>{sousTitre}</p>
          </div>
        </div>
        <div style={{
          padding: '10px 16px', background: teinteBg,
          border: `1px solid ${teinteBorder}`, borderRadius: 6,
          fontSize: 12, color: teinte,
        }}>
          Zone réservée {autorite} · Les éléments imposés sont portés sur la liste
          hiérarchisée avec verrouillage — ils échappent à toute discrimination,
          du secrétaire au commandant de bord.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Rattachement : le sélecteur qui manquait ── */}
          <Card style={{ padding: '18px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14 }}>
              Rattachement
            </div>
            <Field
              label="Vol concerné" teinte={teinte} required
              value={volId}
              onChange={(v) => { setVolId(v); setEscaleBaseId(''); }}
              options={(vols ?? []).map((v: Vol) => ({
                value: v.id,
                label: `${v.numero_mission} · ${v.itineraire.map((p) => p.base.code_base).join('→')}`
                  + ` · ${new Date(v.date_heure).toLocaleDateString('fr-FR')}`,
              }))}
            />
            <Field
              label="Escale visée (vide = vol entier)" teinte={teinte}
              value={escaleBaseId}
              onChange={setEscaleBaseId}
              options={escales.map((p) => ({
                value: p.base_id,
                label: `${p.base.code_base} — point ${p.ordre}`,
              }))}
            />
            {!volId && (
              <div style={{ fontSize: 11, color: T.textDim }}>
                Sélectionnez un vol pour activer l'émission.
              </div>
            )}
          </Card>

          <div style={{ display: 'flex', gap: 8 }}>
            {(['PERSONNEL', 'MATERIEL'] as const).map((t) => (
              <button
                key={t} type="button" onClick={() => setTypeConsigne(t)}
                style={{
                  flex: 1, padding: '10px',
                  background: typeConsigne === t ? teinte : T.bgCard,
                  border: `1px solid ${typeConsigne === t ? teinte : T.border}`,
                  borderRadius: 6, color: typeConsigne === t ? '#fff' : T.textSub,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {t === 'PERSONNEL' ? 'Personnel' : 'Matériel'}
              </button>
            ))}
          </div>

          {typeConsigne === 'PERSONNEL' && (
            <Card style={{ padding: '18px 22px', border: `2px solid ${teinteBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14 }}>
                Imposition de personnel — consigne {autorite}
              </div>
              <div style={{
                padding: '8px 12px', background: T.amberBg,
                border: `1px solid ${T.amberBorder}`, borderRadius: 5,
                fontSize: 11, color: T.amber, marginBottom: 14,
              }}>
                Le personnel imposé est verrouillé sur la liste : ni l'Adjoint Air,
                ni le COMRMIA, ni le commandant de base ne peuvent l'en retirer.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 14px' }}>
                <Field label="Nom" teinte={teinte} required value={pax.nom}
                       onChange={(v) => setPax({ ...pax, nom: v })} />
                <Field label="Prénom(s)" teinte={teinte} required value={pax.prenom}
                       onChange={(v) => setPax({ ...pax, prenom: v })} />
                <Field label="Grade" teinte={teinte} value={pax.grade}
                       onChange={(v) => setPax({ ...pax, grade: v })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Catégorie" teinte={teinte} required value={pax.categorie}
                       onChange={(v) => setPax({ ...pax, categorie: v })}
                       options={CATEGORIES.map((c) => ({ value: c, label: c.replace('_', ' ') }))} />
                <Field label="Matricule" teinte={teinte} value={pax.matricule}
                       onChange={(v) => setPax({ ...pax, matricule: v })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Unité" teinte={teinte} value={pax.unite}
                       onChange={(v) => setPax({ ...pax, unite: v })} />
                <Field label="Destination" teinte={teinte} required value={pax.destination}
                       onChange={(v) => setPax({ ...pax, destination: v })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 14px' }}>
                <Field label="Nb bagages" teinte={teinte} type="number"
                       value={String(pax.nb_bagages)}
                       onChange={(v) => setPax({ ...pax, nb_bagages: Number(v) })} />
                <Field label="Masse bagages (kg)" teinte={teinte} type="number"
                       value={String(pax.masse_bagages_kg)}
                       onChange={(v) => setPax({ ...pax, masse_bagages_kg: Number(v) })} />
                <div />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Contact urgence" teinte={teinte} required
                       value={pax.contact_urgence_nom}
                       onChange={(v) => setPax({ ...pax, contact_urgence_nom: v })} />
                <Field label="Tél urgence" teinte={teinte} required
                       value={pax.contact_urgence_tel} placeholder="+237XXXXXXXXX"
                       onChange={(v) => setPax({ ...pax, contact_urgence_tel: v })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input type="checkbox" id="pax-sensible" checked={pax.sensible}
                       onChange={(e) => setPax({ ...pax, sensible: e.target.checked })}
                       style={{ cursor: 'pointer' }} />
                <label htmlFor="pax-sensible" style={{
                  fontSize: 11, color: teinte, cursor: 'pointer', fontWeight: 600,
                }}>
                  Élément sensible — chiffrement différencié, masqué aux autres acteurs
                </label>
              </div>
            </Card>
          )}

          {typeConsigne === 'MATERIEL' && (
            <Card style={{ padding: '18px 22px', border: `2px solid ${teinteBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14 }}>
                Imposition de matériel — consigne {autorite}
              </div>
              <Field label="Désignation" teinte={teinte} required value={mat.designation}
                     onChange={(v) => setMat({ ...mat, designation: v })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Poids (kg)" teinte={teinte} type="number" required
                       value={String(mat.poids_kg)}
                       onChange={(v) => setMat({ ...mat, poids_kg: Number(v) })} />
                <Field label="Destination" teinte={teinte} required value={mat.destination}
                       onChange={(v) => setMat({ ...mat, destination: v })} />
              </div>
              <Field label="Propriétaire / Unité" teinte={teinte} required
                     value={mat.proprietaire}
                     onChange={(v) => setMat({ ...mat, proprietaire: v })} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="mat-sensible" checked={mat.sensible}
                       onChange={(e) => setMat({ ...mat, sensible: e.target.checked })}
                       style={{ cursor: 'pointer' }} />
                <label htmlFor="mat-sensible" style={{
                  fontSize: 11, color: teinte, cursor: 'pointer', fontWeight: 600,
                }}>
                  Matériel classifié — contenu chiffré, non lisible par les autres acteurs
                </label>
              </div>
            </Card>
          )}

          <button
            type="button"
            onClick={() => emission.mutate()}
            disabled={!complet || emission.isPending}
            style={{
              padding: '12px',
              background: (!complet || emission.isPending) ? T.textMute : teinte,
              border: 'none', borderRadius: 6, color: '#fff', fontSize: 13,
              fontWeight: 700,
              cursor: (!complet || emission.isPending) ? 'not-allowed' : 'pointer',
              opacity: (!complet || emission.isPending) ? 0.6 : 1,
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}
          >
            {emission.isPending ? 'Transmission…' : `Émettre la consigne ${autorite}`}
          </button>
        </div>

        {/* ── Panneau droit ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card style={{ padding: '16px 18px', background: teinteBg, border: `1px solid ${teinteBorder}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: teinte, marginBottom: 10 }}>
              Règles {autorite}
            </div>
            <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.8 }}>
              Portée sur la liste hiérarchisée, verrouillée<br />
              Échappe à toute discrimination aval<br />
              Places et masse déduites du quota<br />
              Bloque le visa du commandant de bord jusqu'à constat<br />
              Contenu sensible chiffré, cloisonné par autorité
            </div>
          </Card>

          <Card style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10 }}>
              Consignes sur ce vol ({consignes.data?.length ?? 0})
            </div>

            {!volId && (
              <div style={{ fontSize: 11, color: T.textMute, textAlign: 'center', padding: '16px 0' }}>
                Sélectionnez un vol
              </div>
            )}

            {volId && consignes.isLoading && (
              <div style={{ fontSize: 11, color: T.textDim }}>Chargement…</div>
            )}

            {volId && consignes.isSuccess && !consignes.data.length && (
              <div style={{ fontSize: 11, color: T.textMute, textAlign: 'center', padding: '16px 0' }}>
                Aucune consigne sur ce vol
              </div>
            )}

            {consignes.data?.map((c) => (
              <div key={c.id} style={{
                padding: '8px 10px', background: T.bgAlt, borderRadius: 5,
                marginBottom: 6, borderLeft: `3px solid ${teinte}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>
                  {c.type} · {c.autorite}
                </div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
                  {c.escale_base_id ? `Escale ${c.escale_base_id}` : 'Vol entier'}
                  {' · '}{c.places_bloquees} place(s), {Number(c.masse_bloquee_kg)} kg
                </div>
                <div style={{ fontSize: 10, color: T.textDim }}>
                  {c.statut_realisation}
                  {' · '}{new Date(c.date).toLocaleDateString('fr-FR')}
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}