// Tableaux de bord agrégés — remplace les getters/fonctions "calculés à la
// volée" des apps Flutter (notificationsAnkkata, recetteJourToutesCompagnies,
// compagniesAbonnementBientotExpire...) par de vraies requêtes d'agrégation
// SQL, puisque plus aucune donnée n'est dupliquée/simulée côté serveur.
const { Op, fn, col, literal } = require('sequelize');
const { Company, Agence, Bus, Ligne, Guichetier, Client, Vente, Trip, Reservation } = require('../models');
const catchAsync = require('../utils/catchAsync');

const recetteTotaleWhere = (extraWhere = {}) => ({
  annulee: false,
  ...extraWhere,
});

async function recetteVentes(where) {
  const result = await Vente.findOne({
    attributes: [[fn('COALESCE', fn('SUM', literal('prix_unitaire * nombre_places')), 0), 'total']],
    where: recetteTotaleWhere(where),
    raw: true,
  });
  return parseInt(result.total, 10) || 0;
}

/** GET /dashboard — vue d'ensemble Ankkata (toutes compagnies). */
const ankkataOverview = catchAsync(async (req, res) => {
  const [totalCompanies, parStatutRaw, dansTrenteJours, recetteTotale] = await Promise.all([
    Company.count(),
    Company.findAll({ attributes: ['statut', [fn('COUNT', col('id')), 'total']], group: ['statut'], raw: true }),
    Company.findAll({
      where: {
        statut: { [Op.notIn]: ['suspendue', 'archivee'] },
        dateExpirationAbonnement: {
          [Op.between]: [new Date().toISOString().slice(0, 10), new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10)],
        },
      },
      order: [['dateExpirationAbonnement', 'ASC']],
    }),
    recetteVentes({}),
  ]);

  const parStatut = Object.fromEntries(parStatutRaw.map((r) => [r.statut, parseInt(r.total, 10)]));

  res.json({
    totalCompanies,
    parStatut,
    abonnementsBientotExpires: dansTrenteJours,
    recetteTotalePlateforme: recetteTotale,
  });
});

/** GET /companies/:companyId/dashboard — vue d'ensemble d'une compagnie. */
const companyOverview = catchAsync(async (req, res) => {
  const companyId = req.params.companyId;
  const aujourdHui = new Date().toISOString().slice(0, 10);

  const [company, nbAgences, nbBus, nbLignes, nbGuichetiers, nbClients, recetteTotale, tripsAujourdhui, reservationsAujourdhui] =
    await Promise.all([
      Company.findByPk(companyId),
      Agence.count({ where: { companyId } }),
      Bus.count({ where: { companyId } }),
      Ligne.count({ where: { companyId } }),
      Guichetier.count({ where: { companyId } }),
      Client.count({ where: { companyId } }),
      recetteVentes({ companyId }),
      Trip.count({ where: { companyId, date: aujourdHui } }),
      Reservation.count({ where: { companyId, date: aujourdHui } }),
    ]);

  res.json({
    company,
    agences: nbAgences,
    buses: nbBus,
    lignes: nbLignes,
    guichetiers: nbGuichetiers,
    clients: nbClients,
    recetteTotale,
    tripsAujourdhui,
    reservationsAujourdhui,
  });
});

module.exports = { ankkataOverview, companyOverview };
