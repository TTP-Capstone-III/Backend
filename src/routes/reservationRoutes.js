const express = require("express");
const router = express.Router();
const { Listing, Reservation, User } = require("../models");
const { requireAuth } = require("../middlewares/auth");

// GET all reservations
router.get("/", async (req, res, next) => {
  try {
    const reservations = await Reservation.findAll({
      include: [
        { model: User, as: "driver" },
        { model: Listing, as: "listing" },
      ],
    });
    return res.status(200).json(reservations);
  } catch (error) {
    return next(error);
  }
});

// GET current user's own reservations (as a driver)
router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const reservations = await Reservation.findAll({
      where: { driverId: req.user.id },
      include: [{ model: Listing, as: "listing" }],
      order: [["startTime", "DESC"]],
    });
    return res.status(200).json(reservations);
  } catch (error) {
    return next(error);
  }
});

// GET reservations for listings the current user hosts
router.get("/host", requireAuth, async (req, res, next) => {
  try {
    const reservations = await Reservation.findAll({
      include: [
        {
          model: Listing,
          as: "listing",
          where: { hostId: req.user.id },
        },
        { model: User, as: "driver" },
      ],
      order: [["startTime", "DESC"]],
    });
    return res.status(200).json(reservations);
  } catch (error) {
    return next(error);
  }
});

// GET a single reservation by id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id, {
      include: [
        { model: User, as: "driver" },
        { model: Listing, as: "listing" },
      ],
    });

    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    const isDriver = reservation.driverId === req.user.id;
    const isHost = reservation.listing.hostId === req.user.id;

    if (!isDriver && !isHost) {
      return res.status(403).json({ error: "Not authorized to view this reservation" });
    }

    return res.status(200).json(reservation);
  } catch (error) {
    return next(error);
  }
});

// POST create a new reservation
router.post("/", requireAuth, async (req, res, next) => {
  const { listingId, startTime, endTime, driverVehicleCategory, fitAcknowledged } = req.body;

  if (!listingId || !startTime || !endTime || !driverVehicleCategory) {
    return res.status(400).json({
      error: "listingId, startTime, endTime, and driverVehicleCategory are required",
    });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: "startTime and endTime must be valid dates" });
  }

  if (start >= end) {
    return res.status(400).json({ error: "startTime must be before endTime" });
  }

  if (!fitAcknowledged) {
    return res.status(400).json({
      error: "You must acknowledge your vehicle fits before booking (fitAcknowledged: true)",
    });
  }

  try {
    const listing = await Listing.findByPk(listingId);

    if (!listing || !listing.isActive) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.hostId === req.user.id) {
      return res.status(400).json({ error: "You cannot book your own listing" });
    }

    if (start < listing.availableFrom || end > listing.availableUntil) {
      return res.status(400).json({ error: "Requested time is outside the listing's availability window" });
    }

    // Fetch all reservations for this listing, then check for overlap in plain JS (no Op)
    const existingReservations = await Reservation.findAll({
      where: { listingId },
    });

    const overlapping = existingReservations.find((r) => {
      const isActiveStatus = r.status === "CONFIRMED";
      const overlapsTime = r.startTime < end && r.endTime > start;
      return isActiveStatus && overlapsTime;
    });

    if (overlapping) {
      return res.status(409).json({ error: "This time slot is already booked" });
    }

    const durationHours = (end - start) / (1000 * 60 * 60);
    const totalPriceCents = Math.round(listing.hourlyPriceCents * durationHours);

    const reservation = await Reservation.create({
      listingId,
      driverId: req.user.id,
      startTime: start,
      endTime: end,
      driverVehicleCategory,
      fitAcknowledged,
      totalPriceCents,
      status: "CONFIRMED",
    });

    return res.status(201).json(reservation);
  } catch (error) {
    return next(error);
  }
});

// PATCH cancel a reservation
router.patch("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id);

    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    if (reservation.driverId !== req.user.id) {
      return res.status(403).json({ error: "Only the driver who booked can cancel" });
    }

    if (reservation.status === "CANCELLED") {
      return res.status(400).json({ error: "Reservation is already cancelled" });
    }

    reservation.status = "CANCELLED";
    await reservation.save();

    return res.status(200).json(reservation);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;