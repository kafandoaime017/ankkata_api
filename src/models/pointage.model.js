// Pointage (connexion/déconnexion) d'un guichetier — PointageEntry côté
// ankata_guichet. Le rapport de clôture (RapportCloture) est stocké tel
// quel en JSONB : c'est un instantané figé, pas une entité à normaliser.
module.exports = (sequelize, DataTypes) => {
  const Pointage = sequelize.define(
    'Pointage',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      guichetierId: { type: DataTypes.UUID, allowNull: false },
      agenceId: { type: DataTypes.UUID, allowNull: false },
      cashSessionId: { type: DataTypes.UUID, allowNull: true },
      heureConnexion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      heureDeconnexion: { type: DataTypes.DATE, allowNull: true },
      rapportEnvoye: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ecartCaisse: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      rapport: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      tableName: 'pointages',
    }
  );

  Pointage.associate = (models) => {
    Pointage.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Pointage.belongsTo(models.Guichetier, { foreignKey: 'guichetierId', as: 'guichetier' });
    Pointage.belongsTo(models.Agence, { foreignKey: 'agenceId', as: 'agence' });
    Pointage.belongsTo(models.CashSession, { foreignKey: 'cashSessionId', as: 'cashSession' });
  };

  return Pointage;
};
