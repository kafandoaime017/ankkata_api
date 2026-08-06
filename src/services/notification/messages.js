// Gabarits de messages (SMS courts + email) — centralisés ici pour éviter de
// dupliquer le texte entre les différents points d'appel.
function messageOtp(code) {
  return `Ankkata : votre code de connexion est ${code}. Il expire dans 10 minutes. Ne le partagez avec personne.`;
}

/** Email d'OTP de connexion — voir voyageur.controller.js#demanderOtpEmail. */
function messageOtpEmail(code) {
  const sujet = 'Votre code de connexion Ankkata';
  const texte = `Votre code de connexion est ${code}. Il expire dans 10 minutes. Ne le partagez avec personne.`;
  const html =
    `<p>Votre code de connexion est :</p>` +
    `<p style="font-size:24px;font-weight:700;letter-spacing:0.2em;">${code}</p>` +
    `<p>Il expire dans 10 minutes. Ne le partagez avec personne.</p>`;
  return { sujet, texte, html };
}

function messageConfirmationReservationSms({ reference, villeDepart, villeArrivee, date, heureDepart }) {
  return (
    `Ankkata : réservation confirmée (${reference}). ` +
    `${villeDepart} -> ${villeArrivee}, le ${date} a ${heureDepart}. ` +
    `Presentez ce numero de telephone a l'agence pour retrouver votre billet.`
  );
}

function confirmationReservationEmail({ reference, villeDepart, villeArrivee, date, heureDepart, nomVoyageur, montant, lienBillet }) {
  const sujet = `Votre réservation Ankkata ${reference} est confirmée`;
  const texte =
    `Bonjour ${nomVoyageur},\n\n` +
    `Votre réservation ${reference} est confirmée : ${villeDepart} -> ${villeArrivee}, le ${date} à ${heureDepart}.\n` +
    `Montant : ${montant} FCFA.\n\n` +
    `Retrouvez votre billet (QR code + PDF) : ${lienBillet}\n\n` +
    `Bon voyage avec Ankkata.`;
  const html =
    `<p>Bonjour ${nomVoyageur},</p>` +
    `<p>Votre réservation <strong>${reference}</strong> est confirmée : <strong>${villeDepart} → ${villeArrivee}</strong>, ` +
    `le ${date} à ${heureDepart}.</p>` +
    `<p>Montant : <strong>${montant} FCFA</strong>.</p>` +
    `<p><a href="${lienBillet}">Retrouver mon billet (QR code + PDF)</a></p>` +
    `<p>Bon voyage avec Ankkata.</p>`;
  return { sujet, texte, html };
}

module.exports = { messageOtp, messageOtpEmail, messageConfirmationReservationSms, confirmationReservationEmail };
