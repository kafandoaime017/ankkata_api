// Lignes (itinéraires) du catalogue d'une compagnie — tarifs/horaires/
// arrêts/promotions sont des tables enfants gérées ici en même temps que
// la ligne (le client envoie des tableaux, on les remplace intégralement
// à chaque écriture plutôt que de gérer un diff fin).
const { sequelize, Ligne, LigneTarif, LigneHoraire, LigneArret, Promotion, Agence } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { buildSearchWhere, getPagination, buildPaginatedResponse } = require('./helpers');
const { genererTrajetsPourLigneSurPeriode, JOURS_GENERATION_INITIALE } = require('../services/tripGeneration.service');
const { EQUIPEMENTS_LIGNE } = require('../constants/enums');

const INCLUDE_COMPLET = [
  { model: LigneTarif, as: 'tarifs' },
  { model: LigneHoraire, as: 'horaires' },
  { model: LigneArret, as: 'arrets' },
  { model: Promotion, as: 'promotions' },
  { model: Agence, as: 'agenceDepart' },
  { model: Agence, as: 'agenceArrivee' },
  // Nécessaire pour la vente aller-retour (voir vente.controller.js
  // #createAllerRetour) : le guichet a besoin de connaître la ligne retour
  // d'une ligne réversible pour proposer ses trajets à la vente.
  { model: Ligne, as: 'ligneRetour' },
];

const list = catchAsync(async (req, res) => {
  const where = { companyId: req.params.companyId, ...buildSearchWhere(req.query, ['villeArrivee']) };
  const { page, limit, offset } = getPagination(req.query);
  const result = await Ligne.findAndCountAll({
    where,
    limit,
    offset,
    order: [['villeArrivee', 'ASC']],
    include: INCLUDE_COMPLET,
    distinct: true,
  });
  res.json(buildPaginatedResponse(result, { page, limit }));
});

const getOne = catchAsync(async (req, res) => {
  const ligne = await Ligne.findOne({
    where: { id: req.params.id, companyId: req.params.companyId },
    include: INCLUDE_COMPLET,
  });
  if (!ligne) throw ApiError.notFound('Ligne introuvable.');
  res.json(ligne);
});

async function remplacerEnfants(ligneId, { tarifs, horaires, arrets, promotions }) {
  if (Array.isArray(tarifs)) {
    await LigneTarif.destroy({ where: { ligneId } });
    if (tarifs.length) await LigneTarif.bulkCreate(tarifs.map((t) => ({ ligneId, classe: t.classe, prix: t.prix })));
  }
  if (Array.isArray(horaires)) {
    await LigneHoraire.destroy({ where: { ligneId } });
    if (horaires.length) await LigneHoraire.bulkCreate(horaires.map((heure) => ({ ligneId, heure })));
  }
  if (Array.isArray(arrets)) {
    await LigneArret.destroy({ where: { ligneId } });
    if (arrets.length) {
      await LigneArret.bulkCreate(arrets.map((a, index) => ({ ligneId, ville: a.ville, ordre: a.ordre ?? index })));
    }
  }
  if (Array.isArray(promotions)) {
    await Promotion.destroy({ where: { ligneId } });
    if (promotions.length) {
      await Promotion.bulkCreate(
        promotions.map((p) => ({
          ligneId,
          libelle: p.libelle,
          dateDebut: p.dateDebut,
          dateFin: p.dateFin,
          reductionPourcentage: p.reductionPourcentage,
          active: p.active ?? true,
        }))
      );
    }
  }
}

/** Utilisé par `create` et `update` — la capacité doit toujours rester un entier positif. */
function validerCapacite(champsLigne) {
  if (champsLigne.capaciteTotale === undefined) return;
  const capacite = Number(champsLigne.capaciteTotale);
  if (!Number.isInteger(capacite) || capacite <= 0) {
    throw ApiError.badRequest('La capacité totale de la ligne doit être un nombre entier supérieur à 0.');
  }
}

