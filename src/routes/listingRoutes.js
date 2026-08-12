const { Op } = require("sequelize")
const express = require("express");
const router = express.Router();
const { Listing, Reservation, User } = require("../models");
const { vehicleCategories } = require("../models/Listing");
const { requireAuth, optionalAuth } = require("../middlewares/auth");


function jitterCoordinate(value) {
  // Adds up to ~0.005 degrees (~500m) of random offset to obscure the exact address
  const OFFSET_RANGE = 0.005;
  const offset = (Math.random() - 0.5) * 2 * OFFSET_RANGE;
  return Math.round((value + offset) * 1e6) / 1e6; // 6 decimal places
}
const PUBLIC_LISTING_FIELDS = [
  "id",
  "title",
  "description",
  "neighborhood",
  "city",
  "state",
  "zipCode",
  "publicLatitude",
  "publicLongitude",
  "hourlyPriceCents",
  "availableFrom",
  "availableUntil",
  "maxVehicleCategory",
  "otherVehicleDescription",
  "imageUrl",
  "isActive",
  "hostId",
  "createdAt",
  "updatedAt",
];

function toPublicListing(listingInstance) {
  const listing = listingInstance.toJSON();
  const publicListing = Object.fromEntries(
    PUBLIC_LISTING_FIELDS.map((field) => [field, listing[field]])
  );

  // Preserve the nested host association if it was included in the query
  if (listing.host) {
    publicListing.host = listing.host;
  }

  return publicListing;
}

// Fields visible to the listing's own host — everything except imagePublicId
function toOwnerListing(listingInstance) {
  const listing = listingInstance.toJSON();
  delete listing.imagePublicId;
  return listing;
}

router.get("/", async (req, res, next) => {
  try {
    const {
      startTime,
      endTime,
      minLat,
      maxLat,
      minLng,
      maxLng,
      vehicleCategory,
      sort, // "distance" | "price"
      lat, // viewer's location, needed if sort=distance
      lng,
    } = req.query;

    const where = { isActive: true };

    if (minLat && maxLat) {
      where.publicLatitude = { [Op.between]: [Number(minLat), Number(maxLat)] };
    }
    if (minLng && maxLng) {
      where.publicLongitude = { [Op.between]: [Number(minLng), Number(maxLng)] };
    }

    let start, end;
    if (startTime && endTime) {
      start = new Date(startTime);
      end = new Date(endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
        return res.status(400).json({ error: "startTime and endTime are invalid" });
      }

      where.availableFrom = { [Op.lte]: start };
      where.availableUntil = { [Op.gte]: end };
    }

    if (vehicleCategory) {
      if (!vehicleCategories.includes(vehicleCategory)) {
        return res.status(400).json({ error: "vehicleCategory is invalid" });
      }
      // Fit rule: listing accepts if maxVehicleCategory === requested OR listing is OTHER_NOT_SURE
      where[Op.or] = [
        { maxVehicleCategory: vehicleCategory },
        { maxVehicleCategory: "OTHER_NOT_SURE" },
      ];
    }

    let listings = await Listing.findAll({ where });

    // Exclude listings with a conflicting CONFIRMED or live PENDING_PAYMENT reservation
    if (start && end) {
      const now = new Date();
      const listingIds = listings.map((l) => l.id);

      const conflicts = await Reservation.findAll({
        where: {
          listingId: { [Op.in]: listingIds },
          [Op.and]: [{ startTime: { [Op.lt]: end } }, { endTime: { [Op.gt]: start } }],
          [Op.or]: [
            { status: "CONFIRMED" },
            { status: "PENDING_PAYMENT", holdExpiresAt: { [Op.gt]: now } },
          ],
        },
        attributes: ["listingId"],
      });

      const blockedIds = new Set(conflicts.map((r) => r.listingId));
      listings = listings.filter((l) => !blockedIds.has(l.id));
    }

    let items = listings.map(toPublicListing);

    if (sort === "price") {
      items.sort((a, b) => a.hourlyPriceCents - b.hourlyPriceCents);
    } else if (sort === "distance" && lat && lng) {
      const viewerLat = Number(lat);
      const viewerLng = Number(lng);
      items.sort((a, b) => {
        const distA = Math.hypot(a.publicLatitude - viewerLat, a.publicLongitude - viewerLng);
        const distB = Math.hypot(b.publicLatitude - viewerLat, b.publicLongitude - viewerLng);
        return distA - distB;
      });
    }

    return res.status(200).json({
      items,
      meta: {
        count: items.length,
        sort: sort === "price" ? "price" : "distance",
      },
    });
  } catch (error) {
    return next(error);
  }
});

