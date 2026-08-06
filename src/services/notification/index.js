// Point d'entrée unique du système de notifications — voyageur (OTP de
// connexion) ET confirmation de réservation passent par ici.
//
// CANAL_NOTIFICATION (.env) pilote le(s) canal(aux) réellement utilisé(s) :
//   - "sms"   : uniquement par SMS (voir sms/index.js, SMS_PROVIDER choisit
//               le fournisseur — africastalking ou twilio).
//   - "email" : uniquement par email (SMTP, voir email.provider.js).
//   - "both"  : les deux, indépendamment (un échec sur un canal n'empêche
//               pas l'autre — voir `envoyerConfirmationReservation`).
//
// Pourquoi cette variable existe : au Burkina Faso, beaucoup de voyageurs
// n'utilisent pas l'email (et ne savent parfois même pas ce que c'est), donc
// le SMS est le canal prioritaire par défaut. L'email reste implémenté et
// utilisable (utile pour les voyageurs qui en ont un, ou pour tester sans
// dépenser de crédit SMS) — un simple changement de CANAL_NOTIFICATION dans
// .env permet de tester chaque canal séparément ou les deux à la fois, sans
// toucher au code.
const env = require('../../config/env');
const { envoyerSms } = require('./sms');
const emailProvider = require('./email.provider');
const { messageOtp, messageOtpEmail, messageConfirmationReservationSms, confirmationReservationEmail } = require('./messages');

function canalActif() {
  return env.notification.canal; // 'sms' | 'email' | 'both'
}

/**
 * Envoie le code de connexion (OTP) — toujours par SMS : le principe même du
 * login "téléphone + code" est que le code arrive sur CE téléphone, l'email
 * n'a pas de sens ici (voir voyageur.controller.js#demanderOtp).
 * N'échoue jamais silencieusement : l'appelant décide quoi faire de l'erreur
 * (voir voyageur.controller.js, qui renvoie quand même `codeSimule` en mode
 * développement si l'envoi réel échoue, pour ne jamais bloquer les tests).
 */
async function envoyerCodeConnexion({ telephone, code }) {
  return envoyerSms({ telephone, message: messageOtp(code) });
}

/**
 * Envoie le code de connexion (OTP) par EMAIL — utilisé par la connexion
 * alternative "se connecter par email" (voir
 * voyageur.controller.js#demanderOtpEmail). Contrairement à
 * `envoyerConfirmationReservation`, ignore volontairement `CANAL_NOTIFICATION`
 * : ici le voyageur a explicitement choisi de recevoir son code par email
 * (c'est le principe même de ce mode de connexion), donc on envoie
 * toujours par email quel que soit le canal par défaut configuré pour les
 * confirmations de réservation.
 */
async function envoyerCodeConnexionEmail({ email, code }) {
  const { sujet, texte, html } = messageOtpEmail(code);
  return emailProvider.envoyer({ email, sujet, texte, html });
}

/**
 * Envoie la confirmation de réservation sur le(s) canal(aux) configuré(s).
 * Ne lève jamais d'exception : chaque tentative est isolée (try/catch) et le
 * résultat de chaque canal est renvoyé, pour que l'appelant puisse logger
 * sans jamais faire échouer la création de la réservation elle-même (voir
 * public.controller.js#createReservation, appelé APRÈS que la réservation
 * soit déjà en base).
 */
async function envoyerConfirmationReservation({ telephone, email, donnees }) {
  const canal = canalActif();
  const resultats = { sms: null, email: null };

  if ((canal === 'sms' || canal === 'both') && telephone) {
    try {
      resultats.sms = await envoyerSms({ telephone, message: messageConfirmationReservationSms(donnees) });
    } catch (err) {
      resultats.sms = { erreur: err.message };
    }
  }

  if ((canal === 'email' || canal === 'both') && email) {
    try {
      const { sujet, texte, html } = confirmationReservationEmail(donnees);
      resultats.email = await emailProvider.envoyer({ email, sujet, texte, html });
    } catch (err) {
      resultats.email = { erreur: err.message };
    }
  }

  return resultats;
}

module.exports = { envoyerCodeConnexion, envoyerCodeConnexionEmail, envoyerConfirmationReservation };
