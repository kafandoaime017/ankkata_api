// Point d'entrée du processus : vérifie la connexion à la base (avec
// nouvelles tentatives, utile le temps que le conteneur PostgreSQL soit
// tout à fait prêt même si docker-compose l'annonce "healthy"), puis
// démarre le serveur HTTP.
const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');

const MAX_TENTATIVES = 15;
const DELAI_ENTRE_TENTATIVES_MS = 2000;

function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connecterAvecReessai() {
  for (let tentative = 1; tentative <= MAX_TENTATIVES; tentative += 1) {
    try {
      await sequelize.authenticate();
      console.log('[db] Connexion PostgreSQL établie.');
      return;
    } catch (err) {
      console.warn(`[db] Tentative ${tentative}/${MAX_TENTATIVES} échouée (${err.message}). Nouvel essai dans ${DELAI_ENTRE_TENTATIVES_MS / 1000}s...`);
      await attendre(DELAI_ENTRE_TENTATIVES_MS);
    }
  }
  throw new Error('Impossible de se connecter à PostgreSQL après plusieurs tentatives.');
}

async function demarrer() {
  await connecterAvecReessai();
  app.listen(env.port, () => {
    console.log(`[server] API Ankkata démarrée sur le port ${env.port} (préfixe ${env.apiPrefix}), environnement "${env.env}".`);
  });
}

demarrer().catch((err) => {
  console.error('[server] Échec du démarrage :', err);
  process.exit(1);
});
