'use strict';

// Le site Voyageur (ankkata_frontend) simule le paiement uniquement via
// Orange Money et Moov Money (les deux Mobile Money les plus répandus en
// zone UEMOA) — on AJOUTE ces deux valeurs à l'énumération Postgres
// existante plutôt que de remplacer 'Mobile Money'/'Espèces', pour ne rien
// casser côté guichet (ankata_guichet) qui continue d'utiliser ces deux
// valeurs historiques. `ADD VALUE IF NOT EXISTS` est idempotent — rejouable
// sans risque si la migration est relancée sur un environnement où les
// valeurs existent déjà.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_reservations_moyen_paiement\" ADD VALUE IF NOT EXISTS 'Orange Money'"
    );
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_reservations_moyen_paiement\" ADD VALUE IF NOT EXISTS 'Moov Money'"
    );
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_ventes_moyen_paiement\" ADD VALUE IF NOT EXISTS 'Orange Money'"
    );
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_ventes_moyen_paiement\" ADD VALUE IF NOT EXISTS 'Moov Money'"
    );
  },

  async down() {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le
    // recréer entièrement (et migrer toutes les colonnes qui l'utilisent) —
    // pas de rollback pour cette migration additive, comme pour les autres
    // migrations "add value to enum" du projet.
  },
};
