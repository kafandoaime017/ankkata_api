# Déploiement de l'API Ankkata sur le VPS (31.97.55.208)

| Service | Adresse                                                      |
|---------|---------------------------------------------------------------|
| API     | `http://31.97.55.208:4002/api/v1` (public — voir §8, HTTP non chiffré pour l'instant) |
| DB (Postgres) | `127.0.0.1:4003` — accessible uniquement DEPUIS le VPS (plus depuis Internet) |
| Adminer | `http://127.0.0.1:4004` — accessible uniquement DEPUIS le VPS (via tunnel SSH, voir §7) |
| Caddy (HTTPS) | `https://<votre-domaine>` une fois configuré — voir §8 |

Ces ports sont fixés dans `docker-compose.yml`. **DB et Adminer ne sont plus
joignables depuis Internet** (liés à `127.0.0.1` dans le conteneur hôte) —
avant ce correctif, PostgreSQL et Adminer étaient exposés publiquement sur
4003/4004, ce qui les rendait directement attaquables depuis n'importe où.
Un `DB_PASSWORD` fort dans `.env` reste néanmoins impératif (défense en
profondeur) — voir §3.

**L'API (port 4002) reste en HTTP non chiffré pour l'instant** : mots de
passe et jetons JWT circulent en clair sur le réseau tant que vous n'avez
pas suivi §8 "Passer en HTTPS". Un service Caddy (HTTPS automatique via
Let's Encrypt) démarre désormais PAR DÉFAUT avec `docker compose up`, prêt à
prendre le relais dès qu'un nom de domaine est configuré.

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

Ouvrez le pare-feu sur les ports utilisés (et gardez SSH ouvert). **N'ouvrez
PAS 4003/4004** : DB et Adminer sont désormais liés à `127.0.0.1` dans
Docker, les ouvrir dans `ufw` ne les rendrait pas joignables depuis
Internet (Docker n'écoute que sur l'interface locale) mais n'a alors aucune
utilité :

```bash
sudo ufw allow OpenSSH
sudo ufw allow 4002/tcp   # API, HTTP direct — voir §8 pour passer en HTTPS
sudo ufw allow 80/tcp     # Caddy — HTTP (redirection + défi Let's Encrypt)
sudo ufw allow 443/tcp    # Caddy — HTTPS, une fois un domaine configuré (§8)
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
- `DB_PASSWORD` — un mot de passe fort, différent de la valeur de dev. Le
  port Postgres n'est plus public (voir en tête de ce guide), mais gardez un
  mot de passe fort en défense en profondeur.
- `LATEST_APP_VERSION` — laissez `1.0.0` pour l'instant (voir §6 pour la
  suite).

`CORS_ORIGIN=*` peut rester tel quel : le client est une app Windows native
(pas un navigateur), CORS ne s'applique pas à ce trafic.

Laissez `ANKKATA_DOMAIN` vide pour l'instant — le service `caddy` démarre
quand même (voir §4), mais sans domaine il n'a aucun effet utile. Vous le
renseignerez à l'étape §8 "Passer en HTTPS".

## 4. Démarrer

```bash
docker compose up -d --build
```

Cela démarre `db` (127.0.0.1:4003, local seulement), `api` (port 4002,
public — HTTP pour l'instant) et `adminer` (127.0.0.1:4004, local
seulement), ainsi que `caddy` (ports 80/443, public, démarre désormais par
défaut). Sans `ANKKATA_DOMAIN` configuré, Caddy sert en HTTP simple sur
`localhost` et n'a aucun effet utile tant que vous n'avez pas suivi §8 —
vous pouvez l'ignorer jusque-là, il ne gêne pas le fonctionnement de l'API
sur son port direct 4002.

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
défaut dans `docker-entrypoint.sh`). Il n'existe pas de route
d'inscription publique — `POST /comptes-ankkata` exige déjà d'être connecté
en tant que direction générale (voir `routes/compteAnkkata.routes.js`), donc
impossible de créer le tout premier compte via l'API ou l'app. Deux options :

**Option A — un seul compte propre (recommandé pour un vrai déploiement)**

Un script dédié crée exactement un compte, sans aucune donnée de
démonstration :

```bash
docker compose exec api node scripts/creer-compte-ankkata.js \
  --code AK-0001 \
  --nom "Aimé Kaboré" \
  --identifiant aime.kabore \
  --mot-de-passe "ChoisissezUnMotDePasseFort"
```

Idempotent (relancer avec le même `--identifiant` ne crée pas de doublon,
il vous le signale). C'est ce compte que vous utiliserez pour vous connecter
sur `ankkata_admin`, puis créer vos propres compagnies/comptes depuis l'app
elle-même (l'app permet de tout gérer une fois connecté).

**Option B — jeu de données de démonstration complet (pour tester vite)**

```bash
docker compose exec api npx sequelize-cli db:seed:all
```

Crée en une fois l'équipe Ankkata (`aime.kabore` / `Ankkata@2026`) **et**
une compagnie de démonstration avec guichetiers (mot de passe `Admin@2026`,
PIN guichetier `123456` — voir `src/seeders/20260101000100-demo-data.js`
pour le détail). Protégé contre les doublons (vérifie que les tables sont
vides avant d'insérer). Pratique pour un test rapide de bout en bout, mais
laisse des comptes/compagnies fictifs dans la base — changez ces mots de
passe (ou repartez de l'option A) si ce VPS doit rester en usage réel.

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

Adminer n'est plus exposé publiquement (voir en tête de ce guide) : il est
lié à `127.0.0.1:4004` sur le VPS, donc injoignable directement depuis votre
navigateur. Ouvrez un tunnel SSH depuis votre machine :

```bash
ssh -L 4004:localhost:4004 <utilisateur>@31.97.55.208
```

Laissez ce terminal ouvert, puis dans votre navigateur : `http://localhost:4004`.
Serveur : `db`. Utilisateur/mot de passe : ceux de `DB_USER`/`DB_PASSWORD`
dans `.env` sur le VPS. Fermez le tunnel (Ctrl+C) une fois terminé.

## 8. Passer en HTTPS

Tant que cette section n'est pas appliquée, l'API reste joignable en HTTP
simple sur le port 4002 (mots de passe et jetons JWT en clair sur le
réseau). Le service `caddy` (HTTPS automatique via Let's Encrypt) est déjà
démarré par défaut depuis l'étape 4 — il ne lui manque qu'un nom de domaine
pour émettre un certificat (Let's Encrypt ne peut pas certifier une adresse
IP nue).

**Étapes :**

1. **Pointez un nom de domaine vers le VPS.** Chez votre registrar/DNS,
   créez un enregistrement A : `api.votredomaine.com` → `31.97.55.208`.
   Attendez la propagation (`dig api.votredomaine.com` doit renvoyer cette IP).

2. **Configurez `ANKKATA_DOMAIN` dans `.env` sur le VPS :**
   ```bash
   ANKKATA_DOMAIN=api.votredomaine.com
   ```

3. **Redéployez :**
   ```bash
   docker compose up -d --build
   docker compose logs -f caddy
   ```
   Caddy doit afficher l'obtention du certificat Let's Encrypt (quelques
   secondes à quelques minutes). En cas d'échec, vérifiez que les ports
   80/tcp et 443/tcp sont bien ouverts dans `ufw` (voir §1) et que le DNS a
   bien propagé.

4. **Vérifiez :**
   ```bash
   curl https://api.votredomaine.com/health
   ```

5. **Reconstruisez et redéployez tous les postes guichet** avec la nouvelle
   URL HTTPS (voir `ankata_guichet/CLIENT_BUILD.md`) :
   ```
   --dart-define=API_BASE_URL=https://api.votredomaine.com/api/v1
   ```
   Tant qu'un seul poste guichet pointe encore sur l'ancienne URL HTTP, ne
   passez pas à l'étape 6 — ce poste perdrait tout accès à l'API.

6. **Une fois tous les postes migrés et vérifiés**, fermez l'accès HTTP
   direct en revenant sur le port de l'API dans `docker-compose.yml` :
   ```yaml
   - "127.0.0.1:4002:4000"
   ```
   puis `docker compose up -d`, et retirez `4002/tcp` de `ufw` (§1). Seul
   `caddy` (HTTPS) restera alors joignable depuis Internet.

## Récapitulatif des fichiers concernés

- `.env` (à créer depuis `.env.example`, jamais commité ; y ajouter
  `ANKKATA_DOMAIN` lors du passage en HTTPS, voir §8)
- `docker-compose.yml` (`db` et `adminer` liés à `127.0.0.1` uniquement ;
  `api` public sur `4002` en HTTP en attendant §8 ; `caddy` démarre
  désormais par défaut sur `80`/`443`, plus de `--profile prod`)
- `Caddyfile` (reverse proxy + HTTPS auto — actif dès qu'`ANKKATA_DOMAIN`
  est configuré, voir §8)
- `scripts/creer-compte-ankkata.js` (créer un premier compte Ankkata propre,
  voir §5)
