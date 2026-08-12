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
      // `DECIMAL` est sérialisé en STRING par le driver pg/Sequelize (évite
      // toute perte de précision implicite) — sans ce getter, chaque route
      // publique qui renvoie une agence (réservations, billet, mes
      // réservations...) exposait `latitude`/`longitude` comme des chaînes,
      // ce qui cassait `AgencePublique.fromJson` côté app mobile avec
      // `type 'String' is not a subtype of type 'num?'`. Le getter est
      // appliqué automatiquement par `toJSON()`/`JSON.stringify`, donc chaque
      // route qui sérialise une instance Agence (directement ou imbriquée) en
      // bénéficie sans avoir à y penser — plus besoin de caster au cas par
      // cas comme le faisait seul `dtoAgencePublique`.
      latitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: true,
        get() {
          const brut = this.getDataValue('latitude');
          return brut === null || brut === undefined ? null : Number(brut);
        },
      },
      longitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: true,
        get() {
          const brut = this.getDataValue('longitude');
          return brut === null || brut === undefined ? null : Number(brut);
        },
      },
    },
    {
      tableName: 'agences',
    }
  );

  Agence.associate = (models) => {
    Agence.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    Agence.hasMany(models.Bus, { foreignKey: 'agenceId', as: 'buses' });
    Agence.hasMany(models.Ligne, { foreignKey: 'agenceDepartId', as: 'lignesDepart' });
    Agence.hasMany(models.Ligne, { foreignKey: 'agenceArriveeId', as: 'lignesArrivee' });
    Agence.hasMany(models.Guichetier, { foreignKey: 'agenceId', as: 'guichetiers' });
    Agence.hasMany(models.AgentControle, { foreignKey: 'agenceId', as: 'agentsControle' });
    Agence.hasMany(models.Trip, { foreignKey: 'agenceDepartId', as: 'trips' });
    Agence.hasMany(models.Reservation, { foreignKey: 'agenceId', as: 'reservations' });
    Agence.hasMany(models.Vente, { foreignKey: 'agenceId', as: 'ventes' });
    Agence.hasMany(models.CashSession, { foreignKey: 'agenceId', as: 'cashSessions' });
    Agence.hasMany(models.Pointage, { foreignKey: 'agenceId', as: 'pointages' });
  };

  return Agence;
};
