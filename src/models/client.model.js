// Client final d'une compagnie — table réelle remplaçant l'agrégation en
// mémoire (par numéro de téléphone) faite côté ankata_guichet.
module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define(
    'Client',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      nom: { type: DataTypes.STRING, allowNull: false },
      telephone: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: true },
      vigilance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: 'clients',
      indexes: [{ unique: true, fields: ['company_id', 'telephone'] }],
    }
  );

  Client.associate = (models) => {
    Client.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Client.hasMany(models.Reservation, { foreignKey: 'clientId', as: 'reservations' });
    Client.hasMany(models.Vente, { foreignKey: 'clientId', as: 'ventes' });
  };

  return Client;
};
