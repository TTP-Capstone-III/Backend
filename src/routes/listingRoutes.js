const express = require("express");
const { Op } = require("sequelize");

const { Listing, Reservation, User } = require("../models");
const { vehicleCategories } = require("../models/Listing");
const { requireAuth, optionalAuth } = require("../middlewares/auth");
const { evaluateVehicleFit, haversineMiles } = require("../utils/domain");

const router = express.Router();

const MIN_INTERVAL_MS = 30 * 60 * 1000;
const EXTERNAL_IMAGE_PUBLIC_ID = "external-image";

function readRequiredText(value, fieldName, minimumLength, maximumLength) {
  if (typeof value !== "string") {
    return { error: `${fieldName} must be text` };
  }

  const cleanedValue = value.trim();

  if (
    cleanedValue.length < minimumLength ||
    cleanedValue.length > maximumLength
  ) {
    return {
      error: `${fieldName} must be ${minimumLength}-${maximumLength} characters`,
    };
  }

  return { value: cleanedValue };
}

function readImageUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: "imageUrl is required" };
  }

  const cleanedUrl = value.trim();

  if (cleanedUrl.length > 2048) {
    return { error: "imageUrl is too long" };
  }

  try {
    const parsedUrl = new URL(cleanedUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { error: "imageUrl must use http or https" };
    }
  } catch {
    return { error: "imageUrl must be a valid URL" };
  }

  return { value: cleanedUrl };
}

function readNumber(value, fieldName, minimum, maximum) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return { error: `${fieldName} is required` };
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < minimum || parsedValue > maximum) {
    return {
      error: `${fieldName} must be between ${minimum} and ${maximum}`,
    };
  }

  return { value: parsedValue };
}

function readDate(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: `${fieldName} is required` };
  }

  const parsedDate = new Date(value);

  if (isNaN(parsedDate.getTime())) {
    return { error: `${fieldName} must be a valid date` };
  }

  return { value: parsedDate };
}

function validateInterval(startTime, endTime, label) {
  if (startTime >= endTime) {
    return `${label} start must be before its end`;
  }

  if (endTime - startTime < MIN_INTERVAL_MS) {
    return `${label} must be at least 30 minutes`;
  }

  return null;
}

