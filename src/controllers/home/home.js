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
 * Helper to format a slot object
 */
const formatSlot = (slot, date) => ({
  id: slot._id,
  label: slot.label,
  startTime: slot.startTime,
  endTime: slot.endTime,
  cutoffTime: slot.cutoffTime,
  available: true,
  date: date.toISOString().split("T")[0],
});

/**
 * Helper to get valid slots for a given date and area
 */
const getValidSlots = (area, date) => {
  return (area.slots || [])
    .filter((slot) => {
      const [startHour, startMin] = slot.startTime.split(":").map(Number);
      const slotTime = new Date(date);
      slotTime.setHours(startHour, startMin, 0, 0);

      return (
        slotTime.getTime() - Date.now() >
        (area.cutoffBufferMins || 60) * 60 * 1000
      );
    })
    .map((slot) => formatSlot(slot, date));
};

/**
 * Helper to get slots for multiple days
 */
const getSlotsForDays = (area, days = 2) => {
  const slots = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    slots.push({
      day: i === 0 ? "today" : `day${i + 1}`,
      slots: getValidSlots(area, date),
    });
  }
  return slots;
};

export const home = async (req, reply) => {
  const { pincode } = req.query;

  if (!pincode) {
    return reply.status(400).send({ message: "Pincode is required." });
  }

  try {
    // 1. Find service area and populate branches
    const area = await ServiceArea.findOne({
      pinCode: pincode,
      isActive: true,
    })
      .populate("branches")
      .lean();

    if (!area || !area.branches || area.branches.length === 0) {
      return reply
        .status(404)
        .send({ message: "No service area or FC found for this pincode." });
    }

    // 2. Pick the first active FC (or return all active branches if needed)
    const assignedBranch = area.branches.find((b) => b.isActive !== false);

    if (!assignedBranch) {
      return reply
        .status(404)
        .send({ message: "No active fulfillment center available." });
    }

    // 3. Get slots for today and tomorrow (or more days if needed)
    const slots = getSlotsForDays(area, 2);

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
