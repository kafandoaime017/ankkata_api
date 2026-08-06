// Gestion des compagnies clientes (tenants) — réservé à l'équipe Ankkata
// (voir routes/company.routes.js pour le détail des permissions par route).
const fs = require('fs');
const path = require('path');
const { Company } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { genererCleActivation } = require('../utils/idGenerator');
const { buildSearchWhere, findAndRespond } = require('./helpers');
const { UPLOADS_ROOT } = require('../middlewares/upload.middleware');

const list = catchAsync(async (req, res) => {
  const where = buildSearchWhere(req.query, ['nom', 'ville', 'pays', 'code']);
  await findAndRespond(res, Company, where, { query: req.query, order: [['nom', 'ASC']] });
});

const getOne = catchAsync(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) throw ApiError.notFound('Compagnie introuvable.');
  res.json(company);
});

/** GET /companies/activation/:cleActivation — endpoint public utilisé par l'app compagnie à l'activation. */
const lookupByActivationKey = catchAsync(async (req, res) => {
  const company = await Company.findOne({ where: { cleActivation: req.params.cleActivation } });
  if (!company) throw ApiError.notFound('Clé d\'activation inconnue.');
  res.json({
    id: company.id,
    nom: company.nom,
    logoPath: company.logoPath,
    couleurPrimaire: company.couleurPrimaire,
    couleurSecondaire: company.couleurSecondaire,
    devise: company.devise,
    fuseauHoraire: company.fuseauHoraire,
    enTeteTicket: company.enTeteTicket,
    piedPageTicket: company.piedPageTicket,
    afficherLogoSurTicket: company.afficherLogoSurTicket,
  });
});

const create = catchAsync(async (req, res) => {
  const donnees = { ...req.body };
  if (!donnees.cleActivation) donnees.cleActivation = genererCleActivation();
  if (!donnees.code) donnees.code = `CIE-${Date.now()}`;
  if (!donnees.dateExpirationAbonnement) {
    // Colonne obligatoire en base mais jamais saisie depuis le formulaire de
    // création (ankkata_admin) — on démarre par défaut une période d'essai
    // de 30 jours, ajustable ensuite via "Renouveler l'abonnement".
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 30);
    donnees.dateExpirationAbonnement = expiration.toISOString().slice(0, 10);
  }

  const company = await Company.create(donnees);
  await enregistrerAudit({
    action: 'Provisioning de compagnie',
    details: `Compagnie "${company.nom}" provisionnée (clé ${company.cleActivation}).`,
    auteur: req.auth,
  });
  res.status(201).json(company);
});

const update = catchAsync(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) throw ApiError.notFound('Compagnie introuvable.');

  const ancienLogoPath = company.logoPath;
  await company.update(req.body);

  // Si le logo a été retiré ou remplacé par un autre chemin depuis cet
  // écran (plutôt que via POST /:id/logo), on nettoie l'ancien fichier pour
  // ne pas laisser d'images orphelines sur le volume uploads/.
  if (ancienLogoPath && ancienLogoPath !== company.logoPath && ancienLogoPath.startsWith('/uploads/logos/')) {
    const ancienChemin = path.join(UPLOADS_ROOT, ancienLogoPath.replace('/uploads/', ''));
    fs.unlink(ancienChemin, () => {});
  }

  await enregistrerAudit({
    action: 'Modification de compagnie',
    details: `Fiche de "${company.nom}" mise à jour.`,
    companyId: company.id,
    auteur: req.auth,
  });
  res.json(company);
});

const regenerateActivationKey = catchAsync(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) throw ApiError.notFound('Compagnie introuvable.');

  const nouvelleCle = genererCleActivation();
  await company.update({ cleActivation: nouvelleCle });
  await enregistrerAudit({
    action: 'Régénération de clé d\'activation',
    details: `Nouvelle clé générée pour "${company.nom}" : ${nouvelleCle}.`,
    companyId: company.id,
    auteur: req.auth,
  });
  res.json(company);
});

/** POST /companies/:id/renew-subscription — { jours } */
const renewSubscription = catchAsync(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) throw ApiError.notFound('Compagnie introuvable.');

  const jours = parseInt(req.body.jours, 10) || 30;
  const base = new Date(company.dateExpirationAbonnement) > new Date() ? new Date(company.dateExpirationAbonnement) : new Date();
  base.setDate(base.getDate() + jours);

  const nouveauStatut = company.statut === 'suspendue' ? 'active' : company.statut;
  await company.update({ dateExpirationAbonnement: base.toISOString().slice(0, 10), statut: nouveauStatut });

  await enregistrerAudit({
    action: 'Renouvellement d\'abonnement',
    details: `Abonnement de "${company.nom}" prolongé jusqu'au ${base.toISOString().slice(0, 10)}.`,
    companyId: company.id,
    auteur: req.auth,
  });
  res.json(company);
});

/**
 * POST /companies/:id/logo (équipe Ankkata, via l'id direct) ou
 * POST /companies/:companyId/branding/logo (administrateur de la compagnie,
 * scopé par `enforceCompanyScope` — voir routes/company.routes.js) —
 * multipart/form-data, champ "logo" (voir middlewares/upload.middleware.js).
 */
