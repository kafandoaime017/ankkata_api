#!/usr/bin/env bash
# ------------------------------------------------------------------
# Point d'entrée du conteneur API :
#   1. attend que PostgreSQL accepte les connexions,
#   2. applique les migrations Sequelize (idempotent),
#   3. exécute le seed de démonstration (idempotent — voir le seeder,
#      il vérifie que les tables sont vides avant d'insérer quoi que
#      ce soit, donc redémarrer le conteneur ne duplique jamais les
#      données),
#   4. démarre le serveur (ou la commande passée en CMD/`docker compose run`).
# ------------------------------------------------------------------
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "[entrypoint] En attente de PostgreSQL sur ${DB_HOST}:${DB_PORT}..."
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  sleep 1
done
echo "[entrypoint] PostgreSQL est prêt."

echo "[entrypoint] Application des migrations..."
npx sequelize-cli db:migrate

# echo "[entrypoint] Exécution du seed de démonstration (ignoré si déjà en place)..."
# npx sequelize-cli db:seed:all

echo "[entrypoint] Démarrage : $*"
exec "$@"
