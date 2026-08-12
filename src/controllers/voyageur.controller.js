// Compte voyageur (espace public, "Mon compte" sur ankkata_frontend) —
// connexion/inscription/profil pour un internaute, indépendamment de toute
// compagnie. Suit le même schéma de jeton que les 3 autres espaces (voir
// auth.controller.js/token.service.js) : `espace: 'voyageur'` dans le
// payload JWT, lu par le même `authenticate` middleware.
//
// AUTHENTIFICATION PAR TÉLÉPHONE + CODE OTP (SMS) — pas de mot de passe.
// `demanderOtp` crée le compte à la première demande si le téléphone est
// inconnu (nom/prenom requis dans ce cas), génère un code à 6 chiffres et
// l'envoie par SMS via services/notification (voir CANAL_NOTIFICATION et
// SMS_PROVIDER dans .env). `verifierOtp` valide le code et émet les jetons.
//
// MODE DÉVELOPPEMENT SANS FOURNISSEUR SMS CONFIGURÉ : si l'envoi réel échoue
// (ex. AFRICASTALKING_API_KEY vide, clé de test, etc.) hors production, le
// code est quand même renvoyé dans la réponse HTTP (`codeSimule`) pour ne
// jamais bloquer les tests — exactement le même principe que le paiement
// simulé Orange Money/Moov Money. En production (NODE_ENV=production),
// l'échec d'envoi est remonté comme une vraie erreur.
const { CompteVoyageur, Reservation, Trip, Ligne, LigneTarif, Agence, Company } = require('../models');
const passwordService = require('../services/password.service');
const tokenService = require('../services/token.service');
const { genererCodePin } = require('../utils/idGenerator');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { ESPACES } = require('../constants/roles');
const env = require('../config/env');
const { envoyerCodeConnexion, envoyerCodeConnexionEmail } = require('../services/notification');

const DUREE_VALIDITE_CODE_MS = 10 * 60 * 1000; // 10 minutes
const TENTATIVES_MAX = 5;

function emettreJetons(compte) {
  const payload = { sub: compte.id, espace: ESPACES.VOYAGEUR, nom: compte.nom, prenom: compte.prenom, telephone: compte.telephone };
  return {
    accessToken: tokenService.signAccessToken(payload),
    refreshToken: tokenService.signRefreshToken({ sub: compte.id, espace: ESPACES.VOYAGEUR }),
  };
}

function compteResume(compte) {
  return {
    id: compte.id,
    nom: compte.nom,
    prenom: compte.prenom,
    email: compte.email,
    telephone: compte.telephone,
  };
}

function normaliserTelephone(telephone) {
  return String(telephone || '').trim().replace(/[\s.-]/g, '');
}

function normaliserEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * POST /voyageur/otp/demander — { telephone, nom?, prenom? }
 * Si le téléphone correspond à un compte existant, envoie simplement un
 * nouveau code. Sinon, `nom`/`prenom` sont requis pour créer le compte à la
 * volée (première connexion = inscription).
 */
const demanderOtp = catchAsync(async (req, res) => {
  const { nom, prenom } = req.body;
  const telephone = normaliserTelephone(req.body.telephone);
  if (!telephone) throw ApiError.badRequest('telephone est requis.');

  let compte = await CompteVoyageur.findOne({ where: { telephone } });
  if (!compte) {
    if (!nom || !prenom) {
      throw ApiError.badRequest('Nouveau numéro : nom et prenom sont requis pour créer le compte.');
    }
    compte = await CompteVoyageur.create({ nom, prenom, telephone });
  } else if (!compte.actif) {
    throw ApiError.unauthorized('Ce compte est désactivé.');
  }

  const code = genererCodePin();
  compte.codeVerificationHash = await passwordService.hash(code);
  compte.codeVerificationExpireAt = new Date(Date.now() + DUREE_VALIDITE_CODE_MS);
  compte.otpTentatives = 0;
  await compte.save();

  const reponse = { telephone: compte.telephone, nouveauCompte: !compte.nom ? false : undefined };
  try {
    await envoyerCodeConnexion({ telephone: compte.telephone, code });
  } catch (err) {
    if (env.isProduction) throw ApiError.internal(`Envoi du code par SMS impossible : ${err.message}`);
    // Hors production : on ne bloque jamais le test faute de fournisseur SMS
    // configuré — le code est renvoyé en clair, avec un avertissement.
    reponse.codeSimule = code;
    reponse.avertissement = `SMS non envoyé (${err.message}) — code affiché uniquement parce que NODE_ENV n'est pas "production".`;
  }

  res.status(200).json(reponse);
});

