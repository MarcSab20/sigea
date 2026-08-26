-- ═══════════════════════════════════════════════════════════════════════════
-- SIGVEA — Numéro de contrôle derrière le code QR (besoin 7)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── Pourquoi cette migration existe ──
-- `NumeroControleService` (apps/pdf-service) appelle `prisma.numeroControle`
-- sur cinq méthodes. Ce modèle n'existe NI dans schema.prisma NI en base : le
-- client Prisma généré ne l'expose pas, et le service ne compile pas.
-- Le code de la fonctionnalité était écrit ; sa table n'a jamais été créée.
--
-- ⚠ Ajoutez d'abord le modèle correspondant à prisma/schema.prisma
--   (voir docs/schema-numero-controle.prisma dans cette livraison), puis
--   `npx prisma generate`. Sans cela, le client Prisma ignorera la table même
--   une fois celle-ci créée.
--
-- ── Ce que la table protège ──
-- Le QR imprimé sur le manifeste porte l'identifiant et l'empreinte du
-- document. Il permet de vérifier qu'un document est authentique, mais pas
-- qu'il est L'EXEMPLAIRE légitime : quiconque photographie un manifeste valide
-- peut réimprimer un QR parfaitement vérifiable.
--
-- Le numéro de contrôle ferme cette porte. Il est tiré aléatoirement à la
-- génération, imprimé en clair sous le code, et n'est JAMAIS renvoyé par
-- l'endpoint public de vérification : celui-ci se contente d'annoncer
-- « concordant » ou « discordant » pour un numéro qu'on lui présente.
-- Seul l'administrateur peut le révéler (GET /api/pdf/controle/manifeste/:id).
--
-- ── Trois représentations, trois usages ──
--   • `code_hash`    : HMAC du numéro. Sert à la recherche inverse en une
--                      lecture indexée, sans jamais stocker le clair en clair.
--                      UNIQUE — c'est la clé de recherche.
--   • `code_chiffre` : le numéro chiffré (CemaaCryptoService). Seul chemin
--                      permettant de RE-AFFICHER le numéro à l'administrateur.
--                      Une empreinte seule ne serait pas réversible.
--   • `suffixe`      : les 4 derniers caractères, en clair. Sert au masque
--                      affiché publiquement (« •••• ••• 4B7C ») : assez pour
--                      qu'un contrôleur compare de visu, trop peu pour
--                      reconstituer le numéro (75 bits d'entropie restants).
--
-- Stocker les trois n'est pas une redondance : chacune répond à une question
-- que les deux autres ne peuvent pas traiter.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "NumeroControle" (
    "id"                    TEXT NOT NULL,
    "manifeste_id"          TEXT NOT NULL,
    "code_hash"             TEXT NOT NULL,
    "code_chiffre"          TEXT NOT NULL,
    "suffixe"               TEXT NOT NULL,
    "genere_etape"          TEXT,
    "genere_le"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nb_verifications"      INTEGER NOT NULL DEFAULT 0,
    "derniere_verification" TIMESTAMP(3),
    CONSTRAINT "NumeroControle_pkey" PRIMARY KEY ("id")
);

-- Un manifeste porte AU PLUS un numéro. La contrainte est ce qui rend la
-- course concurrente inoffensive : deux impressions simultanées tentent
-- l'insertion, l'une gagne, l'autre attrape le P2002 et relit la gagnante
-- (voir le catch dans NumeroControleService.obtenir). Sans cet index unique,
-- un manifeste pourrait porter deux numéros valides — et le contrôleur au sol
-- verrait « discordant » sur un document authentique.
CREATE UNIQUE INDEX IF NOT EXISTS "NumeroControle_manifeste_id_key"
  ON "NumeroControle"("manifeste_id");

-- Clé de la recherche inverse : « à quel manifeste appartient ce numéro ? ».
-- Unique aussi : deux manifestes portant le même numéro rendraient la réponse
-- ambiguë au moment précis où elle doit être catégorique.
CREATE UNIQUE INDEX IF NOT EXISTS "NumeroControle_code_hash_key"
  ON "NumeroControle"("code_hash");

DO $$ BEGIN
  ALTER TABLE "NumeroControle"
    ADD CONSTRAINT "NumeroControle_manifeste_id_fkey" FOREIGN KEY ("manifeste_id")
    REFERENCES "Manifeste"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Immuabilité du numéro ─────────────────────────────────────────────────
--
-- Seuls les deux compteurs de vérification peuvent bouger. Le numéro lui-même,
-- son empreinte et son chiffré sont figés à l'émission : les réécrire
-- permettrait d'aligner après coup un numéro sur un document substitué, ce qui
-- viderait le dispositif de tout son sens.
CREATE OR REPLACE FUNCTION trg_numero_controle_immuable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."manifeste_id" IS DISTINCT FROM OLD."manifeste_id"
  OR NEW."code_hash"    IS DISTINCT FROM OLD."code_hash"
  OR NEW."code_chiffre" IS DISTINCT FROM OLD."code_chiffre"
  OR NEW."suffixe"      IS DISTINCT FROM OLD."suffixe"
  OR NEW."genere_le"    IS DISTINCT FROM OLD."genere_le" THEN
    RAISE EXCEPTION
      'NumeroControle : le numéro est figé à l''émission (manifeste %)', OLD."manifeste_id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_numero_controle_immuable ON "NumeroControle";
CREATE TRIGGER trg_numero_controle_immuable
  BEFORE UPDATE ON "NumeroControle"
  FOR EACH ROW EXECUTE FUNCTION trg_numero_controle_immuable();