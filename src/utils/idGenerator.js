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

/** Clé d'activation compagnie, ex: genererCleActivation('Rafiq Voyages') -> "RAFIQ-VOYAGES-7K2Q9X" */
// Plage Unicode "Combining Diacritical Marks" (U+0300 à U+036F), construite
// via des points de code explicites (String.fromCharCode) pour éviter tout
// souci d'encodage de caractères combinants directement dans le fichier
// source (un caractère combinant littéral dans le code source rendrait le
// fichier fragile selon l'éditeur/l'encodage).
const REGEX_DIACRITIQUES = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g'
);

function genererCleActivation(nom) {
  const prefixe = nom
    .normalize('NFD')
    .replace(REGEX_DIACRITIQUES, '') // retire les diacritiques (é -> e, etc.)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefixe}-${suffixeAleatoire(6)}`;
}

/** Génère un code PIN numérique à 6 chiffres. */
function genererCodePin() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

module.exports = {
  generateCode,
  generateDatedReference,
  genererCleActivation,
  genererCodePin,
};
