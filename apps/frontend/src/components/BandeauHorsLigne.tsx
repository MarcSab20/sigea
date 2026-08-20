// apps/frontend/src/components/BandeauHorsLigne.tsx
//
// Bandeau d'état du mode dégradé.
//
// Il ne s'affiche QUE lorsqu'il y a quelque chose à dire — hors ligne, ou file
// non vide. Un indicateur permanent « connecté » serait du bruit : l'opérateur
// cesserait de le regarder, et ne le verrait plus le jour où il compte.

import React, { useEffect, useState } from 'react';
import {
  estEnLigne, etat, synchroniser, purgerEchecs,
  activerSynchronisationAuto, EtatSynchronisation,
} from '@/offline/outbox';
import { purgerBrouillonsTransmis } from '@/services/manifeste.service';
import { T } from '@/lib/theme';

export default function BandeauHorsLigne(): React.ReactElement | null {
  const [enLigne, setEnLigne] = useState(estEnLigne());
  const [sync, setSync] = useState<EtatSynchronisation>({
    en_attente: 0, en_echec: 0, synchronisation_en_cours: false,
  });

  useEffect(() => {
    const majLigne = (): void => setEnLigne(estEnLigne());
    window.addEventListener('online', majLigne);
    window.addEventListener('offline', majLigne);

    const desinscrire = activerSynchronisationAuto((e) => {
      setSync(e);
      // Les brouillons dont toutes les opérations sont parties n'ont plus lieu
      // d'être affichés localement : la version serveur fait foi.
      void purgerBrouillonsTransmis();
    });
    void etat().then(setSync);

    return () => {
      window.removeEventListener('online', majLigne);
      window.removeEventListener('offline', majLigne);
      desinscrire();
    };
  }, []);

  if (enLigne && sync.en_attente === 0 && sync.en_echec === 0) return null;

  const forcer = async (): Promise<void> => {
    await synchroniser();
    await purgerBrouillonsTransmis();
    setSync(await etat());
  };

  const abandonner = async (): Promise<void> => {
    await purgerEchecs();
    await purgerBrouillonsTransmis();
    setSync(await etat());
  };

  const ton = !enLigne
    ? { bg: T.amberBg, bord: T.amberBorder, txt: T.amber }
    : sync.en_echec > 0
      ? { bg: T.redBg, bord: T.redBorder, txt: T.red }
      : { bg: T.blueBg, bord: T.blueBorder, txt: T.blue };

  return (
    <div style={{
      background: ton.bg, borderBottom: `1px solid ${ton.bord}`, color: ton.txt,
      padding: '8px 24px', fontSize: 12.5, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: ton.txt,
          display: 'inline-block', flexShrink: 0,
        }} />
        <span>
          {!enLigne && (
            <>
              <b>Mode dégradé.</b>{' '}
              La saisie des manifestes en brouillon reste possible et sera transmise au retour
              du réseau. Les soumissions et validations exigent la connexion.
            </>
          )}
          {enLigne && sync.en_echec > 0 && (
            <>
              <b>{sync.en_echec} opération{sync.en_echec > 1 ? 's' : ''} refusée{sync.en_echec > 1 ? 's' : ''} par le serveur.</b>{' '}
              Elles ne seront pas rejouées automatiquement — vérifier la saisie, puis abandonner
              ou ressaisir.
            </>
          )}
          {enLigne && sync.en_echec === 0 && sync.en_attente > 0 && (
            <>Transmission de {sync.en_attente} opération{sync.en_attente > 1 ? 's' : ''} en attente…</>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {!enLigne && sync.en_attente > 0 && (
          <span style={{ fontFamily: T.mono, fontSize: 11.5 }}>{sync.en_attente} en file</span>
        )}
        {enLigne && sync.en_attente > 0 && (
          <button onClick={() => void forcer()} disabled={sync.synchronisation_en_cours}
            style={bouton(ton.txt)}>
            {sync.synchronisation_en_cours ? 'En cours…' : 'Transmettre maintenant'}
          </button>
        )}
        {sync.en_echec > 0 && (
          <button onClick={() => void abandonner()} style={bouton(ton.txt)}>
            Abandonner les échecs
          </button>
        )}
      </div>
    </div>
  );
}

const bouton = (couleur: string): React.CSSProperties => ({
  padding: '4px 11px', border: `1px solid ${couleur}`, borderRadius: 4,
  background: 'transparent', color: couleur, fontSize: 11.5, fontWeight: 600,
  cursor: 'pointer',
});
