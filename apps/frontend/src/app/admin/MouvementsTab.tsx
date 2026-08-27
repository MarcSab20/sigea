// apps/frontend/src/app/admin/MouvementsTab.tsx
//
// ONGLET MOUVEMENTS — mutations, départs, suspensions, réintégrations
//
// Là où l'intérim est temporaire et réversible, le mouvement est définitif :
// il modifie réellement le compte de l'agent (base, rôle, escadron, activité)
// dans la même transaction que la trace qu'il en laisse.
//
// ── Ce que l'écran doit rendre visible ───────────────────────────────────
//
//   • L'AVANT ET L'APRÈS. Un mouvement n'a de sens que comparé : la
//     chronologie affiche systématiquement `base_avant → base_apres` et
//     `role_avant → role_apres`. C'est ce qui permet de relire un parcours.
//
//   • LE CARACTÈRE IRRÉVERSIBLE. Un mouvement ne se corrige pas : il
//     s'annule par un mouvement inverse. Un avertissement le dit avant
//     validation plutôt qu'après.
//
//   • LE SUCCESSEUR. Renseigné, il n'est pas décoratif : le service met à
//     jour le compte du successeur dans la même transaction. L'écran
//     l'annonce, parce que c'est une conséquence qu'on ne devine pas.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';
import { toast } from 'sonner';
import {
  Card, Modal, Field, Badge, StatMini, BarreOutils, Recherche, Selecteur,
  BoutonActualiser, BoutonPrincipal, Squelette, Vide,
  BASES_FAC, ROLES, TYPES_MOUVEMENT, libelleRole, couleurRole, codeBase,
  nomComplet, dateFr, messageErreur,
  type Mouvement, type Utilisateur, type Escadron,
} from './admin.shared';
import './admin.css';

const typeInfo = (t: string) =>
  TYPES_MOUVEMENT.find(x => x.value === t)
  ?? { value: t, label: t, color: T.textDim, icone: '•', aide: '' };

