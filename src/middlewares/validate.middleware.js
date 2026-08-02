// Enveloppe express-validator : exécute les validations déclarées sur la
// route, et transforme les erreurs en ApiError.badRequest (400) uniforme
// plutôt que le format brut d'express-validator.
const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const details = errors.array().map((e) => ({ champ: e.path, message: e.msg }));
  next(ApiError.badRequest('Données invalides.', details));
};
