// Émission/vérification des JSON Web Tokens. Le payload porte toujours
// `espace` (ankkata|admin|guichetier) pour que le middleware d'authentification
// sache quelle table recharger, plus `role`/`companyId` pour les contrôles
// d'autorisation sans requête supplémentaire à chaque appel.
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(payload) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn });
}

/**
 * Jeton de "défi" 2FA — émis juste après un mot de passe validé pour un
 * compte Ankkata avec la double authentification active, AVANT le vrai
 * jeton d'accès (voir auth.controller.js#loginAnkkata). Volontairement très
 * court (5 min) et marqué `type: '2fa_challenge'` : il ne porte ni `espace`
 * ni `role`, donc `authenticate`/`authorize` du middleware ne peuvent pas le
 * confondre avec un jeton d'accès normal même par erreur — seul
 * `POST /auth/ankkata/2fa/login` sait le consommer.
 */
function signDefi2fa(compteId) {
  return jwt.sign({ sub: compteId, type: '2fa_challenge' }, env.jwt.secret, { expiresIn: '5m' });
}

function verifyDefi2fa(token) {
  const decoded = jwt.verify(token, env.jwt.secret);
  if (decoded.type !== '2fa_challenge') throw new Error('Jeton de défi 2FA invalide.');
  return decoded;
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  signDefi2fa,
  verifyDefi2fa,
};