const uploadLogo = catchAsync(async (req, res) => {
  const companyId = req.params.companyId || req.params.id;
  const company = await Company.findByPk(companyId);
  if (!company) throw ApiError.notFound('Compagnie introuvable.');
  if (!req.file) throw ApiError.badRequest('Aucun fichier "logo" reçu.');

  const ancienLogoPath = company.logoPath;
  const logoPath = `/uploads/logos/${req.file.filename}`;
  await company.update({ logoPath });

  // Le fichier précédent (s'il existait) n'est plus référencé : on le
  // supprime pour ne pas accumuler d'anciens logos sur le disque/volume.
  if (ancienLogoPath && ancienLogoPath.startsWith('/uploads/logos/')) {
    const ancienChemin = path.join(UPLOADS_ROOT, ancienLogoPath.replace('/uploads/', ''));
    fs.unlink(ancienChemin, () => {});
  }

  await enregistrerAudit({
    action: 'Mise à jour du logo',
    details: `Logo de "${company.nom}" mis à jour.`,
    companyId: company.id,
    auteur: req.auth,
  });
  res.json(company);
});

/**
 * DELETE /companies/:id/logo (Ankkata) ou
 * DELETE /companies/:companyId/branding/logo (administrateur de la compagnie)
 * — retire le logo sans en uploader un nouveau.
 */
const removeLogo = catchAsync(async (req, res) => {
  const companyId = req.params.companyId || req.params.id;
  const company = await Company.findByPk(companyId);
  if (!company) throw ApiError.notFound('Compagnie introuvable.');

  const ancienLogoPath = company.logoPath;
  await company.update({ logoPath: null });
  if (ancienLogoPath && ancienLogoPath.startsWith('/uploads/logos/')) {
    const ancienChemin = path.join(UPLOADS_ROOT, ancienLogoPath.replace('/uploads/', ''));
    fs.unlink(ancienChemin, () => {});
  }

  await enregistrerAudit({
    action: 'Retrait du logo',
    details: `Logo de "${company.nom}" retiré.`,
    companyId: company.id,
    auteur: req.auth,
  });
  res.json(company);
});

// Seuls ces champs sont modifiables par l'administrateur de la compagnie
// lui-même (voir updateBranding ci-dessous) — tout le reste (nom, statut,
// plan, clé d'activation...) reste réservé à l'équipe Ankkata via `update`.
const CHAMPS_BRANDING_MODIFIABLES = [
  'couleurPrimaire',
  'couleurSecondaire',
  'devise',
  'fuseauHoraire',
  'enTeteTicket',
  'piedPageTicket',
  'afficherLogoSurTicket',
];

/**
 * PATCH /companies/:companyId/branding — identité visuelle + réglages
 * régionaux/ticket, en self-service pour l'administrateur de la compagnie
 * (voir ankata_guichet, écran Paramètres compagnie). Distinct de `update`
 * (réservé à l'équipe Ankkata) pour ne jamais exposer les champs sensibles
 * (statut, plan, clé d'activation) à un compte qui n'est pas Ankkata.
 */
const updateBranding = catchAsync(async (req, res) => {
  const company = await Company.findByPk(req.params.companyId);
  if (!company) throw ApiError.notFound('Compagnie introuvable.');

  const donnees = {};
  for (const champ of CHAMPS_BRANDING_MODIFIABLES) {
    if (req.body[champ] !== undefined) donnees[champ] = req.body[champ];
  }

  await company.update(donnees);
  await enregistrerAudit({
    action: 'Modification de l\'identité visuelle',
    details: `Identité visuelle/réglages de "${company.nom}" mis à jour.`,
    companyId: company.id,
    auteur: req.auth,
  });
  res.json(company);
});

/**
 * PATCH /companies/:id/status — { statut } parmi active/essai/suspendue/archivee
 *
 * IMPORTANT — la suspension (palier 3) et la résiliation (palier 4) sont
 * TOUJOURS déclenchées ici par une action humaine explicite de l'équipe
 * Ankkata, jamais par un job automatique (cette API n'en a d'ailleurs
 * aucun) : voir services/abonnement.service.js. Un impayé au Burkina, c'est
 * souvent un patron en déplacement ou un virement en retard — un appel
 * règle 90% des cas et vaut mieux qu'une coupure surprise.
 *
 * La suspension elle-même ne coupe rien immédiatement : elle n'est
 * vérifiée qu'à la connexion (voir auth.controller.js), jamais en cours de
 * session — une vente en cours n'est donc jamais interrompue.
 */
const changeStatus = catchAsync(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) throw ApiError.notFound('Compagnie introuvable.');

  const { statut } = req.body;
  if (!['active', 'essai', 'suspendue', 'archivee'].includes(statut)) {
    throw ApiError.badRequest('Statut invalide.');
  }

  const donnees = { statut };
  if (statut === 'suspendue' && company.statut !== 'suspendue') {
    donnees.suspensionDemandeeAt = new Date();
  }
  if (statut === 'archivee' && company.statut !== 'archivee') {
    donnees.resiliationAt = new Date();
  }
  // Réactivation (palier 3 -> actif) : "le jour où quelqu'un paie, il ne
  // doit pas attendre" — on efface l'horodatage de suspension pour que le
  // prochain calcul de palier reparte propre, et la levée est répercutée
  // dès le prochain heartbeat/synchro (voir poste.controller.js#heartbeat),
  // pas seulement à la prochaine connexion.
  if (statut === 'active') {
    donnees.suspensionDemandeeAt = null;
  }

  await company.update(donnees);
  const libelles = { active: 'Réactivation', suspendue: 'Suspension', archivee: 'Archivage (résiliation)', essai: 'Passage en essai' };
  await enregistrerAudit({
    action: `${libelles[statut]} de compagnie`,
    details: `Compagnie "${company.nom}" : statut changé en "${statut}".`,
    companyId: company.id,
    auteur: req.auth,
  });
  res.json(company);
});

module.exports = {
  list,
  getOne,
  lookupByActivationKey,
  create,
  update,
  uploadLogo,
  removeLogo,
  updateBranding,
  regenerateActivationKey,
  renewSubscription,
  changeStatus,
};
