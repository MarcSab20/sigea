// libs/shared-types/src/circuit-liste.spec.ts
//
// Ces tests portent sur la seule arithmétique de SIGEA dont une erreur produit
// un surplus physique à bord. Le reste du système peut être rattrapé par un
// humain ; un siège vendu deux fois se découvre sur le tarmac.

import {
  occupationTroncons, disponibiliteAuPoint, repartirParPriorite,
  ETAPE_LISTE_SEQUENCE, etapeListeSuivante, etapeListePrecedente,
  rangEtapeListe, estEtapeListeFinale, voitListeAttente, peutDiscriminer,
  MENTION_PAR_ETAPE, ETAPE_LISTE_TO_ROLE, ROLE_TO_ETAPE_LISTE,
  type LigneOccupante, type FretOccupant,
} from './circuit-liste';
import {
  EtapeListe, MentionVisa, NatureLigne, Priorite, RoleUtilisateur,
} from './enums';

/** Fabrique courte : seuls les champs du calcul comptent. */
function pax(emb: number, deb: number, masse = 0, nature = NatureLigne.HIERARCHISEE): LigneOccupante {
  return { nature, embarquement_ordre: emb, debarquement_ordre: deb, masse_bagages_kg: masse };
}
function fret(emb: number, deb: number, poids: number, retire = false): FretOccupant {
  return { retire, embarquement_ordre: emb, debarquement_ordre: deb, poids_kg: poids };
}

const CAPACITE = { places: 20, masse_kg: 1000 };

describe('occupationTroncons — itinéraire de la directive', () => {
  // Yaoundé(1) → Douala(2) → Garoua(3) → Douala(4) → Yaoundé(5)
  const NB_POINTS = 5;

  it("compte un passager de transit sur CHAQUE tronçon qu'il occupe", () => {
    // Le cas exact de la directive : inscrit à Yaoundé, débarque à Garoua.
    // Il ne figure sur aucune liste de Douala, mais il y occupe un siège.
    const t = occupationTroncons([pax(1, 3)], [], NB_POINTS, CAPACITE);

    expect(t).toHaveLength(4);
    expect(t[0]).toMatchObject({ ordre: 1, places_occupees: 1 }); // Yaoundé → Douala
    expect(t[1]).toMatchObject({ ordre: 2, places_occupees: 1 }); // Douala  → Garoua
    expect(t[2]).toMatchObject({ ordre: 3, places_occupees: 0 }); // Garoua  → Douala
    expect(t[3]).toMatchObject({ ordre: 4, places_occupees: 0 }); // Douala  → Yaoundé
  });

  it("n'occupe pas le tronçon de débarquement", () => {
    // Borne haute EXCLUE : un passager qui descend au point 2 libère son siège
    // pour le tronçon 2→3. L'inclure ferait perdre une place par passager.
    const t = occupationTroncons([pax(1, 2)], [], NB_POINTS, CAPACITE);
    expect(t[0].places_occupees).toBe(1);
    expect(t[1].places_occupees).toBe(0);
  });

  it('additionne les passagers de plusieurs listes sur un même tronçon', () => {
    const t = occupationTroncons(
      [pax(1, 3), pax(1, 5), pax(2, 3)], [], NB_POINTS, CAPACITE,
    );
    // Tronçon Douala→Garoua : les deux de Yaoundé encore à bord + celui de Douala.
    expect(t[1].places_occupees).toBe(3);
  });

  it('ignore la liste d\'attente et les lignes retirées', () => {
    const t = occupationTroncons(
      [
        pax(1, 5),
        pax(1, 5, 0, NatureLigne.ATTENTE),
        pax(1, 5, 0, NatureLigne.RETIREE),
      ],
      [], NB_POINTS, CAPACITE,
    );
    expect(t[0].places_occupees).toBe(1);
  });

  it('cumule la masse des bagages et du fret, et ignore le fret retiré', () => {
    const t = occupationTroncons(
      [pax(1, 3, 25.5)],
      [fret(1, 3, 120), fret(1, 3, 500, true)],
      NB_POINTS, CAPACITE,
    );
    expect(t[0].masse_occupee_kg).toBe(145.5);
    expect(t[0].masse_restante_kg).toBe(854.5);
  });

  it('signale la sur-réservation par un reste négatif', () => {
    // Vingt et un passagers pour vingt places : l'imposition d'une autorité
    // centrale peut produire cet état, et il doit être VISIBLE, pas refusé
    // silencieusement.
    const lignes = Array.from({ length: 21 }, () => pax(1, 5));
    const t = occupationTroncons(lignes, [], NB_POINTS, CAPACITE);
    expect(t[0].places_restantes).toBe(-1);
  });

  it('ne produit aucun tronçon pour un itinéraire dégénéré', () => {
    expect(occupationTroncons([], [], 1, CAPACITE)).toHaveLength(0);
    expect(occupationTroncons([], [], 0, CAPACITE)).toHaveLength(0);
  });
});

