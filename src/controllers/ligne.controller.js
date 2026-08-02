// Lignes (itinéraires) du catalogue d'une compagnie — tarifs/horaires/
// arrêts/promotions sont des tables enfants gérées ici en même temps que
// la ligne (le client envoie des tableaux, on les remplace intégralement
// à chaque écriture plutôt que de gérer un diff fin).
const { Ligne, LigneTarif, LigneHoraire, LigneArret, Promotion, Agence } = require('../models');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { enregistrerAudit } = require('../services/audit.service');
const { buildSearchWhere, getPagination, buildPaginatedResponse } = require('./helpers');

const INCLUDE_COMPLET = [
  { model: LigneTarif, as: 'tarifs' },
  { model: LigneHoraire, as: 'horaires' },
  { model: LigneArret, as: 'arrets' },
  { model: Promotion, as: 'promotions' },
  { model: Agence, as: 'agenceDepart' },
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

const create = catchAsync(async (req, res) => {
  const { tarifs, horaires, arrets, promotions, ...champsLigne } = req.body;
  if (!tarifs || !tarifs.length) throw ApiError.badRequest('Au moins un tarif (Standard ou VIP) est requis.');
  if (!horaires || !horaires.length) throw ApiError.badRequest('Au moins un horaire de départ est requis.');

  const ligne = await Ligne.create({
    ...champsLigne,
    code: champsLigne.code || `RLN-${Date.now()}`,
    companyId: req.params.companyId,
  });
  await remplacerEnfants(ligne.id, { tarifs, horaires, arrets, promotions });

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

  const { tarifs, horaires, arrets, promotions, ...champsLigne } = req.body;
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

module.exports = { list, getOne, create, update, remove };
