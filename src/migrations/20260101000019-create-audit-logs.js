'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      auteur_ankkata_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'comptes_ankkata', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      auteur_admin_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'comptes_admin', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      auteur_guichetier_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'guichetiers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      auteur_nom: { type: Sequelize.STRING, allowNull: false, defaultValue: 'Système' },
      action: { type: Sequelize.STRING, allowNull: false },
      details: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      date: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('audit_logs', ['company_id']);
    await queryInterface.addIndex('audit_logs', ['date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