describe('disponibiliteAuPoint — le plus bas des deux plafonds', () => {
  it("retient le quota quand l'aéronef est plus large", () => {
    const d = disponibiliteAuPoint(
      { places: 5, masse_kg: 200 },
      { places: 2, masse_kg: 50 },
      { ordre: 1, places_occupees: 2, masse_occupee_kg: 50,
        capacite_places: 20, capacite_masse_kg: 1000,
        places_restantes: 18, masse_restante_kg: 950 },
    );
    expect(d).toEqual({ places: 3, masse_kg: 150, facteur_limitant: 'QUOTA' });
  });

  it("retient l'aéronef quand le transit a mangé les sièges", () => {
    // Le cas de Douala : 20 places allouées par le SCOPS, mais 18 passagers de
    // Yaoundé restent à bord. Le quota ne vaut alors rien.
    const d = disponibiliteAuPoint(
      { places: 20, masse_kg: 500 },
      { places: 0, masse_kg: 0 },
      { ordre: 2, places_occupees: 18, masse_occupee_kg: 400,
        capacite_places: 20, capacite_masse_kg: 1000,
        places_restantes: 2, masse_restante_kg: 600 },
    );
    expect(d.places).toBe(2);
    expect(d.facteur_limitant).toBe('AERONEF');
  });

  it('retombe sur le seul quota en l\'absence de tronçon', () => {
    const d = disponibiliteAuPoint(
      { places: 4, masse_kg: 100 }, { places: 1, masse_kg: 10 }, undefined,
    );
    expect(d).toEqual({ places: 3, masse_kg: 90, facteur_limitant: 'QUOTA' });
  });
});

describe('repartirParPriorite', () => {
  it('produit TOUJOURS six tableaux, même vides', () => {
    // Un tableau absent se lit comme un oubli de l'opérateur, un tableau vide
    // comme une absence de candidat. La différence compte devant une autorité.
    const t = repartirParPriorite([]);
    expect(t).toHaveLength(6);
    expect(t.map((x) => x.priorite)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
    expect(t.every((x) => x.lignes.length === 0)).toBe(true);
  });

  it('trie chaque tableau par rang croissant', () => {
    const lignes = [
      { priorite: Priorite.P2, rang: 3, id: 'c' },
      { priorite: Priorite.P2, rang: 1, id: 'a' },
      { priorite: Priorite.P1, rang: 2, id: 'x' },
      { priorite: Priorite.P2, rang: 2, id: 'b' },
    ];
    const t = repartirParPriorite(lignes);
    expect(t[0].lignes.map((l) => l.id)).toEqual(['x']);
    expect(t[1].lignes.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('séquence du circuit', () => {
  it('suit exactement l\'ordre de la directive', () => {
    expect([...ETAPE_LISTE_SEQUENCE]).toEqual([
      EtapeListe.SEC_ADJ_AIR, EtapeListe.ADJ_AIR,
      EtapeListe.COMRMIA, EtapeListe.COMBASE, EtapeListe.COMBORD,
    ]);
  });

  it('enchaîne et remonte correctement', () => {
    expect(etapeListeSuivante(EtapeListe.SEC_ADJ_AIR)).toBe(EtapeListe.ADJ_AIR);
    expect(etapeListeSuivante(EtapeListe.COMBORD)).toBeNull();
    expect(etapeListePrecedente(EtapeListe.SEC_ADJ_AIR)).toBeNull();
    expect(etapeListePrecedente(EtapeListe.COMBASE)).toBe(EtapeListe.COMRMIA);
    expect(rangEtapeListe(EtapeListe.COMRMIA)).toBe(3);
    expect(estEtapeListeFinale(EtapeListe.COMBORD)).toBe(true);
  });

  it('attribue la bonne mention à chaque étape', () => {
    expect(MENTION_PAR_ETAPE[EtapeListe.SEC_ADJ_AIR]).toBe(MentionVisa.VU);
    expect(MENTION_PAR_ETAPE[EtapeListe.ADJ_AIR]).toBe(MentionVisa.VU);
    expect(MENTION_PAR_ETAPE[EtapeListe.COMRMIA]).toBe(MentionVisa.SIGNATURE);
    expect(MENTION_PAR_ETAPE[EtapeListe.COMBASE]).toBe(MentionVisa.ACCORD);
    expect(MENTION_PAR_ETAPE[EtapeListe.COMBORD]).toBe(MentionVisa.VISA);
  });

  it('le secrétaire constitue mais ne discrimine pas', () => {
    expect(peutDiscriminer(EtapeListe.SEC_ADJ_AIR)).toBe(false);
    expect(peutDiscriminer(EtapeListe.ADJ_AIR)).toBe(true);
    expect(peutDiscriminer(EtapeListe.COMBORD)).toBe(true);
  });

  it('le commandant de bord ne voit pas la liste d\'attente', () => {
    expect(voitListeAttente(EtapeListe.COMBASE)).toBe(true);
    expect(voitListeAttente(EtapeListe.COMBORD)).toBe(false);
  });

  it('la correspondance rôle ⇄ étape est bijective', () => {
    for (const etape of ETAPE_LISTE_SEQUENCE) {
      const role = ETAPE_LISTE_TO_ROLE[etape];
      expect(ROLE_TO_ETAPE_LISTE[role]).toBe(etape);
    }
  });

  it("n'accorde aucune étape aux rôles hors circuit", () => {
    // C'est le mécanisme même de l'exclusion : `undefined` fait échouer la
    // machine à états, sans règle supplémentaire à écrire.
    expect(ROLE_TO_ETAPE_LISTE[RoleUtilisateur.SCOPS]).toBeUndefined();
    expect(ROLE_TO_ETAPE_LISTE[RoleUtilisateur.CEMAA]).toBeUndefined();
  });
});