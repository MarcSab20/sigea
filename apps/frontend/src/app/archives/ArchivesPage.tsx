// apps/frontend/src/app/archives/ArchivesPage.tsx
//
// Onglet « Archivé » — manifestes clos, consultables et téléchargeables.
//
// Le cloisonnement par base est appliqué CÔTÉ SERVEUR : cette page n'envoie
// aucun base_id pour un utilisateur ordinaire, et le service le déduit du
// jeton. Ne rétablissez pas un filtre de base ici en croyant bien faire — ce
// serait un filtre décoratif, contournable depuis la console du navigateur.

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { T } from '@/lib/theme';

interface ArchiveItem {
  id: string;
  manifeste_id: string;
  numero_mission: string;
  etape_vol: string;
  base_id: string;
  vol_id: string;
  taille_octets: number;
  statut: 'DISPONIBLE' | 'ABSENT' | 'CORROMPU';
  date_cloture: string;
  genere_le: string;
  nb_telechargements: number;
  version_contenu: number;
}

interface Page { total: number; page: number; taille: number; items: ArchiveItem[] }

const TAILLE_PAGE = 25;

function octets(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

function dateFr(v: string): string {
  return new Date(v).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

const BADGE: Record<ArchiveItem['statut'], { l: string; fg: string; bg: string; bd: string }> = {
  DISPONIBLE: { l: 'Disponible', fg: T.green, bg: T.greenBg, bd: T.greenBorder },
  ABSENT:     { l: 'Fichier absent', fg: T.amber, bg: T.amberBg, bd: T.amberBorder },
  CORROMPU:   { l: 'Corrompu', fg: T.red, bg: T.redBg, bd: T.redBorder },
};

export default function ArchivesPage(): React.ReactElement {
  const [q, setQ] = useState('');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const [enCours, setEnCours] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<Page>({
    queryKey: ['archives', recherche, page],
    queryFn: async () => {
      const { data } = await api.get<Page>('/pdf/archives', {
        params: { q: recherche || undefined, page, taille: TAILLE_PAGE },
      });
      return data;
    },
  });

  /**
   * Téléchargement en blob plutôt qu'en lien direct.
   *
   * Deux raisons : le jeton JWT voyage dans un en-tête et non dans l'URL — un
   * <a href> ne le porterait pas ; et l'en-tête X-SIGVEA-Archive doit être lu
   * pour avertir l'utilisateur qu'il reçoit une régénération.
   */
  const telecharger = async (a: ArchiveItem): Promise<void> => {
    setEnCours(a.id);
    try {
      const reponse = await api.get(`/pdf/archives/${a.id}/telecharger`, {
        responseType: 'blob',
      });

      const type = reponse.headers['x-sigvea-archive'];
      if (type === 'REGENERE') {
        const motif = reponse.headers['x-sigvea-archive-motif'];
        toast.warning(
          'Document RÉGÉNÉRÉ, et non l\'archive d\'origine.' +
          (motif ? ` ${decodeURIComponent(motif)}` : '') +
          ' Signalez-le à l\'administrateur : le volume d\'archives est en défaut.',
          { duration: 12_000 },
        );
      }

      const url = URL.createObjectURL(new Blob([reponse.data], { type: 'application/pdf' }));
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = `manifeste_${a.numero_mission}_${a.etape_vol}.pdf`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      // Libération du blob : sans elle, chaque téléchargement laisse un objet
      // en mémoire jusqu'au rechargement de l'onglet.
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      const message = (e as { response?: { status?: number } })?.response?.status === 403
        ? "Cette archive relève d'une autre base."
        : 'Téléchargement impossible. Réessayez, ou signalez-le à l\'administrateur.';
      toast.error(message);
    } finally {
      setEnCours(null);
    }
  };

  const total = data?.total ?? 0;
  const nbPages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  return (
    <div>
      {/* En-tête */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: T.display, fontSize: 24, fontWeight: 700 }}>Archivé</div>
        <div style={{ fontSize: 13, color: T.textSub, marginTop: 4, lineHeight: 1.6 }}>
          Manifestes dont le circuit est clos. Le document est figé au moment de
          la dernière signature et n&apos;est plus modifiable.
        </div>
      </div>

      {/* Recherche */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setRecherche(q); setPage(1); } }}
          placeholder="Numéro de mission…"
          style={{ flex: 1, minWidth: 220, padding: '10px 13px', background: T.bgInput,
            border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13,
            fontFamily: T.mono, color: T.text, outline: 'none' }} />
        <button onClick={() => { setRecherche(q); setPage(1); }}
          style={{ padding: '10px 20px', background: T.green, color: '#fff', border: 'none',
            borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Rechercher
        </button>
        {recherche && (
          <button onClick={() => { setQ(''); setRecherche(''); setPage(1); }}
            style={{ padding: '10px 16px', background: T.bgAlt, color: T.textSub,
              border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>
            Effacer
          </button>
        )}
      </div>

      {isLoading && (
        <div style={{ padding: 40, textAlign: 'center', color: T.textDim, fontSize: 13 }}>
          Chargement des archives…
        </div>
      )}

      {isError && (
        <div style={{ padding: '14px 18px', background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderRadius: 8, color: T.red, fontSize: 13 }}>
          Les archives n&apos;ont pas pu être chargées. Le service PDF est peut-être
          indisponible.
        </div>
      )}

      {data && data.items.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', background: T.bgCard,
          border: `1px dashed ${T.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 30, marginBottom: 10, opacity: .4 }}>🗄</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textSub }}>
            {recherche ? 'Aucune archive ne correspond à cette recherche' : 'Aucun manifeste archivé'}
          </div>
          <div style={{ fontSize: 12, color: T.textDim, marginTop: 6 }}>
            Un manifeste est archivé automatiquement dès que le commandant de bord
            a clos le circuit.
          </div>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`,
            borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.bgAlt, textAlign: 'left' }}>
                  {['Mission', 'Étape', 'Base', 'Clôturé le', 'Taille', 'État', ''].map((h, i) => (
                    <th key={i} style={{ padding: '11px 14px', fontSize: 10.5, fontWeight: 700,
                      color: T.textDim, textTransform: 'uppercase', letterSpacing: '.06em',
                      borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map(a => {
                  const b = BADGE[a.statut];
                  return (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${T.bgAlt}` }}>
                      <td style={{ padding: '11px 14px', fontFamily: T.mono, fontWeight: 600 }}>
                        {a.numero_mission}
                      </td>
                      <td style={{ padding: '11px 14px', color: T.textSub }}>{a.etape_vol}</td>
                      <td style={{ padding: '11px 14px', fontFamily: T.mono, fontSize: 12,
                        color: T.textSub }}>{a.base_id}</td>
                      <td style={{ padding: '11px 14px', color: T.textSub, fontSize: 12 }}>
                        {dateFr(a.date_cloture)}
                      </td>
                      <td style={{ padding: '11px 14px', color: T.textDim, fontSize: 12 }}>
                        {octets(a.taille_octets)}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 100, fontSize: 10.5,
                          fontWeight: 600, background: b.bg, color: b.fg,
                          border: `1px solid ${b.bd}` }}>{b.l}</span>
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                        <button onClick={() => void telecharger(a)} disabled={enCours === a.id}
                          style={{ padding: '7px 14px', background: T.greenBg, color: T.green,
                            border: `1px solid ${T.greenBorder}`, borderRadius: 6, fontSize: 12,
                            fontWeight: 600, cursor: enCours === a.id ? 'wait' : 'pointer',
                            whiteSpace: 'nowrap' }}>
                          {enCours === a.id ? '…' : '↓ PDF'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14, fontSize: 12, color: T.textDim, flexWrap: 'wrap', gap: 10 }}>
            <span>{total} manifeste{total > 1 ? 's' : ''} archivé{total > 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                style={pag(page <= 1)}>← Précédent</button>
              <span style={{ fontFamily: T.mono }}>{page} / {nbPages}</span>
              <button onClick={() => setPage(p => Math.min(nbPages, p + 1))} disabled={page >= nbPages}
                style={pag(page >= nbPages)}>Suivant →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const pag = (off: boolean): React.CSSProperties => ({
  padding: '6px 12px', background: off ? T.bgAlt : T.bgCard,
  border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12,
  color: off ? T.textMute : T.textSub, cursor: off ? 'not-allowed' : 'pointer',
});