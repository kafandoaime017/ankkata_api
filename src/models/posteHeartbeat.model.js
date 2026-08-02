// Historique des heartbeats d'un poste — sert au graphe "ventes en attente"
// et au diagnostic (dernières erreurs) du détail poste côté admin. Purgé
// au-delà de 30 jours (voir services/poste.service.js#purgerHeartbeatsAnciens,
// appelé opportunément à chaque nouveau heartbeat plutôt que via un job cron
// dédié — pas d'infrastructure de tâches planifiées dans cette API).
module.exports = (sequelize, DataTypes) => {
  const PosteHeartbeat = sequelize.define(
    'PosteHeartbeat',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      posteId: { type: DataTypes.UUID, allowNull: false },
      recuAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      versionApp: { type: DataTypes.STRING, allowNull: true },
      ventesEnAttente: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      erreur: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'poste_heartbeats',
    }
  );

  PosteHeartbeat.associate = (models) => {
    PosteHeartbeat.belongsTo(models.Poste, { foreignKey: 'posteId', as: 'poste' });
  };

  return PosteHeartbeat;
};
