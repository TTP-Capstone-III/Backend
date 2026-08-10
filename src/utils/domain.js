const VEHICLE_RANK = Object.freeze({ // Lower numbers represent smaller vehicle categories.
  COMPACT: 1,
  SEDAN: 2,
  SMALL_SUV: 3,
  LARGE_SUV_MINIVAN: 4,
  PICKUP: 5,
});

function evaluateVehicleFit(maxCategory, driverCategory) {
  if (maxCategory === "OTHER_NOT_SURE" || driverCategory === "OTHER_NOT_SURE") { // The driver must confirm uncertain fit.
    return {
      status: "ACK_REQUIRED",
      fits: true,
    };
  }

  const fits = VEHICLE_RANK[driverCategory] <= VEHICLE_RANK[maxCategory]; // Driver rank cannot exceed the space limit.

  return {
    status: fits ? "FITS" : "TOO_LARGE",
    fits,
  };
}

// Calculate the price using 30-minute billing blocks.
function calculatePrice(hourlyPriceCents, startTime, endTime) {
  const minutes = (endTime.getTime() - startTime.getTime()) / 60000;
  const billableBlocks = Math.ceil(minutes / 30); // Round partial blocks up.

  return {
    billableBlocks,
    totalPriceCents: Math.ceil((hourlyPriceCents * billableBlocks) / 2),
  };
}

module.exports = {
  VEHICLE_RANK,
  evaluateVehicleFit,
  calculatePrice,
};
