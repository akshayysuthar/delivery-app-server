import Order from "../../models/order.js";

export async function getAnalytics(request, reply) {
  try {
    const { startDate, endDate } = request.query;

    const now = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(now.getDate() - 30);

    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : now;

    // Ensure end of day is included
    end.setHours(23, 59, 59, 999);

    const matchStage = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

    console.log("🔎 matchStage:", matchStage); // DEBUG

    const ordersByDay = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          totalOrders: { $sum: 1 },
          canceledOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
          totalRevenue: { $sum: "$totalPrice" },
          totalDeliveryFee: { $sum: { $ifNull: ["$deliveryFee", 0] } },
          totalHandlingFee: { $sum: { $ifNull: ["$handlingFee", 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    const ordersByMonth = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalOrders: { $sum: 1 },
          canceledOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
          totalRevenue: { $sum: "$totalPrice" },
          totalDeliveryFee: { $sum: { $ifNull: ["$deliveryFee", 0] } },
          totalHandlingFee: { $sum: { $ifNull: ["$handlingFee", 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const ordersBySlot = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $ifNull: ["$slot.label", "Unknown"] },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
          canceledOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const ordersByPaymentMethod = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $ifNull: ["$payment.method", "Unknown"] },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
          canceledOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const sellerProductAggregation = await Order.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: {
            seller: "$productDetails.seller",
            product: "$productDetails._id",
            productName: "$productDetails.name",
          },
          totalQuantitySold: { $sum: "$items.count" },
          totalRevenue: { $sum: "$items.itemTotal" },
        },
      },
      {
        $group: {
          _id: "$_id.seller",
          totalQuantitySold: { $sum: "$totalQuantitySold" },
          totalRevenue: { $sum: "$totalRevenue" },
          products: {
            $push: {
              productId: "$_id.product",
              productName: "$_id.productName",
              quantitySold: "$totalQuantitySold",
              revenue: "$totalRevenue",
            },
          },
        },
      },
      {
        $lookup: {
          from: "sellers",
          localField: "_id",
          foreignField: "_id",
          as: "sellerDetails",
        },
      },
      { $unwind: "$sellerDetails" },
      {
        $project: {
          _id: 0,
          sellerId: "$sellerDetails._id",
          sellerName: "$sellerDetails.name",
          totalQuantitySold: 1,
          totalRevenue: 1,
          products: 1,
        },
      },
    ]);

    const branchStats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$branch",
          totalOrders: { $sum: 1 },
          canceledOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
          totalRevenue: { $sum: "$totalPrice" },
          totalDeliveryFee: { $sum: { $ifNull: ["$deliveryFee", 0] } },
          totalHandlingFee: { $sum: { $ifNull: ["$handlingFee", 0] } },
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "_id",
          as: "branchDetails",
        },
      },
      { $unwind: "$branchDetails" },
      {
        $project: {
          _id: 0,
          branchId: "$branchDetails._id",
          branchName: "$branchDetails.name",
          totalOrders: 1,
          canceledOrders: 1,
          totalRevenue: 1,
          totalDeliveryFee: 1,
          totalHandlingFee: 1,
        },
      },
    ]);

    return reply.send({
      success: true,
      data: {
        ordersByDay,
        ordersByMonth,
        ordersBySlot,
        ordersByPaymentMethod,
        sellerProductAggregation,
        branchStats,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return reply.status(500).send({ success: false, error: error.message });
  }
}
