// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=4&t=1168s

import Order from "../../models/order.js";
import Branch from "../../models/branch.js";
import Product from "../../models/products.js"; // <-- Add this line
import { Customer, DeliveryPartner } from "../../models/user.js";
import mongoose from "mongoose";

// to create the order by user
export const createOrder = async (req, reply) => {
  try {
    const {
      userId,
      items,
      totalPrice,
      slot,
      savings,
      handlingCharge,
      deliveryCharge,
      discount,
      couponCode,
    } = req.body;

    console.log("📦 Incoming Order Request:", req.body);

    const customerData = await Customer.findById(userId);
    if (!customerData) {
      return reply.status(404).send({ message: "Customer not found" });
    }

    const address = customerData.address || {};
    const deliveryLocation = {
      latitude: address.location?.latitude || 0,
      longitude: address.location?.longitude || 0,
      houseNo: address.houseNo || "",
      streetAddress: address.streetAddress || "",
      landmark: address.landmark || "",
      city: address.city || "",
      state: address.state || "",
      pinCode: address.pinCode || "",
      country: address.country || "",
    };

const uniqueBranchIds = [
  ...new Set(items.map((item) => new mongoose.Types.ObjectId(item.item.branch))),
];

    const branches = await Branch.find({ _id: { $in: uniqueBranchIds } });
    const pickupLocations = branches.map((branch) => ({
      branch: branch._id,
      latitude: branch.location.latitude,
      longitude: branch.location.longitude,
      address:
        branch.address || "No address available! You can contact support team",
    }));

    // 🆕 Enhance each item by fetching variant quantity (unit)
    const enhancedItems = await Promise.all(
      items.map(async (item) => {
        const productDoc = await Product.findById(item.item.product);
        const variant = productDoc.variants.id(item.item.variantId);

        return {
          product: item.item.product,
          variantId: item.item.variantId,
          branch: item.item.branch,
          name: item.item.name,
          image: item.item.image,
          count: item.count,
          price: item.item.price,
          itemTotal: item.item.price * item.count,
          unit: variant?.quantity || "", // 🟢 Set unit like "1kg", "500g"
        };
      })
    );

    const newOrder = new Order({
      customer: userId,
      slot,
      handlingCharge,
      deliveryCharge,
      savings,
      discount,
      couponCode,
      totalPrice,
      items: enhancedItems,
      deliveryLocation,
      pickupLocations,
    });

    const savedOrder = await newOrder.save();
    return reply.status(201).send(savedOrder);
  } catch (error) {
    console.error("❌ Error in createOrder:", error);
    return reply.status(500).send({ message: "Failed to create order", error });
  }
};

// the delivery parntewr confirm the order
export const comfirmOrder = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { deliveryPersonLocation, userId } = req.body;

    if (!userId) {
      return reply.status(400).send({ message: "userId is required in body" });
    }

    const deliveryPerson = await DeliveryPartner.findById(userId);
    if (!deliveryPerson) {
      return reply.status(404).send({ message: "Delivery Person not Found" });
    }
    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    // Allow assignment if status is "ready" or "packed"
    if (!["ready", "packed"].includes(order.status)) {
      return reply
        .status(400)
        .send({ message: "Order is not available for assignment" });
    }

    order.deliveryPartner = userId;
    // Optionally update status to "assigned"
    order.status = "assigned";
    if (!order.statusTimestamps) order.statusTimestamps = {};
    order.statusTimestamps.assignedAt = new Date();

    await order.save();
    // await sendOrderStatusNotification(order);

    if (req.server?.io) {
      req.server.io.to(orderId).emit("orderConfirmed", order);
    }

    return reply.send(order);
  } catch (error) {
    console.error("Confirm order error:", error, error?.stack);
    return reply.status(500).send({
      message: "Failed to confirm order",
      error: error.message || error,
    });
  }
};

// the fc will update the order status
export const updateOrderStatus = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "available",
      "processing",
      "dispatched",
      "delivered",
      "cancelled",
    ];
    if (!allowedStatuses.includes(status)) {
      return reply.status(400).send({ message: "Invalid status" });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );
    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    // ✅ Send push notification
    // await sendOrderStatusNotification(order);

    return reply.send({ message: "Status updated", order });
  } catch (error) {
    console.error(error);
    return reply
      .status(500)
      .send({ message: "Failed to update status", error });
  }
};

