"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("users", "student_id", {
      type: Sequelize.STRING(11),
      allowNull: false,
      unique: true,
    });

    await queryInterface.addColumn("users", "force_password_reset", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("users", "force_password_reset");
    await queryInterface.changeColumn("users", "student_id", {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true,
    });
  },
};
