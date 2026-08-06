// Double authentification (2FA) par code à usage unique basé sur le temps
// (TOTP, RFC 6238) — réservée aux comptes de l'équipe Ankkata (accès plate-
// forme entière, donc la cible la plus sensible à protéger). Repose sur
// `otplib`, compatible avec toute application d'authentification standard
// (Google Authenticator, Authy, etc.) — aucun SMS/appel nécessaire.
const { authenticator } = require('otplib');

// Petite tolérance d'horloge (1 pas de 30s avant/après) — un décalage léger
// entre l'heure du téléphone et celle du serveur ne doit pas faire échouer
// une saisie par ailleurs correcte.
authenticator.options = { window: 1 };

/** Génère un nouveau secret base32 — à stocker tel quel (voir avertissement compte). */
function genererSecret() {
  return authenticator.generateSecret();
}

/**
 * URI `otpauth://` à encoder en QR code côté client (voir `qr_flutter` dans
 * ankkata_admin) — [compte] identifie le compte dans l'application
 * d'authentification (ex: "aime.kabore"), [emetteur] est le nom affiché
 * ("Ankkata").
 */
function genererUriProvisionnement(compte, secret, emetteur = 'Ankkata') {
  return authenticator.keyuri(compte, emetteur, secret);
}

/** Vérifie un code à 6 chiffres saisi par l'utilisateur contre le secret stocké. */
function verifierCode(code, secret) {
  if (!code || !secret) return false;
  try {
    return authenticator.verify({ token: String(code).trim(), secret });
  } catch (_) {
    return false;
  }
}

module.exports = { genererSecret, genererUriProvisionnement, verifierCode };
