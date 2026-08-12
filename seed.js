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

    const listing4 = await Listing.create({
      hostId: host1.id,
      title: "Manhattan Garage Spot",
      description: "Close to transit, easy in-and-out access for city trips.",
      streetAddress: "100 Broadway",
      neighborhood: "Financial District",
      city: "Manhattan",
      state: "NY",
      zipCode: "10006",
      exactLatitude: 40.707,
      exactLongitude: -74.011,
      publicLatitude: 40.707,
      publicLongitude: -74.011,
      hourlyPriceCents: 1800,
      availableFrom: new Date("2026-08-01T00:00:00Z"),
      availableUntil: new Date("2026-12-31T23:59:59Z"),
      maxVehicleCategory: "SEDAN",
      instructions: "Pull in slowly and keep the rear clear of the walkway.",
      imageUrl: "/images/manhattan.png",
      imagePublicId: "seed/manhattan1",
      isActive: true,
    });

    const listing5 = await Listing.create({
      hostId: host2.id,
      title: "Brooklyn Private Driveway",
      description: "Residential parking with a quick walk to local shops.",
      streetAddress: "44 Montague St",
      neighborhood: "Brooklyn Heights",
      city: "Brooklyn",
      state: "NY",
      zipCode: "11201",
      exactLatitude: 40.695,
      exactLongitude: -73.997,
      publicLatitude: 40.695,
      publicLongitude: -73.997,
      hourlyPriceCents: 1400,
      availableFrom: new Date("2026-08-01T00:00:00Z"),
      availableUntil: new Date("2026-12-31T23:59:59Z"),
      maxVehicleCategory: "LARGE_SUV_MINIVAN",
      instructions:
        "Keep centered in the driveway and leave room for the gate.",
      imageUrl: "/images/brooklynBridge.jpg",
      imagePublicId: "seed/brooklyn1",
      isActive: true,
    });

    const listing6 = await Listing.create({
      hostId: host1.id,
      title: "Queens Covered Spot",
      description: "Covered parking with room for an easy arrival and exit.",
      streetAddress: "12 Queens Blvd",
      neighborhood: "Long Island City",
      city: "Queens",
      state: "NY",
      zipCode: "11101",
      exactLatitude: 40.744,
      exactLongitude: -73.949,
      publicLatitude: 40.744,
      publicLongitude: -73.949,
      hourlyPriceCents: 1200,
      availableFrom: new Date("2026-08-01T00:00:00Z"),
      availableUntil: new Date("2026-12-31T23:59:59Z"),
      maxVehicleCategory: "SMALL_SUV",
      instructions: "Use the side entrance and avoid blocking the curb.",
      imageUrl: "/images/Queens.jpg",
      imagePublicId: "seed/queens1",
      isActive: true,
    });

    const listing7 = await Listing.create({
      hostId: host2.id,
      title: "Bronx Corner Lot",
      description: "Open corner lot with a simple pull-in and plenty of space.",
      streetAddress: "500 Grand Concourse",
      neighborhood: "Concourse Village",
      city: "Bronx",
      state: "NY",
      zipCode: "10451",
      exactLatitude: 40.821,
      exactLongitude: -73.924,
      publicLatitude: 40.821,
      publicLongitude: -73.924,
      hourlyPriceCents: 1000,
      availableFrom: new Date("2026-08-01T00:00:00Z"),
      availableUntil: new Date("2026-12-31T23:59:59Z"),
      maxVehicleCategory: "PICKUP",
      instructions: "Park close to the fence line and keep the walkway open.",
      imageUrl: "/images/Bronx.jpg",
      imagePublicId: "seed/bronx1",
      isActive: true,
    });

    const listing8 = await Listing.create({
      hostId: host1.id,
      title: "Staten Island Side Lot",
      description: "Quiet space with a wider entrance for stress-free parking.",
      streetAddress: "88 Bay St",
      neighborhood: "St. George",
      city: "Staten Island",
      state: "NY",
      zipCode: "10301",
      exactLatitude: 40.643,
      exactLongitude: -74.078,
      publicLatitude: 40.643,
      publicLongitude: -74.078,
      hourlyPriceCents: 1100,
      availableFrom: new Date("2026-08-01T00:00:00Z"),
      availableUntil: new Date("2026-12-31T23:59:59Z"),
      maxVehicleCategory: "OTHER_NOT_SURE",
      otherVehicleDescription: "Best for compact and mid-size vehicles.",
      instructions: "Back in slowly and leave the driveway clear.",
      imageUrl: "/images/StatenIsland.jpg",
      imagePublicId: "seed/statenisland1",
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
