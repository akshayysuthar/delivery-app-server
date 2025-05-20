import {
  ServiceArea,
  Branch,
  ServiceFees,
  Banner,
  Offer,
  Category,
  Product,
} from "../../models/index.js";

export const home = async (req, reply) => {
  const { pincode } = req.query;

  if (!pincode) {
    return reply.status(400).send({ message: "Pincode is required." });
  }

  try {
    // 1. Find service area
    const area = await ServiceArea.findOne({
      pinCode: Number(pincode),
      isActive: true,
    }).populate("Branch");

    if (!area || area.Branch.length === 0) {
      return reply
        .status(404)
        .send({ message: "No service area or FC found for this pincode." });
    }

    // 2. Pick the first active FC
    const assignedBranch = area.Branch.find((b) => b.isActive !== false);

    if (!assignedBranch) {
      return reply
        .status(404)
        .send({ message: "No active fulfillment center available." });
    }

    const formatSlot = (slot, date) => ({
      id: slot._id,
      label: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      cutoffTime: slot.cutoffTime,
      available: true,
      date: date.toISOString().split("T")[0], // Format as YYYY-MM-DD
    });

    const getValidSlots = (date) => {
      return (area.Slots || [])
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

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const todaySlots = getValidSlots(today);
    const tomorrowSlots = getValidSlots(tomorrow);

    // 4. Fetch all service fees
    const serviceFees = await ServiceFees.find();

    // 5. Fetch banners
    const banners = await Banner.find({ isActive: true });

    // 6. Fetch offers
    const offers = await Offer.find({ isActive: true });

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
          lat: assignedBranch.location.latitude,
          lng: assignedBranch.location.longitude,
        },
        slots: {
          today: todaySlots,
          tomorrow: tomorrowSlots,
        },
        deliveryCharges: area.deliveryCharges,
        handlingCharges: area.handlingCharges || 5,
        otherCharge: [],
        codAvailable: assignedBranch.codAvailable,
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
