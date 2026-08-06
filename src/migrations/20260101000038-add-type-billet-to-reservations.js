'use strict';
const { TYPE_BILLET } = require('../constants/enums');
const { dropEnumTypes } = require('../utils/migrationHelpers');

// Réservation publique aller-retour posée en une seule opération (voir
// `public.controller.js#createReservationAllerRetour`) — même architecture
// que `ventes.type_billet`/`ventes.vente_liee_id` côté guichet (migration
// `add-type-billet-to-ventes`) : chaque "jambe" (aller / retour) reste une
// ligne `Reservation` à part entière (son propre `tripId`, son propre
// `montant` — cohérent avec le quota par trajet déjà en place), mais les deux
// lignes se référencent mutuellement via `reservation_liee_id` pour être
// affichées/retrouvées comme une seule réservation côté voyageur (une seule
// page de confirmation montre les deux trajets).
//
// `montant_avant_reduction` : NULL tant qu'aucune réduction aller-retour n'a
// été appliquée (billet aller_simple, ou aller_retour sans réduction
// configurée sur la ligne) ; sinon, montant qu'aurait payé cette jambe SEULE
// sans la réduction — sert uniquement à afficher "vous économisez X FCFA" sur
// le billet/la confirmation, `montant` restant la seule valeur qui compte
// réellement pour la facturation.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reservations', 'type_billet', {
      type: Sequelize.ENUM(...TYPE_BILLET),
      allowNull: false,
      defaultValue: 'aller_simple',
    });
    await queryInterface.addColumn('reservations', 'reservation_liee_id', {
      type: Sequelize.UUID,
      allowNull: true,
      unique: true,
      references: { model: 'reservations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('reservations', 'montant_avant_reduction', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reservations', 'montant_avant_reduction');
    await queryInterface.removeColumn('reservations', 'reservation_liee_id');
    await queryInterface.removeColumn('reservations', 'type_billet');
    await dropEnumTypes(queryInterface, 'reservations', ['type_billet']);
  },
};
