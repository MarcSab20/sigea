// apps/frontend/src/app/admin/EscadronsTab.tsx
//
// ONGLET ESCADRONS
//
// Même constat que pour les intérims : le module serveur
// (referentiel-service/src/escadrons) expose déjà un CRUD complet — POST,
// PATCH, DELETE, tous gardés en @Roles(ADMIN) — et aucun écran ne l'appelait.
// Cet onglet le branche.
//
// ── Trois règles du domaine, portées par le DTO serveur ──────────────────
//
//   1. LE CODE EST UN NUMÉRO NU : « 21 », « 31 », « 13 ». Le suffixe ordinal
//      (« ème ») n'est jamais stocké, il est ajouté à l'affichage. Le stocker
//      exposerait à « 21ème », « 21e », « 21 ème » pour un même escadron et
//      rendrait tout regroupement statistique impossible. Le champ est donc
//      contraint à 1-3 chiffres, et le formulaire montre le libellé rendu.
//
//   2. NI LE CODE NI LA BASE NE SE MODIFIENT. Un escadron ne change ni de
//      numéro ni de base : une réorganisation crée un nouvel escadron et
//      désactive l'ancien, ce qui préserve le rattachement historique des
//      COMEA passés. Les deux champs sont donc verrouillés en modification.
//
//   3. AUCUNE SUPPRESSION PHYSIQUE N'EST EXPOSÉE. `DELETE` désactive. Le
//      service refuse la désactivation d'un escadron auquel des COMEA sont
//      encore rattachés — l'écran affiche ce nombre pour que le refus ne soit
//      pas une surprise.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';
import { toast } from 'sonner';
import {
  Card, Modal, Field, Badge, StatMini, BarreOutils, Recherche, Selecteur,
  BoutonActualiser, BoutonPrincipal, Squelette, Vide, EnteteTable,
  BASES_FAC, codeBase, messageErreur,
} from './admin.shared';
import './admin.css';

/** Vue renvoyée par le service (EscadronVue). */
interface Escadron {
  id: string; code: string; nom: string;
  type: string | null; actif: boolean;
  base_id: string;
  base: { id: string; code_base: string; nom: string } | null;
  /** « 21ème escadron de transport » — composé côté serveur. */
  libelle: string;
  /** Nombre de COMEA rattachés. Sert au garde-fou de désactivation. */
  nb_commandants: number;
}

/**
 * Vocations proposées.
 *
 * Le champ est une chaîne libre côté schéma — et c'est délibéré : la
 * nomenclature évolue par décision d'emploi, pas par migration. Cette liste
 * n'est donc qu'une aide à la saisie, pas une contrainte.
 */
const VOCATIONS = [
  { value: 'TRANSPORT',   label: 'Transport',    color: T.blue },
  { value: 'CHASSE',      label: 'Chasse',       color: T.red },
  { value: 'HELICOPTERE', label: 'Hélicoptère',  color: T.green },
  { value: 'ECOLE',       label: 'École',        color: T.amberLight },
  { value: 'MIXTE',       label: 'Mixte',        color: T.textSub },
];

const couleurVocation = (t?: string | null): string =>
  VOCATIONS.find(v => v.value === t)?.color ?? T.textDim;

/** Ordinal français : 1 → « 1er », le reste → « Nème ». */
const ordinal = (code: string): string => (code === '1' ? '1er' : `${code}ème`);

const COLS = '90px 1fr 130px 90px 110px 90px 200px';