/**
 * Utilisé par `create` et `update` — valide les sous-quotas par canal
 * (`quotaEnLigne`/`quotaGuichet`) et le délai de fermeture des réservations
 * en ligne (`delaiLimiteReservationEnLigneMinutes`). Chaque champ est
 * optionnel (NULL = pas de sous-quota/délai, voir modèle `Ligne`) ; quand il
 * est fourni, il doit rester cohérent avec la capacité totale — celle déjà
 * envoyée dans la même requête (`create`, où elle est obligatoire), ou celle
 * déjà en base (`update`, transmise via `ligneExistante` quand la requête ne
 * la modifie pas elle-même).
 */
function validerQuotasCanal(champsLigne, ligneExistante) {
  const capacite =
    champsLigne.capaciteTotale !== undefined ? Number(champsLigne.capaciteTotale) : ligneExistante?.capaciteTotale;

  function validerSousQuota(champ, libelle) {
    if (champsLigne[champ] === undefined || champsLigne[champ] === null) return;
    const valeur = Number(champsLigne[champ]);
    if (!Number.isInteger(valeur) || valeur < 0) {
      throw ApiError.badRequest(`Le quota de places ${libelle} doit être un nombre entier positif ou nul.`);
    }
    if (capacite !== undefined && capacite !== null && valeur > capacite) {
      throw ApiError.badRequest(`Le quota de places ${libelle} (${valeur}) ne peut pas dépasser la capacité totale de la ligne (${capacite}).`);
    }
  }

  validerSousQuota('quotaEnLigne', 'en ligne');
  validerSousQuota('quotaGuichet', 'guichet');

  if (champsLigne.delaiLimiteReservationEnLigneMinutes !== undefined && champsLigne.delaiLimiteReservationEnLigneMinutes !== null) {
    const delai = Number(champsLigne.delaiLimiteReservationEnLigneMinutes);
    if (!Number.isInteger(delai) || delai < 0) {
      throw ApiError.badRequest('Le délai limite de réservation en ligne doit être un nombre entier de minutes positif ou nul.');
    }
  }
}

/**
 * Utilisé par `create` et `update` — la réduction aller-retour, quand elle
 * est fournie, doit rester un pourcentage entier entre 0 et 100. N'exige PAS
 * que la ligne soit réversible : une valeur renseignée sur une ligne non
 * liée à aucune `ligneRetourId` est simplement sans effet (voir
 * `public.controller.js#createReservationAllerRetour`, qui ne l'applique que
 * si les deux trajets appartiennent bien à la paire réversible).
 */
function validerReductionAllerRetour(champsLigne) {
  if (champsLigne.reductionAllerRetourPourcentage === undefined || champsLigne.reductionAllerRetourPourcentage === null) return;
  const valeur = Number(champsLigne.reductionAllerRetourPourcentage);
  if (!Number.isInteger(valeur) || valeur < 0 || valeur > 100) {
    throw ApiError.badRequest('La réduction aller-retour doit être un pourcentage entier entre 0 et 100.');
  }
}

/**
 * Utilisé par `create` et `update` — `equipements` (services inclus :
 * climatisation, wifi, repas...) doit être un tableau de codes valides,
 * tirés de `EQUIPEMENTS_LIGNE` (voir constants/enums.js). Champ optionnel :
 * absent = inchangé (`update`) ou tableau vide (`create`, valeur par défaut
 * du modèle) ; explicitement `[]` = on vide la liste.
 */
function validerEquipements(champsLigne) {
  if (champsLigne.equipements === undefined) return;
  if (!Array.isArray(champsLigne.equipements)) {
    throw ApiError.badRequest('equipements doit être un tableau de codes.');
  }
  const inconnus = champsLigne.equipements.filter((code) => !EQUIPEMENTS_LIGNE.includes(code));
  if (inconnus.length > 0) {
    throw ApiError.badRequest(`Équipement(s) inconnu(s) : ${inconnus.join(', ')}.`);
  }
  // Dédoublonne au passage — le client ne devrait jamais envoyer de doublon,
  // mais autant ne pas le persister si jamais.
  champsLigne.equipements = [...new Set(champsLigne.equipements)];
}

