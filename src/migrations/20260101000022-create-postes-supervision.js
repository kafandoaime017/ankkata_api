'use strict';

// Supervision des postes (installations du logiciel guichet) — un
// enregistrement par machine, alimenté par des heartbeats périodiques (voir
// poste.controller.js#heartbeat). Permet à l'équipe Ankkata (et, scopé, à
// l'administrateur de chaque compagnie) de savoir en quasi temps réel si
// chaque poste fonctionne, synchronise, et sur quelle version il tourne.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('postes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // Nullable : un poste peut heartbeat avant qu'un guichetier s'y
      // connecte (le JWT ne porte alors pas encore d'agenceId) — voir
      // resolveCompanyId/req.auth dans poste.controller.js.
      agence_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'agences', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      // Identifiant matériel stable généré à la 1re installation côté
      // guichet et persisté localement (jamais régénéré) — voir
      // ankata_guichet/lib/core/utils/machine_id.dart.
      machine_id: { type: Sequelize.STRING, allowNull: false },
      libelle: { type: Sequelize.STRING, allowNull: true },
      version_app: { type: Sequelize.STRING, allowNull: true },
      os_info: { type: Sequelize.STRING, allowNull: true },
      // Toujours l'heure SERVEUR (jamais l'horloge du poste, peu fiable) —
      // voir poste.controller.js#heartbeat.
      derniere_synchro_at: { type: Sequelize.DATE, allowNull: true },
      ventes_en_attente: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      derniere_erreur: { type: Sequelize.TEXT, allowNull: true },
      derniere_erreur_at: { type: Sequelize.DATE, allowNull: true },
      // Permet de retirer un poste désaffecté de la supervision active sans
      // perdre son historique de heartbeats.
      actif: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    // Un poste = une machine pour une compagnie donnée — l'upsert du
    // heartbeat se fait sur cette paire.
    await queryInterface.addIndex('postes', ['company_id', 'machine_id'], { unique: true, name: 'postes_company_machine_unique' });
    await queryInterface.addIndex('postes', ['company_id', 'actif']);

    // Historique des heartbeats — sert au graphe/diagnostic du détail poste
    // côté admin ; purgé au-delà de 30 jours (voir poste.service.js#purgerHeartbeatsAnciens).
    await queryInterface.createTable('poste_heartbeats', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      poste_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'postes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      recu_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      version_app: { type: Sequelize.STRING, allowNull: true },
      ventes_en_attente: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      erreur: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('poste_heartbeats', ['poste_id', 'recu_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('poste_heartbeats');
    await queryInterface.dropTable('postes');
  },
};
