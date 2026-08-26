// libs/shared-types/src/circuit.interim.spec.ts
//
// Tests du circuit après les corrections du lot 4.
//
// Ces tests fixent trois décisions qui ont été prises, défaites, puis reprises
// pendant le développement. Les figer ici évite qu'une prochaine intervention
// les défasse une troisième fois sans s'en apercevoir :
//
//   1. la séquence est IDENTIQUE pour tous les vols, sensibles compris ;
//   2. CEMAA_SENSIBLE et MAGE_SENSIBLE n'apposent AUCUN tampon ;
//   3. un tampon apposé par intérim porte le nom du titulaire empêché.
//
// Exécution : npx nx test shared-types

import {
  ETAPE_SEQUENCE,
  ETAPES_HISTORIQUES,
  ROLE_TO_ETAPE,
  ETAPE_TO_ROLE,
  MENTION_INTERIM,
  composerTampon,
  etapeSuivante,
  estEtapeFinale,
  estEtapeHistorique,
  rangEtape,
} from './circuit';
import {
  EtapeValidation,
  MentionSignature,
  RoleUtilisateur,
  ROLES_CREATION_VOL,
} from './enums';

describe('Séquence du circuit', () => {
  it("suit l'ordre Chef escale → COMESO → COMGMO → COMBASE → COMBORD", () => {
    expect([...ETAPE_SEQUENCE]).toEqual([
      EtapeValidation.CHEF_ESCALE,
      EtapeValidation.COMESO,
      EtapeValidation.COMGMO,
      EtapeValidation.COMBASE,
      EtapeValidation.COMBORD,
    ]);
  });

  it('place le COMBORD en dernier — c\'est lui qui clôt le circuit', () => {
    expect(estEtapeFinale(EtapeValidation.COMBORD)).toBe(true);
    expect(estEtapeFinale(EtapeValidation.COMBASE)).toBe(false);
    expect(etapeSuivante(EtapeValidation.COMBORD)).toBeNull();
  });

  it('enchaîne le COMGMO sur le COMBASE, sans étape d\'autorité intercalée', () => {
    // Régression du lot 3 : une étape CEMAA_SENSIBLE était insérée ici pour
    // les vols sensibles. Comme aucun rôle ne lui correspond, le manifeste s'y
    // arrêtait définitivement. Le contrôle des consignes se fait désormais sur
    // la consigne elle-même, pas dans la séquence.
    expect(etapeSuivante(EtapeValidation.COMGMO)).toBe(EtapeValidation.COMBASE);
    expect(etapeSuivante(EtapeValidation.COMBASE)).toBe(EtapeValidation.COMBORD);
  });

  it('n\'inclut aucune étape historique dans la séquence vivante', () => {
    for (const historique of ETAPES_HISTORIQUES) {
      expect(ETAPE_SEQUENCE).not.toContain(historique);
      expect(estEtapeHistorique(historique)).toBe(true);
      expect(rangEtape(historique)).toBe(0);
    }
  });
});

describe('Rôles hors circuit', () => {
  it.each([RoleUtilisateur.COMEA, RoleUtilisateur.CEMAA, RoleUtilisateur.MAGE])(
    "%s n'appose aucun tampon",
    (role) => {
      // Le mécanisme d'exclusion EST cette absence de correspondance : la
      // state machine refuse toute signature dont l'étape n'a pas de rôle.
      // Aucune règle supplémentaire n'est écrite nulle part.
      expect(ROLE_TO_ETAPE[role]).toBeUndefined();
    },
  );

  it('COMEA et COMGMO planifient les vols, le COMBASE ne planifie plus', () => {
    expect(ROLES_CREATION_VOL).toContain(RoleUtilisateur.COMEA);
    expect(ROLES_CREATION_VOL).toContain(RoleUtilisateur.COMGMO);
    expect(ROLES_CREATION_VOL).not.toContain(RoleUtilisateur.COMBASE);
  });

  it('le COMBASE conserve sa place dans le circuit malgré tout', () => {
    // Retirer un droit de création n'est pas retirer un droit de signature.
    expect(ROLE_TO_ETAPE[RoleUtilisateur.COMBASE]).toBe(EtapeValidation.COMBASE);
    expect(ETAPE_TO_ROLE[EtapeValidation.COMBASE]).toBe(RoleUtilisateur.COMBASE);
  });
});

