// Erreur métier standardisée — tout code applicatif qui veut renvoyer une
// erreur HTTP contrôlée (400/401/403/404/409...) lève une ApiError plutôt
// qu'une Error générique ; le middleware d'erreur central (error.middleware)
// sait la reconnaître via `isOperational` et formater la réponse JSON.
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Requête invalide.', details = null) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Authentification requise.') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Accès refusé.') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Ressource introuvable.') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflit avec l\'état actuel de la ressource.') {
    return new ApiError(409, message);
  }

  static internal(message = 'Erreur interne du serveur.') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
