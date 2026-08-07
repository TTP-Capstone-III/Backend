const { sequelize } = require("../db");
const User = require("./User");
const Listing = require("./Listing");
const Reservation = require("./Reservation");

User.hasMany(Listing, {
  foreignKey: "hostId",
  as: "listings",
});
Listing.belongsTo(User, {
  foreignKey: "hostId",
  as: "host",
});

User.hasMany(Reservation, {
  foreignKey: "driverId",
  as: "reservations",
});
Reservation.belongsTo(User, {
  foreignKey: "driverId",
  as: "driver",
});

Listing.hasMany(Reservation, {
  foreignKey: "listingId",
  as: "reservations",
});
Reservation.belongsTo(Listing, {
  foreignKey: "listingId",
  as: "listing",
});

module.exports = { sequelize, User, Listing, Reservation };
