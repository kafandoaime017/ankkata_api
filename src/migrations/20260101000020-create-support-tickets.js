'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('support_tickets', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sujet: { type: Sequelize.STRING, allowNull: false },
      statut: { type: Sequelize.ENUM('ouvert', 'en_cours', 'resolu', 'ferme'), allowNull: false, defaultValue: 'ouvert' },
      priorite: { type: Sequelize.ENUM('basse', 'normale', 'haute', 'urgente'), allowNull: false, defaultValue: 'normale' },
      canal_contact: {
        type: Sequelize.ENUM('telephone', 'email', 'whatsapp', 'en_personne', 'autre'),
        allowNull: false,
        defaultValue: 'autre',
      },
      nom_contact: { type: Sequelize.STRING, allowNull: false },
      coordonnees_contact: { type: Sequelize.STRING, allowNull: true },
      assigne_a_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'comptes_ankkata', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      date_resolution: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('support_tickets', ['company_id']);
    await queryInterface.addIndex('support_tickets', ['statut']);

    await queryInterface.createTable('support_ticket_messages', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      ticket_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'support_tickets', key: 'id' },
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
      auteur_nom: { type: Sequelize.STRING, allowNull: false },
      contenu: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('support_ticket_messages', ['ticket_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('support_ticket_messages');
    await queryInterface.dropTable('support_tickets');
  },
};
