// src/models/Reservation.js
const { DataTypes } = require("sequelize");
const db = require("../db");
const { vehicleCategories } = require("./Listing");

const Reservation = db.define(
  "Reservation",
  {
    listingId: { type: DataTypes.INTEGER, allowNull: false },
    driverId: { type: DataTypes.INTEGER, allowNull: false },
    startTime: { type: DataTypes.DATE, allowNull: false },
    endTime: { type: DataTypes.DATE, allowNull: false },
    driverVehicleCategory: {
      type: DataTypes.ENUM(...vehicleCategories),
      allowNull: false,
    },
    fitAcknowledged: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    totalPriceCents: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
    status: {
      // ADDED: PENDING_PAYMENT — holds the slot while Stripe Checkout is open
      type: DataTypes.ENUM("PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "EXPIRED"),
      allowNull: false,
      defaultValue: "PENDING_PAYMENT",
    },
    stripeCheckoutSessionId: {
      // ADDED: needed for webhook to find the reservation by session id
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    holdExpiresAt: {
      // ADDED: used to release abandoned PENDING_PAYMENT holds
      type: DataTypes.DATE,
      allowNull: true,
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

