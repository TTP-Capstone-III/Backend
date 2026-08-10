const express = require("express");
const { Listing, Reservation, User } = require("../models");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

router.get("/listings", requireAuth, async (req, res, next) => {
  try {
    const listings = await Listing.findAll({
      where: {
        hostId: req.user.id, // Use the authenticated host, never a user-supplied host ID.
      },
      include: [
        {
          model: Reservation,
          as: "reservations",
          attributes: ["id"],
          where: { status: "CONFIRMED" },
          required: false, // Keep host listings that currently have zero reservations.
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const formattedListings = listings.map((listingInstance) => {
      const listing = listingInstance.toJSON(); // Convert the Sequelize instance before reshaping it.
      const result = {
        ...listing,
        _count: {
          reservations: listing.reservations.length, // Count only the confirmed rows included above.
        },
      };

      delete result.reservations; // Return the count instead of the temporary ID array.
      delete result.imagePublicId; // Do not expose the backend image-storage identifier.
      return result;
    });

    return res.status(200).json(formattedListings);
  } catch (error) {
    return next(error);
  }
});

router.get("/reservations", requireAuth, async (req, res, next) => {
  try {
    const reservations = await Reservation.findAll({
      include: [
        {
          model: Listing,
          as: "listing",
          attributes: [
            "id",
            "title",
            "neighborhood",
            "streetAddress",
            "maxVehicleCategory",
            "otherVehicleDescription",
          ],
          where: { hostId: req.user.id },
          required: true, // Filter out reservations for listings owned by other hosts.
        },
        {
          model: User,
          as: "driver",
          attributes: ["id", "name"], // Return safe driver fields without passwordHash.
        },
      ],
      order: [["startTime", "ASC"]],
    });
    return res.status(200).json(reservations);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
