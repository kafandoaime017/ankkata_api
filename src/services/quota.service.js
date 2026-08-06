// Vérifie qu'il reste assez de places sur un trajet donné avant d'accepter
// une vente ou une réservation — jusqu'ici AUCUNE vérification n'existait
// nulle part côté serveur (voir doc de tête de `vente.controller.js#create`
// avant ce correctif), ce qui permettait de survendre un trajet, notamment
// quand plusieurs guichetiers vendaient hors-ligne en même temps sur le même
// trajet : chacun voit la même valeur (potentiellement périmée) de places
// restantes, et sans contrôle serveur au moment de la synchro, TOUTES leurs
// ventes hors-ligne étaient acceptées telles quelles au retour du réseau.
//
// `verifierEtVerrouillerQuota` doit être appelée DANS une transaction
// Sequelize, avant `Vente.create`/`Reservation.create` : elle verrouille la
// ligne du `Trip` concerné (`SELECT ... FOR UPDATE`) le temps de la
// transaction, ce qui sérialise deux ventes concurrentes sur le même trajet
// — sans ce verrou, deux requêtes simultanées pourraient toutes les deux
// lire "2 places restantes" et vendre chacune 2 places (survente de 2
// places malgré un contrôle en apparence présent). Le verrou couvre aussi
// bien une vente créée EN DIRECT qu'une vente hors-ligne REJOUÉE au retour
// du réseau : les deux passent par le même contrôleur
// (`vente.controller.js#create`), donc une vente hors-ligne rejouée après
// coup est refusée exactement comme une vente en direct si le trajet s'est
// entre-temps rempli (par d'autres guichetiers, en ligne ou hors-ligne).
//
// Depuis l'ajout de `quotaEnLigne`/`quotaGuichet` (voir migration
// `add-quotas-canal-to-lignes`), une compagnie peut en plus réserver un
// sous-quota de places à un canal précis (ex. garder des places au guichet
// même si le site affiche complet, ou l'inverse) : `canal` indique quel
// sous-quota vérifier EN PLUS du plafond global `capaciteTotale`, qui reste
// dans tous les cas la limite absolue tous canaux confondus.
//
// Ces quotas vivent sur `Ligne` (récurrent) donc s'appliquent par défaut à
// TOUS les jours de ce créneau — une compagnie qui veut fermer/ajuster la
// réservation en ligne pour UN SEUL départ daté (ex. "complet le 6 août"
// sans toucher au 7 août) utilise plutôt la surcharge ponctuelle posée sur
// le `Trip` lui-même (`quotaEnLigneOverride`/`quotaGuichetOverride`, voir
// migration `add-quota-overrides-to-trips`), qui prime sur la valeur de la
// Ligne quand elle est renseignée (non NULL) — exactement le même principe
// que `Trip.statut` qui peut déjà surcharger ponctuellement un statut sans
// toucher au reste de la ligne.
const { Trip, Ligne, Vente, Reservation } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * @param {object} params
 * @param {import('sequelize').Transaction} params.transaction - transaction en cours (le verrou ne vaut que pour sa durée)
 * @param {string|null|undefined} params.tripId - trajet concerné ; si absent, aucun quota n'est vérifié (vente/réservation non rattachée à un trajet précis)
 * @param {number} params.placesDemandees - nombre de places que cette vente/réservation consommerait
 * @param {'en_ligne'|'guichet'|undefined} params.canal - canal d'origine ; détermine quel sous-quota (le cas échéant) est vérifié en plus du plafond global
 */
async function verifierEtVerrouillerQuota({ transaction, tripId, placesDemandees, canal }) {
  if (!tripId) return;

  const trip = await Trip.findByPk(tripId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!trip) throw ApiError.notFound('Trajet introuvable.');

  const ligne = await Ligne.findByPk(trip.ligneId, { transaction });
  // Ligne supprimée entre-temps, ou capacité non renseignée (donnée créée
  // avant ce correctif, voir migration `add-capacite-totale-to-lignes`) :
  // pas de quota connu, on laisse passer plutôt que de bloquer à tort.
  if (!ligne || !ligne.capaciteTotale) return;

  const [ventesOccupees, reservationsOccupees, reservationsEnLigneOccupees] = await Promise.all([
    Vente.sum('nombrePlaces', { where: { tripId, annulee: false }, transaction }),
    Reservation.count({ where: { tripId, statut: 'confirmee' }, transaction }),
    Reservation.count({ where: { tripId, statut: 'confirmee', canal: 'en_ligne' }, transaction }),
  ]);

  const occupees = (ventesOccupees || 0) + (reservationsOccupees || 0);
  const restantes = ligne.capaciteTotale - occupees;

  if (placesDemandees > restantes) {
    throw ApiError.conflict(
      restantes > 0
        ? `Plus assez de places disponibles sur ce trajet (${restantes} restante(s), ${placesDemandees} demandée(s)).`
        : 'Ce trajet est complet.',
      { placesRestantes: Math.max(restantes, 0), placesDemandees }
    );
  }

  // Sous-quota "en ligne" : ne s'applique qu'aux réservations posées EN
  // LIGNE, et seulement si une valeur est connue — la surcharge du `Trip`
  // (ce départ daté précis) prime sur celle de la `Ligne` (par défaut, tous
  // les jours) quand elle est renseignée.
  const quotaEnLigneEffectif = trip.quotaEnLigneOverride ?? ligne.quotaEnLigne;
  if (canal === 'en_ligne' && quotaEnLigneEffectif != null) {
    const restantesEnLigne = quotaEnLigneEffectif - (reservationsEnLigneOccupees || 0);
    if (placesDemandees > restantesEnLigne) {
      throw ApiError.conflict(
        restantesEnLigne > 0
          ? `Plus assez de places en ligne sur ce trajet (${restantesEnLigne} restante(s), ${placesDemandees} demandée(s)).`
          : 'Ce trajet est complet pour la réservation en ligne.',
        { placesRestantesEnLigne: Math.max(restantesEnLigne, 0), placesDemandees }
      );
    }
  }

  // Sous-quota "guichet" : les ventes (`Vente`, toujours guichet) ET les
  // réservations posées au guichet comptent contre ce sous-quota. Même
  // principe de surcharge ponctuelle par `Trip`.
  const quotaGuichetEffectif = trip.quotaGuichetOverride ?? ligne.quotaGuichet;
  if (canal === 'guichet' && quotaGuichetEffectif != null) {
    const reservationsGuichetOccupees = (reservationsOccupees || 0) - (reservationsEnLigneOccupees || 0);
    const occupeesGuichet = (ventesOccupees || 0) + reservationsGuichetOccupees;
    const restantesGuichet = quotaGuichetEffectif - occupeesGuichet;
    if (placesDemandees > restantesGuichet) {
      throw ApiError.conflict(
        restantesGuichet > 0
          ? `Plus assez de places guichet sur ce trajet (${restantesGuichet} restante(s), ${placesDemandees} demandée(s)).`
          : 'Ce trajet est complet pour la vente au guichet.',
        { placesRestantesGuichet: Math.max(restantesGuichet, 0), placesDemandees }
      );
    }
  }
}

module.exports = { verifierEtVerrouillerQuota };
