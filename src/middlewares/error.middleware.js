// Gestionnaire d'erreurs central — toute erreur transmise via `next(err)`
// (directement ou via catchAsync) finit ici. Traduit les erreurs Sequelize
// connues en réponses HTTP propres plutôt que de laisser fuiter des piles
// d'appel ou des messages SQL bruts au client.
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

function normaliserErreur(err) {
  if (err instanceof ApiError) return err;

  if (err.name === 'SequelizeUniqueConstraintError') {
    const champs = Object.keys(err.fields || {}).join(', ');
    return ApiError.conflict(`Une ressource avec ces valeurs existe déjà${champs ? ` (${champs})` : ''}.`);
  }
  if (err.name === 'SequelizeValidationError') {
    return ApiError.badRequest(
      'Données invalides.',
      err.errors?.map((e) => ({ champ: e.path, message: e.message }))
    );
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return ApiError.badRequest('Référence invalide vers une ressource liée.');
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Jeton d\'authentification invalide ou expiré.');
  }
  if (err.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'Fichier trop volumineux (5 Mo maximum).',
      LIMIT_UNEXPECTED_FILE: 'Champ de fichier inattendu.',
    };
    return ApiError.badRequest(messages[err.code] || `Erreur d'upload : ${err.message}`);
  }

  return ApiError.internal(env.isProduction ? 'Erreur interne du serveur.' : err.message);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const erreur = normaliserErreur(err);

  // Toujours logger côté serveur (visible via `docker compose logs api`),
  // même en production — seul le MESSAGE renvoyé au client reste générique
  // en prod (voir `normaliserErreur`). Avant ce correctif, une erreur 500 en
  // production ne laissait absolument aucune trace exploitable dans les
  // logs, rendant le diagnostic impossible à distance.
  if (!erreur.isOperational) {
    console.error(err);
  }

  res.status(erreur.statusCode).json({
    error: {
      message: erreur.message,
      details: erreur.details || undefined,
    },
  });
}

module.exports = errorHandler;
