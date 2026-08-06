#!/usr/bin/env node
// ------------------------------------------------------------------
// Crée UN SEUL compte interne Ankkata (espace "ankkata", rôle
// direction_generale par défaut) directement en base, sans passer par
// l'API ni par le seed de démonstration complet (qui crée en plus des
// compagnies/guichetiers fictifs — voir seeders/20260101000100-demo-data.js).
//
// Utile pour un premier déploiement "propre" : la route API
// POST /comptes-ankkata exige déjà d'être connecté en tant que
// direction_generale (voir routes/compteAnkkata.routes.js) — impossible de
// créer le tout premier compte par ce chemin, d'où ce script.
//
// Usage (depuis le conteneur `api`, donc avec accès à la base) :
//
//   docker compose exec api node scripts/creer-compte-ankkata.js \
//     --code AK-0001 \
//     --nom "Aimé Kaboré" \
//     --identifiant aime.kabore \
//     --mot-de-passe "UnMotDePasseFort123!" \
//     --role direction_generale
//
// Tous les arguments ont une valeur par défaut sauf --mot-de-passe (fixé au
// script pour éviter d'écrire un mot de passe faible par mégarde) — un
// message d'usage s'affiche si l'un des arguments obligatoires manque.
// Le script est idempotent : si l'identifiant existe déjà, il ne fait rien
// et l'indique (aucun doublon, aucune donnée écrasée).
// ------------------------------------------------------------------

const { ROLE_ANKKATA } = require('../src/constants/roles');
const passwordService = require('../src/services/password.service');
const db = require('../src/models');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const cle = argv[i].slice(2);
      const valeur = argv[i + 1];
      args[cle] = valeur;
      i += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const code = args['code'] || 'AK-0001';
  const nom = args['nom'] || 'Administrateur Ankkata';
  const identifiant = args['identifiant'] || 'admin.ankkata';
  const motDePasse = args['mot-de-passe'];
  const role = args['role'] || ROLE_ANKKATA.DIRECTION_GENERALE;

  if (!motDePasse) {
    console.error(
      '[erreur] --mot-de-passe est obligatoire (pas de valeur par défaut, pour éviter un mot de passe faible).',
    );
    console.error(
      'Exemple : node scripts/creer-compte-ankkata.js --identifiant aime.kabore --mot-de-passe "UnMotDePasseFort123!"',
    );
    process.exitCode = 1;
    return;
  }

  if (!Object.values(ROLE_ANKKATA).includes(role)) {
    console.error(`[erreur] --role invalide : "${role}". Valeurs possibles : ${Object.values(ROLE_ANKKATA).join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  const existant = await db.CompteAnkkata.findOne({ where: { identifiant } });
  if (existant) {
    console.log(`[info] Le compte "${identifiant}" existe déjà (code ${existant.code}) — rien à faire.`);
    return;
  }

  const motDePasseHash = await passwordService.hash(motDePasse);

  const compte = await db.CompteAnkkata.create({
    code,
    nom,
    identifiant,
    motDePasseHash,
    role,
    photoInitiales: nom
      .split(' ')
      .map((mot) => mot.charAt(0).toUpperCase())
      .slice(0, 2)
      .join(''),
  });

  console.log('[ok] Compte Ankkata créé :');
  console.log(`  code        : ${compte.code}`);
  console.log(`  identifiant : ${compte.identifiant}`);
  console.log(`  rôle        : ${compte.role}`);
  console.log('Connectez-vous depuis ankkata_admin avec cet identifiant et le mot de passe fourni.');
}

main()
  .catch((err) => {
    console.error('[erreur]', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });
