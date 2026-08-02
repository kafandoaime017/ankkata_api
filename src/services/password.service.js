// Hachage/vérification des mots de passe ET des codes PIN guichetier — les
// deux utilisent bcrypt, seul le nombre de tours diffère potentiellement
// selon l'environnement (voir env.bcryptSaltRounds).
const bcrypt = require('bcryptjs');
const env = require('../config/env');

async function hash(plainText) {
  return bcrypt.hash(plainText, env.bcryptSaltRounds);
}

async function compare(plainText, hashed) {
  if (!hashed) return false;
  return bcrypt.compare(plainText, hashed);
}

module.exports = { hash, compare };
