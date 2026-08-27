// apps/frontend/src/app/admin/InterimTab.tsx
//
// ONGLET INTÉRIMS — délégation temporaire d'attributions
//
// Le module serveur existait déjà en entier (referentiel-service/src/interim)
// mais n'était appelé par aucun écran. Cet onglet le rend enfin utilisable.
//
// ── Deux règles du domaine que l'écran doit respecter ────────────────────
//
//   1. UNE DÉLÉGATION NE SE SUPPRIME PAS, elle se révoque.
//      Les signatures apposées sous son couvert la référencent en RESTRICT ;
//      la détruire romprait la piste d'audit d'un manifeste déjà signé. Aucun
//      bouton « Supprimer » n'est donc proposé, seulement « Révoquer », qui
//      exige un motif (3 caractères minimum côté DTO).
//
//   2. LA DÉLÉGATION PEUT ÊTRE PARTIELLE.
//      `role_delegue` permet de confier à un tiers les seules attributions de
//      signature d'un poste qui en cumule plusieurs. Le champ est exposé, avec
//      son défaut explicite (le rôle du titulaire).
//
// ── Vue par défaut ───────────────────────────────────────────────────────
// « Qui signe à la place de qui, en ce moment ». C'est la question qu'on se
// pose en ouvrant cet écran. L'historique est à un clic, pas au premier plan.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';
import { toast } from 'sonner';
import {
  Card, Modal, Field, Badge, StatMini, BarreOutils, Recherche, Selecteur,
  BoutonActualiser, BoutonPrincipal, Squelette, Vide,
  BASES_FAC, ROLES, libelleRole, couleurRole, codeBase, nomComplet, dateFr,
  messageErreur,
  type Interim, type Utilisateur,
} from './admin.shared';
import './admin.css';

type Vue = 'actives' | 'historique';

/** Jours restants avant échéance, ou `null` si la durée est indéterminée. */
function joursRestants(fin?: string | null): number | null {
  if (!fin) return null;
  const d = new Date(fin).getTime() - Date.now();
  return Math.ceil(d / 86_400_000);
}

