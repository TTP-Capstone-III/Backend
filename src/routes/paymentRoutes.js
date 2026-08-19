const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const { db, Listing, Reservation } = require("../models");
const { vehicleCategories } = require("../models/Listing");
const { evaluateVehicleFit, calculatePrice } = require("../utils/domain");
const { requireAuth } = require("../middlewares/auth");
const { activeConflictWhere } = require("./reservationRoutes");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const MIN_RESERVATION_MS = 30 * 60 * 1000;
const HOLD_DURATION_MS = 35 * 60 * 1000;

router.post("/create-checkout-session", requireAuth, async (req, res, next) => {
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

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ error: "startTime and endTime are invalid" });
  }
  if (start <= new Date()) {
    return res.status(400).json({ error: "startTime must be in the future" });
  }
  if (end - start < MIN_RESERVATION_MS) {
    return res.status(400).json({ error: "Reservation must be at least 30 minutes" });
  }

  let reservation;
  let transaction;

  try {
    transaction = await db.transaction();

    const listing = await Listing.findByPk(parsedListingId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!listing || !listing.isActive) {
      await transaction.rollback();
      return res.status(409).json({ error: "This listing is not currently active" });
    }
    if (listing.hostId === req.user.id) {
      await transaction.rollback();
      return res.status(400).json({ error: "You cannot book your own listing" });
    }
    if (start < listing.availableFrom || end > listing.availableUntil) {
      await transaction.rollback();
      return res.status(409).json({
        error: "Requested time is outside the listing's availability window",
      });
    }

    const fit = evaluateVehicleFit(listing.maxVehicleCategory, driverVehicleCategory);

    if (!fit.fits) {
      await transaction.rollback();
      return res.status(422).json({ error: "This vehicle is larger than the listing allows" });
    }
    if (fit.status === "ACK_REQUIRED" && !acknowledgedFit) {
      await transaction.rollback();
      return res.status(422).json({
        error: "You must acknowledge that the vehicle fit is uncertain",
      });
    }

    const conflict = await Reservation.findOne({
      where: activeConflictWhere(parsedListingId, start, end),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (conflict) {
      await transaction.rollback();
      return res.status(409).json({ error: "This time slot is already booked" });
    }

    const { totalPriceCents } = calculatePrice(listing.hourlyPriceCents, start, end);
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);

    reservation = await Reservation.create(
      {
        listingId: parsedListingId,
        driverId: req.user.id,
        startTime: start,
        endTime: end,
        driverVehicleCategory,
        fitAcknowledged: acknowledgedFit,
        totalPriceCents,
        status: "PENDING_PAYMENT",
        holdExpiresAt,
      },
      { transaction },
    );

    await transaction.commit();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Parking at ${listing.title}` },
            unit_amount: reservation.totalPriceCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      expires_at: Math.floor(holdExpiresAt.getTime() / 1000),
      success_url: `${process.env.CLIENT_ORIGIN}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_ORIGIN}/booking-cancelled`,
      metadata: { reservationId: String(reservation.id) },
    });

    reservation.stripeCheckoutSessionId = session.id;
    await reservation.save();

    return res.json({ url: session.url });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    if (reservation && !reservation.stripeCheckoutSessionId) {
      try {
        reservation.status = "EXPIRED";
        await reservation.save();
      } catch (cleanupError) {
        next(cleanupError);
        return;
      }
    }

    return next(error);
  }
});

module.exports = router;