export const getOrder = async (req, reply) => {
  try {
    const { userId } = req.query;
    console.log("Received userId:", userId);

    // Validate
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(400).send({ message: "Invalid or missing userId" });
    }

    const orders = await Order.find({ customer: userId })
      .populate("customer items.product deliveryPartner")
      .sort({ createdAt: -1 }) // <-- Add this line
      .lean();

    return reply.send(orders);
  } catch (error) {
    console.error("Get order error:", error);
    return reply.status(500).send({ message: "Failed to get order", error });
  }
};

export const getOrderById = async (req, reply) => {
  try {
    const { orderId } = req.params;
    // const { userId } = req.user;

    const order = await Order.findById(orderId)
      .populate([
        { path: "customer", select: "name phone address" },
        { path: "items.product", select: "name image" },
        { path: "items.branch", select: "name address" },
        { path: "deliveryPartner", select: "name phone" },
      ])
      .lean(); // allows modifying the result

    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    // Optional auth check (uncomment if needed)
    // if (
    //   order.customer?._id?.toString() !== userId &&
    //   (!order.deliveryPartner ||
    //     order.deliveryPartner._id?.toString() !== userId)
    // ) {
    //   return reply
    //     .status(403)
    //     .send({ message: "Unauthorized access to this order" });
    // }

    return reply.send(order);
  } catch (error) {
    console.error("Get order by ID error:", error);
    return reply.status(500).send({ message: "Failed to get order", error });
  }
};