/**
 * Résout et valide la gare d'arrivée (`agenceArriveeId`) — les "gares" sont
 * les Agences de la compagnie (mêmes objets que pour le départ), donc plus
 * aucun champ libre n'est accepté depuis le client pour l'arrivée : voir
 * migration `add-agence-arrivee-id-to-lignes`. `villeArrivee` est dérivé
 * automatiquement de `agenceArrivee.ville` ci-dessous plutôt que d'être
 * accepté tel quel (préserve la recherche voyageur par ville, qui continue
 * de lire `Ligne.villeArrivee` sans aucun changement de son côté).
 */
async function resoudreGareArrivee(companyId, agenceArriveeId, agenceDepartId) {
  if (!agenceArriveeId) {
    throw ApiError.badRequest("La gare d'arrivée est requise.");
  }
  if (agenceDepartId && agenceArriveeId === agenceDepartId) {
    throw ApiError.badRequest("La gare d'arrivée doit être différente de la gare de départ.");
  }
  const agenceArrivee = await Agence.findOne({ where: { id: agenceArriveeId, companyId } });
  if (!agenceArrivee) {
    throw ApiError.badRequest("Gare d'arrivée introuvable pour cette compagnie.");
  }
  return agenceArrivee;
}

const create = catchAsync(async (req, res) => {
  // `ligneAllerId` : champ transitoire (jamais persisté sur `Ligne`, voir
  // destructuration ci-dessous) envoyé uniquement quand l'admin crée le
  // trajet RETOUR d'une paire de "lignes réversibles" (voir
  // `lignes_tarifs_screen.dart`) — permet de lier les deux lignes l'une à
  // l'autre via `ligneRetourId` dès la création, au lieu de ne compter que
  // sur la convention villeArrivee/agenceDepartId (fragile) pour résoudre le
  // trajet retour au moment d'une vente aller-retour.
  //
  // `agenceArriveeId`/`villeArrivee` sont retirés de `champsLigne` ici car
  // traités à part juste en dessous (voir `resoudreGareArrivee`) —
  // `villeArrivee` n'est donc jamais pris depuis le corps de la requête,
  // même si un ancien client l'envoie encore.
  const { tarifs, horaires, arrets, promotions, ligneAllerId, agenceArriveeId, villeArrivee, ...champsLigne } = req.body;
  if (!tarifs || !tarifs.length) throw ApiError.badRequest('Au moins un tarif (Standard ou VIP) est requis.');
  if (!horaires || !horaires.length) throw ApiError.badRequest('Au moins un horaire de départ est requis.');
  if (!champsLigne.capaciteTotale) throw ApiError.badRequest('La capacité totale de la ligne (nombre de places) est requise.');
  validerCapacite(champsLigne);
  validerQuotasCanal(champsLigne);
  validerReductionAllerRetour(champsLigne);
  validerEquipements(champsLigne);

  const agenceArrivee = await resoudreGareArrivee(req.params.companyId, agenceArriveeId, champsLigne.agenceDepartId);
  champsLigne.agenceArriveeId = agenceArrivee.id;
  champsLigne.villeArrivee = agenceArrivee.ville;

  const ligne = await sequelize.transaction(async (transaction) => {
    const nouvelleLigne = await Ligne.create(
      {
        ...champsLigne,
        code: champsLigne.code || `RLN-${Date.now()}`,
        companyId: req.params.companyId,
      },
      { transaction }
    );

    if (ligneAllerId) {
      const ligneAller = await Ligne.findOne({
        where: { id: ligneAllerId, companyId: req.params.companyId },
        transaction,
      });
      if (ligneAller) {
        await nouvelleLigne.update({ ligneRetourId: ligneAller.id }, { transaction });
        await ligneAller.update({ ligneRetourId: nouvelleLigne.id }, { transaction });
      }
    }

    return nouvelleLigne;
  });
  await remplacerEnfants(ligne.id, { tarifs, horaires, arrets, promotions });

  // Génère d'un coup les ~2 prochains mois de trajets pour cette ligne — la
  // compagnie n'a plus besoin de cliquer sur "Générer" au jour le jour dès
  // le départ (voir doc de tête de `tripGeneration.service.js`). Ne doit
  // jamais faire échouer la création de la ligne elle-même : si ça rate
  // (panne DB passagère...), la ligne existe quand même et peut toujours
  // être générée manuellement ensuite (bouton "Générer pour cette date").
  if (ligne.active) {
    try {
      const ligneAvecHoraires = await Ligne.findByPk(ligne.id, { include: [{ model: LigneHoraire, as: 'horaires' }] });
      await genererTrajetsPourLigneSurPeriode(ligneAvecHoraires);
    } catch (err) {
      console.error(`[lignes] Échec de la génération automatique des trajets pour la ligne ${ligne.id} :`, err);
    }
  }

  await enregistrerAudit({
    action: 'Création de ligne',
    details: `Ligne vers "${ligne.villeArrivee}" ajoutée.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });

  const complet = await Ligne.findByPk(ligne.id, { include: INCLUDE_COMPLET });
  res.status(201).json(complet);
});

const update = catchAsync(async (req, res) => {
  const ligne = await Ligne.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!ligne) throw ApiError.notFound('Ligne introuvable.');

  const { tarifs, horaires, arrets, promotions, agenceArriveeId, villeArrivee, ...champsLigne } = req.body;
  validerCapacite(champsLigne);
  validerQuotasCanal(champsLigne, ligne);
  validerReductionAllerRetour(champsLigne);
  validerEquipements(champsLigne);

  // `agenceArriveeId` reste optionnel ICI (mise à jour partielle) : s'il est
  // fourni on revalide/dérive comme à la création, sinon la gare d'arrivée
  // existante de la ligne n'est pas touchée.
  if (agenceArriveeId !== undefined) {
    const agenceArrivee = await resoudreGareArrivee(
      req.params.companyId,
      agenceArriveeId,
      champsLigne.agenceDepartId ?? ligne.agenceDepartId
    );
    champsLigne.agenceArriveeId = agenceArrivee.id;
    champsLigne.villeArrivee = agenceArrivee.ville;
  }

  await ligne.update(champsLigne);
  await remplacerEnfants(ligne.id, { tarifs, horaires, arrets, promotions });

  await enregistrerAudit({
    action: 'Modification de ligne',
    details: `Ligne "${ligne.villeArrivee}" mise à jour.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });

  const complet = await Ligne.findByPk(ligne.id, { include: INCLUDE_COMPLET });
  res.json(complet);
});

