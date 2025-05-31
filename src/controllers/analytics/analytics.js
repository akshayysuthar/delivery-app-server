import mongoose from "mongoose";
import Order from "../../models/order.js";

export async function getAnalytics(req, reply) {
  try {
    const { startDate, endDate } = req.query;

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

    // Seller stats update: include order counts by status, avg packing and delivery times
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
      // Additional aggregation for order statuses & times for each seller:
      {
        $lookup: {
          from: "orders",
          let: { sellerId: "$_id" },
          pipeline: [
            { $match: matchStage },
            { $unwind: "$items" },
            {
              $match: {
                $expr: { $eq: ["$items.seller", "$$sellerId"] },
              },
            },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                avgPackingTime: {
                  $avg: {
                    $subtract: ["$packedAt", "$createdAt"],
                  },
                },
                avgDeliveryTime: {
                  $avg: {
                    $subtract: ["$deliveredAt", "$packedAt"],
                  },
                },
              },
            },
          ],
          as: "statusStats",
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
          statusStats: 1,
        },
      },
    ]);

    // Branch stats update: count orders by status, avg packing and delivery times by branch
    const branchStats = await Order.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },

      {
        $group: {
          _id: "$items.branch",
          totalQuantity: { $sum: "$items.count" },
          totalRevenue: { $sum: "$items.itemTotal" },

          orders: {
            $addToSet: {
              orderId: "$_id",
              status: "$status",
              packedAt: "$packedAt",
              deliveredAt: "$deliveredAt",
              createdAt: "$createdAt",
              deliveryCharge: "$deliveryCharge",
              handlingCharge: "$handlingCharge",
              totalPrice: "$totalPrice",
            },
          },
        },
      },

      // Calculate order-level stats per branch:
      {
        $project: {
          branchId: "$_id",
          totalQuantity: 1,
          totalRevenue: 1,

          // Count orders by status
          totalOrders: { $size: "$orders" },
          deliveredOrders: {
            $size: {
              $filter: {
                input: "$orders",
                cond: { $eq: ["$$this.status", "delivered"] },
              },
            },
          },
          cancelledOrders: {
            $size: {
              $filter: {
                input: "$orders",
                cond: { $eq: ["$$this.status", "cancelled"] },
              },
            },
          },

          // Calculate average packing time in milliseconds
          avgPackingTime: {
            $avg: {
              $map: {
                input: "$orders",
                as: "order",
                in: {
                  $cond: [
                    { $and: ["$$order.packedAt", "$$order.createdAt"] },
                    { $subtract: ["$$order.packedAt", "$$order.createdAt"] },
                    null,
                  ],
                },
              },
            },
          },

          // Calculate average delivery time in milliseconds (deliveredAt - packedAt)
          avgDeliveryTime: {
            $avg: {
              $map: {
                input: "$orders",
                as: "order",
                in: {
                  $cond: [
                    { $and: ["$$order.deliveredAt", "$$order.packedAt"] },
                    { $subtract: ["$$order.deliveredAt", "$$order.packedAt"] },
                    null,
                  ],
                },
              },
            },
          },
        },
      },

      {
        $lookup: {
          from: "branches",
          localField: "branchId",
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
          totalQuantity: 1,
          totalRevenue: 1,
          totalOrders: 1,
          deliveredOrders: 1,
          cancelledOrders: 1,
          avgPackingTime: 1,
          avgDeliveryTime: 1,
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

    reply.send({
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
