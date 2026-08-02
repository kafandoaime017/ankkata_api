// Assemblage de l'application Express — middlewares transverses, montage
// des routes, gestion des erreurs. Séparé de server.js pour pouvoir être
// importé tel quel dans des tests (supertest) sans démarrer de vrai
// serveur HTTP.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/error.middleware');
const { UPLOADS_ROOT } = require('./middlewares/upload.middleware');

const app = express();

// crossOriginResourcePolicy désactivé sur les fichiers statiques : les logos
// doivent pouvoir être chargés depuis les apps Flutter (ankkata_admin,
// ankata_guichet), pas seulement depuis la même origine que l'API.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (!env.isTest) {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: env.env, timestamp: new Date().toISOString() });
});

// Fichiers uploadés (logos de compagnie, etc.) servis statiquement — l'URL
// publique renvoyée par l'API (logoPath) est de la forme "/uploads/logos/xxx.png",
// à préfixer côté client par l'origine du serveur (sans le préfixe /api/v1).
app.use('/uploads', express.static(UPLOADS_ROOT));

app.use(env.apiPrefix, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
