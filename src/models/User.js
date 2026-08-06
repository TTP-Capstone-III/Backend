const { DataTypes } = require("sequelize");
const db = require("../db");

const User = db.define(
  "User",
  {
    name: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING(320),
      allowNull: false,
      unique: true,
    },

    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "User",
    timestamps: true,
    updatedAt: false,
  },
);

module.exports = User;
