
const bcrypt = require("bcrypt");
const { db, User, Listing, Reservation } = require("./src/models");

async function seed() {
  try {
    console.log("Syncing database...");
    await db.sync({ force: true }); // WARNING: drops and recreates all tables

    console.log("Seeding users...");
    const passwordHash = await bcrypt.hash("password123", 12);

    const host1 = await User.create({
      name: "Alex Host",
      email: "host1@example.com",
      passwordHash,
    });

    const host2 = await User.create({
      name: "Jordan Property",
      email: "host2@example.com",
      passwordHash,
    });

    const driver1 = await User.create({
      name: "Sam Driver",
      email: "driver1@example.com",
      passwordHash,
    });

    const driver2 = await User.create({
      name: "Casey Commuter",
      email: "driver2@example.com",
      passwordHash,
    });

    console.log("Seeding listings...");
    const listing1 = await Listing.create({
      hostId: host1.id,
      title: "Driveway near Downtown Stadium",
      description: "Private driveway, 2 min walk to the stadium entrance.",
      streetAddress: "123 Main St",
      neighborhood: "Downtown",
      city: "Springfield",
      state: "IL",
      zipCode: "62701",
      exactLatitude: 39.7817,
      exactLongitude: -89.6501,
      publicLatitude: 39.7817,
      publicLongitude: -89.6501,
      hourlyPriceCents: 800, // $8.00
      availableFrom: new Date("2026-08-01T00:00:00Z"),
      availableUntil: new Date("2026-12-31T23:59:59Z"),
      maxVehicleCategory: "LARGE_SUV_MINIVAN",
      instructions: "Park close to the fence, do not block the sidewalk.",
      imageUrl: "https://placehold.co/600x400?text=Driveway+1",
      imagePublicId: "seed/driveway1",
      isActive: true,
    });

    const listing2 = await Listing.create({
      hostId: host1.id,
      title: "Covered Spot Near Airport",
      description: "Covered parking spot, 10 min shuttle to terminal.",
      streetAddress: "456 Airport Rd",
      neighborhood: "Airport District",
      city: "Springfield",
      state: "IL",
      zipCode: "62707",
      exactLatitude: 39.8445,
      exactLongitude: -89.6779,
      publicLatitude: 39.8445,
      publicLongitude: -89.6779,
      hourlyPriceCents: 550, // $5.50
      availableFrom: new Date("2026-08-01T00:00:00Z"),
      availableUntil: new Date("2026-12-31T23:59:59Z"),
      maxVehicleCategory: "SEDAN",
      instructions: "Gate code will be sent after booking.",
      imageUrl: "https://placehold.co/600x400?text=Covered+Spot",
      imagePublicId: "seed/airport1",
      isActive: true,
    });

    const listing3 = await Listing.create({
      hostId: host2.id,
      title: "Backyard Parking Near Campus",
      description: "Quiet residential spot, walk to campus in 5 minutes.",
      streetAddress: "789 College Ave",
      neighborhood: "University District",
      city: "Springfield",
      state: "IL",
      zipCode: "62703",
      exactLatitude: 39.799,
      exactLongitude: -89.644,
      publicLatitude: 39.799,
      publicLongitude: -89.644,
      hourlyPriceCents: 400, // $4.00
      availableFrom: new Date("2026-08-01T00:00:00Z"),
      availableUntil: new Date("2026-12-31T23:59:59Z"),
      maxVehicleCategory: "COMPACT",
      instructions: "Text on arrival, gate is unlocked 7am-10pm.",
      imageUrl: "https://placehold.co/600x400?text=Campus+Spot",
      imagePublicId: "seed/campus1",
      isActive: true,
    });

    console.log("Seeding reservations...");
    await Reservation.create({
      listingId: listing1.id,
      driverId: driver1.id,
      startTime: new Date("2026-08-15T18:00:00Z"),
      endTime: new Date("2026-08-15T22:00:00Z"),
      driverVehicleCategory: "SEDAN",
      fitAcknowledged: true,
      totalPriceCents: 3200, // 4 hrs * 800
      status: "CONFIRMED",
    });

    await Reservation.create({
      listingId: listing3.id,
      driverId: driver2.id,
      startTime: new Date("2026-08-20T09:00:00Z"),
      endTime: new Date("2026-08-20T17:00:00Z"),
      driverVehicleCategory: "COMPACT",
      fitAcknowledged: true,
      totalPriceCents: 3200, // 8 hrs * 400
      status: "CONFIRMED",
    });

    console.log("Seed complete ✅");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed ❌", error);
    process.exit(1);
  }
}

seed();