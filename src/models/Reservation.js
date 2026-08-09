const { DataTypes } = require("sequelize");
const db = require("../db");
const { vehicleCategories } = require("./Listing");

const Reservation = db.define(
  "Reservation",
  {
    listingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    driverVehicleCategory: {
      type: DataTypes.ENUM(...vehicleCategories),
      allowNull: false,
    },
    fitAcknowledged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    totalPriceCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    status: {
      type: DataTypes.ENUM("CONFIRMED", "CANCELLED"),
      allowNull: false,
      defaultValue: "CONFIRMED",
    },
  },
  {
    tableName: "Reservation",
    timestamps: true,
    indexes: [
      { fields: ["listingId", "startTime", "endTime"] },
      { fields: ["driverId"] },
    ],
  },
);

module.exports = Reservation;

