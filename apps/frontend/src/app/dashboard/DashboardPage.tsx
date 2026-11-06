// apps/frontend/src/app/dashboard/DashboardPage.tsx
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CET ÉCRAN MONTRE, ET POURQUOI
// ═══════════════════════════════════════════════════════════════════════════
// Un tableau de bord n'a d'intérêt que s'il dit ce qui ATTEND l'utilisateur.
// L'ancienne version listait les manifestes et proposait de les soumettre —
// deux notions disparues avec l'ancien circuit.
//
// Ce qui attend quelqu'un dans SIGEA, c'est une liste à traiter : son étape
// courante correspond à son rôle. Le serveur le calcule déjà et renvoie un
// drapeau `a_traiter` sur chaque liste, intérims compris. On l'affiche, plutôt
// que de le recalculer ici — le client ne connaît pas les délégations.
//
// Les compteurs sont dérivés des mêmes données : aucun appel supplémentaire,
// et aucun risque de voir un chiffre contredire la liste juste en dessous.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { T } from '@/lib/theme';
import CameroonMap from '@/components/CameroonMap';
import { listeService, type ListeResume } from '@/services/liste.service';
import { volService, type Vol } from '@/services/vol.service';
import { manifesteService, type ManifesteResume } from '@/services/manifeste.service';
import { RoleUtilisateur, LIBELLE_RMIA, LIBELLE_ETAPE_LISTE } from '@sigea/shared-types';

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