/** POST /voyageur/otp/verifier — { telephone, code } */
const verifierOtp = catchAsync(async (req, res) => {
  const telephone = normaliserTelephone(req.body.telephone);
  const { code } = req.body;
  if (!telephone || !code) throw ApiError.badRequest('telephone et code sont requis.');

  const compte = await CompteVoyageur.findOne({ where: { telephone } });
  if (!compte || !compte.actif) throw ApiError.unauthorized('Compte introuvable ou désactivé.');

  if (!compte.codeVerificationHash || !compte.codeVerificationExpireAt || compte.codeVerificationExpireAt.getTime() < Date.now()) {
    throw ApiError.badRequest('Code expiré ou inexistant — demandez un nouveau code.');
  }
  if ((compte.otpTentatives || 0) >= TENTATIVES_MAX) {
    throw ApiError.badRequest('Trop de tentatives — demandez un nouveau code.');
  }

  const valide = await passwordService.compare(String(code), compte.codeVerificationHash);
  if (!valide) {
    compte.otpTentatives = (compte.otpTentatives || 0) + 1;
    await compte.save();
    throw ApiError.unauthorized('Code incorrect.');
  }

  compte.codeVerificationHash = null;
  compte.codeVerificationExpireAt = null;
  compte.otpTentatives = 0;
  await compte.save();

  res.json({ ...emettreJetons(compte), compte: compteResume(compte) });
});

/**
 * POST /voyageur/email/demander — { email, nom?, prenom?, telephone? }
 * Connexion alternative "se connecter par email", en plus du téléphone
 * ci-dessus — voir demande explicite du client. Même principe que
 * `demanderOtp` : si l'email correspond à un compte existant, un nouveau
 * code est envoyé PAR EMAIL. Sinon (email inconnu), `nom`/`prenom`/
 * `telephone` sont requis pour créer le compte à la volée — `telephone` est
 * en plus du nom/prénom ici car `CompteVoyageur.telephone` est obligatoire
 * et unique en base (voir compteVoyageur.model.js) : impossible de créer un
 * compte sans lui, contrairement au flux téléphone où l'email est optionnel.
 */
const demanderOtpEmail = catchAsync(async (req, res) => {
  const { nom, prenom } = req.body;
  const email = normaliserEmail(req.body.email);
  if (!email || !email.includes('@')) throw ApiError.badRequest('Adresse email invalide.');

  let compte = await CompteVoyageur.findOne({ where: { email } });
  if (!compte) {
    const telephone = normaliserTelephone(req.body.telephone);
    if (!nom || !prenom || !telephone) {
      throw ApiError.badRequest('Nouvel email : nom, prenom et telephone sont requis pour créer le compte.');
    }
    const telephoneDejaUtilise = await CompteVoyageur.findOne({ where: { telephone } });
    if (telephoneDejaUtilise) {
      throw ApiError.badRequest(
        'Ce numéro de téléphone est déjà associé à un compte existant — connectez-vous par téléphone, puis ajoutez cet email depuis Mon compte.'
      );
    }
    compte = await CompteVoyageur.create({ nom, prenom, telephone, email });
  } else if (!compte.actif) {
    throw ApiError.unauthorized('Ce compte est désactivé.');
  }

  const code = genererCodePin();
  compte.codeVerificationHash = await passwordService.hash(code);
  compte.codeVerificationExpireAt = new Date(Date.now() + DUREE_VALIDITE_CODE_MS);
  compte.otpTentatives = 0;
  await compte.save();

  const reponse = { email: compte.email };
  try {
    await envoyerCodeConnexionEmail({ email: compte.email, code });
  } catch (err) {
    if (env.isProduction) throw ApiError.internal(`Envoi du code par email impossible : ${err.message}`);
    // Hors production : même principe que demanderOtp — ne jamais bloquer
    // le test faute de SMTP configuré.
    reponse.codeSimule = code;
    reponse.avertissement = `Email non envoyé (${err.message}) — code affiché uniquement parce que NODE_ENV n'est pas "production".`;
  }

  res.status(200).json(reponse);
});

