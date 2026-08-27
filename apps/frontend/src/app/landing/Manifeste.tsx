// apps/frontend/src/app/landing/Manifeste.tsx
//
// ① SIGNATURE — LE MANIFESTE TAMPONNÉ
//
// Un manifeste reçoit ses cinq visas l'un après l'autre, puis son empreinte se
// compose. La séquence tourne en boucle : au lieu de repartir sèchement à
// zéro, la feuille achevée part au classement — elle glisse vers la droite en
// basculant légèrement, comme une main qui la range — et la feuille suivante
// remonte du sous-main avec un autre spécimen. La reprise devient un geste de
// bureau plutôt qu'un redémarrage.
//
// Les tampons sont en `mix-blend-mode: multiply` : ils se comportent comme de
// l'encre sur le papier, pas comme des vignettes collées.

import React from 'react';
import { QrCode } from 'lucide-react';
import { CIRCUIT, SPECIMENS } from './landing.data';
import { useRevelation, useCycleManifeste, useFrappe, useMouvementReduit } from './Uselandingmotion';

// Inclinaisons fixes et non aléatoires : elles doivent rester identiques d'un
// rendu à l'autre, sinon le document « bouge » au moindre re-render.
const INCLINAISONS = ['-3deg', '2.4deg', '-1.8deg', '3.1deg', '-2.6deg', '1.6deg'];

const NB_TAMPONS = CIRCUIT.length + 1; // 5 visas + le code de contrôle

export default function ManifesteTamponne(): React.ReactElement {
  const { ref, vu } = useRevelation<HTMLDivElement>({ seuil: 0.25 });
  const reduit = useMouvementReduit();

  const { phase, pose, tour, complet } = useCycleManifeste(NB_TAMPONS, { actif: vu });
  const specimen = SPECIMENS[tour % SPECIMENS.length];
  const empreinte = useFrappe(specimen.hash, complet, 11);

  return (
    <div ref={ref} className="lp-scene">
      {/* Sous-main : l'ombre creuse qui reçoit la feuille suivante */}
      <span className="lp-scene__sousmain" aria-hidden="true" />

      <div key={tour} className="lp-doc" data-phase={phase}>
        {!reduit && vu && phase !== 'sortie' && <span className="lp-scan" aria-hidden="true" />}

        <div className="lp-doc__head">
          <span className="lp-doc__title">Manifeste d&apos;escale</span>
          <span className="lp-doc__ref">SPÉCIMEN · NON OPÉRATIONNEL</span>
        </div>

        <div style={{ marginTop: 4 }}>
          {[
            ['Référence', specimen.ref],
            ['Aéronef',   specimen.aeronef],
            ['Itinéraire', specimen.route],
            ['Embarqués', specimen.charge],
          ].map(([k, v]) => (
            <div className="lp-doc__row" key={k}>
              <span className="lp-doc__k">{k}</span>
              <span className="lp-doc__v">{v}</span>
            </div>
          ))}
        </div>

        <div className="lp-stamps" role="list" aria-label="Visas apposés">
          {CIRCUIT.map((e, i) => (
            <div
              key={e.rang}
              role="listitem"
              className={`lp-tampon${i === 4 ? ' lp-tampon--rouge' : ''}`}
              data-on={pose >= i ? '1' : '0'}
              style={{ '--tilt': INCLINAISONS[i] } as React.CSSProperties}
            >
              <span className="lp-tampon__t">{e.statut}</span>
              <span className="lp-tampon__s">{e.role}</span>
            </div>
          ))}

          {/* 6ᵉ cellule : le code de contrôle porté par le tirage papier */}
          <div
            className="lp-tampon"
            data-on={pose >= 5 ? '1' : '0'}
            style={{ '--tilt': INCLINAISONS[5] } as React.CSSProperties}
          >
            <QrCode size={22} strokeWidth={1.6} />
            <span className="lp-tampon__s">Code de contrôle</span>
          </div>
        </div>

        {/* L'empreinte seule, sans libellé : c'est la chaîne qui parle. */}
        <div className="lp-hash" aria-live="polite">
          {empreinte}
          {complet && empreinte.length < specimen.hash.length && (
            <span className="lp-caret" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}