// GET a single listing by id
// GET a single listing by id — private fields only for owner or a confirmed driver
router.get("/:id", optionalAuth, async (req, res, next) => {
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

    let canSeePrivateFields = false;

    if (req.user) {
      const isOwner = listing.hostId === req.user.id;

      const hasConfirmedReservation = isOwner
        ? false
        : await Reservation.findOne({
            where: {
              listingId: parsedId,
              driverId: req.user.id,
              status: "CONFIRMED",
            },
          });

      canSeePrivateFields = isOwner || Boolean(hasConfirmedReservation);
    }

    const responseBody = canSeePrivateFields
      ? toOwnerListing(listing)
      : toPublicListing(listing);

    return res.status(200).json(responseBody);
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

  if (typeof title !== "string" || title.trim().length === 0 || title.length > 100) {
    return res.status(400).json({ error: "title must be 1-100 characters" });
  }

  if (typeof state !== "string" || !/^[A-Z]{2}$/.test(state.trim())) {
    return res.status(400).json({ error: "state must be a two-letter uppercase code" });
  }

  if (typeof zipCode !== "string" || !/^\d{5}$/.test(zipCode.trim())) {
    return res.status(400).json({ error: "zipCode must be a 5-digit code" });
  }

  if (!vehicleCategories.includes(maxVehicleCategory)) {
    return res.status(400).json({ error: "maxVehicleCategory is invalid" });
  }

  if (maxVehicleCategory === "OTHER_NOT_SURE" && !otherVehicleDescription) {
    return res.status(400).json({
      error: "otherVehicleDescription is required when maxVehicleCategory is OTHER_NOT_SURE",
    });
  }

  if (!Number.isInteger(hourlyPriceCents) || hourlyPriceCents <= 0) {
    return res.status(400).json({ error: "hourlyPriceCents must be a positive integer" });
  }

  if (typeof instructions !== "string" || instructions.trim().length === 0 || instructions.length > 1000) {
    return res.status(400).json({ error: "instructions must be 1-1000 characters" });
  }

  const from = new Date(availableFrom);
  const until = new Date(availableUntil);

  if (isNaN(from.getTime()) || isNaN(until.getTime())) {
    return res.status(400).json({ error: "availableFrom and availableUntil must be valid dates" });
  }

  if (until - from < 30 * 60 * 1000) {
    return res.status(400).json({ error: "Availability window must be at least 30 minutes" });
  }

  if (exactLatitude === undefined || exactLongitude === undefined) {
    return res.status(400).json({ error: "exactLatitude and exactLongitude are required" });
  }

  const lat = Number(exactLatitude);
  const lng = Number(exactLongitude);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({ error: "exactLatitude must be between -90 and 90" });
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "exactLongitude must be between -180 and 180" });
  }

  try {
    // Public coordinates are calculated by the backend, never accepted from the client.
    // Placeholder: exact coordinates reused directly. Replace with real jitter/rounding
    // logic once the team decides on a privacy-offset approach.
    const publicLatitude = jitterCoordinate(lat);
    const publicLongitude = jitterCoordinate(lng);

    const listing = await Listing.create({
      hostId: req.user.id,
      title: title.trim(),
      description,
      streetAddress: streetAddress.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zipCode: zipCode.trim(),
      exactLatitude: lat,
      exactLongitude: lng,
      publicLatitude,
      publicLongitude,
      hourlyPriceCents,
      availableFrom: from,
      availableUntil: until,
      maxVehicleCategory,
      otherVehicleDescription: otherVehicleDescription ?? null,
      instructions: instructions.trim(),
      imageUrl,
      imagePublicId,
      isActive: true,
    });

    return res.status(201).json(toOwnerListing(listing));
  } catch (error) {
    return next(error);
  }
});

