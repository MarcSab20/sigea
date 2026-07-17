import {
  ETAPE_SEQUENCE, BLOCS_SIGNATURE, ROLE_TO_ETAPE, ETAPE_TO_ROLE,
  MENTION_TAMPON, composerTampon, etapeSuivante, rangEtape, estEtapeFinale,
} from './circuit';
import { EtapeValidation, MentionSignature, RoleUtilisateur } from './enums';

describe('Circuit de validation SIGEA', () => {
  describe('ordre des étapes', () => {
    it('suit le circuit métier CHEF_ESCALE → COMESO → COMGMO → COMBORD → COMBASE', () => {
      expect([...ETAPE_SEQUENCE]).toEqual([
        EtapeValidation.CHEF_ESCALE,
        EtapeValidation.COMESO,
        EtapeValidation.COMGMO,
        EtapeValidation.COMBORD,
        EtapeValidation.COMBASE,
      ]);
    });

    it("exclut CEMAA_SENSIBLE de la séquence : c'est un verrou, pas une étape", () => {
      expect(ETAPE_SEQUENCE).not.toContain(EtapeValidation.CEMAA_SENSIBLE);
    });

    it('imprime exactement 5 blocs de signature', () => {
      expect(BLOCS_SIGNATURE).toHaveLength(5);
    });
  });

  describe('composition des tampons', () => {
    const signataire = { signataire_nom: 'MBIDA', signataire_prenom: 'Paul', signataire_grade: 'LCL' };

    it('compose « TITRE + numéro de base » pour COMGMO', () => {
      const t = composerTampon({ etape: EtapeValidation.COMGMO, base_numero: '102', base_code: 'BA102', ...signataire });
      expect(t.mention).toBe(MentionSignature.VU);
      expect(t.tampon_ligne1).toBe('COMGMO 102');
      expect(t.tampon_ligne2).toBeUndefined();
    });

    it("compose « COMESCALE + numéro » pour le chef d'escale", () => {
      const t = composerTampon({ etape: EtapeValidation.CHEF_ESCALE, base_numero: '201', base_code: 'BA201', ...signataire });
      expect(t.tampon_ligne1).toBe('COMESCALE 201');
    });

    it('compose « nom + immatriculation » pour le COMBORD', () => {
      const t = composerTampon({
        etape: EtapeValidation.COMBORD, base_numero: '101', base_code: 'BA101',
        immatriculation: 'TJ-AAF', ...signataire,
      });
      expect(t.tampon_ligne1).toBe('LCL MBIDA');
      expect(t.tampon_ligne2).toBe('TJ-AAF');
    });

    it('refuse un tampon COMBORD sans immatriculation', () => {
      expect(() => composerTampon({
        etape: EtapeValidation.COMBORD, base_numero: '101', base_code: 'BA101', ...signataire,
      })).toThrow(/immatriculation/i);
    });

    it('porte la mention ACCORD pour le COMBASE, VU pour tous les autres', () => {
      expect(MENTION_TAMPON[EtapeValidation.COMBASE]).toBe(MentionSignature.ACCORD);
      for (const e of [EtapeValidation.CHEF_ESCALE, EtapeValidation.COMESO,
                       EtapeValidation.COMGMO, EtapeValidation.COMBORD]) {
        expect(MENTION_TAMPON[e]).toBe(MentionSignature.VU);
      }
    });
  });

  describe('progression', () => {
    it('enchaîne COMGMO → COMBORD → COMBASE → fin', () => {
      expect(etapeSuivante(EtapeValidation.COMGMO)).toBe(EtapeValidation.COMBORD);
      expect(etapeSuivante(EtapeValidation.COMBORD)).toBe(EtapeValidation.COMBASE);
      expect(etapeSuivante(EtapeValidation.COMBASE)).toBeNull();
    });

    it('identifie COMBASE comme étape finale', () => {
      expect(estEtapeFinale(EtapeValidation.COMBASE)).toBe(true);
      expect(estEtapeFinale(EtapeValidation.COMBORD)).toBe(false);
    });

    it('rend un rang nul pour une étape hors séquence', () => {
      expect(rangEtape(EtapeValidation.COMBORD)).toBe(4);
      expect(rangEtape(EtapeValidation.CEMAA_SENSIBLE)).toBe(0);
    });
  });

  describe('correspondance rôle ⇄ étape', () => {
    it('est bijective sur les 5 blocs', () => {
      for (const e of BLOCS_SIGNATURE) {
        const role = ETAPE_TO_ROLE[e] as RoleUtilisateur;
        expect(ROLE_TO_ETAPE[role]).toBe(e);
      }
    });
  });
});