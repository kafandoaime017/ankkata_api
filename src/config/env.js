// Point d'accès unique aux variables d'environnement — tout le reste du
// code lit la config à travers ce module plutôt que `process.env`
// directement, pour centraliser les valeurs par défaut et éviter les
// fautes de frappe de noms de variables dispersées dans tout le projet.
require('dotenv').config();

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  port: parseInt(process.env.PORT, 10) || 4000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'ankkata',
    user: process.env.DB_USER || 'ankkata',
    password: process.env.DB_PASSWORD || 'ankkata_secret',
    ssl: toBool(process.env.DB_SSL, false),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'ankkata_dev_jwt_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'ankkata_dev_refresh_secret_change_me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,

  // Dernière version connue du logiciel guichet — comparée au `versionApp`
  // reçu à chaque heartbeat (voir services/poste.service.js) pour signaler
  // un poste "obsolète" et renvoyer la version disponible au client.
  latestAppVersion: process.env.LATEST_APP_VERSION || '1.0.0',
};
