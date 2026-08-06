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

  // URL publique du site Voyageur (ankkata_frontend) — utilisée pour
  // construire des liens absolus dans les SMS/emails et le contenu du QR
  // code du billet (voir services/notification/*).
  appPublicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:3000',

  // Canal(aux) utilisé(s) pour la confirmation de réservation ET le code de
  // connexion (OTP) voyageur — voir services/notification/index.js. 'sms'
  // par défaut : au Burkina Faso beaucoup de voyageurs n'ont pas d'email
  // (voir commentaire en tête de services/notification/index.js).
  notification: {
    canal: (process.env.CANAL_NOTIFICATION || 'sms').toLowerCase(), // 'sms' | 'email' | 'both'
  },

  // Fournisseur SMS actif — voir services/notification/sms/index.js. Les
  // deux fournisseurs sont implémentés et prêts, un simple changement de
  // cette variable (+ ses identifiants) suffit pour basculer de l'un à
  // l'autre, sans toucher au code.
  sms: {
    provider: (process.env.SMS_PROVIDER || 'africastalking').toLowerCase(), // 'africastalking' | 'sent' | 'twilio'
    sent: {
      apiKey: process.env.SENT_API_KEY || '',
      // Id du template créé dans le tableau de bord sent.dm (obligatoire
      // côté Sent — voir services/notification/sms/sent.provider.js pour le
      // détail) et nom de sa variable dynamique unique (par défaut "texte").
      templateId: process.env.SENT_TEMPLATE_ID || '',
      templateVariable: process.env.SENT_TEMPLATE_VARIABLE || 'texte',
    },
    africastalking: {
      username: process.env.AFRICASTALKING_USERNAME || 'sandbox',
      apiKey: process.env.AFRICASTALKING_API_KEY || '',
      senderId: process.env.AFRICASTALKING_SENDER_ID || '',
      // Le "Sandbox" Africa's Talking (username=sandbox) est un environnement
      // de test gratuit — bascule automatiquement vers l'API de production
      // dès que AFRICASTALKING_USERNAME est renseigné avec un vrai nom
      // d'application "Live".
      sandbox: toBool(process.env.AFRICASTALKING_SANDBOX, true),
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    },
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: toBool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Ankkata <no-reply@ankkata.com>',
  },
};