function validateListingInput(body, coordinatesRequired) {
  const title = readRequiredText(body.title, "title", 5, 100);
  if (title.error) return { error: title.error };

  const description = readRequiredText(body.description, "description", 20, 1200);
  if (description.error) return { error: description.error };

  const streetAddress = readRequiredText(
    body.streetAddress,
    "streetAddress",
    5,
    150,
  );
  if (streetAddress.error) return { error: streetAddress.error };

  const neighborhood = readRequiredText(body.neighborhood, "neighborhood", 2, 80);
  if (neighborhood.error) return { error: neighborhood.error };

  const city = readRequiredText(body.city, "city", 2, 80);
  if (city.error) return { error: city.error };

  if (typeof body.state !== "string" || !/^[A-Za-z]{2}$/.test(body.state.trim())) {
    return { error: "state must be a two-letter code" };
  }

  if (typeof body.zipCode !== "string" || !/^\d{5}$/.test(body.zipCode.trim())) {
    return { error: "zipCode must be a 5-digit code" };
  }

  const hourlyPriceCents = Number(body.hourlyPriceCents);
  if (
    !Number.isInteger(hourlyPriceCents) ||
    hourlyPriceCents < 100 ||
    hourlyPriceCents > 100000
  ) {
    return {
      error: "hourlyPriceCents must be an integer between 100 and 100000",
    };
  }

  const availableFrom = readDate(body.availableFrom, "availableFrom");
  if (availableFrom.error) return { error: availableFrom.error };

  const availableUntil = readDate(body.availableUntil, "availableUntil");
  if (availableUntil.error) return { error: availableUntil.error };

  const intervalError = validateInterval(
    availableFrom.value,
    availableUntil.value,
    "Availability window",
  );
  if (intervalError) return { error: intervalError };

  if (!vehicleCategories.includes(body.maxVehicleCategory)) {
    return { error: "maxVehicleCategory is invalid" };
  }

  let otherVehicleDescription = null;

  if (body.maxVehicleCategory === "OTHER_NOT_SURE") {
    const otherDescription = readRequiredText(
      body.otherVehicleDescription,
      "otherVehicleDescription",
      1,
      180,
    );
    if (otherDescription.error) return { error: otherDescription.error };
    otherVehicleDescription = otherDescription.value;
  } else if (
    body.otherVehicleDescription !== undefined &&
    body.otherVehicleDescription !== null &&
    typeof body.otherVehicleDescription !== "string"
  ) {
    return { error: "otherVehicleDescription must be text" };
  }

  const instructions = readRequiredText(body.instructions, "instructions", 10, 800);
  if (instructions.error) return { error: instructions.error };

  const hasLatitude =
    body.exactLatitude !== undefined &&
    body.exactLatitude !== null &&
    body.exactLatitude !== "";
  const hasLongitude =
    body.exactLongitude !== undefined &&
    body.exactLongitude !== null &&
    body.exactLongitude !== "";

  if (hasLatitude !== hasLongitude) {
    return { error: "exactLatitude and exactLongitude must be provided together" };
  }

  if (coordinatesRequired && !hasLatitude) {
    return { error: "exactLatitude and exactLongitude are required" };
  }

  let coordinates = {};

  if (hasLatitude) {
    const exactLatitude = readNumber(body.exactLatitude, "exactLatitude", -90, 90);
    if (exactLatitude.error) return { error: exactLatitude.error };

    const exactLongitude = readNumber(
      body.exactLongitude,
      "exactLongitude",
      -180,
      180,
    );
    if (exactLongitude.error) return { error: exactLongitude.error };

    // Public map coordinates are approximate; exact coordinates remain private.
    coordinates = {
      exactLatitude: exactLatitude.value,
      exactLongitude: exactLongitude.value,
      publicLatitude: Number(exactLatitude.value.toFixed(3)),
      publicLongitude: Number(exactLongitude.value.toFixed(3)),
    };
  }

  return {
    value: {
      title: title.value,
      description: description.value,
      streetAddress: streetAddress.value,
      neighborhood: neighborhood.value,
      city: city.value,
      state: body.state.trim().toUpperCase(),
      zipCode: body.zipCode.trim(),
      hourlyPriceCents,
      availableFrom: availableFrom.value,
      availableUntil: availableUntil.value,
      maxVehicleCategory: body.maxVehicleCategory,
      otherVehicleDescription,
      instructions: instructions.value,
      ...coordinates,
    },
  };
}

function publicListing(listingInstance, fitStatus, distanceMiles) {
  const listing = listingInstance.toJSON();

  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    neighborhood: listing.neighborhood,
    city: listing.city,
    state: listing.state,
    zipCode: listing.zipCode,
    publicLatitude: listing.publicLatitude,
    publicLongitude: listing.publicLongitude,
    hourlyPriceCents: listing.hourlyPriceCents,
    availableFrom: listing.availableFrom,
    availableUntil: listing.availableUntil,
    maxVehicleCategory: listing.maxVehicleCategory,
    otherVehicleDescription: listing.otherVehicleDescription,
    imageUrl: listing.imageUrl,
    isActive: listing.isActive,
    host: listing.host
      ? {
          id: listing.host.id,
          name: listing.host.name,
        }
      : undefined,
    ...(fitStatus ? { fitStatus } : {}),
    ...(distanceMiles !== undefined ? { distanceMiles } : {}),
  };
}

function detailedListing(listingInstance, canSeePrivateFields) {
  const listing = listingInstance.toJSON();

  return {
    ...publicListing(listingInstance),
    ...(canSeePrivateFields
      ? {
          streetAddress: listing.streetAddress,
          instructions: listing.instructions,
          exactLatitude: listing.exactLatitude,
          exactLongitude: listing.exactLongitude,
        }
      : {}),
  };
}

