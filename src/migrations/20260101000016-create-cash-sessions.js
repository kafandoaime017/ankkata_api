'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cash_sessions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      numero_session: { type: Sequelize.STRING, allowNull: false, unique: true },
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
      guichetier_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'guichetiers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      date_ouverture: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      date_fermeture: { type: Sequelize.DATE, allowNull: true },
      fond_initial: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_ventes_especes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_ventes_mobile_money: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      nombre_billets_vendus: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      montant_compte: { type: Sequelize.INTEGER, allowNull: true },
      commentaire: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      total_depenses: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_versements: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ouverte: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('cash_sessions', ['company_id']);
    await queryInterface.addIndex('cash_sessions', ['agence_id']);
    await queryInterface.addIndex('cash_sessions', ['guichetier_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cash_sessions');
  },
};
