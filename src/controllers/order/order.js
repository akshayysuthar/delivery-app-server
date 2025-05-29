// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=4&t=1168s

import Order from "../../models/order.js";
import Branch from "../../models/branch.js";
import { Customer, DeliveryPartner } from "../../models/user.js";

export const createOrder = async (req, reply) => {
  try {
    const {
      userId,
      items,
      branch,
      totalPrice,
      slot,
      savings,
      handlingFee,
      deliveryFee,
      discount,
    } = req.body;

    console.log("📦 Incoming Order Request:", req.body);

    const customerData = await Customer.findById(userId);
    const branchData = await Branch.findById(branch);

    if (!customerData) {
      return reply.status(404).send({ message: "Customer not found" });
    }

    if (!branchData) {
      return reply.status(404).send({ message: "Branch not found" });
    }

    // Use address fields from customerData.address
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

    const newOrder = new Order({
      customer: userId,
      branch,
      slot,
      handlingFee,
      deliveryFee,
      savings,
      discount: req.body.discount, // ✅ Ensure this is included
      totalPrice,
      items: items.map((item) => ({
        product: item.item.product, // ✅ Main Product ID
        variantId: item.item.variantId, // ✅ Variant ID
        name: item.item.name,
        image: item.item.image,
        count: item.count,
        price: item.item.price,
        itemTotal: item.count * item.item.price,
      })),
      deliveryLocation,
      pickupLocation: {
        latitude: branchData.location.latitude,
        longitude: branchData.location.longitude,
        address:
          branchData.address ||
          "No address available! You can contact support team",
      },
    });

    const savedOrder = await newOrder.save();
    return reply.status(201).send(savedOrder);
  } catch (error) {
    console.error("❌ Error in createOrder:", error);
    return reply.status(500).send({ message: "Failed to create order", error });
  }
};

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

    if (order.status !== "ready") {
      return reply.status(400).send({ message: "Order is not available" });
    }

    order.deliveryPartner = userId;
    // Optionally update status to "assigned"
    order.status = "assigned";
    if (!order.statusTimestamps) order.statusTimestamps = {};
    order.statusTimestamps.assignedAt = new Date();

    await order.save();

    if (req.server?.io) {
      req.server.io.to(orderId).emit("orderConfirmed", order);
    }

    return reply.send(order);
  } catch (error) {
    console.error("Confirm order error:", error, error?.stack);
    return reply.status(500).send({
      message: "Failed to comfirm order",
      error: error.message || error,
    });
  }
};

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

    return reply.send({ message: "Status updated", order });
  } catch (error) {
    console.error(error);
    return reply
      .status(500)
      .send({ message: "Failed to update status", error });
  }
};

// export const updateOrderStatus = async (req, reply) => {
//   try {
//     const { orderId } = req.params;
//     const { status, deliveryPersonLocation } = req.body;
//     const { userId } = req.body;

//     const deliveryPerson = await DeliveryPartner.findById(userId);
//     if (!deliveryPerson) {
//       return reply.ststus(404).send({ message: "Delviery person not found" });
//     }
//     const order = await Order.findById(orderId);
//     if (!order) return reply.status(404).send({ message: "Order not found" });

//     if (["cancelled", "delivered"].includes(order.status)) {
//       return reply.status(400).send({ message: "ORder cannot be updated " });
//     }

//     if (order.deliveryPartner.toString() !== userId) {
//       return reply.status(403).send({ message: "Unauthorized" });
//     }

//     order.status = status;
//     order.deliveryPersonLocation = deliveryPersonLocation;
//     await order.save();

//     req.server.io.to(orderId).emit("LiveTrackingUpdates", order);
//     return reply.send(order);
//   } catch (error) {
//     console.log(error);
//     return reply
//       .status(500)
//       .send({ message: "Failed to update order status", error });
//   }
// };

export const getOrder = async (req, reply) => {
  try {
    const { status, branchId } = req.query;
    const { userId } = req.user;

    let query = { customer: userId };

    if (status) query.status = status;
    if (branchId) query.branch = branchId;

    const orders = await Order.find(query)
      .populate("customer branch items.product deliveryPartner")
      .sort({ createdAt: -1 });

    return reply.send(orders);
  } catch (error) {
    console.log("Get order error:", error);
    return reply.status(500).send({ message: "Failed to get order", error });
  }
};

