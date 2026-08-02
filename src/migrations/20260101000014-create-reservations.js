'use strict';
const { CANAL_RESERVATION, STATUT_RESERVATION, MOYEN_PAIEMENT, CLASSE_CONFORT } = require('../constants/enums');
const { dropEnumTypes } = require('../utils/migrationHelpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reservations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      reference: { type: Sequelize.STRING, allowNull: false, unique: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      client_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'clients', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      trip_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'trips', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      agence_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agences', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      nom_voyageur: { type: Sequelize.STRING, allowNull: false },
      telephone_voyageur: { type: Sequelize.STRING, allowNull: false },
      ville_depart: { type: Sequelize.STRING, allowNull: false },
      ville_arrivee: { type: Sequelize.STRING, allowNull: false },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      heure_depart: { type: Sequelize.STRING(5), allowNull: false },
      classe: { type: Sequelize.ENUM(...CLASSE_CONFORT), allowNull: false, defaultValue: 'Standard' },
      montant: { type: Sequelize.INTEGER, allowNull: false },
      moyen_paiement: { type: Sequelize.ENUM(...MOYEN_PAIEMENT), allowNull: false },
      canal: { type: Sequelize.ENUM(...CANAL_RESERVATION), allowNull: false },
      statut: { type: Sequelize.ENUM(...STATUT_RESERVATION), allowNull: false, defaultValue: 'confirmee' },
      motif_annulation: { type: Sequelize.STRING, allowNull: true },
      date_reservation: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('reservations', ['company_id']);
    await queryInterface.addIndex('reservations', ['agence_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reservations');
    await dropEnumTypes(queryInterface, 'reservations', ['classe', 'moyen_paiement', 'canal', 'statut']);
  },
};
