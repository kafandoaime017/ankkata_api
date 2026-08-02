# Déploiement de l'API Ankkata sur un VPS

Ce guide part d'un VPS Linux tout neuf (Ubuntu 22.04/24.04 — adaptez les
commandes `apt` si vous utilisez une autre distribution) et vous amène à une
API accessible publiquement, avec ou sans nom de domaine.

Deux modes possibles :

- **Mode production (recommandé)** — vous avez un nom de domaine pointé vers
  le VPS → HTTPS automatique via Caddy/Let's Encrypt.
- **Mode simple (test rapide)** — pas de domaine, juste l'IP du VPS → HTTP en
  clair. Suffisant pour "compiler le client et tester sur un autre PC", mais
  à ne pas garder en usage réel (mots de passe et jetons JWT circulent en
  clair).

Vous pouvez commencer en mode simple pour votre test, puis basculer en mode
production plus tard sans tout refaire.

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

Ouvrez le pare-feu pour le web (et gardez le port SSH ouvert) :

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
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
- `DB_PASSWORD` — un mot de passe fort, différent de la valeur de dev.
- `LATEST_APP_VERSION` — laissez `1.0.0` pour l'instant (voir §6 pour la
  suite).

`CORS_ORIGIN=*` peut rester tel quel : le client est une app Windows native
(pas un navigateur), CORS ne s'applique pas à ce trafic.

**Mode production uniquement** : renseignez aussi `ANKKATA_DOMAIN=votre-domaine.com`.
**Mode simple** : laissez `ANKKATA_DOMAIN` vide, vous n'utiliserez pas Caddy (voir §4b).

## 4a. Démarrer — mode production (domaine + HTTPS)

```bash
docker compose --profile prod up -d --build
```

Cela démarre `db`, `api`, `adminer` (liés à `127.0.0.1` uniquement, donc pas
accessibles depuis l'extérieur) et `caddy` (ports 80/443, seul point d'entrée
public). Caddy obtient et renouvelle automatiquement le certificat Let's
Encrypt pour `ANKKATA_DOMAIN` au premier démarrage — comptez quelques
secondes.

Votre API est accessible sur `https://votre-domaine.com/api/v1`.

## 4b. Démarrer — mode simple (IP nue, sans HTTPS)

Pas de domaine ? Exposez directement le port de l'API le temps du test, sans
Caddy :

1. Ouvrez `docker-compose.yml`, repérez le service `api`, et remplacez
   temporairement la ligne du port :
   ```yaml
   ports:
     - "${PORT:-4000}:4000"   # au lieu de "127.0.0.1:${PORT:-4000}:4000"
   ```
2. Ouvrez le port dans le pare-feu :
   ```bash
   sudo ufw allow 4000/tcp
   ```
3. Démarrez sans le profil `prod` (pas besoin de Caddy) :
   ```bash
   docker compose up -d --build
   ```

Votre API est accessible sur `http://<IP-du-VPS>:4000/api/v1`. C'est cette
adresse que vous utiliserez pour compiler le client (voir
`ankata_guichet/CLIENT_BUILD.md`).

## 5. Vérifier que tout tourne

```bash
docker compose ps
docker compose logs -f api
```

Les migrations Sequelize s'exécutent automatiquement au démarrage du
conteneur `api` (voir `docker-entrypoint.sh`) — pas de commande manuelle à
lancer. Testez avec :

```bash
curl http://localhost:4000/health   # depuis le VPS lui-même
# ou, en mode production :
curl https://votre-domaine.com/health
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
docker compose --profile prod up -d --build   # ou sans --profile prod en mode simple
```

Les migrations s'appliquent automatiquement au redémarrage (idempotentes).

Chaque fois que vous compilez une nouvelle version du logiciel guichet (voir
`ankata_guichet/CLIENT_BUILD.md`), pensez à mettre à jour
`LATEST_APP_VERSION` dans `.env` sur le VPS pour qu'elle corresponde au
numéro de version compilé (`pubspec.yaml` → `version:`), puis
`docker compose up -d` pour appliquer. Les postes obsolètes recevront alors
l'alerte de mise à jour (voir Supervision des postes, écran Ankkata).

## 7. Accéder à Adminer (base de données) à distance

Adminer (`http://127.0.0.1:8080` sur le VPS) n'est jamais exposé
publiquement. Pour l'utiliser depuis votre PC, ouvrez un tunnel SSH :

```bash
ssh -L 8080:localhost:8080 utilisateur@votre-vps
```

Puis ouvrez `http://localhost:8080` dans votre navigateur local, serveur
`db`, utilisateur/mot de passe = ceux de `.env` sur le VPS.

## Récapitulatif des fichiers concernés

- `.env` (à créer depuis `.env.example`, jamais commité)
- `docker-compose.yml` (services db/api/adminer liés à 127.0.0.1 par défaut
  + service `caddy` optionnel via `--profile prod`)
- `Caddyfile` (reverse proxy + HTTPS auto — à adapter selon domaine/IP, voir
  les commentaires dans le fichier)
