const ApiError = require('../utils/ApiError');

module.exports = function notFound(req, res, next) {
  next(ApiError.notFound(`Route introuvable : ${req.method} ${req.originalUrl}`));
};
