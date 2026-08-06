import { sequelize } from "../db";
import User from "./User";
import Listing from "./Listing";
import Reservation from "./Reservation";

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

export { sequelize, User, Listing, Reservation };
