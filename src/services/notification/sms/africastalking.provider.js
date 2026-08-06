// Fournisseur SMS "Africa's Talking" — API REST directe (pas de SDK officiel
// ajouté comme dépendance, leur API HTTP est simple et bien documentée,
// ça évite une dépendance de plus à maintenir). Couvre officiellement le
// Burkina Faso (+226) pour l'envoi de SMS, et propose un environnement
// "Sandbox" totalement gratuit pour tester avant tout achat de crédit réel
// (AFRICASTALKING_USERNAME=sandbox, valeur par défaut ici) — voir
// https://africastalking.com et le tableau de bord après inscription
// gratuite pour le tarif exact au Burkina Faso en mode "Live" (non confirmé
// publiquement au moment de l'écriture de ce code, contrairement à Twilio
// dont le tarif Burkina Faso est publié : ~0,2233 $/SMS).
const axios = require('axios');
const env = require('../../../config/env');

/**
 * @param {{ telephone: string, message: string }} params `telephone` au
 *   format E.164 (ex. "+22670000000").
 */
async function envoyer({ telephone, message }) {
  const { username, apiKey, senderId, sandbox } = env.sms.africastalking;
  if (!apiKey) {
    throw new Error(
      "AFRICASTALKING_API_KEY manquant — créez un compte gratuit sur africastalking.com (l'app 'Sandbox' est gratuite) et renseignez la clé dans .env."
    );
  }

  const base = sandbox ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
  const params = new URLSearchParams({ username, to: telephone, message });
  if (senderId) params.set('from', senderId);

  const { data } = await axios.post(`${base}/version1/messaging`, params.toString(), {
    headers: {
      apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 15000,
  });

  const destinataire = data?.SMSMessageData?.Recipients?.[0];
  // Codes de succès Africa's Talking : 100 (envoyé au SMSC) / 101 (en file).
  if (!destinataire || ![100, 101].includes(destinataire.statusCode)) {
    throw new Error(
      `Envoi SMS Africa's Talking échoué : ${destinataire?.status || data?.SMSMessageData?.Message || 'réponse inattendue'}`
    );
  }
  return { fournisseur: 'africastalking', id: destinataire.messageId, statut: destinataire.status };
}

module.exports = { envoyer };
