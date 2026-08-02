// Arrêt intermédiaire d'une ligne, ordonné — remplace la List<String>
// `arretsIntermediaires` du modèle Dart.
module.exports = (sequelize, DataTypes) => {
  const LigneArret = sequelize.define(
    'LigneArret',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      ligneId: { type: DataTypes.UUID, allowNull: false },
      ville: { type: DataTypes.STRING, allowNull: false },
      ordre: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'ligne_arrets',
    }
  );

  LigneArret.associate = (models) => {
    LigneArret.belongsTo(models.Ligne, { foreignKey: 'ligneId', as: 'ligne' });
  };

  return LigneArret;
};
