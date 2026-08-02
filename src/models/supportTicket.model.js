// Ticket de support/assistance — trace "qui a contacté qui" pour une
// compagnie en difficulté (aucun système équivalent n'existait avant).
// Rattaché à une compagnie ; peut être pris en charge par un compte Ankkata
// (`assigneAId`), jamais par la compagnie elle-même (outil interne Ankkata).
const { STATUT_SUPPORT_TICKET, PRIORITE_SUPPORT_TICKET, CANAL_CONTACT_SUPPORT } = require('../constants/enums');

module.exports = (sequelize, DataTypes) => {
  const SupportTicket = sequelize.define(
    'SupportTicket',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      companyId: { type: DataTypes.UUID, allowNull: false },
      sujet: { type: DataTypes.STRING, allowNull: false },
      statut: {
        type: DataTypes.ENUM(...STATUT_SUPPORT_TICKET),
        allowNull: false,
        defaultValue: 'ouvert',
      },
      priorite: {
        type: DataTypes.ENUM(...PRIORITE_SUPPORT_TICKET),
        allowNull: false,
        defaultValue: 'normale',
      },
      canalContact: {
        type: DataTypes.ENUM(...CANAL_CONTACT_SUPPORT),
        allowNull: false,
        defaultValue: 'autre',
      },
      // Personne côté compagnie à l'origine du contact — pas forcément un
      // compte admin enregistré (peut être n'importe quel employé au
      // téléphone), d'où des champs texte libres plutôt qu'une FK.
      nomContact: { type: DataTypes.STRING, allowNull: false },
      coordonneesContact: { type: DataTypes.STRING, allowNull: true },
      assigneAId: { type: DataTypes.UUID, allowNull: true },
      dateResolution: { type: DataTypes.DATE, allowNull: true },
      // Qui a ouvert ce ticket — 'ankkata'/'admin'/'guichetier' (voir
      // req.auth.espace au moment de la création). `creeParGuichetierId` n'est
      // renseigné que si `creeParEspace === 'guichetier'` : sert à scoper
      // "mes tickets" côté guichetier (il ne voit/ne répond qu'aux siens) et
      // à savoir qui notifier en cas de réponse/mise à jour.
      creeParEspace: { type: DataTypes.STRING, allowNull: true },
      creeParGuichetierId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: 'support_tickets',
    }
  );

  SupportTicket.associate = (models) => {
    SupportTicket.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
    SupportTicket.belongsTo(models.CompteAnkkata, { foreignKey: 'assigneAId', as: 'assigneA' });
    SupportTicket.belongsTo(models.Guichetier, { foreignKey: 'creeParGuichetierId', as: 'creePar' });
    SupportTicket.hasMany(models.SupportTicketMessage, { foreignKey: 'ticketId', as: 'messages', onDelete: 'CASCADE' });
  };

  return SupportTicket;
};
