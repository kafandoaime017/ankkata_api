// Envoi d'email réel via SMTP (nodemailer) — remplace l'ancienne simulation
// ("codeSimule" renvoyé en clair dans la réponse HTTP). Devient fonctionnel
// dès que SMTP_HOST/SMTP_USER/SMTP_PASS sont renseignés dans .env (n'importe
// quel fournisseur SMTP classique convient : Gmail avec mot de passe
// d'application, Brevo/Sendinblue, Mailtrap pour les tests, OVH, etc.).
const nodemailer = require('nodemailer');
const env = require('../../config/env');

let transporteur = null;
function obtenirTransporteur() {
  if (transporteur) return transporteur;
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    throw new Error('SMTP_HOST / SMTP_USER / SMTP_PASS manquants — configurez un fournisseur SMTP dans .env.');
  }
  transporteur = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporteur;
}

/** @param {{ email: string, sujet: string, texte: string, html?: string }} params */
async function envoyer({ email, sujet, texte, html }) {
  const client = obtenirTransporteur();
  const info = await client.sendMail({ from: env.smtp.from, to: email, subject: sujet, text: texte, html: html || undefined });
  return { fournisseur: 'smtp', id: info.messageId };
}

module.exports = { envoyer };
