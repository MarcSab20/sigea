#!/usr/bin/env bash
# Génération des clés RS256 pour JWT — NE JAMAIS COMMITTER CES FICHIERS
set -euo pipefail

mkdir -p keys
echo "🔑 Génération clés JWT RS256 4096 bits..."
openssl genrsa -out keys/jwt.private.key 4096
openssl rsa -in keys/jwt.private.key -pubout -out keys/jwt.public.key

echo "🔑 Génération clé de chiffrement CEMAA AES-256..."
CEMAA_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "CEMAA_ENCRYPTION_KEY=${CEMAA_KEY}" >> .env.local

echo "✅ Clés générées dans ./keys/"
echo "   ⚠️  Ne JAMAIS committer les fichiers .key"