// Search active listings that satisfy the requested map, time, and vehicle rules.
router.get("/", optionalAuth, async (req, res, next) => {
  const requiredQueryFields = [
    "startTime",
    "endTime",
    "driverVehicleCategory",
    "west",
    "south",
    "east",
    "north",
    "destinationLat",
    "destinationLng",
  ];

  const missingField = requiredQueryFields.find(
    (field) =>
      req.query[field] === undefined ||
      req.query[field] === null ||
      req.query[field] === "",
  );

  if (missingField) {
    return res.status(400).json({ error: `${missingField} is required` });
  }

  if (
    req.query.location !== undefined &&
    (typeof req.query.location !== "string" ||
      req.query.location.trim().length < 2 ||
      req.query.location.trim().length > 100)
  ) {
    return res.status(400).json({ error: "location must be 2-100 characters" });
  }

  if (!vehicleCategories.includes(req.query.driverVehicleCategory)) {
    return res.status(400).json({ error: "driverVehicleCategory is invalid" });
  }

  const startTime = readDate(req.query.startTime, "startTime");
  if (startTime.error) return res.status(400).json({ error: startTime.error });

  const endTime = readDate(req.query.endTime, "endTime");
  if (endTime.error) return res.status(400).json({ error: endTime.error });

  const intervalError = validateInterval(
    startTime.value,
    endTime.value,
    "Reservation",
  );
  if (intervalError) return res.status(400).json({ error: intervalError });

  const west = readNumber(req.query.west, "west", -180, 180);
  if (west.error) return res.status(400).json({ error: west.error });
  const south = readNumber(req.query.south, "south", -90, 90);
  if (south.error) return res.status(400).json({ error: south.error });
  const east = readNumber(req.query.east, "east", -180, 180);
  if (east.error) return res.status(400).json({ error: east.error });
  const north = readNumber(req.query.north, "north", -90, 90);
  if (north.error) return res.status(400).json({ error: north.error });
  const destinationLat = readNumber(
    req.query.destinationLat,
    "destinationLat",
    -90,
    90,
  );
  if (destinationLat.error) {
    return res.status(400).json({ error: destinationLat.error });
  }
  const destinationLng = readNumber(
    req.query.destinationLng,
    "destinationLng",
    -180,
    180,
  );
  if (destinationLng.error) {
    return res.status(400).json({ error: destinationLng.error });
  }

  if (west.value >= east.value) {
    return res.status(400).json({ error: "west must be less than east" });
  }

  if (south.value >= north.value) {
    return res.status(400).json({ error: "south must be less than north" });
  }

  const sort = req.query.sort || "distance";

  if (!["distance", "price"].includes(sort)) {
    return res.status(400).json({ error: "sort must be distance or price" });
  }

  try {
    const candidates = await Listing.findAll({
      where: {
        isActive: true,
        publicLatitude: {
          [Op.ne]: null,
          [Op.between]: [south.value, north.value],
        },
        publicLongitude: {
          [Op.ne]: null,
          [Op.between]: [west.value, east.value],
        },
        availableFrom: { [Op.lte]: startTime.value },
        availableUntil: { [Op.gte]: endTime.value },
      },
      include: [
        {
          model: User,
          as: "host",
          attributes: ["id", "name"],
        },
      ],
      order: [["id", "ASC"]],
      limit: 100,
    });

    let blockedListingIds = new Set();

    if (candidates.length > 0) {
      const conflicts = await Reservation.findAll({
        where: {
          listingId: { [Op.in]: candidates.map((listing) => listing.id) },
          status: "CONFIRMED",
          startTime: { [Op.lt]: endTime.value },
          endTime: { [Op.gt]: startTime.value },
        },
        attributes: ["listingId"],
      });

      blockedListingIds = new Set(
        conflicts.map((reservation) => reservation.listingId),
      );
    }

    const matchingListings = candidates
      .filter((listing) => !blockedListingIds.has(listing.id))
      .map((listing) => {
        const fit = evaluateVehicleFit(
          listing.maxVehicleCategory,
          req.query.driverVehicleCategory,
        );
        const distance = haversineMiles(
          destinationLat.value,
          destinationLng.value,
          listing.publicLatitude,
          listing.publicLongitude,
        );

        return {
          listing,
          fit,
          distanceMiles: Number(distance.toFixed(1)),
        };
      })
      .filter(({ fit }) => fit.fits)
      .sort((first, second) => {
        if (sort === "price") {
          return (
            first.listing.hourlyPriceCents - second.listing.hourlyPriceCents ||
            first.distanceMiles - second.distanceMiles
          );
        }

        return (
          first.distanceMiles - second.distanceMiles ||
          first.listing.hourlyPriceCents - second.listing.hourlyPriceCents
        );
      })
      .slice(0, 60)
      .map(({ listing, fit, distanceMiles }) =>
        publicListing(listing, fit.status, distanceMiles),
      );

    return res.status(200).json({
      items: matchingListings,
      meta: {
        count: matchingListings.length,
        sort,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Exact address details are limited to the owner or a confirmed driver.
router.get("/:id", optionalAuth, async (req, res, next) => {
  const listingId = Number(req.params.id);

  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: "Listing id must be a positive integer" });
  }

  try {
    const listing = await Listing.findByPk(listingId, {
      include: [
        {
          model: User,
          as: "host",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    let canSeePrivateFields = false;

    if (req.user) {
      const isOwner = listing.hostId === req.user.id;
      const confirmedReservation = isOwner
        ? null
        : await Reservation.findOne({
            where: {
              listingId,
              driverId: req.user.id,
              status: "CONFIRMED",
            },
          });

      canSeePrivateFields = isOwner || Boolean(confirmedReservation);
    }

    return res.status(200).json(detailedListing(listing, canSeePrivateFields));
  } catch (error) {
    return next(error);
  }
});

// Temporarily accept an image URL until direct photo uploads are added later.
router.post("/", requireAuth, async (req, res, next) => {
  const validation = validateListingInput(req.body, true);

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const imageUrl = readImageUrl(req.body.imageUrl);

  if (imageUrl.error) {
    return res.status(400).json({ error: imageUrl.error });
  }

  try {
    const listing = await Listing.create({
      ...validation.value,
      imageUrl: imageUrl.value,
      imagePublicId: EXTERNAL_IMAGE_PUBLIC_ID,
      hostId: req.user.id,
      isActive: true,
    });

    return res.status(201).json(detailedListing(listing, true));
  } catch (error) {
    return next(error);
  }
});

// Update listing information; photo replacement has its own route.
router.patch("/:id", requireAuth, async (req, res, next) => {
  const listingId = Number(req.params.id);

  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: "Listing id must be a positive integer" });
  }

  try {
    const listing = await Listing.findByPk(listingId);

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.hostId !== req.user.id) {
      return res.status(403).json({
        error: "Only the host who owns this listing can edit it",
      });
    }

    const addressChanged = ["streetAddress", "city", "state", "zipCode"].some(
      (field) =>
        String(req.body[field] ?? "").trim().toLowerCase() !==
        String(listing[field]).trim().toLowerCase(),
    );

    const validation = validateListingInput(req.body, addressChanged);

    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const invalidatedReservation = await Reservation.findOne({
      where: {
        listingId,
        status: "CONFIRMED",
        endTime: { [Op.gt]: new Date() },
        [Op.or]: [
          { startTime: { [Op.lt]: validation.value.availableFrom } },
          { endTime: { [Op.gt]: validation.value.availableUntil } },
        ],
      },
    });

    if (invalidatedReservation) {
      return res.status(409).json({
        error: "Availability cannot exclude an upcoming reservation",
      });
    }

    const updatedValues = { ...validation.value };

    if (updatedValues.exactLatitude === undefined) {
      updatedValues.exactLatitude = listing.exactLatitude;
      updatedValues.exactLongitude = listing.exactLongitude;
      updatedValues.publicLatitude = listing.publicLatitude;
      updatedValues.publicLongitude = listing.publicLongitude;
    }

    await listing.update(updatedValues);

    return res.status(200).json(detailedListing(listing, true));
  } catch (error) {
    return next(error);
  }
});

// Activate or deactivate a listing without changing its other information.
router.patch("/:id/status", requireAuth, async (req, res, next) => {
  const listingId = Number(req.params.id);

  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: "Listing id must be a positive integer" });
  }

  if (typeof req.body.isActive !== "boolean") {
    return res.status(400).json({ error: "isActive must be true or false" });
  }

  try {
    const listing = await Listing.findByPk(listingId);

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.hostId !== req.user.id) {
      return res.status(403).json({
        error: "Only the host who owns this listing can change its status",
      });
    }

    listing.isActive = req.body.isActive;
    await listing.save();

    return res.status(200).json(detailedListing(listing, true));
  } catch (error) {
    return next(error);
  }
});

// Temporarily replace a photo URL until direct photo uploads are added later.
router.post("/:id/photo", requireAuth, async (req, res, next) => {
  const listingId = Number(req.params.id);

  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: "Listing id must be a positive integer" });
  }

  try {
    const listing = await Listing.findByPk(listingId);

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.hostId !== req.user.id) {
      return res.status(403).json({
        error: "Only the host who owns this listing can update its photo",
      });
    }

    const imageUrl = readImageUrl(req.body.imageUrl);

    if (imageUrl.error) {
      return res.status(400).json({ error: imageUrl.error });
    }

    listing.imageUrl = imageUrl.value;
    listing.imagePublicId = EXTERNAL_IMAGE_PUBLIC_ID;
    await listing.save();

    return res.status(200).json(detailedListing(listing, true));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
