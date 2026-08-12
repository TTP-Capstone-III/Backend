// src/routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const Stripe = require("stripe");
const { db, Listing, Reservation } = require("../models");
const { vehicleCategories } = require("../models/Listing");
const { requireAuth } = require("../middlewares/auth");

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required.");
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("STRIPE_WEBHOOK_SECRET is required.");
}
if (!process.env.CLIENT_ORIGIN) {
  throw new Error("CLIENT_ORIGIN is required.");
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const MIN_RESERVATION_MS = 30 * 60 * 1000;
const HOLD_DURATION_MS = 30 * 60 * 1000; // matches Stripe Checkout's default 30-min session expiry

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

    const listingWantsSpecificFit = listing.maxVehicleCategory !== "OTHER_NOT_SURE";
    const driverIsUncertain = driverVehicleCategory === "OTHER_NOT_SURE";

    if (listingWantsSpecificFit && driverIsUncertain && !fitAcknowledged) {
      await transaction.rollback();
      return res.status(422).json({
        error: "You must acknowledge that the vehicle fit is uncertain",
      });
    }

    const now = new Date();

    // Conflicts with CONFIRMED reservations, or still-live PENDING_PAYMENT holds
    const overlapping = await Reservation.findOne({
      where: {
        listingId: parsedListingId,
        [Op.and]: [
          { startTime: { [Op.lt]: end } },
          { endTime: { [Op.gt]: start } },
        ],
        [Op.or]: [
          { status: "CONFIRMED" },
          {
            status: "PENDING_PAYMENT",
            holdExpiresAt: { [Op.gt]: now },
          },
        ],
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (overlapping) {
      await transaction.rollback();
      return res.status(409).json({ error: "This time slot is already booked" });
    }

    const durationHours = (end - start) / (1000 * 60 * 60);
    const totalPriceCents = Math.round(listing.hourlyPriceCents * durationHours);

    // Hold the slot BEFORE creating the Stripe session
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);

    const reservation = await Reservation.create(
      {
        listingId: parsedListingId,
        driverId: req.user.id,
        startTime: start,
        endTime: end,
        driverVehicleCategory,
        fitAcknowledged: Boolean(fitAcknowledged),
        totalPriceCents,
        status: "PENDING_PAYMENT",
        holdExpiresAt,
      },
      { transaction },
    );

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Parking at ${listing.title}` },
            unit_amount: totalPriceCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      expires_at: Math.floor(holdExpiresAt.getTime() / 1000), // align Stripe's own expiry with our hold
      success_url: `${process.env.CLIENT_ORIGIN}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_ORIGIN}/booking-cancelled`,
      metadata: {
        reservationId: String(reservation.id),
      },
    });

    reservation.stripeCheckoutSessionId = session.id;
    await reservation.save({ transaction });

    await transaction.commit();

    res.json({ url: session.url });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    next(error);
  }
});

module.exports = router;