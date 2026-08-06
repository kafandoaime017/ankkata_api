// Génération du "billet" voyageur (QR code + PDF téléchargeable) — voir
// controllers/public.controller.js#getBillet / getBilletPdf. Pensé pour les
// voyageurs notifiés par SMS : le SMS ne peut pas porter de pièce jointe, ils
// suivent donc un lien vers la page de confirmation puis téléchargent ce PDF.
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const env = require('../config/env');
const { UPLOADS_ROOT } = require('../middlewares/upload.middleware');

// PDFKit ne sait intégrer nativement que du PNG/JPEG (pas SVG, pas WebP) — un
// logo dans un autre format est simplement ignoré dans le PDF (le nom de la
// compagnie en texte suffit alors), voir cheminLogo() ci-dessous.
const EXTENSIONS_IMAGE_PDFKIT = new Set(['.png', '.jpg', '.jpeg']);

/** Résout le chemin disque absolu d'un logo de compagnie, ou null s'il est
 * absent/dans un format non supporté par PDFKit/introuvable sur disque.
 * `company.logoPath` est de la forme "/uploads/logos/xxx.png" (voir
 * middlewares/upload.middleware.js) — UPLOADS_ROOT pointe déjà vers
 * ".../ankkata_api/uploads", il ne reste qu'à retirer le préfixe "/uploads/". */
