'use strict';
const { TYPE_BILLET } = require('../constants/enums');
const { dropEnumTypes } = require('../utils/migrationHelpers');

// Billet aller-retour vendu en une seule opération (voir
// `vente.controller.js#createAllerRetour`) : chaque "jambe" (aller / retour)
// reste une ligne `Vente` à part entière (un `tripId`, un `prixUnitaire`
// chacune — cohérent avec le quota par trajet déjà en place, voir
// `quota.service.js`), mais les deux lignes se référencent mutuellement via
// `vente_liee_id` pour être affichées/imprimées comme un seul billet et pour
// qu'annuler l'une signale l'existence de l'autre.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ventes', 'type_billet', {
      type: Sequelize.ENUM(...TYPE_BILLET),
      allowNull: false,
      defaultValue: 'aller_simple',
    });
    await queryInterface.addColumn('ventes', 'vente_liee_id', {
      type: Sequelize.UUID,
      allowNull: true,
      unique: true,
      references: { model: 'ventes', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ventes', 'vente_liee_id');
    await queryInterface.removeColumn('ventes', 'type_billet');
    await dropEnumTypes(queryInterface, 'ventes', ['type_billet']);
  },
};
