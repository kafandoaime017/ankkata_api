'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Trace qui (compagnie admin, guichetier, ou équipe Ankkata) a ouvert un
    // ticket — nécessaire pour scoper "mes tickets" côté guichetier (il ne
    // doit voir/répondre qu'à ses propres tickets, pas ceux de ses collègues)
    // et pour savoir qui notifier en retour d'une réponse/mise à jour.
    await queryInterface.addColumn('support_tickets', 'cree_par_espace', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('support_tickets', 'cree_par_guichetier_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'guichetiers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Notifications génériques — pour l'instant uniquement alimentées par le
    // cycle de vie des tickets de support (voir supportTicket.controller.js),
    // mais volontairement assez génériques (type/entityType/entityId) pour
    // servir d'autres événements plus tard sans nouvelle migration.
    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      // Espace destinataire : 'ankkata' (inbox partagée équipe Ankkata),
      // 'admin' (administrateur(s) d'une compagnie donnée), 'guichetier'
      // (un guichetier précis).
      espace: { type: Sequelize.STRING, allowNull: false },
      // Scope compagnie — requis pour espace='admin', ignoré (toujours
      // NULL = diffusion à toute l'équipe) pour espace='ankkata'.
      company_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // Destinataire précis pour espace='guichetier' — NULL sinon.
      guichetier_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'guichetiers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.STRING, allowNull: false },
      titre: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.STRING, allowNull: false },
      entity_type: { type: Sequelize.STRING, allowNull: true },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      lu: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('notifications', ['espace', 'company_id']);
    await queryInterface.addIndex('notifications', ['espace', 'guichetier_id']);
    await queryInterface.addIndex('notifications', ['lu']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
    await queryInterface.removeColumn('support_tickets', 'cree_par_guichetier_id');
    await queryInterface.removeColumn('support_tickets', 'cree_par_espace');
  },
};
