const db = require("../db");
const User = require("./User");
const Listing = require("./Listing");
const Reservation = require("./Reservation");

User.hasMany(Listing, {
  foreignKey: "hostId",
  as: "listings",
  onUpdate: "CASCADE",
  onDelete: "RESTRICT",
});

Listing.belongsTo(User, {
  foreignKey: "hostId",
  as: "host",
});

User.hasMany(Reservation, {
  foreignKey: "driverId",
  as: "reservations",
  onUpdate: "CASCADE",
  onDelete: "RESTRICT",
});

Reservation.belongsTo(User, {
  foreignKey: "driverId",
  as: "driver",
});

Listing.hasMany(Reservation, {
  foreignKey: "listingId",
  as: "reservations",
  onUpdate: "CASCADE",
  onDelete: "RESTRICT",
});

Reservation.belongsTo(Listing, {
  foreignKey: "listingId",
  as: "listing",
});

module.exports = { db, User, Listing, Reservation };
