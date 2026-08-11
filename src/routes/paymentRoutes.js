// src/routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { Listing } = require("../models");
const { requireAuth } = require("../middlewares/auth");

router.post("/create-checkout-session", requireAuth, async (req, res, next) => {
  try {
    const { listingId, startTime, endTime, totalPriceCents } = req.body;

    const listing = await Listing.findByPk(listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `Parking at ${listing.title}` },
          unit_amount: totalPriceCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.CLIENT_ORIGIN}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_ORIGIN}/booking-cancelled`,
      metadata: {
        listingId: String(listingId),
        driverId: String(req.user.id),
        startTime,
        endTime,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

module.exports = router;