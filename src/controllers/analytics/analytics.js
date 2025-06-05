import mongoose from "mongoose";
import Order from "../../models/order.js";

export async function getAnalytics(req, reply) {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // On-Time Performance
    const onTimePipeline = [
      {
        $match: {
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $project: {
          status: 1,
          packedAt: "$statusTimestamps.packedAt",
          readyAt: "$statusTimestamps.readyAt",
          slotTime: {
            $dateFromString: {
              dateString: {
                $concat: ["$slot.date", "T", "$slot.startTime", ":00.000Z"],
              },
            },
          },
        },
      },
      {
        $addFields: {
          delayMinutes: {
            $divide: [{ $subtract: ["$readyAt", "$slotTime"] }, 1000 * 60],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          onTime: {
            $sum: { $cond: [{ $lte: ["$delayMinutes", 0] }, 1, 0] },
          },
          delayed: {
            $sum: { $cond: [{ $gt: ["$delayMinutes", 15] }, 1, 0] },
          },
          atRisk: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$delayMinutes", 0] },
                    { $lte: ["$delayMinutes", 15] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ];
    const [onTimeStats = {}] = await Order.aggregate(onTimePipeline);

    // Today & Month Orders
    const todayOrders = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfToday } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          pending: {
            $sum: {
              $cond: [
                { $in: ["$status", ["pending", "packing", "packed", "ready"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const monthOrders = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          pending: {
            $sum: {
              $cond: [
                { $in: ["$status", ["pending", "packing", "packed", "ready"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Orders by Day
    const ordersByDay = await Order.aggregate([
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
          totalDeliveryFee: { $sum: "$deliveryCharge" },
          totalHandlingFee: { $sum: "$handlingCharge" },
          canceledOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { "_id.month": 1, "_id.day": 1 } },
    ]);

    // Orders by Slot
    const ordersBySlot = await Order.aggregate([
      {
        $group: {
          _id: "$slot.label",
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    // Branch Stats
    const branchStats = await Order.aggregate([
      {
        $unwind: "$items",
      },
      {
        $group: {
          _id: "$items.branch",
          totalOrders: { $addToSet: "$_id" },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          totalRevenue: { $sum: "$totalPrice" },
          totalQuantity: { $sum: "$items.count" },
          totalDeliveryFee: { $sum: "$deliveryCharge" },
          totalHandlingFee: { $sum: "$handlingCharge" },
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "_id",
          as: "branchInfo",
        },
      },
      {
        $addFields: {
          branchName: { $arrayElemAt: ["$branchInfo.name", 0] },
          branchId: "$_id",
          totalOrders: { $size: "$totalOrders" },
          avgPackingTime: null,
          avgDeliveryTime: null,
        },
      },
      {
        $project: {
          branchId: 1,
          branchName: 1,
          totalOrders: 1,
          deliveredOrders: 1,
          cancelledOrders: 1,
          totalRevenue: 1,
          totalQuantity: 1,
          totalDeliveryFee: 1,
          totalHandlingFee: 1,
          avgPackingTime: 1,
          avgDeliveryTime: 1,
        },
      },
    ]);

    // Seller Product Aggregation
    const sellerProductAggregation = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: { sellerName: "$items.branch", productId: "$items.product" },
          revenue: { $sum: "$items.itemTotal" },
          quantitySold: { $sum: "$items.count" },
        },
      },
      {
        $group: {
          _id: "$_id.sellerName",
          products: {
            $push: {
              productId: "$_id.productId",
              revenue: "$revenue",
              quantitySold: "$quantitySold",
            },
          },
        },
      },
      {
        $project: {
          sellerName: "$_id",
          products: 1,
        },
      },
    ]);

    // Payment Method Breakdown
    const ordersByPaymentMethod = await Order.aggregate([
      {
        $group: {
          _id: "$payment.method",
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
        },
      },
    ]);

    return reply.send({
      success: true,
      data: {
        onTimePerformance: {
          onTime: onTimeStats.onTime || 0,
          delayed: onTimeStats.delayed || 0,
          atRisk: onTimeStats.atRisk || 0,
          total: onTimeStats.total || 0,
        },
        todayOrders: {
          ...todayOrders[0],
          change: 0,
        },
        monthOrders: {
          ...monthOrders[0],
          change: 0,
        },
        ordersByDay,
        ordersBySlot,
        branchStats,
        sellerProductAggregation,
        ordersByPaymentMethod,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return reply.status(500).send({ success: false, error: error.message });
  }
}

// Updated getBranchAnalytics with order status counts and avg times
export const getBranchAnalytics = async (req, reply) => {
  try {
    const { branchId } = req.params;
    const query = req.query;

    const match = {
      "items.branch": new mongoose.Types.ObjectId(branchId),
      ...buildDateFilter(query),
    };

    const result = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      { $match: { "items.branch": new mongoose.Types.ObjectId(branchId) } },
      {
        $group: {
          _id: "$_id", // group by order to avoid counting duplicate items
          status: { $first: "$status" },
          packedAt: { $first: "$packedAt" },
          deliveredAt: { $first: "$deliveredAt" },
          createdAt: { $first: "$createdAt" },
          totalPrice: { $first: "$totalPrice" },
          quantity: { $sum: "$items.count" },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "delivered"] }, 1, 0],
            },
          },
          cancelledOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
          totalProductsSold: { $sum: "$quantity" },
          totalRevenue: { $sum: "$totalPrice" },

          avgPackingTime: {
            $avg: {
              $cond: [
                { $and: ["$packedAt", "$createdAt"] },
                { $subtract: ["$packedAt", "$createdAt"] },
                null,
              ],
            },
          },
          avgDeliveryTime: {
            $avg: {
              $cond: [
                { $and: ["$deliveredAt", "$packedAt"] },
                { $subtract: ["$deliveredAt", "$packedAt"] },
                null,
              ],
            },
          },
        },
      },
    ]);

    return reply.send(
      result[0] || {
        totalOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalProductsSold: 0,
        totalRevenue: 0,
        avgPackingTime: null,
        avgDeliveryTime: null,
      }
    );
  } catch (err) {
    req.log.error("Error in getBranchAnalytics:", err);
    return reply
      .status(500)
      .send({ error: "Failed to fetch branch analytics" });
  }
};

// Updated getSellerAnalytics with order status counts and avg times
export const getSellerAnalytics = async (req, reply) => {
  try {
    const { sellerId } = req.params;
    const query = req.query;

    const match = {
      "items.seller": new mongoose.Types.ObjectId(sellerId),
      ...buildDateFilter(query),
    };

    const orders = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      { $match: { "items.seller": new mongoose.Types.ObjectId(sellerId) } },
      {
        $group: {
          _id: "$_id", // group by order
          status: { $first: "$status" },
          packedAt: { $first: "$packedAt" },
          deliveredAt: { $first: "$deliveredAt" },
          createdAt: { $first: "$createdAt" },
          totalPrice: { $first: "$totalPrice" },
          quantity: { $sum: "$items.count" },
        },
      },
    ]);

    // Summarize stats in JS because avg with conditionals in aggregation is complex
    let totalOrders = 0,
      deliveredOrders = 0,
      cancelledOrders = 0,
      totalProductsSold = 0,
      totalRevenue = 0,
      totalPackingTime = 0,
      packingTimeCount = 0,
      totalDeliveryTime = 0,
      deliveryTimeCount = 0;

    orders.forEach((order) => {
      totalOrders++;
      totalProductsSold += order.quantity;
      totalRevenue += order.totalPrice || 0;

      if (order.status === "delivered") deliveredOrders++;
      if (order.status === "cancelled") cancelledOrders++;

      if (order.packedAt && order.createdAt) {
        totalPackingTime += order.packedAt - order.createdAt;
        packingTimeCount++;
      }
      if (order.deliveredAt && order.packedAt) {
        totalDeliveryTime += order.deliveredAt - order.packedAt;
        deliveryTimeCount++;
      }
    });

    const avgPackingTime = packingTimeCount
      ? totalPackingTime / packingTimeCount
      : null;
    const avgDeliveryTime = deliveryTimeCount
      ? totalDeliveryTime / deliveryTimeCount
      : null;

    return reply.send({
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      totalProductsSold,
      totalRevenue,
      avgPackingTime,
      avgDeliveryTime,
    });
  } catch (err) {
    req.log.error("Error in getSellerAnalytics:", err);
    reply.status(500).send({ error: "Failed to fetch seller analytics" });
  }
};

const buildDateFilter = (query) => {
  const filter = {};
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }
  return filter;
};

export const getFulfillmentDashboard = async (req, reply) => {
  try {
    const { branchId } = req.params;

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const previousMonthStart = new Date(startOfMonth);
    previousMonthStart.setMonth(startOfMonth.getMonth() - 1);

    const previousMonthEnd = new Date(startOfMonth);
    previousMonthEnd.setDate(0);

    const previousDay = new Date();
    previousDay.setDate(previousDay.getDate() - 1);
    const startOfPrevDay = new Date(previousDay.setHours(0, 0, 0, 0));
    const endOfPrevDay = new Date(previousDay.setHours(23, 59, 59, 999));

    const branchOrders = await Order.find({ "items.branch": branchId });

    // === Order Counts ===
    const orderCounts = {
      currentMonth: branchOrders.filter((o) => o.createdAt >= startOfMonth)
        .length,
      currentDay: branchOrders.filter(
        (o) => o.createdAt >= startOfDay && o.createdAt <= endOfDay
      ).length,
      previousMonth: branchOrders.filter(
        (o) =>
          o.createdAt >= previousMonthStart && o.createdAt <= previousMonthEnd
      ).length,
      previousDay: branchOrders.filter(
        (o) => o.createdAt >= startOfPrevDay && o.createdAt <= endOfPrevDay
      ).length,
    };

    // === On-Time Status (based on delivery delays or packedAt timestamps) ===
    let onTime = 0,
      delayed = 0,
      atRisk = 0;
    const now = new Date();

    const deliveryStatusOrders = branchOrders.filter((o) =>
      ["packing", "packed", "ready", "assigned"].includes(o.status)
    );
    deliveryStatusOrders.forEach((order) => {
      const slotStart = new Date(
        `${order.slot?.date}T${order.slot?.startTime}`
      );
      const packedTime = order.statusTimestamps?.packedAt;

      if (packedTime && packedTime <= slotStart) {
        onTime++;
      } else if (packedTime && packedTime > slotStart) {
        delayed++;
      } else {
        atRisk++;
      }
    });

    const onTimeStatus = {
      onTime,
      delayed,
      atRisk,
      total: onTime + delayed + atRisk,
    };

    // === Slot Analysis ===
    const slotAnalysis = [];
    const slotMap = {};

    branchOrders.forEach((order) => {
      const slotKey = order.slot?.label;
      if (!slotKey) return;

      if (!slotMap[slotKey]) {
        slotMap[slotKey] = {
          slotLabel: order.slot.label,
          slotTime: `${order.slot.startTime}-${order.slot.endTime}`,
          totalOrders: 0,
          pendingOrders: 0,
          packingOrders: 0,
          packedOrders: 0,
          readyOrders: 0,
          onTimeCount: 0,
        };
      }

      const entry = slotMap[slotKey];
      entry.totalOrders++;

      switch (order.status) {
        case "pending":
          entry.pendingOrders++;
          break;
        case "packing":
          entry.packingOrders++;
          break;
        case "packed":
          entry.packedOrders++;
          break;
        case "ready":
          entry.readyOrders++;
          break;
      }

      const packedTime = order.statusTimestamps?.packedAt;
      const slotStart = new Date(
        `${order.slot?.date}T${order.slot?.startTime}`
      );
      if (packedTime && packedTime <= slotStart) {
        entry.onTimeCount++;
      }
    });

    for (const slotKey in slotMap) {
      const entry = slotMap[slotKey];
      const { onTimeCount, totalOrders, ...rest } = entry;
      slotAnalysis.push({
        ...rest,
        onTimePercentage: totalOrders
          ? ((onTimeCount / totalOrders) * 100).toFixed(1)
          : 0,
      });
    }

    // === Recent Orders ===
    const recentOrders = await Order.find({ "items.branch": branchId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("customer", "name")
      .lean();

    const formattedRecentOrders = recentOrders.map((order) => ({
      _id: order._id,
      orderId: order.orderId,
      customerName: order.customer?.name || "N/A",
      totalPrice: order.totalPrice,
      status: order.status,
      createdAt: order.createdAt,
      slot: {
        label: order.slot?.label,
        date: order.slot?.date,
        startTime: order.slot?.startTime,
      },
      itemCount: order.items?.length || 0,
    }));

    // === Revenue Data ===
    const totalRevenue = branchOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const todayRevenue = branchOrders
      .filter((o) => o.createdAt >= startOfDay && o.createdAt <= endOfDay)
      .reduce((sum, o) => sum + o.totalPrice, 0);
    const monthRevenue = branchOrders
      .filter((o) => o.createdAt >= startOfMonth)
      .reduce((sum, o) => sum + o.totalPrice, 0);
    const averageOrderValue = branchOrders.length
      ? (totalRevenue / branchOrders.length).toFixed(2)
      : 0;

    const revenueData = {
      totalRevenue,
      todayRevenue,
      monthRevenue,
      averageOrderValue: Number(averageOrderValue),
    };

    // === Recent Actions (placeholder) ===
    const recentActions = []; // can be from a separate `ActionLog` collection if you have one

    return reply.send({
      success: true,
      data: {
        orderCounts,
        onTimeStatus,
        slotAnalysis,
        recentOrders: formattedRecentOrders,
        revenueData,
        recentActions,
      },
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ success: false, message: error.message });
  }
};
