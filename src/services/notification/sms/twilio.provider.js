// Fournisseur SMS Twilio — deuxième option prête à l'emploi (voir
// SMS_PROVIDER dans .env pour basculer). Tarif Burkina Faso confirmé
// publiquement par Twilio au moment de l'écriture : ~0,2233 $ par SMS sortant
// + ~1,15 $/mois pour un numéro international, sensiblement plus cher que ce
// qu'annonce Africa's Talking pour l'Afrique — gardé en solution de repli /
// pour les tests ponctuels (un compte d'essai Twilio offre un petit crédit
// gratuit sans carte bancaire).
const env = require('../../../config/env');

/** @param {{ telephone: string, message: string }} params */
async function envoyer({ telephone, message }) {
  const { accountSid, authToken, fromNumber } = env.sms.twilio;
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER manquants — voir votre tableau de bord Twilio (console.twilio.com).'
    );
  }

  // Import paresseux : le SDK Twilio n'est chargé que si ce fournisseur est
  // effectivement sélectionné (SMS_PROVIDER=twilio).
  const twilio = require('twilio');
  const client = twilio(accountSid, authToken);

  const resultat = await client.messages.create({ body: message, from: fromNumber, to: telephone });
  return { fournisseur: 'twilio', id: resultat.sid, statut: resultat.status };
}

module.exports = { envoyer };
