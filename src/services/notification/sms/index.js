// Sélecteur de fournisseur SMS — pilote par SMS_PROVIDER (.env). Ajouter un
// nouveau fournisseur : créer <nom>.provider.js exportant `envoyer({
// telephone, message })`, puis l'ajouter à la map ci-dessous.
const env = require('../../../config/env');
const africastalking = require('./africastalking.provider');
const twilio = require('./twilio.provider');
const sent = require('./sent.provider');

const FOURNISSEURS = { africastalking, twilio, sent };

/** @param {{ telephone: string, message: string }} params */
async function envoyerSms({ telephone, message }) {
  const fournisseur = FOURNISSEURS[env.sms.provider];
  if (!fournisseur) {
    throw new Error(`SMS_PROVIDER invalide : "${env.sms.provider}" (attendu : ${Object.keys(FOURNISSEURS).join(' | ')}).`);
  }
  return fournisseur.envoyer({ telephone, message });
}

module.exports = { envoyerSms };
