#!/bin/bash
set -e

echo "🛑 1. Arrêt de l'application (pour libérer les connexions à la BDD)..."
docker stop makemenage-prod-app-1 || true

echo "🔄 2. Renommage de la base de données et de l'utilisateur Postgres..."
# La base de données a déjà été renommée avec succès. On connecte en tant que superuser 'postgres' pour renommer l'utilisateur.
docker exec -u postgres makemenage-prod-db-1 psql -c "ALTER USER makemenage RENAME TO quotidy;" || true

echo "🛑 3. Arrêt complet de l'ancienne stack..."
docker compose --env-file .env.production -f docker-compose.prod.yml down || true

echo "📝 4. Mise à jour des configurations..."
# On remplace makemenage par quotidy dans les fichiers clés
sed -i 's/POSTGRES_DB=makemenage/POSTGRES_DB=quotidy/g' .env* || true
sed -i 's/POSTGRES_USER=makemenage/POSTGRES_USER=quotidy/g' .env* || true
sed -i 's/name: makemenage-prod/name: quotidy-prod/g' docker-compose.prod.yml || true
sed -i 's/POSTGRES_DB:-makemenage/POSTGRES_DB:-quotidy/g' docker-compose.prod.yml || true
sed -i 's/POSTGRES_USER:-makemenage/POSTGRES_USER:-quotidy/g' docker-compose.prod.yml || true
sed -i 's/"name": "makemenage"/"name": "quotidy"/g' package.json package-lock.json || true
sed -i 's/makemenage-stack/quotidy-stack/g' deploy/systemd/* || true
sed -i 's/makemenage-update/quotidy-update/g' deploy/systemd/* || true
sed -i 's/makemenage-prod/quotidy-prod/g' deploy/systemd/* || true
sed -i 's/makemenage/quotidy/g' scripts/server/deploy-if-head-changed.sh || true

echo "📂 5. Renommage des services Systemd..."
mv deploy/systemd/makemenage-stack.service deploy/systemd/quotidy-stack.service || true
mv deploy/systemd/makemenage-update.service deploy/systemd/quotidy-update.service || true
mv deploy/systemd/makemenage-update.timer deploy/systemd/quotidy-update.timer || true

echo "🚀 6. Redémarrage de la nouvelle stack Quotidy..."
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

echo "✅ Migration terminée ! Ton instance s'appelle maintenant Quotidy de bout en bout."
