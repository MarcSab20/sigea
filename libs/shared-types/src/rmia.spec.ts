// libs/shared-types/src/rmia.spec.ts
//
// Le découpage RMIA porte le cloisonnement. Une erreur ici ne provoque pas un
// écran cassé : elle donne à un officier d'une région l'accès aux listes d'une
// autre. Ces tests valent donc d'être lus autant qu'exécutés.

import {
  rmiaDeRegion, rmiaDeRegionStrict, normaliserRegion, perimetreDeRole,
  exigeRmia, titreSignataire, Perimetre, REGIONS_PAR_RMIA, RMIA_ORDONNEES,
} from './rmia';
import { Rmia, RoleUtilisateur } from './enums';

describe('normaliserRegion', () => {
  it('neutralise accents, casse et variantes de séparateur', () => {
    // Les trois formes arrivent effectivement dans les imports de référentiel.
    expect(normaliserRegion('Extrême-Nord')).toBe('extreme-nord');
    expect(normaliserRegion('EXTREME NORD')).toBe('extreme-nord');
    expect(normaliserRegion('  extreme   nord  ')).toBe('extreme-nord');
  });

  it('traite le tiret insécable comme un tiret ordinaire', () => {
    // U+2011 : copié-collé depuis un document Word, invisible à l'œil.
    expect(normaliserRegion('Sud\u2011Ouest')).toBe('sud-ouest');
  });
});

describe('rmiaDeRegion — découpage des cinq régions', () => {
  const attendu: Array<[string, Rmia]> = [
    ['Centre', Rmia.RMIA_1], ['Sud', Rmia.RMIA_1], ['Est', Rmia.RMIA_1],
    ['Littoral', Rmia.RMIA_2], ['Sud-Ouest', Rmia.RMIA_2],
    ['Nord', Rmia.RMIA_3], ['Adamaoua', Rmia.RMIA_3],
    ['Extrême-Nord', Rmia.RMIA_4],
    ['Ouest', Rmia.RMIA_5], ['Nord-Ouest', Rmia.RMIA_5],
  ];

  it.each(attendu)('rattache %s à %s', (region, rmia) => {
    expect(rmiaDeRegion(region)).toBe(rmia);
  });

  it('couvre les dix régions administratives, sans doublon', () => {
    const toutes = RMIA_ORDONNEES.flatMap((r) => REGIONS_PAR_RMIA[r]);
    expect(toutes).toHaveLength(10);
    expect(new Set(toutes).size).toBe(10);
  });

  it('ne confond pas « Nord », « Nord-Ouest » et « Extrême-Nord »', () => {
    // Trois régions, trois RMIA différentes, et des libellés qui se contiennent
    // l'un l'autre : une comparaison par `includes` donnerait ici trois fois la
    // même réponse.
    expect(rmiaDeRegion('Nord')).toBe(Rmia.RMIA_3);
    expect(rmiaDeRegion('Nord-Ouest')).toBe(Rmia.RMIA_5);
    expect(rmiaDeRegion('Extrême-Nord')).toBe(Rmia.RMIA_4);
  });

  it('renvoie null pour une région inconnue, et lève en mode strict', () => {
    expect(rmiaDeRegion('Kousséri')).toBeNull();
    expect(() => rmiaDeRegionStrict('Kousséri')).toThrow(/hors du découpage RMIA/);
  });
});

describe('perimetreDeRole', () => {
  it('classe la chaîne RMIA au périmètre régional', () => {
    for (const r of [RoleUtilisateur.COMRMIA, RoleUtilisateur.ADJ_AIR, RoleUtilisateur.SEC_ADJ_AIR]) {
      expect(perimetreDeRole(r)).toBe(Perimetre.RMIA);
      expect(exigeRmia(r)).toBe(true);
    }
  });

  it('classe SCOPS, CEMAA, MAGE et ADMIN au périmètre national', () => {
    for (const r of [RoleUtilisateur.SCOPS, RoleUtilisateur.CEMAA,
                     RoleUtilisateur.MAGE, RoleUtilisateur.ADMIN]) {
      expect(perimetreDeRole(r)).toBe(Perimetre.NATIONAL);
      expect(exigeRmia(r)).toBe(false);
    }
  });

  it('laisse tous les autres rôles au périmètre de leur base', () => {
    for (const r of [RoleUtilisateur.COMBASE, RoleUtilisateur.COMEA,
                     RoleUtilisateur.COMGMO, RoleUtilisateur.COMSECBASE,
                     RoleUtilisateur.COMBORD]) {
      expect(perimetreDeRole(r)).toBe(Perimetre.BASE);
    }
  });
});

describe('titreSignataire', () => {
  it('nomme la RMIA pour la chaîne régionale', () => {
    expect(titreSignataire(RoleUtilisateur.ADJ_AIR, { rmia: Rmia.RMIA_2 }))
      .toBe('ADJOINT AIR / RMIA 2');
    expect(titreSignataire(RoleUtilisateur.COMRMIA, { rmia: Rmia.RMIA_4 }))
      .toBe('COMMANDANT RMIA 4');
  });

  it('nomme la base pour les rôles de base', () => {
    expect(titreSignataire(RoleUtilisateur.COMBASE, { code_base: 'BA101' }))
      .toBe('COMMANDANT DE BASE / BA101');
  });

  it('reste lisible quand le contexte manque', () => {
    // Un titre dégradé vaut mieux qu'un « undefined » imprimé sous une
    // signature numérique.
    expect(titreSignataire(RoleUtilisateur.COMBASE, {})).toBe('COMMANDANT DE BASE');
    expect(titreSignataire(RoleUtilisateur.COMBORD, {})).toBe('COMMANDANT DE BORD');
  });
});