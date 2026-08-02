'use strict';
const { MOYEN_PAIEMENT, CLASSE_CONFORT } = require('../constants/enums');
const { dropEnumTypes } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ventes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      reference: { type: Sequelize.STRING, allowNull: false, unique: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      agence_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agences', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      trip_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'trips', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      guichetier_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'guichetiers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      client_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'clients', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      classe: { type: Sequelize.ENUM(...CLASSE_CONFORT), allowNull: false, defaultValue: 'Standard' },
      nombre_places: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      prix_unitaire: { type: Sequelize.INTEGER, allowNull: false },
      nom_voyageur: { type: Sequelize.STRING, allowNull: false },
      telephone_voyageur: { type: Sequelize.STRING, allowNull: false },
      piece_identite: { type: Sequelize.STRING, allowNull: true },
      moyen_paiement: { type: Sequelize.ENUM(...MOYEN_PAIEMENT), allowNull: false },
      heure_vente: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      date_voyage: { type: Sequelize.DATEONLY, allowNull: false },
      annulee: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      motif_annulation: { type: Sequelize.STRING, allowNull: true },
      a_des_colis: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      colis_description: { type: Sequelize.STRING, allowNull: true },
      colis_poids_kg: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      colis_verifie: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      montant_recu: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('ventes', ['company_id']);
    await queryInterface.addIndex('ventes', ['agence_id']);
    await queryInterface.addIndex('ventes', ['guichetier_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ventes');
    await dropEnumTypes(queryInterface, 'ventes', ['classe', 'moyen_paiement']);
  },
};
