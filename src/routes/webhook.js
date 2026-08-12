// src/routes/webhookRoutes.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const { Reservation } = require("../models");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// NOTE: this route needs the RAW body, not JSON-parsed — must be mounted
// in app.js BEFORE app.use(express.json()) runs on this path. See app.js notes below.
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  let event;

  try {
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const reservationId = Number(session.metadata.reservationId);

      const reservation = await Reservation.findByPk(reservationId);

      // Idempotency: only act if still PENDING_PAYMENT — duplicate webhook
      // deliveries for an already-CONFIRMED reservation are a no-op.
      if (reservation && reservation.status === "PENDING_PAYMENT") {
        reservation.status = "CONFIRMED";
        reservation.holdExpiresAt = null;
        await reservation.save();
      }
    }

    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object;
      const reservationId = Number(session.metadata.reservationId);

      const reservation = await Reservation.findByPk(reservationId);

      if (reservation && reservation.status === "PENDING_PAYMENT") {
        reservation.status = "EXPIRED";
        await reservation.save();
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    // Return 200 anyway so Stripe doesn't endlessly retry a permanently broken event
    return res.status(200).json({ received: true, error: "internal handling error" });
  }
});

module.exports = router;