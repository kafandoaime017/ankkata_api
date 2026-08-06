// Génération des trajets (départs concrets) à partir des horaires
// récurrents d'une ligne. Deux usages :
//  - `genererTrajetsPourLigneSurPeriode` : appelée UNE FOIS à la création
//    d'une ligne (voir `ligne.controller.js#create`) — génère d'un coup les
//    ~2 prochains mois de trajets pour CETTE ligne, pour que la compagnie
//    n'ait plus jamais besoin de cliquer sur un bouton au jour le jour dès
//    le départ.
//  - `genererTrajetsPourCompagnie` : génération manuelle ponctuelle pour UNE
//    date précise, toutes lignes actives d'une compagnie confondues (voir
//    `trip.controller.js#generateForDate`) — reste utile pour étendre
//    l'horizon au-delà des ~2 mois initiaux, ou combler un trou (ex. horaire
//    ajouté après coup sur une ligne existante), toujours à la demande.
//
// Idempotentes toutes les deux : la contrainte unique (ligne_id, date,
// heure_depart) protège contre les doublons, qu'on utilise `findOrCreate`
// (une date à la fois) ou `bulkCreate({ ignoreDuplicates: true })` (beaucoup
// de dates d'un coup, bien plus rapide qu'une boucle de `findOrCreate`).
const { Ligne, LigneHoraire, Trip } = require('../models');

/** Nombre de jours couverts par la génération automatique à la création d'une ligne (~2 mois). */
const JOURS_GENERATION_INITIALE = 60;

/** Date UTC (YYYY-MM-DD) — Burkina Faso = UTC+0 toute l'année, aucune conversion de fuseau nécessaire. */
function dateIsoDansNJours(offsetJours) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetJours);
  return d.toISOString().slice(0, 10);
}

/**
 * Génère en une seule fois les trajets des `joursAVenir` prochains jours
 * pour UNE ligne (tous ses horaires) — utilisée à la création d'une ligne.
 * @param {object} ligne - instance Sequelize `Ligne`, doit avoir `horaires` chargés (ou les recharge elle-même sinon)
 * @param {number} joursAVenir
 * @returns {Promise<number>} nombre de lignes candidates envoyées (pas nécessairement toutes créées si certaines existaient déjà)
 */
async function genererTrajetsPourLigneSurPeriode(ligne, joursAVenir = JOURS_GENERATION_INITIALE) {
  const horaires = ligne.horaires ?? (await LigneHoraire.findAll({ where: { ligneId: ligne.id } }));
  if (!horaires.length) return 0;

  const rows = [];
  for (let offset = 0; offset < joursAVenir; offset += 1) {
    const date = dateIsoDansNJours(offset);
    for (const h of horaires) {
      rows.push({
        companyId: ligne.companyId,
        ligneId: ligne.id,
        agenceDepartId: ligne.agenceDepartId,
        busId: ligne.busId,
        date,
        heureDepart: h.heure,
        statut: 'prevu',
      });
    }
  }
  if (rows.length) await Trip.bulkCreate(rows, { ignoreDuplicates: true });
  return rows.length;
}

/**
 * Génération MANUELLE, à la demande, pour UNE date précise — toutes les
 * lignes actives d'une compagnie. Utilisée pour étendre l'horizon au-delà
 * des ~2 mois générés automatiquement à la création, ou pour une ligne dont
 * les horaires ont changé après coup.
 * @param {string} companyId
 * @param {string} date - 'YYYY-MM-DD'
 * @returns {Promise<number>} nombre de trajets effectivement créés (0 si déjà tous générés)
 */
async function genererTrajetsPourCompagnie(companyId, date) {
  const lignes = await Ligne.findAll({
    where: { companyId, active: true },
    include: [{ model: LigneHoraire, as: 'horaires' }],
  });

  let crees = 0;
  for (const ligne of lignes) {
    for (const h of ligne.horaires) {
      const [, wasCreated] = await Trip.findOrCreate({
        where: { ligneId: ligne.id, date, heureDepart: h.heure },
        defaults: {
          companyId,
          ligneId: ligne.id,
          agenceDepartId: ligne.agenceDepartId,
          busId: ligne.busId,
          date,
          heureDepart: h.heure,
          statut: 'prevu',
        },
      });
      if (wasCreated) crees += 1;
    }
  }
  return crees;
}

module.exports = { JOURS_GENERATION_INITIALE, genererTrajetsPourLigneSurPeriode, genererTrajetsPourCompagnie };
