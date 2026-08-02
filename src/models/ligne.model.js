// Ligne (itinéraire) du catalogue d'une compagnie — agence de départ +
// ville d'arrivée + bus assigné (optionnel). Tarifs/horaires/arrêts/
// promotions vivent dans des tables enfants (ligne_tarifs, ligne_horaires,
// ligne_arrets, promotions_tarifaires) plutôt que des colonnes Map/List.
module.exports = (sequelize, DataTypes) => {
  const Ligne = sequelize.define(
    'Ligne',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      agenceDepartId: { type: DataTypes.UUID, allowNull: false },
      villeArrivee: { type: DataTypes.STRING, allowNull: false },
      busId: { type: DataTypes.UUID, allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      reversible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      dureeEstimeeMinutes: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: 'lignes',
    }
  );

  Ligne.associate = (models) => {
    Ligne.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Ligne.belongsTo(models.Agence, { foreignKey: 'agenceDepartId', as: 'agenceDepart' });
    Ligne.belongsTo(models.Bus, { foreignKey: 'busId', as: 'bus' });
    Ligne.hasMany(models.LigneTarif, { foreignKey: 'ligneId', as: 'tarifs', onDelete: 'CASCADE' });
    Ligne.hasMany(models.LigneHoraire, { foreignKey: 'ligneId', as: 'horaires', onDelete: 'CASCADE' });
    Ligne.hasMany(models.LigneArret, { foreignKey: 'ligneId', as: 'arrets', onDelete: 'CASCADE' });
    Ligne.hasMany(models.Promotion, { foreignKey: 'ligneId', as: 'promotions', onDelete: 'CASCADE' });
    Ligne.hasMany(models.Trip, { foreignKey: 'ligneId', as: 'trips' });
  };

  return Ligne;
};