function cheminLogo(company) {
  const logoPath = company?.logoPath;
  if (!logoPath) return null;
  if (!EXTENSIONS_IMAGE_PDFKIT.has(path.extname(logoPath).toLowerCase())) return null;
  const chemin = path.join(UPLOADS_ROOT, logoPath.replace(/^\/?uploads\//, ''));
  return fs.existsSync(chemin) ? chemin : null;
}

/** Convertit `Company.couleurPrimaire` (entier ARGB façon Flutter, ex.
 * 0xff141b4d — voir company.model.js et lib/utils.ts#couleurArgbVersHex côté
 * frontend pour la même conversion) en chaîne hex CSS "#rrggbb". */
function couleurHex(valeurArgb, defaut = '#141B4D') {
  if (valeurArgb === undefined || valeurArgb === null) return defaut;
  const hex = (Number(valeurArgb) >>> 0).toString(16).padStart(8, '0');
  return `#${hex.slice(2)}`;
}

/** Contenu encodé dans le QR — l'URL de la page "retrouver ma réservation",
 * déjà pré-remplie avec référence + téléphone (les deux informations que
 * cette page demande de toute façon pour prouver l'identité du voyageur). */
function urlVerification(reservation) {
  return `${env.appPublicUrl}/mes-reservations?reference=${encodeURIComponent(reservation.reference)}&telephone=${encodeURIComponent(reservation.telephoneVoyageur)}`;
}

async function genererQrDataUrl(reservation) {
  return QRCode.toDataURL(urlVerification(reservation), { margin: 1, width: 320 });
}

async function genererQrBuffer(reservation) {
  return QRCode.toBuffer(urlVerification(reservation), { margin: 1, width: 320 });
}

// Palette sobre, façon papeterie/invoice pro : l'essentiel du texte reste en
// noir/gris, la couleur de marque de la compagnie n'accentue que quelques
// éléments ciblés (liseré, flèche du trajet, référence, montant).
// Duo de polices standard PDF (aucun fichier à embarquer) : Times-Bold pour
// les éléments "chiffrés"/d'identité (trajet, référence, montant) façon
// billet officiel, Helvetica pour le texte courant — plus lisible et plus
// net qu'une police unique sur tout le document.
const GRIS_LIGNE = '#D9D9D9';
const GRIS_LABEL = '#767676';
const NOIR = '#1A1A1A';
const POLICE = 'Helvetica';
const POLICE_TITRE = 'Times-Bold';

/** Dessine une flèche vectorielle (trait + pointe) plutôt que le caractère
 * unicode "→", qui n'existe pas dans l'encodage WinAnsi des polices PDF
 * standard et s'affichait comme un glyphe cassé ("!"). */
function dessinerFleche(doc, x, yCentre, longueur, couleur) {
  doc.strokeColor(couleur).lineWidth(1.6).moveTo(x, yCentre).lineTo(x + longueur - 7, yCentre).stroke();
  doc
    .fillColor(couleur)
    .polygon([x + longueur - 7, yCentre - 4], [x + longueur, yCentre], [x + longueur - 7, yCentre + 4])
    .fill();
}

/** Construit le document PDFKit (l'appelant fait `.pipe(res)` puis `.end()`).
 * Mise en page sobre façon billet compagnie/invoice pro : logo (seul, en
 * grand) en haut à gauche, référence en haut à droite, un fin liseré de
 * couleur en dessous, puis le trajet et les informations en lignes séparées
 * par des filets — pas d'aplats colorés ni d'encadrés. */
async function genererBilletPdf(reservation) {
  const qrBuffer = await genererQrBuffer(reservation);
  const company = reservation.trip?.company || reservation.trip?.ligne?.company || null;
  const compagnie = company?.nom || '';
  const couleur = couleurHex(company?.couleurPrimaire);
  const logo = cheminLogo(company);

  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
  const xGauche = 50;
  const xDroite = doc.page.width - 50;
  const largeurUtile = xDroite - xGauche;

  const filet = (y, couleurFilet = GRIS_LIGNE, epaisseur = 1) => {
    doc.moveTo(xGauche, y).lineTo(xDroite, y).lineWidth(epaisseur).strokeColor(couleurFilet).stroke();
  };

  // --- En-tête : logo (ou nom à défaut) à gauche, référence à droite. Les
  // positions du liseré et du libellé "BILLET ÉLECTRONIQUE" sont fixes,
  // indépendantes de la hauteur réelle du logo une fois mis à l'échelle
  // (un logo large/plat ne doit pas créer un grand vide avant la suite). ---
  const tailleLogo = 60;
  if (logo) {
    try {
      doc.image(logo, xGauche, 45, { fit: [tailleLogo, tailleLogo] });
    } catch {
      // Fichier illisible/corrompu : on retombe sur le nom en texte.
      doc.fillColor(NOIR).font(POLICE_TITRE).fontSize(15).text(compagnie || 'Compagnie de transport', xGauche, 50, { width: 260 });
    }
  } else {
    doc.fillColor(NOIR).font(POLICE_TITRE).fontSize(15).text(compagnie || 'Compagnie de transport', xGauche, 50, { width: 260 });
  }

  const largeurRef = 200;
  doc
    .fillColor(GRIS_LABEL)
    .font(POLICE)
    .fontSize(8)
    .text('RÉFÉRENCE', xDroite - largeurRef, 47, { width: largeurRef, align: 'right', characterSpacing: 0.5 });
  doc
    .fillColor(couleur)
    .font(POLICE_TITRE)
    .fontSize(13)
    .text(reservation.reference, xDroite - largeurRef, 59, { width: largeurRef, align: 'right' });

  // (110, pas 45 : même avec un logo carré occupant tout le bloc de 60px de
  // haut, on garde une petite marge de respiration avant ce libellé.)
  const yLibelle = 110;
  doc
    .fillColor(couleur)
    .font(POLICE)
    .fontSize(8)
    .text('BILLET ÉLECTRONIQUE', xGauche, yLibelle, { characterSpacing: 0.6 });

  // Fin liseré de couleur sous l'en-tête — touche de couleur de marque,
  // le reste du document reste en noir/gris.
  const yListeau = yLibelle + 10;
  filet(yListeau, couleur, 2);

  // --- Trajet, avec une flèche vectorielle colorée entre les deux villes ---
  const yTrajet = yListeau + 16;
  doc.font(POLICE_TITRE).fontSize(19);
  const largeurDepart = doc.widthOfString(reservation.villeDepart);
  const largeurFleche = 30;
  const xFleche = xGauche + largeurDepart + 14;
  const xArrivee = xFleche + largeurFleche + 14;

  doc.fillColor(NOIR).text(reservation.villeDepart, xGauche, yTrajet);
  doc.fillColor(NOIR).font(POLICE_TITRE).fontSize(19).text(reservation.villeArrivee, xArrivee, yTrajet);
  dessinerFleche(doc, xFleche, yTrajet + 10, largeurFleche, couleur);

  doc
    .fillColor(GRIS_LABEL)
    .font(POLICE)
    .fontSize(10)
    .text(`${reservation.date} — départ ${reservation.heureDepart}`, xGauche, yTrajet + 24);

  // --- Informations voyage/voyageur, en lignes séparées par des filets ---
  const yInfos = yTrajet + 40;
  filet(yInfos);

  const col1 = xGauche;
  const col2 = xGauche + largeurUtile / 2;
  const largeurCol = largeurUtile / 2 - 10;

  const ligneInfo = (y, label1, valeur1, label2, valeur2) => {
    doc.fillColor(GRIS_LABEL).font(POLICE).fontSize(8).text(label1, col1, y, { characterSpacing: 0.4 });
    doc.fillColor(GRIS_LABEL).font(POLICE).fontSize(8).text(label2, col2, y, { characterSpacing: 0.4 });
    doc.fillColor(NOIR).font(POLICE).fontSize(11).text(valeur1, col1, y + 11, { width: largeurCol });
    doc.fillColor(NOIR).font(POLICE).fontSize(11).text(valeur2, col2, y + 11, { width: largeurCol });
    filet(y + 27);
  };

  ligneInfo(yInfos + 9, 'VOYAGEUR', reservation.nomVoyageur, 'CLASSE', reservation.classe);
  ligneInfo(yInfos + 9 + 33, 'TÉLÉPHONE', reservation.telephoneVoyageur, 'MOYEN DE PAIEMENT', reservation.moyenPaiement);

  // --- Montant payé, seule ligne en couleur de marque ---
  const yMontant = yInfos + 9 + 66 + 9;
  doc.fillColor(GRIS_LABEL).font(POLICE).fontSize(9).text('MONTANT PAYÉ', xGauche, yMontant, { characterSpacing: 0.4 });
  doc.fillColor(couleur).font(POLICE_TITRE).fontSize(18).text(`${reservation.montant} FCFA`, xGauche, yMontant + 13);

  // --- QR code ---
  const yQr = yMontant + 54;
  filet(yQr - 14);
  doc.image(qrBuffer, xGauche, yQr, { width: 100 });
  doc
    .fillColor(NOIR)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('Présentez ce QR code à l\'agence de départ', xGauche + 120, yQr + 6, { width: 330 });
  doc
    .fillColor(GRIS_LABEL)
    .font(POLICE)
    .fontSize(9)
    .text(
      'Votre numéro de téléphone peut aussi servir de preuve d\'identité si vous n\'avez pas ce document sous la main.',
      xGauche + 120,
      yQr + 24,
      { width: 330 }
    );

  // --- "Bon voyage" en clôture du contenu, centré ---
  const yBonVoyage = yQr + 110;
  filet(yBonVoyage);
  doc
    .fillColor(NOIR)
    .font(POLICE)
    .fontSize(13)
    .text('Bon voyage !', xGauche, yBonVoyage + 14, { width: largeurUtile, align: 'center', characterSpacing: 0.3 });

  // --- Pied de page, ancré tout en bas de la feuille — placé volontairement
  // à l'intérieur de la marge basse du document (page.height - marge - un
  // peu de jeu) : au-delà, PDFKit considère le contenu hors zone imprimable
  // et bascule automatiquement sur une nouvelle page, ce qu'on veut éviter. ---
  doc
    .fillColor(GRIS_LABEL)
    .font(POLICE)
    .fontSize(8)
    .text('Powered by Ankkata', xGauche, doc.page.height - 58, { width: largeurUtile, align: 'center', characterSpacing: 0.5 });

  return doc;
}

module.exports = { genererQrDataUrl, genererQrBuffer, genererBilletPdf };