export async function getAllOrders(query = {}) {
  try {
    const { status, startDate, endDate, limit = 10, page = 1 } = query;

    // Build query conditions
    let queryConditions = {};

    // Add status filter if provided
    if (status) {
      queryConditions.status = status;
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      queryConditions.createdAt = {};
      if (startDate) queryConditions.createdAt.$gte = new Date(startDate);
      if (endDate) queryConditions.createdAt.$lte = new Date(endDate);
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    const orders = await Order.find(queryConditions)
      .populate("customer", "name phone email")
      .populate("deliveryPartner", "name phone")
      .populate("branch", "name address")
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(queryConditions);

    return {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasMore: skip + orders.length < totalOrders,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }
}

export const getOrdersForFC = async (req, reply) => {
  try {
    const { _id, branch } = req.user;
    const { status } = req.query;

    if (!branch) {
      return reply
        .status(400)
        .send({ message: "Branch ID missing in user token" });
    }

    const query = { branch: branch };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate("customer deliveryPartner");

    return reply.send({ orders });
  } catch (error) {
    console.error("FC Orders fetch failed:", error);
    return reply.status(500).send({ message: "Failed to fetch orders", error });
  }
};

export const getOrdersForDeliveryPartner = async (req, reply) => {
  try {
    const { userId } = req.user;

    const orders = await Order.find({ deliveryPartner: userId })
      .populate("customer branch")
      .sort({ createdAt: -1 });

    return reply.send(orders);
  } catch (error) {
    console.error("Delivery orders fetch failed:", error);
    return reply.status(500).send({ message: "Failed to fetch orders", error });
  }
};

export const getAvailableOrdersForDeliveryPartner = async (req, reply) => {
  try {
    const orders = await Order.find({
      deliveryPartner: null,
      status: "available",
    })
      .populate("customer branch")
      .sort({ createdAt: -1 });

    return reply.send(orders);
    // console.log({orders});
  } catch (error) {
    console.error("Fetch available orders failed:", error);
    return reply
      .status(500)
      .send({ message: "Failed to fetch available orders", error });
  }
};

export const acceptOrderByDeliveryPartner = async (req, reply) => {
  try {
    const { userId } = req.user;
    const { orderId } = req.params;

    const deliveryPartner = await DeliveryPartner.findById(userId);
    if (!deliveryPartner) {
      return reply.status(404).send({ message: "Delivery Partner not found" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    if (order.deliveryPartner) {
      return reply
        .status(400)
        .send({ message: "Order is already assigned to a delivery partner" });
    }

    if (order.status !== "available") {
      return reply
        .status(400)
        .send({ message: "Order is not in an assignable state" });
    }

    // Assign order
    order.deliveryPartner = userId;
    order.status = "processing"; // optionally update status
    order.statusTimestamps = {
      ...order.statusTimestamps,
      processingAt: new Date(),
    };

    await order.save();

    // Optional: notify clients via Socket.io
    req.server.io.to(orderId).emit("orderAccepted", order);

    return reply.send({ message: "Order accepted", order });
  } catch (error) {
    console.error("Accept order error:", error);
    return reply.status(500).send({ message: "Failed to accept order", error });
  }
};

function orderSummary(order) {
  return {
    _id: order._id,
    status: order.status,
    customer: order.customer?.name || order.customer,
    deliveryPartner: order.deliveryPartner?.name || order.deliveryPartner,
    branch: order.branch?.name || order.branch,
    slot: order.slot,
    totalPrice: order.totalPrice,
    items: order.items?.map((item) => ({
      product: item.product?.name || item.product,
      count: item.count,
      price: item.price,
    })),
    updatedAt: order.updatedAt,
    statusTimestamps: order.statusTimestamps,
  };
}

// export const sendOrderStatusNotification = async (order) => {
//   try {
//     const customer = await Customer.findById(order.customer);
//     console.log("📨 Customer token:", customer?.fcmToken);

//     if (!customer?.fcmToken) return;

//     const title = "Order Update";
//     const body = `Your order status is now: ${order.status.toUpperCase()}`;

//     await sendNotification(customer.fcmToken, title, body);
//   } catch (err) {
//     console.error("❌ Failed to send order status notification:", err.message);
//   }
// };

// fcmService.js
// import fetch from "node-fetch";
// import { getAccessToken } from "../notication/fcmService.js";
// import Product from "../../models/products.js";

// export const sendNotification = async (token, title, body) => {
//   const accessToken = await getAccessToken(); // from service account

//   const message = {
//     message: {
//       token,
//       notification: { title, body },
//     },
//   };

//   const response = await fetch(
//     "https://fcm.googleapis.com/v1/projects/surati-mart/messages:send",
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(message),
//     }
//   );

//   const data = await response.json();
//   if (!response.ok) {
//     console.error("FCM Error:", data);
//     throw new Error(data.error?.message || "Failed to send notification");
//   }

//   return data;
// };

// ===============================================================

export const updateItemPackingStatus = async (req, reply) => {
  const { orderId, itemId } = req.params;
  const { branchId, newStatus } = req.body;

  // Allowable statuses
  const allowedStatuses = ["packing", "packed", "cancelled"];
  if (!allowedStatuses.includes(newStatus)) {
    return reply.status(400).send({ message: "Invalid status" });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return reply.status(404).send({ message: "Item not found in order" });
    }

    if (item.branch.toString() !== branchId) {
      return reply
        .status(403)
        .send({ message: "Cannot update item of other branch" });
    }

    // Update item status
    item.status = newStatus;
    await order.save();

    // Filter only active (non-cancelled) items for this branch
    const branchItems = order.items.filter(
      (i) => i.branch.toString() === branchId && i.status !== "cancelled"
    );
    const allBranchPacked = branchItems.every((i) => i.status === "packed");

    let message = "";

    if (allBranchPacked) {
      // Check if all non-cancelled items across all branches are packed
      const allItemsPacked = order.items
        .filter((i) => i.status !== "cancelled")
        .every((i) => i.status === "packed");

      if (allItemsPacked) {
        order.status = "packed";
        order.statusTimestamps.packedAt = new Date();
        await order.save();
        message =
          "All active items packed across all branches. Order marked as packed.";
      } else {
        message =
          "All active items packed for your branch. Waiting for others.";
      }
    } else {
      message = "Item status updated.";
      if (newStatus === "cancelled") {
        message += " Item has been cancelled.";
      }
    }

    return reply.send({ message, order });
  } catch (error) {
    console.error("Error updating item status:", error);
    return reply
      .status(500)
      .send({ message: "Failed to update item status", error });
  }
};

export const cancelOrderItem = async (req, reply) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    const trimmedItemId = itemId.trim();
    const item = order.items.find((i) => i._id.toString() === trimmedItemId);

    if (!item)
      return reply.status(404).send({ message: "Item not found in order" });

    if (item.status === "cancelled") {
      return reply.status(400).send({ message: "Item already cancelled" });
    }

    // Mark item as cancelled and store reason
    item.status = "cancelled";
    item.cancellationReason = reason || "Not specified";

    // Recalculate total price
    const activeItems = order.items.filter((i) => i.status !== "cancelled");
    const newItemsTotal = activeItems.reduce((sum, i) => sum + i.itemTotal, 0);

    const deliveryCharge = order.deliveryCharge || 0;
    const handlingCharge = order.handlingCharge || 0;
    const discountAmt = parseFloat(order.discount?.amt || 0);

    order.totalPrice =
      newItemsTotal + deliveryCharge + handlingCharge - discountAmt;

    await order.save();

    return reply.send({ message: "Item cancelled and totals updated", order });
  } catch (error) {
    console.error("Cancel item error:", error);
    return reply.status(500).send({
      message: "Failed to cancel item",
      error: error.message,
    });
  }
};

export const getPendingOrdersForBranch = async (req, reply) => {
  const { branchId } = req.params;
  try {
    const pendingStatuses = [
      "pending",
      "confirmed",
      "processing",
      "packing",
      "packed",
      "ready",
    ];

    // Fetch orders that contain items from this branch and are in relevant statuses
    const orders = await Order.find({
      status: { $in: pendingStatuses },
      "items.branch": branchId,
    })
      .populate("customer", "name  address.area address.pinCode")
      .populate("deliveryPartner", "name phone")
      .populate("items.product", "name image")
      .select(
        "customer slot orderId status createdAt totalPrice items pickupLocations"
      )
      .sort({ createdAt: -1 });

    // Filter items to only those belonging to this branch
    const filteredOrders = orders.map((order) => {
      const filteredItems = order.items.filter(
        (item) => item.branch.toString() === branchId
      );
      return {
        ...order.toObject(),
        items: filteredItems,
      };
    });

    return reply.send(filteredOrders);
  } catch (error) {
    console.error("Fetch pending orders for branch failed:", error);
    return reply
      .status(500)
      .send({ message: "Failed to fetch pending orders", error });
  }
};

export const getOrderByIdFC = async (req, reply) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("customer")
      .populate("deliveryPartner")
      .populate("items.product")
      .populate("items.branch")
      .populate("pickupLocations.branch");

    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    return reply.send(order);
  } catch (error) {
    console.error("Get order by ID error:", error);
    return reply.status(500).send({ message: "Failed to get order", error });
  }
};

