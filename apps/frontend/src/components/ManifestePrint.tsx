// apps/frontend/src/components/ManifestePrint.tsx

import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Manifeste } from '@/services/manifeste.service';
import { T } from '@/lib/theme';

interface ManifestePrintProps {
  manifeste: Manifeste;
  onClose: () => void;
}

export default function ManifestePrint({ manifeste, onClose }: ManifestePrintProps): React.ReactElement {
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let annule = false;

    const charger = async (): Promise<void> => {
      try {
        // Blob authentifié : un <iframe src="/api/pdf/..."> n'enverrait pas le
        // JWT, l'endpoint répondrait 401 et l'aperçu resterait blanc.
        const res = await api.get(`/pdf/manifeste/${manifeste.id}`, { responseType: 'blob' });

        // Type forcé : si la réponse n'est pas étiquetée application/pdf, le
        // navigateur proposerait un téléchargement au lieu d'afficher le
        // document dans l'iframe.
        const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        if (!annule) setUrl(objectUrl);
      } catch (e) {
        const statut = (e as { response?: { status?: number } })?.response?.status;
        if (!annule) {
          setErreur(
            statut === 403 || statut === 404
              ? "Ce manifeste n'est pas accessible depuis votre base."
              : 'Génération du document impossible. Le service PDF est peut-être indisponible.',
          );
        }
      }
    };

    void charger();

    return () => {
      annule = true;
      // Libération mémoire : sans révocation, chaque ouverture d'aperçu
      // laisserait un blob de plusieurs centaines de kilo-octets en mémoire
      // jusqu'au rechargement de la page.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [manifeste.id]);

  /**
   * Impression du PDF affiché.
   *
   * On imprime le contenu de l'iframe, et non la page hôte : `window.print()`
   * sortirait l'interface SIGEA autour du document. Si le navigateur refuse
   * l'accès au document embarqué, on ouvre le PDF dans un onglet — l'opérateur
   * imprime alors depuis la visionneuse native.
   */
  const imprimer = (): void => {
    const cadre = iframeRef.current;
    try {
      if (cadre?.contentWindow) {
        cadre.contentWindow.focus();
        cadre.contentWindow.print();
        return;
      }
    } catch {
      // Ignoré : repli ci-dessous.
    }
    if (url) window.open(url, '_blank');
  };

  const telecharger = (): void => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `Manifeste-${manifeste.id.slice(0, 8).toUpperCase()}.pdf`;
    a.click();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 1000,
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        background: T.bgCard, borderBottom: `1px solid ${T.border}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
            Aperçu impression — Manifeste #{manifeste.id.slice(0, 8).toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
            Document officiel généré par SIGEA — identique à la version imprimée
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={telecharger} disabled={!url} style={bouton(false, !url)}>
            Télécharger
          </button>
          <button onClick={imprimer} disabled={!url} style={bouton(true, !url)}>
            Imprimer
          </button>
          <button onClick={onClose} style={bouton(false, false)}>Fermer</button>
        </div>
      </header>

      <div style={{ flex: 1, background: '#525659', position: 'relative' }}>
        {erreur && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 24,
          }}>
            <div style={{
              background: T.bgCard, border: `1px solid ${T.redBorder}`,
              borderLeft: `4px solid ${T.red}`, borderRadius: 8,
              padding: '18px 22px', maxWidth: 420,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 6 }}>
                Aperçu indisponible
              </div>
              <div style={{ fontSize: 12.5, color: T.textSub, lineHeight: 1.6 }}>{erreur}</div>
            </div>
          </div>
        )}

        {!erreur && !url && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#e2e8f0', fontSize: 13,
          }}>
            Génération du document…
          </div>
        )}

        {url && (
          <iframe
            ref={iframeRef}
            src={url}
            title="Manifeste d'escale aérienne"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        )}
      </div>
    </div>
  );
}

const bouton = (primaire: boolean, desactive: boolean): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
  cursor: desactive ? 'not-allowed' : 'pointer',
  opacity: desactive ? 0.5 : 1,
  border: primaire ? 'none' : `1px solid ${T.border}`,
  background: primaire ? T.green : T.bgCard,
  color: primaire ? '#fff' : T.textSub,
});