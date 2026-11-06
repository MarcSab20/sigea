// apps/frontend/src/components/SelecteurPiece.tsx
//
// Choix d'une pièce justificative : photographier, ou prendre un fichier.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI DEUX CHAMPS ET NON UN SEUL
// ═══════════════════════════════════════════════════════════════════════════
// L'attribut `capture` d'un `<input type="file">` ouvre directement l'appareil
// photo. Posé sur un champ unique, il INTERDIT de choisir un fichier existant
// sur la plupart des navigateurs mobiles — le sélecteur de fichiers n'est même
// plus proposé.
//
// Deux champs distincts laissent donc le choix : photographier un ordre de
// mission présenté au guichet, ou reprendre un PDF déjà reçu. Les deux usages
// existent, et sur un poste fixe seul le second a un sens.
//
// `capture="environment"` désigne la caméra arrière : on photographie un
// document posé devant soi, pas son propre visage.
//
// ── Compression avant envoi ──
// Un téléphone récent produit des photos de 4 à 12 Mo. Le plafond serveur est
// à 8 Mo, et même en deçà, transférer 10 Mo depuis une base aérienne mal
// desservie prend plusieurs minutes. Les images sont donc redimensionnées et
// recompressées côté navigateur. Un ordre de mission reste parfaitement
// lisible à 2000 pixels de large — ce qui ramène le fichier sous le mégaoctet.
//
// Les PDF ne sont pas touchés : ils sont déjà compacts, et les recomposer
// exigerait une bibliothèque entière pour un gain nul.

import React, { useRef, useState } from 'react';
import { Camera, Paperclip, Loader2 } from 'lucide-react';

/** Côté le plus long après redimensionnement, en pixels. */
const COTE_MAX = 2000;

/** Qualité JPEG. 0,82 : seuil au-delà duquel le gain visuel ne se voit plus. */
const QUALITE = 0.82;

interface Props {
  onFichier: (fichier: File) => void | Promise<void>;
  desactive?: boolean;
}

/**
 * Redimensionne et recompresse une image.
 *
 * Renvoie le fichier d'origine si ce n'est pas une image, ou si la compression
 * n'apporte rien — recompresser une photo déjà légère la dégraderait sans
 * réduire sa taille.
 */
async function compresser(fichier: File): Promise<File> {
  if (!fichier.type.startsWith('image/')) return fichier;

  const bitmap = await createImageBitmap(fichier).catch(() => null);
  if (!bitmap) return fichier;

  const facteur = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height));
  const largeur = Math.round(bitmap.width * facteur);
  const hauteur = Math.round(bitmap.height * facteur);

  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext('2d');
  if (!ctx) return fichier;
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
  bitmap.close();

  const blob = await new Promise<Blob | null>((r) =>
    toile.toBlob(r, 'image/jpeg', QUALITE),
  );
  if (!blob || blob.size >= fichier.size) return fichier;

  // Le nom conserve son radical pour rester reconnaissable dans la liste des
  // pièces, mais prend l'extension du format réellement produit.
  const radical = fichier.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${radical}.jpg`, { type: 'image/jpeg' });
}

export default function SelecteurPiece(props: Props): React.ReactElement {
  const [occupe, setOccupe] = useState(false);
  const refAppareil = useRef<HTMLInputElement>(null);
  const refFichier  = useRef<HTMLInputElement>(null);

  async function traiter(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const brut = e.target.files?.[0];
    if (!brut) return;
    setOccupe(true);
    try {
      await props.onFichier(await compresser(brut));
    } finally {
      setOccupe(false);
      // Réinitialisation : sans elle, redéposer le même fichier après une
      // erreur ne déclencherait aucun évènement, la valeur n'ayant pas changé.
      e.target.value = '';
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={props.desactive || occupe}
        onClick={() => refAppareil.current?.click()}
        className="inline-flex items-center gap-2 rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        Photographier
      </button>

      <button
        type="button"
        disabled={props.desactive || occupe}
        onClick={() => refFichier.current?.click()}
        className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Paperclip className="h-4 w-4" />
        Choisir un fichier
      </button>

      {/*
        Champ appareil photo. `capture` n'a d'effet que sur mobile ; sur un
        poste fixe il ouvre le sélecteur de fichiers, ce qui reste cohérent.
      */}
      <input
        ref={refAppareil}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void traiter(e)}
      />

      {/* Champ fichier : PDF et images déjà enregistrées. */}
      <input
        ref={refFichier}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff"
        className="hidden"
        onChange={(e) => void traiter(e)}
      />
    </div>
  );
}