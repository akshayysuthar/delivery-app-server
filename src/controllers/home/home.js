import {
  ServiceArea,
  Product,
  Branch,
  ServiceFees,
  Banner,
  Offer,
} from "../../models/index.js";

import { DateTime } from "luxon";

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

  // Use IST for all time calculations
  const now = DateTime.now().setZone("Asia/Kolkata");
  const slotStart = DateTime.fromJSDate(date)
    .setZone("Asia/Kolkata")
    .set({
      hour: Number(slot.startTime.split(":")[0]),
      minute: Number(slot.startTime.split(":")[1]),
      second: 0,
      millisecond: 0,
    });

  if (
    slotStart.toMillis() - now.toMillis() <
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

    // 2. Get all active branches assigned to this service area
    const assignedBranches = area.branches.filter((b) => b.isActive !== false);

    if (assignedBranches.length === 0) {
      return reply
        .status(404)
        .send({ message: "No active fulfillment centers available." });
    }

    // 3. Combine slots across all assigned branches (assuming slots are universal)
    //    If slots are branch-specific, you'll need to adjust this accordingly.
    //    Here, just use area.slots.
    const slots = getSlotsForDays(
      area,
      area.slots,
      assignedBranches.map((b) => b._id),
      2
    );

    // 4. Fetch all service fees
    const serviceFees = await ServiceFees.find().lean();

    // 5. Fetch banners applicable to any of the assigned branches or globally
    const branchIds = assignedBranches.map((b) => b._id);
    const banners = await Banner.find({
      isActive: true,
      $or: [
        { Branch: { $in: branchIds } },
        { Branch: { $exists: false } },
        { Branch: null },
      ],
    }).lean();

    // 6. Fetch offers
    const offers = await Offer.find({
      isActive: true,
      validTill: { $gte: new Date() },
    });

    // 7. Fetch products assigned to any of the assigned branches
    // Assuming your Product model has a field `branches` which is an array of branch ObjectIds where product is available
    const products = await Product.find({
      branches: { $in: branchIds },
      isActive: true,
    }).lean();

    // You can group products by category or subcategory as needed here before sending

    // 8. Delivery and handling charges (could be area-level or branch-level, adjust as needed)
    const deliveryCharges = Array.isArray(area.deliveryCharges)
      ? area.deliveryCharges
      : area.deliveryCharges || 39;

    const handlingCharges = Array.isArray(area.handlingCharges)
      ? area.handlingCharges
      : area.handlingCharges || 5;

    const minimumOrderAmount = area?.minimumOrderAmount;
    const freeDeliveryAbove = area?.freeDeliveryAbove;

    // 9. Construct response object with multiple branches and products
    const response = {
      meta: {
        timestamp: new Date().toISOString(),
        city: area.city,
        area: area.name,
        pinCode: area.pinCode,
        // you can send all assigned branch IDs or names
        fcIds: branchIds,
        currency: "INR",
        language: "en",
      },

      fulfillmentCenter: assignedBranches.map((branch) => ({
        id: branch._id,
        name: branch.name,
        address: branch.address,
        location: {
          lat: branch.location?.latitude,
          lng: branch.location?.longitude,
        },
        codAvailable: branch.codAvailable || true,
        isActive: branch.isActive,
      })),
      charges: {
        deliveryCharges,
        handlingCharges,
        minimumOrderAmount,
        freeDeliveryAbove,
      },
      slots, // slots are universal in this case

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
      productGroups: [
        {
          title: "Available Products",
          products: products,
        },
      ],
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
