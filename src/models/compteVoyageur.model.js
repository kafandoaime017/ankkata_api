// Compte voyageur — espace "Mon compte" du site public (ankkata_frontend),
// distinct des Client (denormalisés par compagnie, créés à chaque
// réservation) : un CompteVoyageur est UNE identité, valable pour réserver
// chez toutes les compagnies Ankkata.
//
// Authentification par TÉLÉPHONE + CODE OTP envoyé par SMS (voir
// controllers/voyageur.controller.js et services/notification/) — plus de
// mot de passe. `telephone` est donc le vrai identifiant (obligatoire,
// unique) ; `email` devient optionnel, utile uniquement pour recevoir la
// confirmation de réservation par email si le voyageur en fournit un (voir
// CANAL_NOTIFICATION dans .env). `motDePasseHash` est conservé en base
// (nullable) pour ne pas casser d'anciennes lignes, mais n'est plus lu ni
// écrit par aucun contrôleur. `codeVerificationHash`/`codeVerificationExpireAt`
// sont réutilisés tels quels pour stocker le hash + l'expiration du code OTP
// de connexion (voir migration 20260101000033).
module.exports = (sequelize, DataTypes) => {
  const CompteVoyageur = sequelize.define(
    'CompteVoyageur',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      nom: { type: DataTypes.STRING, allowNull: false },
      prenom: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: true, unique: true },
      telephone: { type: DataTypes.STRING, allowNull: false, unique: true },
      motDePasseHash: { type: DataTypes.STRING, allowNull: true },
      emailVerifie: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      codeVerificationHash: { type: DataTypes.STRING, allowNull: true },
      codeVerificationExpireAt: { type: DataTypes.DATE, allowNull: true },
      otpTentatives: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'comptes_voyageurs',
    }
  );

  CompteVoyageur.associate = (models) => {
    CompteVoyageur.hasMany(models.Reservation, { foreignKey: 'compteVoyageurId', as: 'reservations' });
  };

  return CompteVoyageur;
};
