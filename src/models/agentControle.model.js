// Compte "agent de contrôle" (scan/embarquement) — rattaché à une agence
// précise, exactement comme un Guichetier, mais un modèle et un espace JWT
// À PART (voir constants/roles.js#ESPACES.CONTROLE) : cet agent n'a besoin
// d'aucun accès vente/caisse/réservation, donc jamais mélangé avec
// Guichetier. Utilise le même mécanisme identifiant + code PIN haché (voir
// controllers/agentControle.controller.js et
// controllers/auth.controller.js#loginControle).
module.exports = (sequelize, DataTypes) => {
  const AgentControle = sequelize.define(
    'AgentControle',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      agenceId: { type: DataTypes.UUID, allowNull: false },
      nom: { type: DataTypes.STRING, allowNull: false },
      identifiant: { type: DataTypes.STRING, allowNull: false },
      actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      codePinHash: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: 'agents_controle',
      indexes: [{ unique: true, fields: ['company_id', 'identifiant'] }],
    }
  );

  AgentControle.associate = (models) => {
    AgentControle.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    AgentControle.belongsTo(models.Agence, { foreignKey: 'agenceId', as: 'agence' });
    AgentControle.hasMany(models.Embarquement, { foreignKey: 'agentControleId', as: 'embarquements' });
  };

  return AgentControle;
};
