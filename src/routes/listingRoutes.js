// src/routes/listingRoutes.js
const express = require("express");
const router = express.Router();
const { Listing, User } = require("../models");
const { vehicleCategories } = require("../models/Listing");
const { requireAuth } = require("../middlewares/auth");

// GET all active listings (public browse/search)
router.get("/", async (req, res, next) => {
  try {
    const listings = await Listing.findAll({
      where: { isActive: true },
      include: [{ model: User, as: "host", attributes: ["id", "name"] }],
      order: [["createdAt", "DESC"]],
    });

    const safeListings = listings.map((listingInstance) => {
      const listing = listingInstance.toJSON();
      delete listing.imagePublicId; // internal Cloudinary reference, not for the client
      return listing;
    });

    return res.status(200).json(safeListings);
  } catch (error) {
    return next(error);
  }
});

// GET a single listing by id (public)
router.get("/:id", async (req, res, next) => {
  try {
    const parsedId = Number(req.params.id);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return res.status(400).json({ error: "Listing id must be a positive integer" });
    }

    const listing = await Listing.findByPk(parsedId, {
      include: [{ model: User, as: "host", attributes: ["id", "name"] }],
    });

    if (!listing || !listing.isActive) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const safeListing = listing.toJSON();
    delete safeListing.imagePublicId;

    return res.status(200).json(safeListing);
  } catch (error) {
    return next(error);
  }
});

// POST create a new listing (host only)
router.post("/", requireAuth, async (req, res, next) => {
  const {
    title,
    description,
    streetAddress,
    neighborhood,
    city,
    state,
    zipCode,
    exactLatitude,
    exactLongitude,
    publicLatitude,
    publicLongitude,
    hourlyPriceCents,
    availableFrom,
    availableUntil,
    maxVehicleCategory,
    otherVehicleDescription,
    instructions,
    imageUrl,
    imagePublicId,
  } = req.body;

  const requiredFields = {
    title,
    description,
    streetAddress,
    neighborhood,
    city,
    state,
    zipCode,
    hourlyPriceCents,
    availableFrom,
    availableUntil,
    maxVehicleCategory,
    instructions,
    imageUrl,
    imagePublicId,
  };

  const missingField = Object.entries(requiredFields).find(
    ([, value]) => value === undefined || value === null || value === ""
  );

  if (missingField) {
    return res.status(400).json({ error: `${missingField[0]} is required` });
  }

  if (!vehicleCategories.includes(maxVehicleCategory)) {
    return res.status(400).json({ error: "maxVehicleCategory is invalid" });
  }

  if (!Number.isInteger(hourlyPriceCents) || hourlyPriceCents <= 0) {
    return res.status(400).json({ error: "hourlyPriceCents must be a positive integer" });
  }

  const from = new Date(availableFrom);
  const until = new Date(availableUntil);

  if (isNaN(from.getTime()) || isNaN(until.getTime())) {
    return res.status(400).json({ error: "availableFrom and availableUntil must be valid dates" });
  }

  if (from >= until) {
    return res.status(400).json({ error: "availableFrom must be before availableUntil" });
  }

  try {
    const listing = await Listing.create({
      hostId: req.user.id,
      title,
      description,
      streetAddress,
      neighborhood,
      city,
      state,
      zipCode,
      exactLatitude: exactLatitude ?? null,
      exactLongitude: exactLongitude ?? null,
      publicLatitude: publicLatitude ?? null,
      publicLongitude: publicLongitude ?? null,
      hourlyPriceCents,
      availableFrom: from,
      availableUntil: until,
      maxVehicleCategory,
      otherVehicleDescription: otherVehicleDescription ?? null,
      instructions,
      imageUrl,
      imagePublicId,
      isActive: true,
    });

    const safeListing = listing.toJSON();
    delete safeListing.imagePublicId;

    return res.status(201).json(safeListing);
  } catch (error) {
    return next(error);
  }
});

// PUT update a listing (host who owns it only)
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsedId = Number(req.params.id);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return res.status(400).json({ error: "Listing id must be a positive integer" });
    }

    const listing = await Listing.findByPk(parsedId);

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.hostId !== req.user.id) {
      return res.status(403).json({ error: "Only the host who owns this listing can edit it" });
    }

    const {
      title,
      description,
      streetAddress,
      neighborhood,
      city,
      state,
      zipCode,
      exactLatitude,
      exactLongitude,
      publicLatitude,
      publicLongitude,
      hourlyPriceCents,
      availableFrom,
      availableUntil,
      maxVehicleCategory,
      otherVehicleDescription,
      instructions,
      imageUrl,
      imagePublicId,
      isActive,
    } = req.body;

    if (maxVehicleCategory && !vehicleCategories.includes(maxVehicleCategory)) {
      return res.status(400).json({ error: "maxVehicleCategory is invalid" });
    }

    if (hourlyPriceCents !== undefined && (!Number.isInteger(hourlyPriceCents) || hourlyPriceCents <= 0)) {
      return res.status(400).json({ error: "hourlyPriceCents must be a positive integer" });
    }

    let from = listing.availableFrom;
    let until = listing.availableUntil;

    if (availableFrom !== undefined) from = new Date(availableFrom);
    if (availableUntil !== undefined) until = new Date(availableUntil);

    if (isNaN(from.getTime()) || isNaN(until.getTime())) {
      return res.status(400).json({ error: "availableFrom and availableUntil must be valid dates" });
    }

    if (from >= until) {
      return res.status(400).json({ error: "availableFrom must be before availableUntil" });
    }

    listing.title = title ?? listing.title;
    listing.description = description ?? listing.description;
    listing.streetAddress = streetAddress ?? listing.streetAddress;
    listing.neighborhood = neighborhood ?? listing.neighborhood;
    listing.city = city ?? listing.city;
    listing.state = state ?? listing.state;
    listing.zipCode = zipCode ?? listing.zipCode;
    listing.exactLatitude = exactLatitude ?? listing.exactLatitude;
    listing.exactLongitude = exactLongitude ?? listing.exactLongitude;
    listing.publicLatitude = publicLatitude ?? listing.publicLatitude;
    listing.publicLongitude = publicLongitude ?? listing.publicLongitude;
    listing.hourlyPriceCents = hourlyPriceCents ?? listing.hourlyPriceCents;
    listing.availableFrom = from;
    listing.availableUntil = until;
    listing.maxVehicleCategory = maxVehicleCategory ?? listing.maxVehicleCategory;
    listing.otherVehicleDescription = otherVehicleDescription ?? listing.otherVehicleDescription;
    listing.instructions = instructions ?? listing.instructions;
    listing.imageUrl = imageUrl ?? listing.imageUrl;
    listing.imagePublicId = imagePublicId ?? listing.imagePublicId;
    if (typeof isActive === "boolean") listing.isActive = isActive;

    await listing.save();

    const safeListing = listing.toJSON();
    delete safeListing.imagePublicId;

    return res.status(200).json(safeListing);
  } catch (error) {
    return next(error);
  }
});

// DELETE (deactivate) a listing (host who owns it only)
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsedId = Number(req.params.id);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return res.status(400).json({ error: "Listing id must be a positive integer" });
    }

    const listing = await Listing.findByPk(parsedId);

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.hostId !== req.user.id) {
      return res.status(403).json({ error: "Only the host who owns this listing can delete it" });
    }

    // Soft delete — preserve reservation history instead of removing the row
    listing.isActive = false;
    await listing.save();

    return res.status(200).json({ message: "Listing deactivated" });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;