/** POST /voyageur/email/verifier — { email, code } */
const verifierOtpEmail = catchAsync(async (req, res) => {
  const email = normaliserEmail(req.body.email);
  const { code } = req.body;
  if (!email || !code) throw ApiError.badRequest('email et code sont requis.');

  const compte = await CompteVoyageur.findOne({ where: { email } });
  if (!compte || !compte.actif) throw ApiError.unauthorized('Compte introuvable ou désactivé.');

  if (!compte.codeVerificationHash || !compte.codeVerificationExpireAt || compte.codeVerificationExpireAt.getTime() < Date.now()) {
    throw ApiError.badRequest('Code expiré ou inexistant — demandez un nouveau code.');
  }
  if ((compte.otpTentatives || 0) >= TENTATIVES_MAX) {
    throw ApiError.badRequest('Trop de tentatives — demandez un nouveau code.');
  }

  const valide = await passwordService.compare(String(code), compte.codeVerificationHash);
  if (!valide) {
    compte.otpTentatives = (compte.otpTentatives || 0) + 1;
    await compte.save();
    throw ApiError.unauthorized('Code incorrect.');
  }

  compte.codeVerificationHash = null;
  compte.codeVerificationExpireAt = null;
  compte.otpTentatives = 0;
  compte.emailVerifie = true;
  await compte.save();

  res.json({ ...emettreJetons(compte), compte: compteResume(compte) });
});

/** GET /voyageur/me — profil du compte connecté. */
const me = catchAsync(async (req, res) => {
  const compte = await CompteVoyageur.findByPk(req.auth.sub);
  if (!compte || !compte.actif) throw ApiError.unauthorized('Compte introuvable ou désactivé.');
  res.json({ compte: compteResume(compte) });
});

/** PATCH /voyageur/me — { nom?, prenom?, email? } */
const updateProfile = catchAsync(async (req, res) => {
  const compte = await CompteVoyageur.findByPk(req.auth.sub);
  if (!compte || !compte.actif) throw ApiError.unauthorized('Compte introuvable ou désactivé.');

  const { nom, prenom, email } = req.body;
  if (nom !== undefined) compte.nom = nom;
  if (prenom !== undefined) compte.prenom = prenom;
  if (email !== undefined) compte.email = email ? String(email).trim().toLowerCase() : null;
  await compte.save();

  res.json({ compte: compteResume(compte) });
});

/** GET /voyageur/reservations — réservations posées par ce compte connecté, toutes compagnies confondues. */
const mesReservations = catchAsync(async (req, res) => {
  const reservations = await Reservation.findAll({
    where: { compteVoyageurId: req.auth.sub },
    order: [['dateReservation', 'DESC']],
    // `subQuery: false` défensif : l'inclusion d'un hasMany (`Ligne.tarifs`)
    // imbriqué à deux niveaux sous un belongsTo peut, selon la version de
    // Sequelize, déclencher son wrapping automatique en sous-requête et
    // produire un FROM/SELECT invalide — bug déjà rencontré et corrigé de la
    // même façon ailleurs dans cette API (voir createReservationAllerRetour
    // / lookup de réservations liées, tâches #530-532).
    subQuery: false,
    include: [
      {
        model: Trip,
        as: 'trip',
        include: [
          { model: Ligne, as: 'ligne', include: [{ model: LigneTarif, as: 'tarifs' }] },
          { model: Agence, as: 'agenceDepart' },
          { model: Company, as: 'company' },
        ],
      },
    ],
  });
  res.json({ reservations });
});

module.exports = { demanderOtp, verifierOtp, demanderOtpEmail, verifierOtpEmail, me, updateProfile, mesReservations };