function StatCard(
  { label, value, color, sub, onClick }: {
    label: string; value: number; color: string; sub?: string; onClick?: () => void;
  },
): React.ReactElement {
  return (
    <Card style={{
      padding: '18px 20px', position: 'relative', overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div onClick={onClick}>
        <div style={{
          fontSize: 11, color: T.textDim, fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
        }}>{label}</div>
        <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1, fontFamily: T.display }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 6 }}>{sub}</div>}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
          background: color, opacity: 0.3,
        }} />
      </div>
    </Card>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }): React.ReactElement {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color, background: bg,
      border: `1px solid ${color}40`, borderRadius: 4, padding: '2px 8px',
      letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

const STYLE_STATUT_LISTE: Record<string, { color: string; bg: string }> = {
  OUVERTE:       { color: T.amberLight, bg: T.amberBg },
  EN_VALIDATION: { color: T.blue,       bg: T.blueBg },
  ARRETEE:       { color: T.green,      bg: T.greenBg },
  CLOTUREE:      { color: T.textDim,    bg: T.bgAlt },
  REJETEE:       { color: T.red,        bg: T.redBg },
};

export default function DashboardPage(): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // `refetchInterval` plutôt qu'un setInterval manuel : react-query suspend le
  // rafraîchissement quand l'onglet est en arrière-plan, là où un intervalle
  // nu continuerait d'interroger le serveur toute la nuit.
  const listes = useQuery({
    queryKey: ['listes'],
    queryFn: listeService.mesListes,
    refetchInterval: 60_000,
  });

  const vols = useQuery({
    queryKey: ['vols'],
    queryFn: volService.lister,
    refetchInterval: 60_000,
  });

  const manifestes = useQuery({
    queryKey: ['manifestes'],
    queryFn: manifesteService.lister,
    refetchInterval: 60_000,
    // Les rôles de la chaîne RMIA n'ont pas accès aux manifestes : inutile de
    // provoquer un 403 à chaque minute pour afficher un compteur à zéro.
    enabled: user?.role !== RoleUtilisateur.SEC_ADJ_AIR
      && user?.role !== RoleUtilisateur.ADJ_AIR,
  });

  const mesListes   = (listes.data ?? []) as ListeResume[];
  const aTraiter    = mesListes.filter((l) => l.a_traiter);
  const volsVisibles = (vols.data ?? []) as Vol[];
  const aDiffuser   = volsVisibles.filter((v) => v.statut === 'PLANIFIE');
  const manifs      = (manifestes.data ?? []) as ManifesteResume[];
  const aViser      = manifs.filter((m) => m.statut === 'EMIS');

  const estScops = user?.role === RoleUtilisateur.SCOPS || user?.role === RoleUtilisateur.ADMIN;

  /** Rattachement affiché : la base, ou la région pour la chaîne RMIA. */
  const rattachement = user?.base_id
    ? `Base · ${user.base_id.toUpperCase()}`
    : user?.rmia
      ? LIBELLE_RMIA[user.rmia as keyof typeof LIBELLE_RMIA] ?? user.rmia
      : 'Échelon central';

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 700, color: T.text,
          fontFamily: T.display, letterSpacing: '0.05em',
        }}>Tableau de bord</h1>
        <p style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>
          {rattachement} — {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      {/* ── Compteurs ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 14, marginBottom: 20,
      }}>
        <StatCard
          label="En attente de vous"
          value={aTraiter.length}
          color={aTraiter.length ? T.amberLight : T.textDim}
          sub={aTraiter.length ? 'Cliquez pour traiter' : 'Rien ne vous attend'}
          onClick={() => navigate('/listes')}
        />
        <StatCard
          label="Listes suivies"
          value={mesListes.length}
          color={T.blue}
          sub="Dossiers de votre périmètre"
          onClick={() => navigate('/listes')}
        />
        {estScops && (
          <StatCard
            label="Vols à diffuser"
            value={aDiffuser.length}
            color={aDiffuser.length ? T.red : T.textDim}
            sub="Quotas à allouer"
            onClick={() => navigate('/scops')}
          />
        )}
        {manifestes.isSuccess && (
          <StatCard
            label="Manifestes à viser"
            value={aViser.length}
            color={aViser.length ? T.amberLight : T.textDim}
            sub="En attente du commandant de bord"
            onClick={() => navigate('/manifestes')}
          />
        )}
      </div>

      {/* ── Ce qui attend l'utilisateur ── */}
      <Card style={{ padding: '18px 22px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>
          En attente de votre action
        </div>

        {listes.isLoading && (
          <div style={{ fontSize: 12, color: T.textDim }}>Chargement…</div>
        )}

        {listes.isError && (
          <div style={{
            fontSize: 12, color: T.red, background: T.redBg,
            border: `1px solid ${T.redBorder}`, borderRadius: 5, padding: '8px 12px',
          }}>
            Les dossiers n'ont pas pu être chargés. Vérifiez votre connexion.
          </div>
        )}

        {listes.isSuccess && !aTraiter.length && (
          <div style={{ fontSize: 12, color: T.textMute, padding: '12px 0' }}>
            Aucun dossier ne requiert votre intervention pour l'instant.
          </div>
        )}

        {aTraiter.map((l) => {
          const s = STYLE_STATUT_LISTE[l.statut] ?? { color: T.textDim, bg: T.bgAlt };
          return (
            <div
              key={l.id}
              onClick={() => navigate(`/listes/${l.id}`)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', background: T.bgAlt, borderRadius: 5,
                marginBottom: 6, cursor: 'pointer', borderLeft: `3px solid ${T.amberLight}`,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                  {l.vol.numero_mission} — escale {l.etape.ordre} ({l.etape.base.code_base})
                </div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                  {new Date(l.vol.date_heure).toLocaleString('fr-FR',
                    { dateStyle: 'short', timeStyle: 'short' })}
                  {' · '}{l._count.lignes} inscrit(s) / {l.quota_places} place(s)
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {l.etape_courante && (
                  <Badge
                    label={LIBELLE_ETAPE_LISTE[l.etape_courante] ?? l.etape_courante}
                    color={T.amber} bg={T.amberBg}
                  />
                )}
                <Badge label={l.statut} color={s.color} bg={s.bg} />
              </div>
            </div>
          );
        })}
      </Card>

      {/* ── Prochains vols ── */}
      <Card style={{ padding: '18px 22px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>
          Prochains vols
        </div>
        {!volsVisibles.length ? (
          <div style={{ fontSize: 12, color: T.textMute, padding: '12px 0' }}>
            Aucun vol dans votre périmètre.
          </div>
        ) : (
          volsVisibles.slice(0, 6).map((v) => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: `1px solid ${T.border}`,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                  {v.numero_mission}
                  <span style={{ marginLeft: 8, fontWeight: 400, color: T.textDim }}>
                    {v.itineraire.map((p) => p.base.code_base).join(' → ')}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                  {new Date(v.date_heure).toLocaleString('fr-FR',
                    { dateStyle: 'short', timeStyle: 'short' })}
                  {' · '}{v.immatriculation}
                </div>
              </div>
              <Badge
                label={v.statut}
                color={v.statut === 'PLANIFIE' ? T.amber : T.green}
                bg={v.statut === 'PLANIFIE' ? T.amberBg : T.greenBg}
              />
            </div>
          ))
        )}
      </Card>

      <Card style={{ padding: '20px 24px' }}>
        <CameroonMap />
      </Card>
    </div>
  );
}