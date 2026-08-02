// Agence (guichet physique) d'une compagnie — fusionne AgenceCompagnie
// (ankkata_admin) et Agence (ankata_guichet).
module.exports = (sequelize, DataTypes) => {
  const Agence = sequelize.define(
    'Agence',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      nom: { type: DataTypes.STRING, allowNull: false },
      ville: { type: DataTypes.STRING, allowNull: false },
      responsable: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
      telephone: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
    },
    {
      tableName: 'agences',
    }
  );

  Agence.associate = (models) => {
    Agence.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Agence.hasMany(models.Bus, { foreignKey: 'agenceId', as: 'buses' });
    Agence.hasMany(models.Ligne, { foreignKey: 'agenceDepartId', as: 'lignesDepart' });
    Agence.hasMany(models.Guichetier, { foreignKey: 'agenceId', as: 'guichetiers' });
    Agence.hasMany(models.Trip, { foreignKey: 'agenceDepartId', as: 'trips' });
    Agence.hasMany(models.Reservation, { foreignKey: 'agenceId', as: 'reservations' });
    Agence.hasMany(models.Vente, { foreignKey: 'agenceId', as: 'ventes' });
    Agence.hasMany(models.CashSession, { foreignKey: 'agenceId', as: 'cashSessions' });
    Agence.hasMany(models.Pointage, { foreignKey: 'agenceId', as: 'pointages' });
  };

  return Agence;
};
