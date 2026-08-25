// apps/frontend/src/app/cemaa/CemaaPage.tsx

import React from 'react';
import EspaceAutoritePage from '@/components/EspaceAutoritePage';

export default function CemaaPage(): React.ReactElement {
  return (
    <EspaceAutoritePage
      autorite="CEMAA"
      titre="Espace CEMAA"
      sousTitre="Chef d'État-Major de l'Armée de l'Air"
      prefixeApi="/cemaa"
      accent="red"
      sigle="⬡"
    />
  );
}