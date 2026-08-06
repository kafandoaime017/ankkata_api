'use strict';

// Surcharge PONCTUELLE (un seul départ daté) des sous-quotas par canal —
// jusqu'ici `quota_en_ligne`/`quota_guichet` ne vivaient que sur `lignes`
// (voir migration `add-quotas-canal-to-lignes`), donc récurrents : les
// modifier s'applique à TOUS les jours de ce créneau, pas seulement à celui
// que la compagnie veut ajuster (ex. fermer la réservation en ligne d'un
// seul départ un jour précis, sans changer le réglage par défaut de la
// ligne pour les autres jours — signalé après coup comme "pas logique" par
// l'utilisateur, à raison).
//
// NULL = pas de surcharge pour ce trajet daté, on retombe sur la valeur de
// la `Ligne` — rétrocompatible, aucun trajet existant n'est affecté tant
// que personne ne renseigne explicitement une surcharge.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trips', 'quota_en_ligne_override', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('trips', 'quota_guichet_override', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('trips', 'quota_en_ligne_override');
    await queryInterface.removeColumn('trips', 'quota_guichet_override');
  },
};
