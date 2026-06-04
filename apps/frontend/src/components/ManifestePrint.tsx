// apps/frontend/src/components/ManifestePrint.tsx
// Vue impression du manifeste avec signatures par acteur

import React, { useRef } from 'react';
import { Manifeste } from '@/services/manifeste.service';

interface SignatureActeur {
  role: string;
  nom: string;
  grade: string;
  etape: string;
  statut: string;
  date_heure?: string;
  commentaire?: string;
}

interface ManifestePrintProps {
  manifeste: Manifeste;
  onClose: () => void;
}

const ETAPES_ORDRE = ['COMESO', 'COMGMO', 'COMBORD', 'COMBASE', 'CEMAA_SENSIBLE'];

const ROLE_LABELS: Record<string, string> = {
  COMESO:        'Chef des Opérations Sol',
  COMGMO:        'Chef GMO / Logistique',
  COMBORD:       'Commandant de Bord',
  COMBASE:       'Commandant de Base',
  CEMAA_SENSIBLE:'Commandant des Forces Aériennes',
};

export default function ManifestePrint({ manifeste, onClose }: ManifestePrintProps): React.ReactElement {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = (): void => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Manifeste ${manifeste.id.slice(0,8).toUpperCase()} — FAC/SIGEA</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Arial Narrow', Arial, sans-serif; font-size: 10pt;
            color: #000; background: #fff; }
          .page { padding: 20mm; max-width: 210mm; margin: 0 auto; }
          h1 { font-size: 14pt; font-weight: bold; text-align: center; }
          h2 { font-size: 11pt; font-weight: bold; margin: 8pt 0 4pt; }
          table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 9pt; }
          th { background: #2d6a4f; color: white; padding: 4pt 6pt; text-align: left; }
          td { border: 1px solid #ccc; padding: 3pt 6pt; vertical-align: top; }
          .header { text-align: center; border-bottom: 2px solid #2d6a4f; padding-bottom: 8pt; margin-bottom: 12pt; }
          .confidential { color: #8b1a1a; font-weight: bold; font-size: 11pt; }
          .section { margin: 10pt 0; }
          .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; margin-top: 16pt; }
          .sig-box { border: 1px solid #2d6a4f; border-radius: 3pt; padding: 8pt; min-height: 80pt; }
          .sig-title { font-size: 8pt; font-weight: bold; color: #2d6a4f; text-transform: uppercase; margin-bottom: 4pt; }
          .sig-name { font-size: 9pt; font-weight: bold; margin-bottom: 2pt; }
          .sig-status { font-size: 8pt; padding: 1pt 5pt; border-radius: 2pt; display: inline-block; }
          .sig-status.approuve { background: #d8f3dc; color: #2d6a4f; border: 1px solid #95d5b2; }
          .sig-status.rejete   { background: #fde8e8; color: #8b1a1a; border: 1px solid #f5b8b8; }
          .sig-status.attente  { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
          .sig-area { border-top: 1px dashed #aaa; margin-top: 6pt; padding-top: 4pt;
            min-height: 30pt; font-size: 8pt; color: #666; font-style: italic; }
          .footer { margin-top: 20pt; border-top: 1px solid #ccc; padding-top: 8pt;
            font-size: 7.5pt; color: #666; display: flex; justify-content: space-between; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const getValidation = (etape: string) =>
    manifeste.validations?.find(v => v.etape === etape);

  const signatures: SignatureActeur[] = ETAPES_ORDRE
    .filter(e => manifeste.flag_sensible || e !== 'CEMAA_SENSIBLE')
    .map(etape => {
      const v = getValidation(etape);
      return {
        role: ROLE_LABELS[etape] ?? etape,
        nom: '…',
        grade: '…',
        etape,
        statut: v?.statut ?? 'EN_ATTENTE',
        date_heure: v?.date_heure,
        commentaire: v?.commentaire,
      };
    });

  const now = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 900,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Barre d'actions */}
        <div style={{ padding: '14px 20px', background: '#f4f1ec',
          borderBottom: '1px solid #d4cfc5', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
            Aperçu impression — Manifeste #{manifeste.id.slice(0,8).toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handlePrint} style={{ padding: '8px 20px',
              background: '#2d6a4f', border: 'none', borderRadius: 6,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              🖨 Imprimer
            </button>
            <button onClick={onClose} style={{ padding: '8px 16px',
              background: 'transparent', border: '1px solid #d4cfc5',
              borderRadius: 6, color: '#4a4540', fontSize: 13, cursor: 'pointer' }}>
              Fermer
            </button>
          </div>
        </div>

        {/* Contenu imprimable */}
        <div ref={printRef} style={{ padding: '20mm', fontFamily: "'Arial Narrow', Arial, sans-serif",
          fontSize: '10pt', color: '#000' }}>

          {/* En-tête officiel */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #2d6a4f',
            paddingBottom: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#666',
              textTransform: 'uppercase', marginBottom: 4 }}>
              RÉPUBLIQUE DU CAMEROUN — FORCES AÉRIENNES DU CAMEROUN
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.1em' }}>
              MANIFESTE D'ESCALE AÉRIENNE
            </div>
            <div style={{ fontSize: 11, marginTop: 4, color: '#2d6a4f' }}>
              SYSTÈME INTÉGRÉ DE GESTION DES ESCALES AÉRIENNES (SIGEA)
            </div>
            {manifeste.flag_sensible && (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8b1a1a',
                marginTop: 6, letterSpacing: '0.2em' }}>
                ⬡ CONFIDENTIEL DÉFENSE — SENSIBLE CEMAA
              </div>
            )}
          </div>

          {/* Informations générales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <table>
              <tbody>
                {[
                  ['Réf. Manifeste', `#${manifeste.id.slice(0,8).toUpperCase()}`],
                  ['N° Mission', manifeste.vol?.numero_mission ?? '—'],
                  ['Aéronef', manifeste.vol?.immatriculation ?? '—'],
                  ['Étape', `Étape ${manifeste.etape_vol}`],
                  ['Version', `v${manifeste.version}`],
                ].map(([l, v]) => (
                  <tr key={l}>
                    <td style={{ background: '#f4f1ec', fontWeight: 600, width: '45%',
                      border: '1px solid #ccc', padding: '3pt 6pt', fontSize: '9pt' }}>{l}</td>
                    <td style={{ border: '1px solid #ccc', padding: '3pt 6pt', fontSize: '9pt' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table>
              <tbody>
                {[
                  ['Statut', manifeste.statut.replace('_', ' ')],
                  ['Date création', new Date(manifeste.createdAt).toLocaleDateString('fr-FR')],
                  ['Base', manifeste.base_id?.toUpperCase() ?? '—'],
                  ['Passagers', String(manifeste.passagers?.length ?? 0)],
                  ['Matériels', String(manifeste.materiels?.length ?? 0)],
                ].map(([l, v]) => (
                  <tr key={l}>
                    <td style={{ background: '#f4f1ec', fontWeight: 600, width: '45%',
                      border: '1px solid #ccc', padding: '3pt 6pt', fontSize: '9pt' }}>{l}</td>
                    <td style={{ border: '1px solid #ccc', padding: '3pt 6pt', fontSize: '9pt' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Passagers */}
          {manifeste.passagers && manifeste.passagers.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: 5,
                color: '#2d6a4f', borderBottom: '1px solid #2d6a4f', paddingBottom: 3 }}>
                I. LISTE DES PASSAGERS ({manifeste.passagers.length})
              </h2>
              <table>
                <thead>
                  <tr>
                    {['#','Nom & Prénom','Grade','Catégorie','Matricule','Destination','Bagages','Contact urgence'].map(h => (
                      <th key={h} style={{ background: '#2d6a4f', color: '#fff',
                        padding: '3pt 5pt', fontSize: '8pt', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {manifeste.passagers.map((p, i) => (
                    <tr key={p.id ?? i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f7f4' }}>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {i + 1}
                        {p.verrouille && <span style={{ color: '#d97706', fontSize: '7pt' }}> 🔒</span>}
                        {p.sensible && <span style={{ color: '#8b1a1a', fontSize: '7pt' }}> ⬡</span>}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt', fontWeight: 600 }}>
                        {p.sensible ? '[DONNÉES RESTREINTES]' : `${p.nom} ${p.prenom}`}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {p.grade ?? '—'}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {p.categorie}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {p.matricule ?? '—'}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {p.destination}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {p.nb_bagages} · {p.masse_bagages_kg}kg
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {p.contact_urgence_nom}<br />
                        <span style={{ fontSize: '7pt', color: '#666' }}>{p.contact_urgence_tel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Matériels */}
          {manifeste.materiels && manifeste.materiels.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: 5,
                color: '#2d6a4f', borderBottom: '1px solid #2d6a4f', paddingBottom: 3 }}>
                II. LISTE DES MATÉRIELS ({manifeste.materiels.length})
              </h2>
              <table>
                <thead>
                  <tr>
                    {['#','Désignation','Type logistique','Propriétaire','Poids','Destination','Expéditeur'].map(h => (
                      <th key={h} style={{ background: '#2d6a4f', color: '#fff',
                        padding: '3pt 5pt', fontSize: '8pt', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {manifeste.materiels.map((m, i) => (
                    <tr key={m.id ?? i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f7f4' }}>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {i + 1}
                        {m.verrouille && <span style={{ color: '#d97706' }}> 🔒</span>}
                        {m.sensible && <span style={{ color: '#8b1a1a' }}> ⬡</span>}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt', fontWeight: 600 }}>
                        {m.sensible ? '[MATÉRIEL CLASSIFIÉ]' : m.designation}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {m.type_mission_log}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {m.proprietaire}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {m.poids_kg} kg
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {m.destination}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '3pt 5pt', fontSize: '8pt' }}>
                        {m.expediteur_nom}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Signatures */}
          <div style={{ marginTop: 20, pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: 10,
              color: '#2d6a4f', borderBottom: '1px solid #2d6a4f', paddingBottom: 3 }}>
              III. SIGNATURES DE LA CHAÎNE DE VALIDATION
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {signatures.map((sig, i) => {
                const isApprouve = sig.statut === 'APPROUVE';
                const isRejete   = sig.statut === 'REJETE';
                const isAttente  = !isApprouve && !isRejete;
                return (
                  <div key={i} style={{ border: `1px solid ${isApprouve ? '#95d5b2' : isRejete ? '#f5b8b8' : '#d4cfc5'}`,
                    borderRadius: 4, padding: 10, minHeight: 120,
                    background: isApprouve ? '#f0fdf4' : isRejete ? '#fff5f5' : '#fafafa' }}>
                    <div style={{ fontSize: '8pt', fontWeight: 700, color: '#2d6a4f',
                      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                      {sig.etape}
                    </div>
                    <div style={{ fontSize: '9pt', fontWeight: 600, marginBottom: 2 }}>
                      {sig.role}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: '7.5pt', padding: '1pt 5pt', borderRadius: 2,
                        fontWeight: 600, display: 'inline-block',
                        background: isApprouve ? '#d8f3dc' : isRejete ? '#fde8e8' : '#fef3c7',
                        color: isApprouve ? '#2d6a4f' : isRejete ? '#8b1a1a' : '#92400e',
                        border: `1px solid ${isApprouve ? '#95d5b2' : isRejete ? '#f5b8b8' : '#fcd34d'}` }}>
                        {isApprouve ? '✓ VALIDÉ' : isRejete ? '✗ REJETÉ' : '⏳ EN ATTENTE'}
                      </span>
                    </div>
                    {sig.date_heure && (
                      <div style={{ fontSize: '7pt', color: '#666', marginBottom: 4 }}>
                        {new Date(sig.date_heure).toLocaleString('fr-FR')}
                      </div>
                    )}
                    {sig.commentaire && (
                      <div style={{ fontSize: '7.5pt', color: '#8b1a1a', fontStyle: 'italic',
                        marginBottom: 4 }}>"{sig.commentaire}"</div>
                    )}
                    {/* Zone signature manuscrite */}
                    <div style={{ borderTop: '1px dashed #aaa', marginTop: 8, paddingTop: 6,
                      minHeight: 40, fontSize: '7.5pt', color: '#aaa', fontStyle: 'italic' }}>
                      {isApprouve ? (
                        <div>
                          <div style={{ fontSize: '8pt', color: '#2d6a4f', fontStyle: 'normal',
                            fontWeight: 600 }}>Signature :</div>
                          <div style={{ height: 28, borderBottom: '1px solid #ccc', marginTop: 4 }} />
                          <div style={{ fontSize: '7pt', color: '#666', marginTop: 2 }}>
                            Cachet et signature
                          </div>
                        </div>
                      ) : (
                        'Signature à apposer'
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pied de page */}
          <div style={{ marginTop: 20, borderTop: '1px solid #ccc', paddingTop: 8,
            display: 'flex', justifyContent: 'space-between',
            fontSize: '7.5pt', color: '#666' }}>
            <span>SIGEA v1.0 · FAC/DSIC · Généré le {now}</span>
            <span>Manifeste #{manifeste.id.slice(0,8).toUpperCase()} · Confidentiel Défense</span>
            <span>Toutes les actions sont auditées · SHA-256</span>
          </div>
        </div>
      </div>
    </div>
  );
}