const express = require("express");
const { Listing, Reservation, User } = require("../models");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

router.get("/listings", requireAuth, async (req, res, next) => {
  try {
    const listings = await Listing.findAll({
      where: {
        hostId: req.user.id,
      },
      include: [
        {
          model: Reservation,
          as: "reservations",
          attributes: ["id"],
          where: { status: "CONFIRMED" },
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const formattedListings = listings.map((listingInstance) => {
      const listing = listingInstance.toJSON();
      const result = {
        ...listing,
        _count: {
          reservations: listing.reservations.length,
        },
      };

      delete result.reservations;
      delete result.imagePublicId;
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
          required: true,
        },
        {
          model: User,
          as: "driver",
          attributes: ["id", "name"], //select only these attributes
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
