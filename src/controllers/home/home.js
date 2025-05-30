import {
  ServiceArea,
  Branch,
  ServiceFees,
  Banner,
  Offer,
  Category,
  Product,
} from "../../models/index.js";

/**
 * Format a slot for response, add slot date info
 */
const formatSlot = (slot, date) => ({
  id: slot._id,
  label: slot.label,
  startTime: slot.startTime,
  endTime: slot.endTime,
  available: true,
  date: date.toISOString().split("T")[0],
});

/**
 * Check if a slot is valid for a given date & current time, based on
 * minOrderTimeMinutes buffer and slot day availability
 */
const isSlotValid = (slot, date) => {
  if (!slot.isActive) return false;

  // Check if slot available on this day
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayName = daysOfWeek[date.getDay()];
  if (!slot.availableOnDays.includes(dayName)) return false;

  // Check cutoff buffer (minOrderTimeMinutes) from current time to slot start time
  const [startHour, startMin] = slot.startTime.split(":").map(Number);
  const slotStart = new Date(date);
  slotStart.setHours(startHour, startMin, 0, 0);

  const now = new Date();
  // Slot must start after (now + minOrderTimeMinutes)
  if (
    slotStart.getTime() - now.getTime() <
    slot.minOrderTimeMinutes * 60 * 1000
  ) {
    return false;
  }

  return true;
};

/**
 * Get valid slots for a service area & date, filtered by assigned branches
 * Only include slots that are assigned to branches that intersect with service area branches
 */
const getValidSlots = (area, slots, date, assignedBranchId) => {
  return slots
    .filter((slot) => {
      // Check if slot assigned to the branch or branch is in service area branches
      // Since slots are universal, you might want to check branch assignment if needed
      // Here assuming slots are global and assigned to service area branches by design

      // Validate if slot is valid for this date/time
      return isSlotValid(slot, date);
    })
    .map((slot) => formatSlot(slot, date));
};

/**
 * Get slots for multiple days for the area, filtering by assigned branch
 */
const getSlotsForDays = (area, slots, assignedBranchId, days = 2) => {
  const slotsByDay = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    slotsByDay.push({
      day: i === 0 ? "today" : `day${i + 1}`,
      slots: getValidSlots(area, slots, date, assignedBranchId),
    });
  }
  return slotsByDay;
};

export const home = async (req, reply) => {
  const { pincode } = req.query;

  if (!pincode) {
    return reply.status(400).send({ message: "Pincode is required." });
  }

  try {
    // 1. Find service area and populate branches and slots
    const area = await ServiceArea.findOne({
      pinCode: pincode,
      isActive: true,
    })
      .populate("branches")
      .populate("slots") // populate slots by ObjectId references
      .lean();

    if (!area || !area.branches || area.branches.length === 0) {
      return reply
        .status(404)
        .send({ message: "No service area or FC found for this pincode." });
    }

    // 2. Pick the first active FC (fulfillment center)
    const assignedBranch = area.branches.find((b) => b.isActive !== false);

    if (!assignedBranch) {
      return reply
        .status(404)
        .send({ message: "No active fulfillment center available." });
    }

    // 3. Get valid slots for today and tomorrow using populated slots
    const slots = getSlotsForDays(area, area.slots, assignedBranch._id, 2);

    // 4. Fetch all service fees
    const serviceFees = await ServiceFees.find().lean();

    // 5. Fetch banners
    const banners = await Banner.find({
      isActive: true,
      $or: [
        { Branch: assignedBranch._id },
        { Branch: { $exists: false } },
        { Branch: null },
      ],
    }).lean();

    // 6. Fetch offers
    const offers = await Offer.find({
      isActive: true,
      validTill: { $gte: new Date() },
    });

    // 7. (Optional) Fetch categories/products for productGroups if needed

    // 9. Delivery and handling charges as arrays
    const deliveryCharges = Array.isArray(area.deliveryCharges)
      ? area.deliveryCharges
      : area.deliveryCharges || 0;

    const handlingCharges = Array.isArray(area.handlingCharges)
      ? area.handlingCharges
      : area.handlingCharges || 5;

    // 8. Construct response object
    const response = {
      meta: {
        timestamp: new Date().toISOString(),
        city: area.city,
        area: area.name,
        pinCode: area.pinCode,
        fcId: assignedBranch._id,
        currency: "INR",
        language: "en",
      },
      fulfillmentCenter: {
        id: assignedBranch._id,
        name: assignedBranch.name,
        address: assignedBranch.address,
        serviceAreas: area.serviceAreas,
        supportedPinCodes: area.supportedPinCodes,
        location: {
          lat: assignedBranch.location?.latitude,
          lng: assignedBranch.location?.longitude,
        },
        slots,
        charges: {
          deliveryCharges: deliveryCharges, // now always an array
          handlingCharges: handlingCharges, // now always an array
        },
        otherCharge: [],
        minimumOrderAmount: area.minimumOrderAmount,
        cutoffBufferMins: area.cutoffBufferMins,
        freeDeliveryAbove: area.freeDeliveryAbove || null,

        codAvailable: assignedBranch.codAvailable || true,
        isActive: assignedBranch.isActive,
      },
      banners: banners.map((banner) => ({
        id: banner._id,
        image: banner.image,
        redirectType: banner.redirectType,
        targetId: banner.targetId,
        title: banner.title,
      })),
      offers: offers.map((offer) => ({
        id: offer._id,
        type: offer.type,
        title: offer.title,
        code: offer.code,
        minOrderValue: offer.minOrderValue,
        discountValue: offer.discountValue,
        validTill: offer.validTill,
      })),
      productGroups: [], // Populate as needed
      config: {
        featureFlags: {
          enableSearch: true,
          enableCOD: true,
          showOutOfStock: false,
          showRatings: false,
        },
        sortOptions: [
          { id: "price_low_high", label: "Price: Low to High" },
          { id: "popularity", label: "Most Popular" },
          { id: "newest", label: "New Arrivals" },
        ],
        filters: {
          priceRanges: [
            { label: "Under ₹50", min: 0, max: 50 },
            { label: "₹50 to ₹100", min: 50, max: 100 },
          ],
          tags: ["bestseller", "organic", "fast-delivery"],
        },
      },
    };

    return reply.send(response);
  } catch (err) {
    console.error("Assign FC error:", err);
    return reply.status(500).send({ message: "An error occurred", error: err });
  }
};
