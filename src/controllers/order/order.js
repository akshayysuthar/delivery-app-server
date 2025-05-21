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
    const { status, deliveryPersonLocation } = req.body;
    const { userId } = req.body;

    const deliveryPerson = await DeliveryPartner.findById(userId);
    if (!deliveryPerson) {
      return reply.ststus(404).send({ message: "Delviery person not found" });
    }
    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    if (["cancelled", "delivered"].includes(order.status)) {
      return reply.status(400).send({ message: "ORder cannot be updated " });
    }

    if (order.deliveryPartner.toString() !== userId) {
      return reply.status(403).send({ message: "Unauthorized" });
    }

    order.status = status;
    order.deliveryPersonLocation = deliveryPersonLocation;
    await order.save();

    req.server.io.to(orderId).emit("LiveTrackingUpdates", order);
    return reply.send(order);
  } catch (error) {
    console.log(error);
    return reply
      .status(500)
      .send({ message: "Failed to update order status", error });
  }
};

export const getOrder = async (req, reply) => {
  try {
    const { status, customerId, deliveryPartnerId, branchId } = req.query;
    let query = {};
    if (status) query.status = status;
    if (customerId) query.customer = customerId;
    if (deliveryPartnerId) {
      query.deliveryPartner = deliveryPartnerId;
      query.branch = branchId;
    }
    console.log("Query:", query);
    const orders = await Order.find(query)
      .populate("customer branch items.product deliveryPartner")
      .sort({ createdAt: -1 });
    // console.log("Orders found:", orders);
    return reply.send(orders);
  } catch (error) {
    console.log("Get order error:", error);
    return reply.status(500).send({ message: "Failed to get order", error });
  }
};

export const getOrderById = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      // .populate(
      //   "customer branch items.product items.item deliveryPartner"
      // );
      .populate("customer branch items.product deliveryPartner");

    console.log(order);

    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    return reply.send(order);
  } catch (error) {
    console.log(error);
    return reply.status(500).send({ message: "Failed to get order", error });
  }
};
