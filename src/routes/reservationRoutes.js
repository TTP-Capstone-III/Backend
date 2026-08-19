const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { Listing, Reservation, User } = require("../models");
const { vehicleCategories } = require("../models/Listing");
const { evaluateVehicleFit, calculatePrice } = require("../utils/domain");
const { requireAuth } = require("../middlewares/auth");

const MIN_RESERVATION_MS = 30 * 60 * 1000;

function activeConflictWhere(listingId, start, end) {
  return {
    listingId,
    [Op.and]: [
      { startTime: { [Op.lt]: end } },
      { endTime: { [Op.gt]: start } },
    ],
    [Op.or]: [
      { status: "CONFIRMED" },
      { status: "PENDING_PAYMENT", holdExpiresAt: { [Op.gt]: new Date() } },
    ],
  };
}

router.post("/quote", requireAuth, async (req, res, next) => {
  const { listingId, startTime, endTime, driverVehicleCategory, fitAcknowledged } = req.body;

  if (!listingId || !startTime || !endTime || !driverVehicleCategory) {
    return res.status(400).json({
      error: "listingId, startTime, endTime, and driverVehicleCategory are required",
    });
  }

  if (!vehicleCategories.includes(driverVehicleCategory)) {
    return res.status(400).json({ error: "driverVehicleCategory is invalid" });
  }

  const parsedListingId = Number(listingId);
  const acknowledgedFit = fitAcknowledged ?? false;

  if (typeof acknowledgedFit !== "boolean") {
    return res.status(400).json({ error: "fitAcknowledged must be true or false" });
  }

  if (!Number.isInteger(parsedListingId) || parsedListingId <= 0) {
    return res.status(400).json({ error: "listingId must be a positive integer" });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: "startTime and endTime must be valid dates" });
  }
  if (start >= end) {
    return res.status(400).json({ error: "startTime must be before endTime" });
  }
  if (start <= new Date()) {
    return res.status(400).json({ error: "startTime must be in the future" });
  }
  if (end - start < MIN_RESERVATION_MS) {
    return res.status(400).json({ error: "Reservation must be at least 30 minutes" });
  }

  try {
    const listing = await Listing.findByPk(parsedListingId);

    if (!listing || !listing.isActive) {
      return res.status(409).json({ error: "This listing is not currently active" });
    }
    if (listing.hostId === req.user.id) {
      return res.status(400).json({ error: "You cannot quote your own listing" });
    }
    if (start < listing.availableFrom || end > listing.availableUntil) {
      return res.status(409).json({
        error: "Requested time is outside the listing's availability window",
      });
    }

    const fit = evaluateVehicleFit(listing.maxVehicleCategory, driverVehicleCategory);

    if (!fit.fits) {
      return res.status(422).json({ error: "This vehicle is larger than the listing allows" });
    }
    if (fit.status === "ACK_REQUIRED" && !acknowledgedFit) {
      return res.status(422).json({
        error: "You must acknowledge that the vehicle fit is uncertain",
      });
    }

    const conflict = await Reservation.findOne({
      where: activeConflictWhere(parsedListingId, start, end),
    });

    if (conflict) {
      return res.status(409).json({ error: "This time slot is already booked" });
    }

    const { billableBlocks, totalPriceCents } = calculatePrice(
      listing.hourlyPriceCents,
      start,
      end,
    );

    const fitMessage =
      fit.status === "ACK_REQUIRED"
        ? listing.otherVehicleDescription ?? "Fit cannot be confirmed automatically."
        : "Your vehicle should fit.";

    return res.status(200).json({
      listingId: parsedListingId,
      startTime: start,
      endTime: end,
      billableBlocks,
      totalPriceCents,
      fitStatus: fit.status,
      fitMessage,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/driver", requireAuth, async (req, res, next) => {
  try {
    const reservations = await Reservation.findAll({
      where: { driverId: req.user.id },
      include: [
        {
          model: Listing,
          as: "listing",
          attributes: [
            "id",
            "title",
            "neighborhood",
            "city",
            "state",
            "zipCode",
            "streetAddress",
            "instructions",
            "imageUrl",
          ],
        },
      ],
      order: [["startTime", "ASC"]],
    });
    return res.status(200).json(reservations);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const parsedReservationId = Number(req.params.id);

    if (!Number.isInteger(parsedReservationId) || parsedReservationId <= 0) {
      return res.status(400).json({ error: "Reservation id must be a positive integer" });
    }

    const reservation = await Reservation.findByPk(parsedReservationId);

    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }
    if (reservation.driverId !== req.user.id) {
      return res.status(403).json({ error: "Only the driver who booked can cancel" });
    }
    if (reservation.status !== "CONFIRMED" || reservation.startTime <= new Date()) {
      return res
        .status(409)
        .json({ error: "Only future confirmed reservations can be cancelled" });
    }

    reservation.status = "CANCELLED";
    await reservation.save();

    return res.status(200).json(reservation);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
module.exports.activeConflictWhere = activeConflictWhere;