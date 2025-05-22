// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=4&t=1168s

import Order from "../../models/order.js";
import Branch from "../../models/branch.js";
import { Customer, DeliveryPartner } from "../../models/user.js";

export const createOrder = async (req, reply) => {
  try {
    const { userId } = req.user;
    const {
      items,
      branch,
      totalPrice,
      slot,
      savings,
      handlingFee,
      deliveryFee,
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

    const newOrder = new Order({
      customer: userId,
      branch,
      slot,
      handlingFee,
      deliveryFee,
      savings,
      totalPrice,

      items: items.map((item) => ({
        product: item.item._id,
        name: item.item.name,
        image: item.item.image,
        count: item.count,
        price: item.item.price,
        itemTotal: item.count * item.item.price, // Correct field name here
      })),
      deliveryLocation: {
        latitude: customerData?.LiveLocation?.latitude || "0",
        longitude: customerData?.LiveLocation?.longitude || "0",
      },
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
    const { userId } = req.user;
    const { orderId } = req.params;
    const { deliveryPersonLocation } = req.body;

    const deliveryPerson = await DeliveryPartner.findById(userId);
    if (!deliveryPerson) {
      return reply.status(404).send({ message: "Delivery Person not Found" });
    }
    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "ORder not found" });

    if (order.status !== "available") {
      return reply.status(400).send({ message: "ORder is not available " });
    }

    order.deliveryPersonLocation = deliveryPersonLocation;
    order.deliveryPartner = userId;
    order.deliveryPersonLocation = {
      latitude: deliveryPersonLocation.LiveLocation.latitude,
      longitude: deliveryPersonLocation.LiveLocation.longitude,
      address: deliveryPersonLocation.address || "NO Location",
    };

    req.server.io.to(orderId).emit("orderConfirmed", order); // ✅ 'server'

    await order.save();

    return reply.send(order);
  } catch (error) {
    console.log(error);
    return reply
      .status(500)
      .send({ message: "Failed to comfirm order", error });
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

export const updateOrderStatusByFC = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

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
    order.statusTimestamps[`${status}At`] = new Date();
    await order.save();

    req.server.io.to(orderId).emit("FCOrderUpdate", order);

    return reply.send(order);
  } catch (error) {
    console.error("FC Order status update error:", error);
    return reply.status(500).send({ message: "Failed to update order", error });
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
