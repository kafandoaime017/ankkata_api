// Génère des codes/références "lisibles" cohérents avec les formats déjà
// utilisés par les apps Flutter (ex : "RAG-001", "RLN-042", "TCK-2026-08-01-00147"),
// tout en restant robustes à la concurrence (pas de compteur en mémoire à la
// Dart — on combine un horodatage et un suffixe aléatoire, l'unicité finale
// étant de toute façon garantie par une contrainte UNIQUE en base).
const CARACTERES_ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function suffixeAleatoire(longueur = 6) {
  let s = '';
  for (let i = 0; i < longueur; i += 1) {
    s += CARACTERES_ALPHANUM[Math.floor(Math.random() * CARACTERES_ALPHANUM.length)];
  }
  return s;
}

/** Ex: generateCode('RAG') -> "RAG-7F3K2Q" */
function generateCode(prefix, { longueur = 6 } = {}) {
  return `${prefix}-${suffixeAleatoire(longueur)}`;
}

/** Ex: generateDatedReference('TCK') -> "TCK-2026-08-01-4F7QZ1" */
function generateDatedReference(prefix, date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${prefix}-${yyyy}-${mm}-${dd}-${suffixeAleatoire(5)}`;
}

/**
 * Clé d'activation compagnie — entièrement aléatoire, AUCUN lien avec le nom
 * de la compagnie (contrairement à l'ancienne version qui préfixait avec le
 * nom, ex. "RAFIQ-VOYAGES-7K2Q9X" : lisible mais devinable/prévisible, et
 * gênant si la compagnie change de raison sociale).
 *
 * Alphabet "Crockford-like" — 23456789ABCDEFGHJKMNPQRSTVWXYZ — qui exclut
 * volontairement 0/O, 1/I/L : des paires visuellement confondables une fois
 * dictées au téléphone ou tapées à la main par un guichetier.
 *
 * Format : 3 blocs de 4 caractères séparés par des tirets, ex.
 * "7K3Q-XM4R-9BCD" (12 caractères utiles, ~62 bits d'entropie — largement
 * suffisant pour un code à durée de vie courte, voir expiration 7 jours).
 */
const ALPHABET_ACTIVATION = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function genererCleActivation() {
  const blocs = [];
  for (let b = 0; b < 3; b += 1) {
    let bloc = '';
    for (let i = 0; i < 4; i += 1) {
      bloc += ALPHABET_ACTIVATION[Math.floor(Math.random() * ALPHABET_ACTIVATION.length)];
    }
    blocs.push(bloc);
  }
  return blocs.join('-');
}

/** Génère un code PIN numérique à 6 chiffres. */
function genererCodePin() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

/**
 * Référence de billet séquentielle PAR POSTE — remplace l'ancien suffixe
 * aléatoire de `generateDatedReference('TCK')` pour les ventes rattachées à
 * un poste identifié (voir controllers/vente.controller.js#create et
 * services/poste.service.js#resolvePoste).
 *
 * Format : `TCK-{codePoste}-{yyyyMMdd}-{numéro sur 6 chiffres}`, ex.
 * "TCK-P03-20260803-000147". L'intérêt par rapport à un suffixe aléatoire :
 * `numero` vient d'un compteur qui n'incrémente JAMAIS que de 1 en 1 et ne
 * revient jamais en arrière — un trou dans la séquence d'un poste donné
 * (ex. 000147 puis 000150) est donc un signal direct de vente perdue ou
 * falsifiée, détectable d'un coup d'œil sur le relevé de ce poste.
 */
function genererReferenceTicket({ codePoste, numero, date = new Date() }) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const numeroFormate = String(numero).padStart(6, '0');
  return `TCK-${codePoste}-${yyyy}${mm}${dd}-${numeroFormate}`;
}

module.exports = {
  generateCode,
  generateDatedReference,
  genererCleActivation,
  genererCodePin,
  genererReferenceTicket,
};