export default function MouvementsTab(): React.ReactElement {
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [agents, setAgents] = useState<Utilisateur[]>([]);
  const [escadrons, setEscadrons] = useState<Escadron[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);

  const [recherche, setRecherche] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [creation, setCreation] = useState(false);

  const charger = useCallback(async (silencieux = false): Promise<void> => {
    if (silencieux) setRafraichit(true);
    try {
      const [m, p] = await Promise.all([
        api.get<Mouvement[]>('/admin/mouvements'),
        api.get<Utilisateur[]>('/referentiel/personnels'),
      ]);
      setMouvements(m.data); setAgents(p.data);

      // Les escadrons ne sont nécessaires que pour un passage au rôle COMEA.
      // Leur absence ne doit pas empêcher l'écran de fonctionner : l'échec est
      // avalé et le champ correspondant se désactive de lui-même.
      try {
        const e = await api.get<Escadron[]>('/referentiel/escadrons');
        setEscadrons(e.data);
      } catch { setEscadrons([]); }
    } catch (e) {
      toast.error(messageErreur(e, 'Erreur de chargement des mouvements'));
    } finally {
      setChargement(false); setRafraichit(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const filtres = useMemo(() => mouvements.filter(m => {
    const texte = `${m.utilisateur?.nom} ${m.utilisateur?.prenom} ${m.motif ?? ''} ${m.reference ?? ''}`.toLowerCase();
    return (!recherche || texte.includes(recherche.toLowerCase()))
      && (!filtreType || m.type === filtreType);
  }), [mouvements, recherche, filtreType]);

  const compte = (t: string): number => mouvements.filter(m => m.type === t).length;

  return (
    <div className="ad-scope ad-panel">
      {/* ── Vignettes : cliquables, elles filtrent la chronologie ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {TYPES_MOUVEMENT.map(t => (
          <StatMini key={t.value} label={t.label + 's'} value={compte(t.value)} color={t.color}
                    actif={filtreType === t.value}
                    onClick={() => setFiltreType(filtreType === t.value ? '' : t.value)} />
        ))}
      </div>

      <Card>
        <BarreOutils>
          <Recherche value={recherche} onChange={setRecherche}
                     placeholder="Rechercher un agent, un motif, une référence de décision…" />
          <Selecteur value={filtreType} onChange={setFiltreType} vide="Tous les types"
                     options={TYPES_MOUVEMENT.map(t => ({ value: t.value, label: t.label }))} />
          <BoutonActualiser onClick={() => charger(true)} busy={rafraichit} />
          <BoutonPrincipal onClick={() => setCreation(true)}>+ Enregistrer un mouvement</BoutonPrincipal>
        </BarreOutils>

        {chargement ? (
          <Squelette lignes={5} hauteur={70} />
        ) : filtres.length === 0 ? (
          <Vide
            icone="⇄"
            titre="Aucun mouvement enregistré"
            aide="Mutation, départ, suspension ou réintégration : chaque mouvement met à jour le compte de l'agent et en conserve la trace, avec la référence de la décision qui l'ordonne."
          />
        ) : (
          <div className="ad-fil" style={{ padding: '18px 20px 22px' }}>
            {filtres.map((m, n) => <Jalon key={m.id} m={m} index={n} />)}
          </div>
        )}
      </Card>

      {creation && (
        <ModaleMouvement
          agents={agents} escadrons={escadrons}
          onFermer={() => setCreation(false)}
          onFait={() => { setCreation(false); charger(true); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   JALON DE CHRONOLOGIE
   ═══════════════════════════════════════════════════════════════════════════ */

function Jalon({ m, index }: { m: Mouvement; index: number }): React.ReactElement {
  const ti = typeInfo(m.type);
  const baseChange = m.base_avant !== m.base_apres && (m.base_avant || m.base_apres);
  const roleChange = m.role_avant !== m.role_apres && (m.role_avant || m.role_apres);

  return (
    <div className="ad-row ad-jalon" style={{
      '--ad-i': index, display: 'grid', gridTemplateColumns: '32px 1fr',
      gap: 14, paddingBottom: 18,
    } as React.CSSProperties}>
      {/* Pastille sur le fil */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="ad-jalon-pt" style={{
          width: 32, height: 32, borderRadius: '50%', background: T.bgCard,
          border: `2px solid ${ti.color}`, color: ti.color,
          display: 'grid', placeItems: 'center',
          fontSize: 14, fontWeight: 700, fontFamily: T.display,
        }}>{ti.icone}</div>
      </div>

      <div style={{
        border: `1px solid ${T.border}`, borderRadius: 8, background: T.bgCard,
        padding: '13px 16px',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge label={ti.label} color={ti.color} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            {nomComplet(m.utilisateur)}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textDim, fontFamily: T.mono }}>
            {dateFr(m.date_effet, true)}
          </span>
        </div>

        {/* Avant → après : c'est la comparaison qui porte l'information. */}
        {(baseChange || roleChange || m.successeur) && (
          <div style={{
            display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 11, paddingTop: 10,
            borderTop: `1px dashed ${T.border}`,
          }}>
            {baseChange && (
              <Transition k="Base" avant={codeBase(m.base_avant)} apres={codeBase(m.base_apres)} />
            )}
            {roleChange && (
              <Transition k="Rôle"
                          avant={libelleRole(m.role_avant)} apres={libelleRole(m.role_apres)}
                          couleurApres={couleurRole(m.role_apres)} />
            )}
            {m.successeur && (
              <div>
                <div style={{ fontSize: 9.5, color: T.textDim, textTransform: 'uppercase',
                              letterSpacing: '0.07em', marginBottom: 4 }}>Successeur</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.green }}>
                  {nomComplet(m.successeur)}
                </div>
              </div>
            )}
          </div>
        )}

        {(m.motif || m.reference) && (
          <div style={{
            marginTop: 10, fontSize: 11.5, color: T.textDim, lineHeight: 1.6,
            display: 'flex', gap: 18, flexWrap: 'wrap',
          }}>
            {m.reference && (
              <span style={{ fontFamily: T.mono, color: T.textSub }}>Réf. {m.reference}</span>
            )}
            {m.motif && <span>{m.motif}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function Transition({ k, avant, apres, couleurApres }: {
  k: string; avant: string; apres: string; couleurApres?: string;
}): React.ReactElement {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: T.textDim, textTransform: 'uppercase',
                    letterSpacing: '0.07em', marginBottom: 4 }}>{k}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ color: T.textDim, textDecoration: 'line-through' }}>{avant}</span>
        <span className="ad-fleche" style={{ color: T.textMute }}>→</span>
        <span style={{ fontWeight: 600, color: couleurApres ?? T.text }}>{apres}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENREGISTREMENT D'UN MOUVEMENT
   ═══════════════════════════════════════════════════════════════════════════ */

function ModaleMouvement({ agents, escadrons, onFermer, onFait }: {
  agents: Utilisateur[]; escadrons: Escadron[];
  onFermer: () => void; onFait: () => void;
}): React.ReactElement {
  const [f, setF] = useState({
    utilisateur_id: '', type: '', base_apres: '', role_apres: '',
    escadron_apres: '', successeur_id: '', date_effet: '', motif: '', reference: '',
  });
  const [envoi, setEnvoi] = useState(false);

  const set = (k: keyof typeof f) => (v: string): void => setF(x => ({ ...x, [k]: v }));

  const agent = agents.find(a => a.id === f.utilisateur_id);
  const ti = f.type ? typeInfo(f.type) : null;

  // Règles du DTO serveur, reproduites ici pour guider la saisie plutôt que
  // pour la remplacer : le serveur reste seul juge.
  const baseRequise = f.type === 'MUTATION';
  const escadronRequis = f.role_apres === 'comea';

  const options = agents.map(a => ({
    value: a.id,
    label: `${a.grade ? a.grade + ' ' : ''}${a.nom} ${a.prenom} — ${libelleRole(a.role)} (${codeBase(a.base_id)})${a.actif ? '' : ' · inactif'}`,
  }));

  const enregistrer = async (): Promise<void> => {
    if (!f.utilisateur_id || !f.type) {
      toast.error('Agent et type de mouvement sont obligatoires'); return;
    }
    if (baseRequise && !f.base_apres) {
      toast.error('Une mutation exige la nouvelle base d\u2019affectation'); return;
    }
    if (escadronRequis && !f.escadron_apres) {
      toast.error("Le rôle COMEA exige un escadron de rattachement"); return;
    }
    if (f.successeur_id && f.successeur_id === f.utilisateur_id) {
      toast.error("Un agent ne peut pas être son propre successeur"); return;
    }

    setEnvoi(true);
    try {
      const corps: Record<string, string> = {
        utilisateur_id: f.utilisateur_id,
        type: f.type,
      };
      if (f.base_apres)     corps.base_apres = f.base_apres;
      if (f.role_apres)     corps.role_apres = f.role_apres;
      if (f.escadron_apres) corps.escadron_apres = f.escadron_apres;
      if (f.successeur_id)  corps.successeur_id = f.successeur_id;
      if (f.date_effet)     corps.date_effet = new Date(f.date_effet).toISOString();
      if (f.motif)          corps.motif = f.motif;
      if (f.reference)      corps.reference = f.reference;

      await api.post('/admin/mouvements', corps);
      toast.success('Mouvement enregistré');
      onFait();
    } catch (e) {
      toast.error(messageErreur(e));
    } finally { setEnvoi(false); }
  };

  return (
    <Modal title="Enregistrer un mouvement" onClose={onFermer} largeur={640}>
      <Field label="Agent concerné" value={f.utilisateur_id} onChange={set('utilisateur_id')}
             required options={options} />

      <Field label="Type de mouvement" value={f.type} onChange={set('type')}
             required options={TYPES_MOUVEMENT.map(t => ({ value: t.value, label: t.label }))}
             aide={ti?.aide} />

      {/* Situation actuelle, pour que l'avant soit sous les yeux au moment de
          saisir l'après. */}
      {agent && (
        <div style={{
          padding: '11px 14px', background: T.bgAlt, border: `1px solid ${T.border}`,
          borderRadius: 6, marginBottom: 14, fontSize: 11.5, color: T.textSub,
          display: 'flex', gap: 20, flexWrap: 'wrap',
        }}>
          <span>Base actuelle <strong style={{ color: T.text }}>{codeBase(agent.base_id)}</strong></span>
          <span>Rôle actuel <strong style={{ color: T.text }}>{libelleRole(agent.role)}</strong></span>
          <span>Compte <strong style={{ color: agent.actif ? T.green : T.red }}>
            {agent.actif ? 'actif' : 'inactif'}</strong></span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="Nouvelle base" value={f.base_apres} onChange={set('base_apres')}
               required={baseRequise}
               options={BASES_FAC.map(b => ({ value: b.id, label: `${b.code} — ${b.region}` }))}
               aide={baseRequise ? 'Obligatoire pour une mutation.' : 'Facultatif : laissez vide si l\u2019affectation ne change pas.'} />

        <Field label="Nouveau rôle" value={f.role_apres} onChange={set('role_apres')}
               options={ROLES.map(r => ({ value: r.value, label: r.label }))}
               aide="Facultatif : uniquement si le mouvement s'accompagne d'un changement de fonction." />
      </div>

      {escadronRequis && (
        <Field label="Escadron de rattachement" value={f.escadron_apres} onChange={set('escadron_apres')}
               required
               options={escadrons.map(e => ({ value: e.id, label: `${e.code} — ${e.nom}` }))}
               aide={escadrons.length === 0
                 ? "Aucun escadron n'a pu être chargé. Vérifiez que le référentiel répond avant de valider."
                 : "Un COMEA sans escadron est refusé par la contrainte de cohérence du service."} />
      )}

      <Field label="Successeur désigné" value={f.successeur_id} onChange={set('successeur_id')}
             options={options.filter(o => o.value !== f.utilisateur_id)}
             aide="Renseigné, le compte du successeur est mis à jour dans la même transaction — rôle, base et escadron du poste libéré lui sont transférés." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="Date d'effet" value={f.date_effet} onChange={set('date_effet')}
               type="datetime-local" aide="Vide = maintenant." />
        <Field label="Référence de la décision" value={f.reference} onChange={set('reference')}
               placeholder="Message n° …, note de service, ordre de mutation" />
      </div>

      <Field label="Motif" value={f.motif} onChange={set('motif')} type="textarea"
             placeholder="Contexte du mouvement" />

      <div style={{
        padding: '11px 14px', background: T.amberBg, border: `1px solid ${T.amberBorder}`,
        borderRadius: 6, fontSize: 11, color: T.amber, marginBottom: 16, lineHeight: 1.6,
      }}>
        Un mouvement modifie réellement le compte de l&apos;agent et ne s&apos;annule pas :
        une erreur se corrige par un mouvement inverse, qui restera lui aussi tracé.
        {f.type === 'DEPART' && ' Un départ désactive le compte.'}
        {f.type === 'SUSPENSION' && " Une suspension désactive le compte en conservant l'affectation."}
        {f.type === 'REINTEGRATION' && ' Une réintégration réactive le compte.'}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onFermer} className="ad-btn" style={{
          padding: '9px 20px', background: T.bgAlt, border: `1px solid ${T.border}`,
          borderRadius: 6, color: T.textSub, fontSize: 13, cursor: 'pointer',
        }}>Annuler</button>
        <BoutonPrincipal onClick={enregistrer} disabled={envoi}
                         couleur={ti?.color ?? T.green}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le mouvement'}
        </BoutonPrincipal>
      </div>
    </Modal>
  );
}