/**
 * POST /companies/:companyId/lignes/:id/generer — génère (ou complète, de
 * façon idempotente) les `JOURS_GENERATION_INITIALE` (~2 mois) prochains
 * jours de trajets pour CETTE ligne. Une ligne nouvellement créée le fait
 * déjà automatiquement (voir `create` ci-dessus) ; cette route sert à
 * rattraper les lignes créées AVANT ce comportement, ou à repousser
 * l'horizon d'une ligne existante sans attendre une génération date par
 * date via `trip.controller.js#generateForDate`.
 */
const genererProchainsMois = catchAsync(async (req, res) => {
  const ligne = await Ligne.findOne({
    where: { id: req.params.id, companyId: req.params.companyId },
    include: [{ model: LigneHoraire, as: 'horaires' }],
  });
  if (!ligne) throw ApiError.notFound('Ligne introuvable.');
  if (!ligne.horaires.length) {
    throw ApiError.badRequest('Cette ligne n\'a aucun horaire de départ — ajoutez-en au moins un avant de générer des trajets.');
  }

  await genererTrajetsPourLigneSurPeriode(ligne);

  await enregistrerAudit({
    action: 'Génération de trajets (ligne)',
    details: `${JOURS_GENERATION_INITIALE} jours générés pour la ligne vers "${ligne.villeArrivee}".`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });

  res.status(201).json({ message: `Trajets générés pour les ${JOURS_GENERATION_INITIALE} prochains jours.`, jours: JOURS_GENERATION_INITIALE });
});

const remove = catchAsync(async (req, res) => {
  const ligne = await Ligne.findOne({ where: { id: req.params.id, companyId: req.params.companyId } });
  if (!ligne) throw ApiError.notFound('Ligne introuvable.');

  await ligne.destroy();
  await enregistrerAudit({
    action: 'Suppression de ligne',
    details: `Ligne "${ligne.villeArrivee}" supprimée.`,
    companyId: req.params.companyId,
    auteur: req.auth,
  });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove, genererProchainsMois };
