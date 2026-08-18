const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const { Reservation } = require("../models");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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

      if (session.payment_status !== "paid") {
        return res.status(200).json({ received: true, skipped: "not paid" });
      }

      const reservationId = Number(session.metadata?.reservationId);

      if (!reservationId || isNaN(reservationId)) {
        return res.status(200).json({ received: true, skipped: "no reservationId in metadata" });
      }

      const reservation = await Reservation.findByPk(reservationId);

      if (!reservation) {
        return res.status(200).json({ received: true, skipped: "no matching reservation" });
      }

      if (reservation.status === "CONFIRMED") {
        return res.status(200).json({ received: true, alreadyConfirmed: true });
      }

      if (reservation.status !== "PENDING_PAYMENT") {
        return res.status(200).json({ received: true, skipped: reservation.status });
      }

      reservation.status = "CONFIRMED";
      reservation.holdExpiresAt = null;
      await reservation.save();

      return res.status(200).json({ received: true, confirmed: true });
    }

    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object;
      const reservationId = Number(session.metadata?.reservationId);

      if (reservationId && !isNaN(reservationId)) {
        const reservation = await Reservation.findByPk(reservationId);

        if (reservation && reservation.status === "PENDING_PAYMENT") {
          reservation.status = "EXPIRED";
          await reservation.save();
        }
      }

      return res.status(200).json({ received: true });
    }

    return res.status(200).json({ received: true, ignored: event.type });
  } catch (error) {
  
    console.error("Webhook handler error:", error);
    return res.status(500).json({ error: "Internal error processing webhook" });
  }
});

module.exports = router;