export const updateOrderStatusByFC = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { status, itemIndex } = req.body;

    // Add "confirmed" if it is an item-level status
    const allowedItemStatuses = ["packing", "packed", "cancelled", "confirmed"];
    const allowedOrderStatuses = ["ready", "confirmed"];

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    if (["cancelled", "delivered"].includes(order.status)) {
      return reply
        .status(400)
        .send({ message: "Cannot modify completed order" });
    }

    // If status is confirmed (or packing) and order.status is not confirmed yet, update it
    if (allowedOrderStatuses.includes(status)) {
      // Order-level update, no itemIndex needed
      if (status === "confirmed" && order.status !== "confirmed") {
        order.status = "confirmed";
        order.statusTimestamps ??= {};
        if (!order.statusTimestamps.confirmedAt) {
          order.statusTimestamps.confirmedAt = new Date();
        }
      } else if (status === "ready") {
        // Before ready, ensure all items packed
        const allPacked = order.items.every((item) => item.status === "packed");
        if (!allPacked) {
          return reply.status(400).send({
            message: "All items must be packed before setting order to ready",
          });
        }
        order.status = "ready";
        order.statusTimestamps ??= {};
        order.statusTimestamps.readyAt = new Date();
      }
    } else {
      // Item-level update - validate itemIndex and status
      if (!allowedItemStatuses.includes(status)) {
        return reply
          .status(400)
          .send({ message: "Invalid item status update" });
      }

      if (
        typeof itemIndex !== "number" ||
        itemIndex < 0 ||
        itemIndex >= order.items.length
      ) {
        return reply.status(400).send({ message: "Invalid item index" });
      }

      // Update item status
      order.items[itemIndex].status = status;

      // Update order status to packed if all items packed
      const allPacked = order.items.every((item) => item.status === "packed");
      if (allPacked) {
        order.status = "packed";
        order.statusTimestamps ??= {};
        order.statusTimestamps.packedAt = new Date();
      }
    }

    await order.save();

    req.server?.io?.to(orderId).emit("FCOrderUpdate", order);

    return reply.send({ message: "Order status updated", order });
  } catch (error) {
    console.error("FC Order status update error:", error);
    return reply.status(500).send({
      message: "Failed to update order",
      error: error.message || error,
    });
  }
};

