const { DataTypes } = require('sequelize');
const db = require('../db')

const Reservation = db.define('reservation', {
    listingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    driverId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    startDate: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    totalPrice: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    vehicleType: {
        type: DataTypes.STRING("compact", "sedan", "suv", "truck", "van", "other"),
        allowNull: false,
    },
    acknowledged_custom_fit: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'cancelled'),
        defaultValue: 'pending',
    },
});
