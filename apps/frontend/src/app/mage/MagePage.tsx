// apps/frontend/src/app/mage/MagePage.tsx

import React from 'react';
import EspaceAutoritePage from '@/components/EspaceAutoritePage';

export default function MagePage(): React.ReactElement {
  return (
    <EspaceAutoritePage
      autorite="MAGE"
      titre="Espace MAGE"
      sousTitre="Major Général de l'Armée de l'Air"
      prefixeApi="/mage"
      accent="amber"
      sigle="◇"
    />
  );
}