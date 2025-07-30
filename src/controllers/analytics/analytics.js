import Order from "../../models/order.js";
import Product from "../../models/products.js";
import Branch from "../../models/branch.js";
import Seller from "../../models/seller.js";
import mongoose from "mongoose";

export async function getAnalytics(request, reply) {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    // ✅ Today Orders
    const todayOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "delivered"] }, 1, 0],
            },
          },
          pending: {
            $sum: {
              $cond: [
                {
                  $in: ["$status", ["pending", "packed", "ready", "packing"]],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // ✅ Current Orders (pending/active)
    const currentOrders = await Order.countDocuments({
      status: { $in: ["pending", "packing", "packed", "ready"] },
    });

    // ✅ Total Revenue
    const totalRevenueData = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalPrice" },
        },
      },
    ]);
    const totalRevenue = totalRevenueData[0]?.totalRevenue || 0;

    // ✅ Orders by Slot
    const ordersBySlot = await Order.aggregate([
      {
        $group: {
          _id: "$slot.label",
          totalOrders: { $sum: 1 },
          totalValue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { totalOrders: -1 } },
    ]);

    // ✅ Orders by Area (from customer address)
    const ordersByArea = await Order.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$order.customer.address.area", "Unknown"] },
          totalOrders: { $sum: 1 },
          totalValue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { totalOrders: -1 } },
    ]);

    // ✅ Orders by Payment Method
    const ordersByPaymentMethod = await Order.aggregate([
      {
        $group: {
          _id: "$payment.method",
          totalOrders: { $sum: 1 },
          totalValue: { $sum: "$totalPrice" },
        },
      },
    ]);

    // ✅ Orders by Day (for charting)
    const ordersByDay = await Order.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ✅ Seller-Product Aggregation
    // const sellerProductAggregation = await Product.aggregate([
    //   {
    //     $unwind: "$variants",
    //   },
    //   {
    //     $group: {
    //       _id: {
    //         seller: "$seller",
    //         product: "$_id",
    //       },
    //       totalStock: { $sum: "$variants.stock" },
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: "sellers",
    //       localField: "_id.seller",
    //       foreignField: "_id",
    //       as: "sellerInfo",
    //     },
    //   },
    //   {
    //     $unwind: "$sellerInfo",
    //   },
    //   {
    //     $project: {
    //       sellerName: "$sellerInfo.name",
    //       productId: "$_id.product",
    //       totalStock: 1,
    //     },
    //   },
    // ]);

    // ✅ Branch Stats
    const branchStats = await Branch.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "items.branch",
          as: "branchOrders",
        },
      },
      {
        $project: {
          name: 1,
          totalOrders: { $size: "$branchOrders" },
          totalValue: {
            $sum: "$branchOrders.totalPrice",
          },
        },
      },
    ]);

    // ✅ Response
    return reply.send({
      success: true,
      data: {
        todayOrders: todayOrders[0] || { total: 0, completed: 0, pending: 0 },
        currentOrders,
        totalRevenue,
        ordersBySlot,
        ordersByArea,
        ordersByDay,
        ordersByPaymentMethod,
        branchStats,
        // sellerProductAggregation,
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    if (!reply.sent) {
      reply.code(500).send({
        success: false,
        message: "Failed to fetch analytics",
        error: err.message,
      });
    }
  }
}