// PATCH update a listing (owning host only)
router.patch("/:id", requireAuth, async (req, res, next) => {
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
      hourlyPriceCents,
      availableFrom,
      availableUntil,
      maxVehicleCategory,
      otherVehicleDescription,
      instructions,
      imageUrl,
      imagePublicId,
    } = req.body;

    if (maxVehicleCategory && !vehicleCategories.includes(maxVehicleCategory)) {
      return res.status(400).json({ error: "maxVehicleCategory is invalid" });
    }

    if (
      maxVehicleCategory === "OTHER_NOT_SURE" &&
      !otherVehicleDescription &&
      !listing.otherVehicleDescription
    ) {
      return res.status(400).json({
        error: "otherVehicleDescription is required when maxVehicleCategory is OTHER_NOT_SURE",
      });
    }

    if (
      hourlyPriceCents !== undefined &&
      (!Number.isInteger(hourlyPriceCents) || hourlyPriceCents <= 0)
    ) {
      return res.status(400).json({ error: "hourlyPriceCents must be a positive integer" });
    }

    let from = listing.availableFrom;
    let until = listing.availableUntil;

    if (availableFrom !== undefined) from = new Date(availableFrom);
    if (availableUntil !== undefined) until = new Date(availableUntil);

    if (isNaN(from.getTime()) || isNaN(until.getTime())) {
      return res.status(400).json({ error: "availableFrom and availableUntil must be valid dates" });
    }

    if (until - from < 30 * 60 * 1000) {
      return res.status(400).json({ error: "Availability window must be at least 30 minutes" });
    }

    // Guard against shrinking availability to exclude an already-confirmed future reservation.
    // NOTE: requires checking Reservation records tied to this listing — not yet implemented,
    // flagged as a follow-up once the team confirms the exact rule.

    const addressChanged =
      streetAddress !== undefined ||
      city !== undefined ||
      state !== undefined ||
      zipCode !== undefined;

    if (addressChanged && (exactLatitude === undefined || exactLongitude === undefined)) {
      return res.status(400).json({
        error: "exactLatitude and exactLongitude are required when the address changes",
      });
    }

    let lat = listing.exactLatitude;
    let lng = listing.exactLongitude;

    if (exactLatitude !== undefined) {
      lat = Number(exactLatitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ error: "exactLatitude must be between -90 and 90" });
      }
    }

    if (exactLongitude !== undefined) {
      lng = Number(exactLongitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ error: "exactLongitude must be between -180 and 180" });
      }
    }

    listing.title = title !== undefined ? title.trim() : listing.title;
    listing.description = description ?? listing.description;
    listing.streetAddress = streetAddress !== undefined ? streetAddress.trim() : listing.streetAddress;
    listing.neighborhood = neighborhood !== undefined ? neighborhood.trim() : listing.neighborhood;
    listing.city = city !== undefined ? city.trim() : listing.city;
    listing.state = state !== undefined ? state.trim().toUpperCase() : listing.state;
    listing.zipCode = zipCode !== undefined ? zipCode.trim() : listing.zipCode;
    listing.exactLatitude = lat;
    listing.exactLongitude = lng;
    listing.publicLatitude = jitterCoordinate(lat);
    listing.publicLongitude = jitterCoordinate(lng);
    listing.hourlyPriceCents = hourlyPriceCents ?? listing.hourlyPriceCents;
    listing.availableFrom = from;
    listing.availableUntil = until;
    listing.maxVehicleCategory = maxVehicleCategory ?? listing.maxVehicleCategory;
    listing.otherVehicleDescription = otherVehicleDescription ?? listing.otherVehicleDescription;
    listing.instructions = instructions !== undefined ? instructions.trim() : listing.instructions;
    listing.imageUrl = imageUrl ?? listing.imageUrl;
    listing.imagePublicId = imagePublicId ?? listing.imagePublicId;

    await listing.save();

    return res.status(200).json(toOwnerListing(listing));
  } catch (error) {
    return next(error);
  }
});

// PATCH toggle active status — deactivate or reactivate (owning host only)
router.patch("/:id/status", requireAuth, async (req, res, next) => {
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
      return res.status(403).json({ error: "Only the host who owns this listing can change its status" });
    }

    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be a boolean" });
    }

    listing.isActive = isActive;
    await listing.save();

    return res.status(200).json(toOwnerListing(listing));
  } catch (error) {
    return next(error);
  }
});

// POST /:id/photo — placeholder for photo replacement (owning host only)
// NOTE: needs to integrate with the team's image-upload service once decided.
// This currently only accepts an already-uploaded imageUrl/imagePublicId pair
// rather than handling the upload itself.
router.post("/:id/photo", requireAuth, async (req, res, next) => {
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
      return res.status(403).json({ error: "Only the host who owns this listing can update its photo" });
    }

    const { imageUrl, imagePublicId } = req.body;

    if (!imageUrl || !imagePublicId) {
      return res.status(400).json({ error: "imageUrl and imagePublicId are required" });
    }

    // NOTE: old image cleanup (deleting the previous Cloudinary asset) is not
    // implemented here — needs the image-upload service's delete method.
    listing.imageUrl = imageUrl;
    listing.imagePublicId = imagePublicId;
    await listing.save();

    return res.status(200).json(toOwnerListing(listing));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;