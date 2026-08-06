const db = require("../db");
const { DataTypes } = require("sequelize");

const Listing = db.define("Listing", {
  hostId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  street_address: {
    type: DataTypes.SRTING,
    allowNull: false,
  },
  neighborhood: {
    type: DataTypes.SRTING,
    allowNull: false,
  },
  city: {
    type: DataTypes.SRTING,
    allowNull: false,
  },
  state: {
    type: DataTypes.SRTING,
    allowNull: false,
  },
  zip_code: {
    type: DataTypes.SRTING,
    allowNull: false,
  },
  exact_latitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  exact_longitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  public_latitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  public_longitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  hourly_price_cents: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  availability_start: {
    type: DataTypes.SRTING,
    allowNull: true,
  },
  availability_end: {
    type: DataTypes.SRTING,
    allowNull: true,
  },
  max_vehicle_size: {
    type: DataTypes.SRTING,
    allowNull: true,
  },
  other_vehicle_Description: {
    type: DataTypes.SRTING,
    allowNull: true,
  },

  instructions: {
    type: DataTypes.SRTING,
    allowNull: false,
  },
  image_url: {
    type: DataTypes.SRTING,
    allowNull: false,
  },
  image_public_id: {
    type: DataTypes.SRTING,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
});

module.exports = Listing;
