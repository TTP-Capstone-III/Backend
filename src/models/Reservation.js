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
      type: DataTypes.ENUM("CONFIRMED", "CANCELLED", "EXPIRED", "PENDING_PAYMENT"),
      allowNull: false,
      defaultValue: "PENDING_PAYMENT",
    },
    holdExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    stripeCheckoutSessionId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
  },
  {
    tableName: "Reservation",
    timestamps: true,
    indexes: [
      { fields: ["listingId", "startTime", "endTime"] },
      { fields: ["driverId"] },
      { fields: ["stripeCheckoutSessionId"] },
    ],
  },
);

module.exports = Reservation;