describe('Composition du tampon', () => {
  const socle = {
    base_numero: '102',
    base_code: 'BA102',
    signataire_nom: 'NKOMO',
    signataire_prenom: 'Jean',
    signataire_grade: 'CNE',
  };

  it('compose « COMGMO 102 » pour le COMGMO', () => {
    const t = composerTampon({ ...socle, etape: EtapeValidation.COMGMO });
    expect(t.tampon_ligne1).toBe('COMGMO 102');
    expect(t.mention).toBe(MentionSignature.VU);
    expect(t.par_interim).toBe(false);
  });

  it('porte ACCORD, et non VU, pour le COMBASE', () => {
    // Seul acte de commandement du circuit : la mention doit le refléter.
    const t = composerTampon({ ...socle, etape: EtapeValidation.COMBASE });
    expect(t.mention).toBe(MentionSignature.ACCORD);
    expect(t.tampon_ligne2).toBe('BA102');
  });

  it("exige l'immatriculation pour le COMBORD", () => {
    expect(() => composerTampon({ ...socle, etape: EtapeValidation.COMBORD }))
      .toThrow(/immatriculation/i);

    const t = composerTampon({
      ...socle, etape: EtapeValidation.COMBORD, immatriculation: 'TJ-XCD',
    });
    expect(t.tampon_ligne2).toBe('TJ-XCD');
  });

  it('refuse de tamponner une étape historique', () => {
    // Sans ce garde, un appel erroné produirait un tampon fantôme sur un
    // document officiel — bien pire qu'une exception.
    for (const historique of ETAPES_HISTORIQUES) {
      expect(() => composerTampon({ ...socle, etape: historique }))
        .toThrow(/n'est plus produite/);
    }
  });
});

describe('Tampon apposé par intérim (besoin 6)', () => {
  const socle = {
    base_numero: '201',
    base_code: 'BA201',
    signataire_nom: 'ABENA',
    signataire_prenom: 'Paul',
    signataire_grade: 'LTN',
  };

  it('porte le nom et le grade du titulaire empêché', () => {
    const t = composerTampon({
      ...socle,
      etape: EtapeValidation.COMESO,
      par_interim: true,
      titulaire_nom: 'MBALLA',
      titulaire_grade: 'CDT',
    });

    expect(t.par_interim).toBe(true);
    expect(t.titulaire_nom).toBe('MBALLA');
    expect(t.titulaire_grade).toBe('CDT');
    // Le signataire reste celui qui a signé : l'intérim qualifie la signature,
    // il ne la substitue pas.
    expect(t.signataire_nom).toBe('ABENA');
    expect(t.tampon_ligne1).toBe('COMESO 201');
  });

  it('refuse un intérim sans titulaire nommé', () => {
    // Un tampon « P/I » sans nom de titulaire n'apprend rien : on saurait
    // qu'il y a eu délégation, pas de quel poste. Autant refuser.
    expect(() => composerTampon({
      ...socle, etape: EtapeValidation.COMESO, par_interim: true,
    })).toThrow(/titulaire/i);
  });

  it("n'inscrit aucun titulaire quand il n'y a pas d'intérim", () => {
    // Garantit qu'un titulaire passé par erreur ne pollue pas un tampon
    // ordinaire — cas réel lors d'une resoumission après révocation.
    const t = composerTampon({
      ...socle, etape: EtapeValidation.COMESO,
      par_interim: false, titulaire_nom: 'MBALLA', titulaire_grade: 'CDT',
    });
    expect(t.par_interim).toBe(false);
    expect(t.titulaire_nom).toBeUndefined();
    expect(t.titulaire_grade).toBeUndefined();
  });

  it('expose une mention P/I courte, imprimable dans un tampon circulaire', () => {
    // Le SVG du tampon dispose d'environ 3 caractères à gauche de la mention.
    expect(MENTION_INTERIM).toBe('P/I');
    expect(MENTION_INTERIM.length).toBeLessThanOrEqual(4);
  });
});