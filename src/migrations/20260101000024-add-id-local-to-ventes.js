'use strict';

// Mode offline (guichet) : le logiciel guichet génère un identifiant local
// (UUID) au moment de la vente, AVANT même de savoir si le réseau est
// disponible — voir ankata_guichet/lib/core/services/vente_sync_session.dart.
// S'il faut réessayer l'envoi plus tard (retour de connexion), on renvoie ce
// même `idLocal` : le serveur peut alors reconnaître un doublon (la vente a
// peut-être déjà été acceptée lors d'une tentative précédente qui a réussi
// côté serveur mais dont la réponse ne serait jamais arrivée au client) et
// renvoyer l'enregistrement existant plutôt que d'en créer un second.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ventes', 'id_local', { type: Sequelize.UUID, allowNull: true });
    // Unique PAR COMPAGNIE (pas globalement) : deux compagnies différentes
    // pourraient en théorie générer le même UUID côté client par pure
    // coïncidence (négligeable en pratique, mais l'unicité par compagnie
    // suffit et coûte moins cher à vérifier qu'une unicité globale).
    await queryInterface.addIndex('ventes', ['company_id', 'id_local'], {
      unique: true,
      name: 'ventes_company_id_local_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('ventes', 'ventes_company_id_local_unique');
    await queryInterface.removeColumn('ventes', 'id_local');
  },
};