export default function InterimTab(): React.ReactElement {
  const [vue, setVue] = useState<Vue>('actives');
  const [actives, setActives] = useState<Interim[]>([]);
  const [histo, setHisto] = useState<Interim[]>([]);
  const [agents, setAgents] = useState<Utilisateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);

  const [recherche, setRecherche] = useState('');
  const [filtreBase, setFiltreBase] = useState('');

  const [creation, setCreation] = useState(false);
  const [aRevoquer, setARevoquer] = useState<Interim | null>(null);

  // ── Chargement ───────────────────────────────────────────────────────────
  // Les trois appels partent ensemble : l'annuaire est nécessaire aux menus
  // déroulants du formulaire, l'attendre en série ferait clignoter l'écran.
  const charger = useCallback(async (silencieux = false): Promise<void> => {
    if (silencieux) setRafraichit(true);
    try {
      const [a, h, p] = await Promise.all([
        api.get<Interim[]>('/admin/interims'),
        api.get<Interim[]>('/admin/interims/historique'),
        api.get<Utilisateur[]>('/referentiel/personnels'),
      ]);
      setActives(a.data); setHisto(h.data); setAgents(p.data);
    } catch (e) {
      toast.error(messageErreur(e, 'Erreur de chargement des intérims'));
    } finally {
      setChargement(false); setRafraichit(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // ── Filtrage ─────────────────────────────────────────────────────────────
  const liste = vue === 'actives' ? actives : histo;

  const filtree = useMemo(() => liste.filter(i => {
    const texte = `${i.titulaire?.nom} ${i.titulaire?.prenom} ${i.suppleant?.nom} ${i.suppleant?.prenom} ${i.motif ?? ''}`.toLowerCase();
    return (!recherche || texte.includes(recherche.toLowerCase()))
      && (!filtreBase || i.base_id === filtreBase);
  }), [liste, recherche, filtreBase]);

  // Une délégation à moins de 3 jours de son terme mérite d'être signalée :
  // c'est le moment où l'on décide de la prolonger ou de la laisser tomber.
  const echeanceProche = actives.filter(i => {
    const j = joursRestants(i.date_fin);
    return j !== null && j <= 3;
  }).length;

  const indeterminees = actives.filter(i => !i.date_fin).length;

  return (
    <div className="ad-scope ad-panel">
      {/* ── Vignettes ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <StatMini label="Délégations en cours" value={actives.length} color={T.green}
                  onClick={() => setVue('actives')} actif={vue === 'actives'} />
        <StatMini label="Échéance sous 3 jours" value={echeanceProche} color={T.amberLight} />
        <StatMini label="Durée indéterminée" value={indeterminees} color={T.blue} />
        <StatMini label="Historique complet" value={histo.length} color={T.textSub}
                  onClick={() => setVue('historique')} actif={vue === 'historique'} />
      </div>

      <Card>
        <BarreOutils>
          {/* Bascule actives / historique */}
          <div style={{ display: 'flex', gap: 2, borderBottom: `2px solid ${T.border}`, marginRight: 6 }}>
            {([['actives', 'En cours'], ['historique', 'Historique']] as [Vue, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setVue(k)} className="ad-tab ad-btn"
                data-on={vue === k ? '1' : '0'}
                style={{
                  padding: '7px 15px', background: 'transparent', border: 'none',
                  color: vue === k ? T.green : T.textDim,
                  fontSize: 12.5, fontWeight: vue === k ? 600 : 400,
                  cursor: 'pointer', marginBottom: -2,
                }}>{l}</button>
            ))}
          </div>

          <Recherche value={recherche} onChange={setRecherche}
                     placeholder="Rechercher un titulaire, un suppléant, un motif…" />
          <Selecteur value={filtreBase} onChange={setFiltreBase} vide="Toutes les bases"
                     options={BASES_FAC.map(b => ({ value: b.id, label: b.code }))} />
          <BoutonActualiser onClick={() => charger(true)} busy={rafraichit} />
          <BoutonPrincipal onClick={() => setCreation(true)}>+ Nouvelle délégation</BoutonPrincipal>
        </BarreOutils>

        {chargement ? (
          <Squelette lignes={4} hauteur={96} />
        ) : filtree.length === 0 ? (
          <Vide
            icone="⇌"
            titre={vue === 'actives' ? 'Aucune délégation en cours' : 'Aucune délégation enregistrée'}
            aide={vue === 'actives'
              ? "Une délégation permet à un suppléant d'exercer les attributions d'un titulaire empêché, sans lui céder son compte."
              : "L'historique conserve les délégations révoquées et échues : elles restent référencées par les signatures apposées sous leur couvert."}
          />
        ) : (
          <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            {filtree.map((i, n) => (
              <CarteDelegation key={i.id} interim={i} index={n}
                               onRevoquer={() => setARevoquer(i)} />
            ))}
          </div>
        )}
      </Card>

      {creation && (
        <ModaleCreation
          agents={agents}
          onFermer={() => setCreation(false)}
          onFait={() => { setCreation(false); charger(true); }}
        />
      )}

      {aRevoquer && (
        <ModaleRevocation
          interim={aRevoquer}
          onFermer={() => setARevoquer(null)}
          onFait={() => { setARevoquer(null); charger(true); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CARTE DE DÉLÉGATION
   Le titulaire à gauche, le suppléant à droite, le rôle délégué sur le trait
   qui les relie : la lecture reproduit le geste de passation.
   ═══════════════════════════════════════════════════════════════════════════ */

function CarteDelegation({ interim: i, index, onRevoquer }: {
  interim: Interim; index: number; onRevoquer: () => void;
}): React.ReactElement {
  const jours = joursRestants(i.date_fin);
  const revoquee = !i.actif;
  const echue = !revoquee && jours !== null && jours < 0;
  const enCours = !revoquee && !echue;

  const etat = revoquee
    ? { label: 'Révoquée', couleur: T.red }
    : echue
      ? { label: 'Échue', couleur: T.textDim }
      : jours !== null && jours <= 3
        ? { label: `Fin dans ${jours} j`, couleur: T.amberLight }
        : { label: 'En cours', couleur: T.green };

  return (
    <div className="ad-row ad-deleg" style={{ '--ad-i': index } as React.CSSProperties}>
      <div style={{
        border: `1px solid ${enCours ? T.border : T.borderHi}`,
        borderLeft: `3px solid ${etat.couleur}`,
        borderRadius: 8, background: enCours ? T.bgCard : T.bgAlt,
        padding: '14px 18px', opacity: enCours ? 1 : 0.82,
      }}>
        {/* Ligne 1 — la passation */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr auto',
          gap: 16, alignItems: 'center',
        }}>
          <Personne titre="Titulaire empêché" p={i.titulaire} aligne="left" />

          <div className="ad-passe" style={{
            position: 'relative', minWidth: 132, textAlign: 'center', color: etat.couleur,
          }}>
            <span style={{
              position: 'relative', zIndex: 1, display: 'inline-block',
              background: enCours ? T.bgCard : T.bgAlt, padding: '0 9px',
            }}>
              <Badge label={libelleRole(i.role_delegue)} color={couleurRole(i.role_delegue)}
                     titre="Rôle effectivement délégué" />
            </span>
          </div>

          <Personne titre="Suppléant" p={i.suppleant} aligne="left" />

          <div style={{ textAlign: 'right' }}>
            <Badge label={etat.label} color={etat.couleur} />
            {enCours && (
              <div style={{ marginTop: 8 }}>
                <button onClick={onRevoquer} className="ad-btn" style={{
                  padding: '5px 12px', background: T.redBg,
                  border: `1px solid ${T.redBorder}`, borderRadius: 4,
                  color: T.red, fontSize: 11, cursor: 'pointer', fontWeight: 600,
                }}>Révoquer</button>
              </div>
            )}
          </div>
        </div>

        {/* Ligne 2 — les bornes */}
        <div style={{
          display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 12, paddingTop: 11,
          borderTop: `1px dashed ${T.border}`, fontSize: 11, color: T.textDim,
        }}>
          <Detail k="Base" v={codeBase(i.base_id)} />
          <Detail k="Début" v={dateFr(i.date_debut, true)} />
          <Detail k="Fin" v={i.date_fin ? dateFr(i.date_fin, true) : 'Indéterminée'} />
          {i.motif && <Detail k="Motif" v={i.motif} />}
          {revoquee && (
            <>
              <Detail k="Révoquée le" v={dateFr(i.revoque_le, true)} />
              {i.motif_revocation && <Detail k="Motif de révocation" v={i.motif_revocation} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Personne({ titre, p, aligne }: {
  titre: string; p: { nom: string; prenom: string; grade: string; role?: string } | undefined;
  aligne: 'left' | 'right';
}): React.ReactElement {
  return (
    <div style={{ textAlign: aligne, minWidth: 0 }}>
      <div style={{
        fontSize: 9.5, color: T.textDim, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 4,
      }}>{titre}</div>
      <div style={{
        fontSize: 13, fontWeight: 600, color: T.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {nomComplet(p as never)}
      </div>
      {p?.role && (
        <div style={{ fontSize: 10.5, color: T.textDim, marginTop: 3 }}>
          Rôle propre : {libelleRole(p.role)}
        </div>
      )}
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }): React.ReactElement {
  return (
    <span>
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 9.5 }}>{k} </span>
      <span style={{ color: T.textSub, fontWeight: 500 }}>{v}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CRÉATION
   ═══════════════════════════════════════════════════════════════════════════ */

function ModaleCreation({ agents, onFermer, onFait }: {
  agents: Utilisateur[]; onFermer: () => void; onFait: () => void;
}): React.ReactElement {
  const [f, setF] = useState({
    titulaire_id: '', suppleant_id: '', role_delegue: '',
    motif: '', date_debut: '', date_fin: '',
  });
  const [envoi, setEnvoi] = useState(false);

  const set = (k: keyof typeof f) => (v: string): void => setF(x => ({ ...x, [k]: v }));

  const options = agents
    .filter(a => a.actif)
    .map(a => ({ value: a.id, label: `${a.grade ? a.grade + ' ' : ''}${a.nom} ${a.prenom} — ${libelleRole(a.role)} (${codeBase(a.base_id)})` }));

  const titulaire = agents.find(a => a.id === f.titulaire_id);

  const enregistrer = async (): Promise<void> => {
    if (!f.titulaire_id || !f.suppleant_id) {
      toast.error('Titulaire et suppléant sont obligatoires'); return;
    }
    // Ce contrôle existe aussi côté serveur ; le doubler ici évite un
    // aller-retour réseau pour une erreur que l'écran peut voir tout seul.
    if (f.titulaire_id === f.suppleant_id) {
      toast.error('Le suppléant ne peut pas être le titulaire lui-même'); return;
    }
    if (f.date_debut && f.date_fin && new Date(f.date_fin) <= new Date(f.date_debut)) {
      toast.error('La date de fin doit être postérieure à la date de début'); return;
    }

    setEnvoi(true);
    try {
      const corps: Record<string, string> = {
        titulaire_id: f.titulaire_id,
        suppleant_id: f.suppleant_id,
      };
      if (f.role_delegue) corps.role_delegue = f.role_delegue;
      if (f.motif)        corps.motif = f.motif;
      if (f.date_debut)   corps.date_debut = new Date(f.date_debut).toISOString();
      if (f.date_fin)     corps.date_fin = new Date(f.date_fin).toISOString();

      await api.post('/admin/interims', corps);
      toast.success('Délégation enregistrée');
      onFait();
    } catch (e) {
      toast.error(messageErreur(e));
    } finally { setEnvoi(false); }
  };

  return (
    <Modal title="Nouvelle délégation d'intérim" onClose={onFermer} largeur={620}>
      <Field label="Titulaire empêché" value={f.titulaire_id} onChange={set('titulaire_id')}
             required options={options}
             aide="Son compte reste actif et son rôle inchangé. Seul l'exercice des attributions est délégué." />

      <Field label="Suppléant" value={f.suppleant_id} onChange={set('suppleant_id')}
             required options={options.filter(o => o.value !== f.titulaire_id)}
             aide="Il exercera le rôle délégué EN PLUS du sien, sans perdre ses propres attributions." />

      <Field label="Rôle délégué" value={f.role_delegue} onChange={set('role_delegue')}
             options={ROLES.map(r => ({ value: r.value, label: r.label }))}
             aide={titulaire
               ? `Laissé vide : le rôle du titulaire (${libelleRole(titulaire.role)}). À renseigner uniquement pour une délégation partielle, lorsqu'un poste cumule plusieurs attributions et qu'on n'en confie qu'une.`
               : "Laissé vide : le rôle du titulaire. À renseigner pour une délégation partielle."} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="Début" value={f.date_debut} onChange={set('date_debut')}
               type="datetime-local" aide="Vide = immédiat." />
        <Field label="Fin" value={f.date_fin} onChange={set('date_fin')}
               type="datetime-local" aide="Vide = durée indéterminée, jusqu'à révocation." />
      </div>

      <Field label="Motif" value={f.motif} onChange={set('motif')} type="textarea"
             placeholder="Mission, permission, stage, hospitalisation…" />

      <div style={{
        padding: '11px 14px', background: T.blueBg, border: `1px solid ${T.blueBorder}`,
        borderRadius: 6, fontSize: 11, color: T.blue, marginBottom: 16, lineHeight: 1.6,
      }}>
        Les signatures apposées par le suppléant porteront la mention de l&apos;intérim et
        resteront rattachées à cette délégation, y compris après sa révocation.
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onFermer} className="ad-btn" style={{
          padding: '9px 20px', background: T.bgAlt, border: `1px solid ${T.border}`,
          borderRadius: 6, color: T.textSub, fontSize: 13, cursor: 'pointer',
        }}>Annuler</button>
        <BoutonPrincipal onClick={enregistrer} disabled={envoi}>
          {envoi ? 'Enregistrement…' : 'Créer la délégation'}
        </BoutonPrincipal>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RÉVOCATION
   Le motif est obligatoire (min. 3 caractères, contrainte du DTO serveur).
   ═══════════════════════════════════════════════════════════════════════════ */

function ModaleRevocation({ interim: i, onFermer, onFait }: {
  interim: Interim; onFermer: () => void; onFait: () => void;
}): React.ReactElement {
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const revoquer = async (): Promise<void> => {
    if (motif.trim().length < 3) {
      toast.error('Le motif de révocation est obligatoire (3 caractères minimum)'); return;
    }
    setEnvoi(true);
    try {
      await api.patch(`/admin/interims/${i.id}/revoquer`, { motif: motif.trim() });
      toast.success('Délégation révoquée');
      onFait();
    } catch (e) {
      toast.error(messageErreur(e));
    } finally { setEnvoi(false); }
  };

  return (
    <Modal title="Révoquer la délégation" onClose={onFermer} largeur={520}>
      <div style={{
        padding: '13px 16px', background: T.bgAlt, border: `1px solid ${T.border}`,
        borderRadius: 6, marginBottom: 16, fontSize: 12.5, lineHeight: 1.7, color: T.textSub,
      }}>
        <strong style={{ color: T.text }}>{nomComplet(i.suppleant)}</strong> cessera
        immédiatement d&apos;exercer les attributions de <strong style={{ color: T.text }}>
        {libelleRole(i.role_delegue)}</strong> pour le compte de{' '}
        <strong style={{ color: T.text }}>{nomComplet(i.titulaire)}</strong>.
      </div>

      <div style={{
        padding: '11px 14px', background: T.amberBg, border: `1px solid ${T.amberBorder}`,
        borderRadius: 6, fontSize: 11, color: T.amber, marginBottom: 16, lineHeight: 1.6,
      }}>
        La délégation n&apos;est pas supprimée mais close et conservée. Les manifestes déjà
        signés sous son couvert continuent de la référencer — c&apos;est ce qui permet, des
        mois plus tard, d&apos;expliquer pourquoi tel agent a signé à la place de tel autre.
      </div>

      <Field label="Motif de révocation" value={motif} onChange={setMotif} type="textarea"
             required placeholder="Retour du titulaire, fin de mission, erreur de saisie…" />

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onFermer} className="ad-btn" style={{
          padding: '9px 20px', background: T.bgAlt, border: `1px solid ${T.border}`,
          borderRadius: 6, color: T.textSub, fontSize: 13, cursor: 'pointer',
        }}>Annuler</button>
        <BoutonPrincipal onClick={revoquer} disabled={envoi} couleur={T.red}>
          {envoi ? 'Révocation…' : 'Révoquer'}
        </BoutonPrincipal>
      </div>
    </Modal>
  );
}