export const getOrderById = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.user;

    const order = await Order.findById(orderId).populate(
      "customer branch items.product deliveryPartner"
    );

    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    console.log("Order fetched:", order._id);
    console.log("Order customer:", order.customer?._id?.toString());
    console.log(
      "Order deliveryPartner:",
      order.deliveryPartner?._id?.toString()
    );
    console.log("Request userId:", userId);

    // if (
    //   order.customer.toString() !== userId &&
    //   (!order.deliveryPartner || order.deliveryPartner.toString() !== userId)
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

function setStatusTimestamp(order, status) {
  if (!order.statusTimestamps) order.statusTimestamps = {};
  const now = new Date();
  switch (status) {
    case "pending":
      order.statusTimestamps.confirmedAt = now;
      break;
    case "packing":
      order.statusTimestamps.packedAt = null; // reset packedAt if going back
      break;
    case "packed":
      order.statusTimestamps.packedAt = now;
      break;
    case "arriving":
      order.statusTimestamps.arrivingAt = now;
      break;
    case "delivered":
      order.statusTimestamps.deliveredAt = now;
      break;
    case "cancelled":
      order.statusTimestamps.cancelledAt = now;
      break;
    // Add more as needed
    default:
      break;
  }
}
// ===============================================================
export const getPendingOrdersForBranch = async (req, reply) => {
  const { branchId } = req.params;
  try {
    const pendingStatuses = [
      "pending",
      "processing",
      "packing",
      "packed",
      "ready",
    ];
    const orders = await Order.find({
      branch: branchId,
      status: { $in: pendingStatuses },
    })
      .populate("customer", "name phone email")
      .populate("deliveryPartner", "name phone")
      .select("customer slot status createdAt totalPrice items") // Only select needed fields
      .sort({ createdAt: -1 });

    return reply.send(orders);
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
      .populate("branch")
      .populate("items.product")
      .populate("deliveryPartner");

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
    const { status } = req.body;

    // Only allow FC to set these statuses
    const allowedStatuses = ["packing", "packed", "ready", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      return reply.status(400).send({ message: "Invalid status update" });
    }

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    // Prevent overwriting final statuses
    if (["cancelled", "delivered"].includes(order.status)) {
      return reply
        .status(400)
        .send({ message: "Cannot modify completed order" });
    }

    order.status = status;
    setStatusTimestamp(order, status);
    await order.save();

    // Optional: notify via socket.io if needed
    if (req.server?.io) {
      req.server.io.to(orderId).emit("FCOrderUpdate", order);
    }

    return reply.send({ message: "Order status updated", order });
  } catch (error) {
    console.error("FC Order status update error:", error, error?.stack);
    return reply.status(500).send({
      message: "Failed to update order",
      error: error.message || error,
    });
  }
};
export const getAvailableOrdersForDelivery = async (req, reply) => {
  try {
    const deliveryPartnerId = req.body.userId; // from auth middleware

    // Fetch orders that are ready, assigned to this delivery partner, or delivered by this partner
    const orders = await Order.find({
      $or: [
        { status: "ready" }, // available to all
        {
          status: { $in: ["assigned", "delivered"] },
          deliveryPartner: deliveryPartnerId,
        },
      ],
    })
      .populate("customer", "name phone address")
      .populate("branch", "name address")
      .populate("items.product")
      .sort({ createdAt: -1 });

    // Split into available, assigned, and delivered arrays
    const available = orders.filter((order) => order.status === "ready");
    const assigned = orders.filter((order) => order.status === "assigned");
    const delivered = orders.filter((order) => order.status === "delivered");

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

    // Only allow delivery partner to set these statuses
    const allowedStatuses = ["arriving", "delivered", "cancelled"];
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
    const deliveryPartnerId = req.body.userId; // assuming this is passed from middleware

    const orders = await Order.find({
      deliveryPartner: deliveryPartnerId,
      status: { $ne: "delivered" }, // not delivered yet
    })
      .populate("customer")
      .populate("branch")
      .sort({ createdAt: -1 });

    reply.send(orders);
  } catch (err) {
    console.error("Error fetching assigned pending orders:", err);
    reply.status(500).send({ message: "Server Error" });
  }
};
