#!/usr/bin/env bash
# Script d'installation développement complet SIGEA
set -euo pipefail

echo "╔══════════════════════════════════════════════════════╗"
echo "║        SIGEA — Installation environnement DEV        ║"
echo "╚══════════════════════════════════════════════════════╝"

# 1. Vérifications prérequis
echo "📋 Vérification des prérequis..."
command -v node  >/dev/null || { echo "❌ Node.js 20+ requis"; exit 1; }
command -v npm   >/dev/null || { echo "❌ npm requis"; exit 1; }
command -v docker >/dev/null || { echo "❌ Docker requis"; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then echo "❌ Node.js 20+ requis (actuel: v${NODE_VERSION})"; exit 1; fi
echo "✅ Node.js $(node -v) — OK"

# 2. Copier .env si absent
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  .env créé depuis .env.example — MODIFIER LES SECRETS AVANT DÉMARRAGE"
fi

# 3. Installation des dépendances
echo "📦 Installation npm..."
npm install

# 4. Génération des clés JWT
if [ ! -f keys/jwt.private.key ]; then
  echo "🔑 Génération des clés JWT..."
  bash scripts/generate-keys.sh
fi

# 5. Démarrage de l'infrastructure Docker
echo "🐳 Démarrage de l'infrastructure (PostgreSQL, Redis, RabbitMQ)..."
docker compose -f docker/docker-compose.yml up -d postgres redis rabbitmq
echo "⏳ Attente de la santé des services (30s)..."
sleep 30

# 6. Migration Prisma
echo "🗃️  Migration de la base de données..."
npx prisma migrate dev --schema=prisma/schema.prisma --name init

# 7. Application RLS
echo "🔒 Application des politiques RLS PostgreSQL..."
docker compose -f docker/docker-compose.yml exec -T postgres \
  psql -U sigea_app -d sigea -f /dev/stdin < prisma/rls.sql || echo "⚠️  RLS — à appliquer manuellement si erreur"

# 8. Seed
echo "🌱 Initialisation des données de test..."
npx ts-node --project tsconfig.base.json prisma/seed.ts

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           ✅ Installation terminée !                 ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Démarrer les services : npm run dev                 ║"
echo "║  Prisma Studio        : npm run db:studio           ║"
echo "║  RabbitMQ UI          : http://localhost:15672       ║"
echo "║                        (sigea / RABBIT_PASSWORD)     ║"
echo "╚══════════════════════════════════════════════════════╝"
