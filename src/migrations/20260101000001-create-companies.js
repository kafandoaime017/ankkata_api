'use strict';
const { PLAN_ABONNEMENT, STATUT_COMPAGNIE } = require('../constants/enums');
const { dropEnumTypes } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('companies', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      nom: { type: Sequelize.STRING, allowNull: false },
      cle_activation: { type: Sequelize.STRING, allowNull: false, unique: true },
      logo_path: { type: Sequelize.STRING, allowNull: true },
      couleur_primaire: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0xff141b4d },
      couleur_secondaire: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0xff2748e0 },
      devise: { type: Sequelize.STRING, allowNull: false, defaultValue: 'Franc CFA (XOF)' },
      fuseau_horaire: { type: Sequelize.STRING, allowNull: false, defaultValue: 'GMT (Afrique/Ouagadougou)' },
      ville: { type: Sequelize.STRING, allowNull: false },
      pays: { type: Sequelize.STRING, allowNull: false, defaultValue: 'Burkina Faso' },
      responsable_nom: { type: Sequelize.STRING, allowNull: false },
      responsable_telephone: { type: Sequelize.STRING, allowNull: false },
      responsable_email: { type: Sequelize.STRING, allowNull: false },
      plan: { type: Sequelize.ENUM(...PLAN_ABONNEMENT), allowNull: false, defaultValue: 'essai' },
      statut: { type: Sequelize.ENUM(...STATUT_COMPAGNIE), allowNull: false, defaultValue: 'essai' },
      date_expiration_abonnement: { type: Sequelize.DATEONLY, allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      en_tete_ticket: { type: Sequelize.STRING, allowNull: true },
      pied_page_ticket: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Merci de votre confiance — bon voyage !',
      },
      afficher_logo_sur_ticket: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('companies');
    await dropEnumTypes(queryInterface, 'companies', ['plan', 'statut']);
  },
};
