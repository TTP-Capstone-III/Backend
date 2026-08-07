const { DataTypes } = require("sequelize");
const db = require("../db");

const vehicleCategories = [
  "COMPACT",
  "SEDAN",
  "SMALL_SUV",
  "LARGE_SUV_MINIVAN",
  "PICKUP",
  "OTHER_NOT_SURE",
];

const Listing = db.define(
  "Listing",
  {
    hostId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    streetAddress: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    neighborhood: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(2),
      allowNull: false,
    },
    zipCode: {
      type: DataTypes.STRING(5),
      allowNull: false,
    },
    exactLatitude: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    exactLongitude: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    publicLatitude: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    publicLongitude: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    hourlyPriceCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    availableFrom: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    availableUntil: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    maxVehicleCategory: {
      type: DataTypes.ENUM(...vehicleCategories),
      allowNull: false,
    },
    otherVehicleDescription: {
      type: DataTypes.STRING(180),
      allowNull: true,
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    imagePublicId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "Listing",
    timestamps: true,
    indexes: [
      { fields: ["hostId"] },
      { fields: ["city"] },
      { fields: ["zipCode"] },
      { fields: ["neighborhood"] },
      { fields: ["publicLatitude", "publicLongitude"] },
    ],
  },
);

module.exports = Listing;
module.exports.vehicleCategories = vehicleCategories;