export default function EscadronsTab(): React.ReactElement {
  const [escadrons, setEscadrons] = useState<Escadron[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);

  const [recherche, setRecherche] = useState('');
  const [filtreBase, setFiltreBase] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [masquerInactifs, setMasquerInactifs] = useState(true);

  const [edition, setEdition] = useState<Escadron | null | 'nouveau'>(null);
  const [aDesactiver, setADesactiver] = useState<Escadron | null>(null);

  const charger = useCallback(async (silencieux = false): Promise<void> => {
    if (silencieux) setRafraichit(true);
    try {
      const r = await api.get<Escadron[]>('/referentiel/escadrons');
      setEscadrons(r.data);
    } catch (e) {
      toast.error(messageErreur(e, 'Erreur de chargement des escadrons'));
    } finally {
      setChargement(false); setRafraichit(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const filtres = useMemo(() => escadrons.filter(e => {
    const texte = `${e.code} ${e.nom} ${e.type ?? ''} ${e.libelle}`.toLowerCase();
    return (!recherche || texte.includes(recherche.toLowerCase()))
      && (!filtreBase || e.base_id === filtreBase || e.base?.code_base === filtreBase)
      && (!filtreType || e.type === filtreType)
      && (!masquerInactifs || e.actif);
  }), [escadrons, recherche, filtreBase, filtreType, masquerInactifs]);

  const actifs = escadrons.filter(e => e.actif);
  const sansCommandant = actifs.filter(e => e.nb_commandants === 0).length;

  const reactiver = async (e: Escadron): Promise<void> => {
    try {
      await api.patch(`/referentiel/escadrons/${e.id}`, { actif: true });
      toast.success(`${ordinal(e.code)} escadron réactivé`);
      charger(true);
    } catch (err) { toast.error(messageErreur(err)); }
  };

  return (
    <div className="ad-scope ad-panel">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <StatMini label="Escadrons actifs" value={actifs.length} color={T.green} />
        <StatMini label="Désactivés" value={escadrons.length - actifs.length} color={T.textDim}
                  actif={!masquerInactifs}
                  onClick={() => setMasquerInactifs(m => !m)} />
        {/* Un escadron actif sans COMEA rattaché n'a personne pour créer ses
            vols : c'est un trou d'organisation, pas une statistique. */}
        <StatMini label="Sans COMEA rattaché" value={sansCommandant} color={T.amberLight} />
        <StatMini label="Bases pourvues"
                  value={new Set(actifs.map(e => e.base_id)).size} color={T.blue} />
      </div>

      <Card>
        <BarreOutils>
          <Recherche value={recherche} onChange={setRecherche}
                     placeholder="Rechercher un numéro, un nom, une vocation…" />
          <Selecteur value={filtreBase} onChange={setFiltreBase} vide="Toutes les bases"
                     options={BASES_FAC.map(b => ({ value: b.id, label: b.code }))} />
          <Selecteur value={filtreType} onChange={setFiltreType} vide="Toutes vocations"
                     options={VOCATIONS.map(v => ({ value: v.value, label: v.label }))} />
          <button onClick={() => setMasquerInactifs(m => !m)} className="ad-btn"
            aria-pressed={!masquerInactifs} style={{
              padding: '8px 14px',
              background: masquerInactifs ? T.bgInput : T.bgAlt,
              border: `1px solid ${T.border}`, borderRadius: 6,
              color: T.textDim, fontSize: 12, cursor: 'pointer',
            }}>
            {masquerInactifs ? 'Afficher les désactivés' : 'Masquer les désactivés'}
          </button>
          <BoutonActualiser onClick={() => charger(true)} busy={rafraichit} />
          <BoutonPrincipal onClick={() => setEdition('nouveau')}>+ Nouvel escadron</BoutonPrincipal>
        </BarreOutils>

        {chargement ? (
          <Squelette lignes={5} hauteur={48} />
        ) : filtres.length === 0 ? (
          <Vide icone="◈" titre="Aucun escadron"
                aide="Un escadron regroupe les moyens d'une base sous un COMEA. Il est identifié par son numéro, unique au sein de sa base." />
        ) : (
          <div>
            <EnteteTable cols={COLS} colonnes={[
              'Numéro', 'Dénomination', 'Vocation', 'Base', 'COMEA', 'État',
              <span key="a" style={{ textAlign: 'right', display: 'block' }}>Actions</span>,
            ]} />

            {filtres.map((e, n) => (
              <div key={e.id} className="ad-row ad-row-hover" style={{
                '--ad-i': n,
                color: e.actif ? couleurVocation(e.type) : T.textMute,
                display: 'grid', gridTemplateColumns: COLS, gap: 8,
                padding: '12px 20px', borderBottom: `1px solid ${T.border}`,
                alignItems: 'center', opacity: e.actif ? 1 : 0.55,
              } as React.CSSProperties}>
                <span style={{
                  fontFamily: T.display, fontSize: 20, fontWeight: 700, color: T.text,
                }}>{e.code}</span>

                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontSize: 13, fontWeight: 600, color: T.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.nom}</span>
                  <span style={{ fontSize: 10.5, color: T.textDim }}>{e.libelle}</span>
                </span>

                <span>
                  {e.type
                    ? <Badge label={VOCATIONS.find(v => v.value === e.type)?.label ?? e.type}
                             color={couleurVocation(e.type)} />
                    : <span style={{ fontSize: 11, color: T.textMute }}>—</span>}
                </span>

                <span style={{ fontSize: 11.5, color: T.textSub, fontFamily: T.mono }}>
                  {e.base?.code_base ?? codeBase(e.base_id)}
                </span>

                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: e.nb_commandants > 0 ? T.text : T.amberLight,
                }}>
                  {e.nb_commandants > 0
                    ? `${e.nb_commandants} rattaché${e.nb_commandants > 1 ? 's' : ''}`
                    : 'aucun'}
                </span>

                <span style={{ fontSize: 10, fontWeight: 600, color: e.actif ? T.green : T.textDim }}>
                  {e.actif ? '● Actif' : '○ Désactivé'}
                </span>

                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEdition(e)} className="ad-btn" style={{
                    padding: '4px 10px', background: T.blueBg,
                    border: `1px solid ${T.blueBorder}`, borderRadius: 4,
                    color: T.blue, fontSize: 11, cursor: 'pointer',
                  }}>Modifier</button>

                  {e.actif ? (
                    <button onClick={() => setADesactiver(e)} className="ad-btn" style={{
                      padding: '4px 10px', background: T.redBg,
                      border: `1px solid ${T.redBorder}`, borderRadius: 4,
                      color: T.red, fontSize: 11, cursor: 'pointer',
                    }}>Désactiver</button>
                  ) : (
                    <button onClick={() => reactiver(e)} className="ad-btn" style={{
                      padding: '4px 10px', background: T.greenBg,
                      border: `1px solid ${T.greenBorder}`, borderRadius: 4,
                      color: T.green, fontSize: 11, cursor: 'pointer',
                    }}>Réactiver</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {edition && (
        <ModaleEscadron
          escadron={edition === 'nouveau' ? null : edition}
          existants={escadrons}
          onFermer={() => setEdition(null)}
          onFait={() => { setEdition(null); charger(true); }}
        />
      )}

      {aDesactiver && (
        <ModaleDesactivation
          escadron={aDesactiver}
          onFermer={() => setADesactiver(null)}
          onFait={() => { setADesactiver(null); charger(true); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CRÉATION / MODIFICATION
   ═══════════════════════════════════════════════════════════════════════════ */

function ModaleEscadron({ escadron, existants, onFermer, onFait }: {
  escadron: Escadron | null;
  existants: Escadron[];
  onFermer: () => void; onFait: () => void;
}): React.ReactElement {
  const modification = escadron !== null;

  const [f, setF] = useState({
    code: escadron?.code ?? '',
    nom: escadron?.nom ?? '',
    type: escadron?.type ?? '',
    base_id: escadron?.base_id ?? '',
  });
  const [envoi, setEnvoi] = useState(false);

  const set = (k: keyof typeof f) => (v: string): void => setF(x => ({ ...x, [k]: v }));

  // Le code est unique DANS une base, pas globalement : deux bases peuvent
  // héberger des escadrons de numérotation voisine (@@unique([base_id, code])).
  // Ce contrôle local évite un aller-retour pour une collision évidente.
  // Boolean() explicite : `f.code && …` renvoie la chaîne vide quand le champ
  // est vide, et `disabled` n'accepte pas une chaîne.
  const collision = Boolean(
    !modification && f.code && f.base_id
    && existants.some(e => e.base_id === f.base_id && e.code === f.code),
  );

  const codeValide = /^\d{1,3}$/.test(f.code);

  // Aperçu du libellé rendu — c'est ce que verront les listes déroulantes.
  const apercu = codeValide
    ? `${ordinal(f.code)} escadron${f.type ? ' ' + (
        f.type === 'TRANSPORT'   ? 'de transport'
      : f.type === 'CHASSE'      ? 'de chasse'
      : f.type === 'HELICOPTERE' ? "d'hélicoptères"
      : f.type === 'ECOLE'       ? "d'instruction"
      : f.type === 'MIXTE'       ? 'mixte' : '') : ''}`
    : null;

  const enregistrer = async (): Promise<void> => {
    if (modification) {
      if (!f.nom || f.nom.trim().length < 3) {
        toast.error('La dénomination doit compter au moins 3 caractères'); return;
      }
    } else {
      if (!codeValide) {
        toast.error("Le numéro doit compter 1 à 3 chiffres (ex. 21, 31, 13)"); return;
      }
      if (!f.nom || f.nom.trim().length < 3) {
        toast.error('La dénomination doit compter au moins 3 caractères'); return;
      }
      if (!f.base_id) { toast.error("La base de rattachement est obligatoire"); return; }
      if (collision) {
        toast.error(`Un escadron ${f.code} existe déjà sur cette base`); return;
      }
    }

    setEnvoi(true);
    try {
      if (modification && escadron) {
        // `code` et `base_id` ne sont pas modifiables : le DTO Update ne les
        // accepte pas, les envoyer serait rejeté par la validation.
        const corps: Record<string, string> = { nom: f.nom.trim() };
        if (f.type) corps.type = f.type;
        await api.patch(`/referentiel/escadrons/${escadron.id}`, corps);
        toast.success('Escadron mis à jour');
      } else {
        const corps: Record<string, string> = {
          code: f.code, nom: f.nom.trim(), base_id: f.base_id,
        };
        if (f.type) corps.type = f.type;
        await api.post('/referentiel/escadrons', corps);
        toast.success(`${ordinal(f.code)} escadron créé`);
      }
      onFait();
    } catch (e) {
      toast.error(messageErreur(e));
    } finally { setEnvoi(false); }
  };

  return (
    <Modal
      title={modification ? `Modifier — ${escadron?.libelle}` : 'Nouvel escadron'}
      onClose={onFermer} largeur={580}>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0 16px' }}>
        <Field label="Numéro" value={f.code} onChange={set('code')}
               required={!modification} disabled={modification}
               placeholder="21"
               aide={modification ? 'Non modifiable' : '1 à 3 chiffres'} />
        <Field label="Base de rattachement" value={f.base_id} onChange={set('base_id')}
               required={!modification} disabled={modification}
               options={BASES_FAC.map(b => ({ value: b.id, label: `${b.code} — ${b.nom}` }))}
               aide={modification ? 'Non modifiable' : 'Le numéro est unique au sein de la base.'} />
      </div>

      {collision && (
        <div style={{
          padding: '10px 13px', background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderRadius: 6, fontSize: 11.5, color: T.red, marginBottom: 14, lineHeight: 1.6,
        }}>
          Un escadron portant le numéro {f.code} existe déjà sur {codeBase(f.base_id)}.
          Le serveur refusera la création.
        </div>
      )}

      <Field label="Dénomination" value={f.nom} onChange={set('nom')} required
             placeholder="Escadron de transport aérien"
             aide="Nom complet tel qu'il figure dans les textes d'organisation." />

      <Field label="Vocation" value={f.type} onChange={set('type')}
             options={VOCATIONS.map(v => ({ value: v.value, label: v.label }))}
             aide="Aide à la saisie seulement : le champ est libre côté schéma, la nomenclature évoluant par décision d'emploi et non par migration." />

      {apercu && (
        <div style={{
          padding: '11px 14px', background: T.bgAlt, border: `1px solid ${T.border}`,
          borderRadius: 6, marginBottom: 16,
        }}>
          <div style={{
            fontSize: 9.5, color: T.textDim, textTransform: 'uppercase',
            letterSpacing: '0.07em', marginBottom: 5,
          }}>Libellé rendu dans les listes</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{apercu}</div>
          <div style={{ fontSize: 10.5, color: T.textDim, marginTop: 6, lineHeight: 1.55 }}>
            Le suffixe ordinal n&apos;est pas stocké : seul le numéro l&apos;est. C&apos;est
            ce qui évite d&apos;avoir « 21ème », « 21e » et « 21 ème » pour un même escadron.
          </div>
        </div>
      )}

      {modification && escadron && escadron.nb_commandants > 0 && (
        <div style={{
          padding: '10px 13px', background: T.blueBg, border: `1px solid ${T.blueBorder}`,
          borderRadius: 6, fontSize: 11.5, color: T.blue, marginBottom: 16, lineHeight: 1.6,
        }}>
          {escadron.nb_commandants} COMEA {escadron.nb_commandants > 1 ? 'sont rattachés' : 'est rattaché'} à
          cet escadron. Changer sa dénomination n&apos;affecte pas ce rattachement.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onFermer} className="ad-btn" style={{
          padding: '9px 20px', background: T.bgAlt, border: `1px solid ${T.border}`,
          borderRadius: 6, color: T.textSub, fontSize: 13, cursor: 'pointer',
        }}>Annuler</button>
        <BoutonPrincipal onClick={enregistrer} disabled={envoi || collision}>
          {envoi ? 'Enregistrement…' : modification ? 'Mettre à jour' : "Créer l'escadron"}
        </BoutonPrincipal>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DÉSACTIVATION
   Le service refuse si des COMEA sont encore rattachés. L'écran le dit AVANT
   la tentative : un refus prévisible ne doit pas se découvrir par une erreur.
   ═══════════════════════════════════════════════════════════════════════════ */

function ModaleDesactivation({ escadron: e, onFermer, onFait }: {
  escadron: Escadron; onFermer: () => void; onFait: () => void;
}): React.ReactElement {
  const [envoi, setEnvoi] = useState(false);
  const bloque = e.nb_commandants > 0;

  const desactiver = async (): Promise<void> => {
    setEnvoi(true);
    try {
      await api.delete(`/referentiel/escadrons/${e.id}`);
      toast.success(`${ordinal(e.code)} escadron désactivé`);
      onFait();
    } catch (err) {
      toast.error(messageErreur(err));
    } finally { setEnvoi(false); }
  };

  return (
    <Modal title="Désactiver l'escadron" onClose={onFermer} largeur={520}>
      <div style={{
        padding: '13px 16px', background: T.bgAlt, border: `1px solid ${T.border}`,
        borderRadius: 6, marginBottom: 16,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{e.libelle}</div>
        <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 5 }}>
          {e.nom} · {e.base?.code_base ?? codeBase(e.base_id)}
        </div>
      </div>

      {bloque ? (
        <div style={{
          padding: '12px 15px', background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderRadius: 6, fontSize: 12, color: T.red, marginBottom: 16, lineHeight: 1.65,
        }}>
          <strong>Désactivation impossible en l&apos;état.</strong><br />
          {e.nb_commandants} COMEA {e.nb_commandants > 1 ? 'sont encore rattachés' : 'est encore rattaché'} à
          cet escadron. Réaffectez-{e.nb_commandants > 1 ? 'les' : 'le'} d&apos;abord via
          l&apos;onglet Mouvements, puis revenez ici. Le serveur refusera l&apos;opération tant
          que ce rattachement subsiste.
        </div>
      ) : (
        <div style={{
          padding: '12px 15px', background: T.amberBg, border: `1px solid ${T.amberBorder}`,
          borderRadius: 6, fontSize: 11.5, color: T.amber, marginBottom: 16, lineHeight: 1.65,
        }}>
          L&apos;escadron n&apos;est pas supprimé mais désactivé : il disparaît des listes de
          saisie et reste référencé par l&apos;historique. C&apos;est ce qui permet, des années
          plus tard, de relire un dossier mentionnant un escadron dissous.
          <br /><br />
          L&apos;opération est réversible depuis cette même liste.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onFermer} className="ad-btn" style={{
          padding: '9px 20px', background: T.bgAlt, border: `1px solid ${T.border}`,
          borderRadius: 6, color: T.textSub, fontSize: 13, cursor: 'pointer',
        }}>{bloque ? 'Fermer' : 'Annuler'}</button>
        {!bloque && (
          <BoutonPrincipal onClick={desactiver} disabled={envoi} couleur={T.red}>
            {envoi ? 'Désactivation…' : 'Désactiver'}
          </BoutonPrincipal>
        )}
      </div>
    </Modal>
  );
}