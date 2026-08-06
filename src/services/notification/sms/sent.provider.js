// Fournisseur SMS "Sent" (sent.dm) — API unifiée SMS/WhatsApp/RCS.
// PARTICULARITÉ IMPORTANTE : contrairement à Africa's Talking/Twilio, Sent
// n'accepte jamais de texte libre — chaque message doit référencer un
// "template" créé au préalable dans le tableau de bord Sent
// (https://app.sent.dm/dashboard), avec au moins une variable dynamique.
//
// Pour rester compatible avec le reste du système (qui construit déjà le
// texte final côté serveur — voir services/notification/messages.js — afin
// que le même texte fonctionne quel que soit le fournisseur), on ne crée
// qu'UN SEUL template générique côté Sent, avec un unique corps du type :
//
//   {{0:texte}}
//
// ...où la variable DOIT être nommée exactement "texte" (voir
// SENT_TEMPLATE_VARIABLE dans .env si vous préférez un autre nom). Le texte
// déjà rendu (code OTP ou confirmation de réservation) est alors transmis
// comme valeur de cette unique variable. Voir .env.example pour les
// instructions de création de ce template dans le tableau de bord Sent.
const axios = require('axios');
const env = require('../../../config/env');

/** @param {{ telephone: string, message: string }} params */
async function envoyer({ telephone, message }) {
  const { apiKey, templateId, templateVariable } = env.sms.sent;
  if (!apiKey || !templateId) {
    throw new Error(
      'SENT_API_KEY / SENT_TEMPLATE_ID manquants — créez un compte sur sent.dm, un template avec une variable "texte" dans son tableau de bord, et renseignez sa clé API + l\'id du template dans .env.'
    );
  }

  const { data } = await axios.post(
    'https://api.sent.dm/v3/messages',
    {
      to: [telephone],
      channel: ['sms'],
      template: {
        id: templateId,
        parameters: { [templateVariable]: message },
      },
    },
    {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );

  const destinataire = data?.data?.recipients?.[0];
  if (!data?.success || !destinataire) {
    throw new Error(`Envoi SMS Sent échoué : ${data?.error?.message || 'réponse inattendue'}`);
  }
  return { fournisseur: 'sent', id: destinataire.message_id, statut: data.data.status };
}

module.exports = { envoyer };
