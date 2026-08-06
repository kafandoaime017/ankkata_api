'use strict';

// Jusqu'ici l'arrivée d'une ligne n'était qu'une ville en texte libre
// (`ville_arrivee`) : aucune gare précise n'était rattachée, donc impossible
// d'afficher la gare d'arrivée (seule la gare de DÉPART l'était, via
// `agence_depart_id`) ou de tracer un itinéraire sur une carte (pas de
// coordonnées connues pour une simple ville texte).
//
// `agence_arrivee_id` référence désormais une Agence existante (les "gares"
// sont les agences de la compagnie — mêmes objets que pour le départ) et
// porte donc ses coordonnées lat/lon. Nullable pour rester rétrocompatible
// avec les lignes déjà en base : le backfill ci-dessous tente de retrouver
// automatiquement la bonne agence par correspondance de ville, mais une
// ligne dont la ville d'arrivée ne correspond à aucune agence existante de
// la compagnie restera à NULL et devra être corrigée manuellement (le
// formulaire ne proposera alors plus de champ libre, seulement une liste de
// gares — voir `ligne.controller.js#create/update`, qui exige désormais ce
// champ à la création et dérive `ville_arrivee` automatiquement à partir de
// la gare choisie plutôt que de l'accepter en texte libre).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lignes', 'agence_arrivee_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'agences', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.addIndex('lignes', ['agence_arrivee_id']);

    // Backfill best-effort : associe chaque ligne existante à une agence de
    // la MÊME compagnie dont la ville correspond (comparaison insensible à
    // la casse/aux espaces). Les lignes sans correspondance restent NULL.
    await queryInterface.sequelize.query(`
      UPDATE lignes AS l
      SET agence_arrivee_id = a.id
      FROM agences AS a
      WHERE l.company_id = a.company_id
        AND lower(trim(a.ville)) = lower(trim(l.ville_arrivee))
        AND l.agence_arrivee_id IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lignes', 'agence_arrivee_id');
  },
};
