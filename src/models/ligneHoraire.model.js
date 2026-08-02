// Horaire de départ d'une ligne — remplace la List<String> `horaires` du
// modèle Dart par une ligne par horaire (format "HH:mm").
module.exports = (sequelize, DataTypes) => {
  const LigneHoraire = sequelize.define(
    'LigneHoraire',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      ligneId: { type: DataTypes.UUID, allowNull: false },
      heure: { type: DataTypes.STRING(5), allowNull: false }, // "HH:mm"
    },
    {
      tableName: 'ligne_horaires',
      indexes: [{ unique: true, fields: ['ligne_id', 'heure'] }],
    }
  );

  LigneHoraire.associate = (models) => {
    LigneHoraire.belongsTo(models.Ligne, { foreignKey: 'ligneId', as: 'ligne' });
  };

  return LigneHoraire;
};
