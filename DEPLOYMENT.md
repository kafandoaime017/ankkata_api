# Déploiement de l'API Ankkata sur le VPS (31.97.55.208)

Déploiement ciblé sur ce VPS précis, avec exposition directe par port (pas
de nom de domaine, pas de HTTPS pour l'instant) :

| Service | Adresse publique                  |
|---------|------------------------------------|
| API     | `http://31.97.55.208:4002/api/v1`  |
| DB (Postgres) | `31.97.55.208:4003`          |
| Adminer | `http://31.97.55.208:4004`         |

Ces ports sont fixés dans `docker-compose.yml` (services `api`, `db`,
`adminer`). Le trafic circule en HTTP non chiffré : c'est acceptable pour un
test, mais **à ne pas garder en usage réel** — mots de passe et jetons JWT
circuleraient en clair sur le réseau. Un service Caddy (HTTPS automatique)
est déjà présent dans `docker-compose.yml`, inactif par défaut
(`profiles: [prod]`) — utile le jour où vous aurez un nom de domaine pointé
vers ce VPS.

**Le port 4003 expose PostgreSQL directement sur Internet.** Un
`DB_PASSWORD` fort dans `.env` est donc impératif — voir §3. Si possible,
restreignez ce port par IP source dans le pare-feu du VPS une fois vos
adresses de test connues.

## 1. Préparer le VPS

Connectez-vous en SSH, puis installez Docker :

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# déconnectez-vous / reconnectez-vous pour que le groupe prenne effet
```

Vérifiez :

```bash
docker --version
docker compose version
```

Ouvrez le pare-feu sur les trois ports utilisés (et gardez SSH ouvert) :

```bash
sudo ufw allow OpenSSH
sudo ufw allow 4002/tcp
sudo ufw allow 4003/tcp
sudo ufw allow 4004/tcp
sudo ufw enable
```

## 2. Récupérer le code

Depuis votre machine, poussez `ankkata_api` vers un dépôt Git (recommandé
pour les mises à jour futures), puis sur le VPS :

```bash
git clone <url-de-votre-dépôt> ankkata_api
cd ankkata_api
```

Si vous n'utilisez pas Git, `scp -r` le dossier `ankkata_api` (en excluant
`node_modules/`) directement vers le VPS.

## 3. Configurer les secrets (`.env`)

```bash
cp .env.example .env
```

Éditez `.env` et changez impérativement :

- `NODE_ENV=production`
- `JWT_SECRET` et `JWT_REFRESH_SECRET` — générez des valeurs aléatoires
  fortes, jamais les valeurs par défaut du dépôt :
  ```bash
  openssl rand -hex 32
  openssl rand -hex 32
  ```
- `DB_PASSWORD` — un mot de passe fort, différent de la valeur de dev (voir
  l'avertissement en tête de ce guide : ce port est public).
- `LATEST_APP_VERSION` — laissez `1.0.0` pour l'instant (voir §6 pour la
  suite).

`CORS_ORIGIN=*` peut rester tel quel : le client est une app Windows native
(pas un navigateur), CORS ne s'applique pas à ce trafic.

Laissez `ANKKATA_DOMAIN` vide — il ne sert que si vous activez un jour le
service `caddy` (non utilisé dans ce déploiement).

## 4. Démarrer

```bash
docker compose up -d --build
```

(pas besoin de `--profile prod` : le service `caddy` reste inactif, on
n'expose pas de domaine ici.)

Cela démarre `db` (port 4003), `api` (port 4002) et `adminer` (port 4004),
tous accessibles directement sur `31.97.55.208`.

## 5. Vérifier que tout tourne

```bash
docker compose ps
docker compose logs -f api
```

Les migrations Sequelize s'exécutent automatiquement au démarrage du
conteneur `api` (voir `docker-entrypoint.sh`) — pas de commande manuelle à
lancer. Testez avec :

```bash
curl http://localhost:4002/health     # depuis le VPS lui-même
# ou, depuis n'importe où :
curl http://31.97.55.208:4002/health
```

(la route `/health` est à la racine, pas sous `/api/v1` — voir `src/app.js`.)

### Créer le premier compte pour se connecter

La base est vide au premier démarrage (le seed de démo est désactivé par
défaut dans `docker-entrypoint.sh`). Pour obtenir immédiatement un jeu de
comptes fonctionnels à utiliser (équipe Ankkata + une compagnie de
démonstration avec guichetiers), lancez le seed une fois :

```bash
docker compose exec api npx sequelize-cli db:seed:all
```

Il est protégé contre les doublons (il vérifie que les tables sont vides
avant d'insérer quoi que ce soit — relancer la commande ne fait rien de
plus). Comptes créés :

- **Ankkata** (`ankkata_admin`) : identifiant `aime.kabore`, mot de passe
  `Ankkata@2026`.
- **Compagnie de démo** (`ankata_guichet`, espace admin compagnie) : voir
  `src/seeders/20260101000100-demo-data.js` pour les identifiants exacts,
  mot de passe `Admin@2026`.
- **Guichetiers de démo** : PIN `123456`.

Changez ces mots de passe dès la première connexion si ce VPS doit rester en
usage réel — ils sont documentés en clair dans le code source du seeder.

## 6. Mettre à jour l'API plus tard

```bash
git pull
docker compose up -d --build
```

Les migrations s'appliquent automatiquement au redémarrage (idempotentes).

Chaque fois que vous compilez une nouvelle version du logiciel guichet (voir
`ankata_guichet/CLIENT_BUILD.md`), pensez à mettre à jour
`LATEST_APP_VERSION` dans `.env` sur le VPS pour qu'elle corresponde au
numéro de version compilé (`pubspec.yaml` → `version:`), puis
`docker compose up -d` pour appliquer. Les postes obsolètes recevront alors
l'alerte de mise à jour (voir Supervision des postes, écran Ankkata).

## 7. Accéder à Adminer (base de données)

Ouvrez `http://31.97.55.208:4004` dans un navigateur. Serveur : `db`.
Utilisateur/mot de passe : ceux de `DB_USER`/`DB_PASSWORD` dans `.env` sur le
VPS. Adminer étant public sur ce port, ne partagez pas cette adresse au-delà
de vos besoins de test.

## Récapitulatif des fichiers concernés

- `.env` (à créer depuis `.env.example`, jamais commité)
- `docker-compose.yml` (services `db`/`api`/`adminer` exposés directement
  sur `4003`/`4002`/`4004` + service `caddy` optionnel, inactif par défaut,
  via `--profile prod`)
- `Caddyfile` (reverse proxy + HTTPS auto — non utilisé dans ce déploiement,
  gardé pour une future migration vers un nom de domaine)