export const getAvailableOrdersForDelivery = async (req, reply) => {
  try {
    const deliveryPartnerId = req.query.userId;
    if (!deliveryPartnerId)
      return reply.code(400).send({ error: "User ID missing" });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      // createdAt: { $gte: todayStart, $lte: todayEnd },
      $or: [
        { status: { $in: ["ready", "packed"] } }, // Show available to all
        {
          status: { $in: ["assigned", "arriving", "delivered", "cancelled"] },
          deliveryPartner: deliveryPartnerId, // Only assigned/cancelled/delivered to this partner
        },
      ],
    })
      .populate("customer", "name phone address")
      .populate("items.product orderId")
      .populate("items.branch")
      .populate("pickupLocations.branch");

    // Grouping
    const available = orders.filter(
      (order) => order.status === "ready" || order.status === "packed"
    );

    const assigned = orders.filter(
      (order) => order.status === "assigned" || order.status === "arriving"
    );

    const delivered = orders.filter(
      (order) => order.status === "delivered" || order.status === "cancelled"
    );

    return reply.send({ available, assigned, delivered });
  } catch (error) {
    console.error("Fetch available/assigned/delivered orders failed:", error);
    return reply.status(500).send({ message: "Failed to fetch orders", error });
  }
};

export const updateOrderStatusByDeliveryPartner = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus, paymentMethod, userId } = req.body;

    console.log(status, paymentMethod, paymentStatus, userId);

    // Only allow delivery partner to set these statuses
    const allowedStatuses = [
      "arriving",
      "delivered",
      "cancelled",
      "upi",
      "cash",
    ];
    if (!allowedStatuses.includes(status)) {
      return reply.status(400).send({ message: "Invalid status update" });
    }

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    // Only the assigned delivery partner can update
    if (!order.deliveryPartner || order.deliveryPartner.toString() !== userId) {
      return reply.status(403).send({ message: "Not authorized" });
    }

    // Prevent overwriting final statuses
    if (["cancelled", "delivered"].includes(order.status)) {
      return reply.status(400).send({ message: "Order already completed" });
    }

    // Update order status
    order.status = status;

    // Update payment status and method if provided
    if (paymentStatus) {
      order.payment.status = paymentStatus;
    }
    if (paymentMethod) {
      order.payment.method = paymentMethod;
    }

    if (!order.statusTimestamps) order.statusTimestamps = {};
    order.statusTimestamps[`${status}At`] = new Date();

    await order.save();

    // Optional: notify via socket.io
    if (req.server?.io) {
      req.server.io.to(orderId).emit("DeliveryOrderUpdate", order);
    }

    return reply.send({
      message: "Order status and payment updated",
      order: orderSummary(order),
    });
  } catch (error) {
    console.error("Delivery partner status update error:", error, error?.stack);
    return reply.status(500).send({
      message: "Failed to update order",
      error: error.message || error,
    });
  }
};
// GET orders assigned to this delivery partner and not yet delivered
export const getAssignedPendingOrdersForDeliveryPartner = async (
  req,
  reply
) => {
  try {
    const deliveryPartnerId = req.body.userId;

    const orders = await Order.find({
      deliveryPartner: deliveryPartnerId,
      status: { $ne: "delivered" },
    })
      .populate("customer")
      .populate("items.product")
      .populate("items.branch")
      .populate("pickupLocations.branch")
      .sort({ createdAt: -1 });

    reply.send(orders);
  } catch (err) {
    console.error("Error fetching assigned pending orders:", err);
    reply.status(500).send({ message: "Server Error" });
  }
};

export const getOrderByOrderId = async (request, reply) => {
  try {
    const { orderId } = request.params;

    // Attempt to find by the custom "orderId" field (not the _id)
    const order = await Order.findOne({ orderId });

    if (!order) {
      return reply.code(404).send({ error: "Order not found" });
    }

    return reply.send(order);
  } catch (err) {
    console.error("Error fetching order by orderId:", err);

    // If headers are already sent, do nothing further
    if (reply.sent) {
      return;
    }

    return reply.code(500).send({ error: "Internal server error" });
  }
};

export async function getDeliveredOrderCount(req, reply) {
  try {
    const { partnerId } = req.params;

    const count = await Order.countDocuments({
      deliveryPartner: partnerId,
      status: "delivered",
    });

    return reply.send({ deliveredOrderCount: count });
  } catch (error) {
    req.log.error(error, "Failed to fetch delivered order count");
    return reply.code(500).send({ message: "Server error" });
  }
}
