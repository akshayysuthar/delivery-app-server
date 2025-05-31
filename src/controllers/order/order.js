import mongoose from "mongoose";
import Order from "../../models/order.js";
import Branch from "../../models/branch.js";
import { Customer, DeliveryPartner } from "../../models/user.js";

export const createOrder = async (req, reply) => {
  try {
    const requiredFields = ["userId", "items", "totalPrice", "slot", "deliveryCharge", "handlingCharge"];
    for (const field of requiredFields) {
      if (req.body[field] === undefined) {
        return reply.status(400).send({ message: `Missing required field: ${field}` });
      }
    }
    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
      return reply.status(400).send({ message: "Items must be a non-empty array." });
    }
    if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
      return reply.status(400).send({ message: "Invalid userId format." });
    }
    // Basic validation for item structure (can be expanded)
    for (const item of req.body.items) {
        if (!item.item || !item.item.product || !item.item.variantId || !item.item.branch || !item.item.name || !item.item.image || item.count === undefined || item.item.price === undefined) {
            return reply.status(400).send({ message: "Invalid item structure in items array."});
        }
        if (!mongoose.Types.ObjectId.isValid(item.item.product) || !mongoose.Types.ObjectId.isValid(item.item.branch)) {
             return reply.status(400).send({ message: "Invalid product or branch ID format in items array."});
        }
    }


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

    const uniqueBranchIds = [...new Set(items.map((item) => item.item.branch.toString()))];
    const branches = await Branch.find({ _id: { $in: uniqueBranchIds } });
    const pickupLocations = branches.map((branch) => ({
      branch: branch._id,
      latitude: branch.location.latitude,
      longitude: branch.location.longitude,
      address: branch.address || "No address available! You can contact support team",
    }));

    const newOrder = new Order({
      customer: userId,
      slot,
      handlingFee: handlingCharge,
      deliveryFee: deliveryCharge,
      savings,
      discount,
      couponCode,
      totalPrice,
      items: items.map((item) => ({
        product: item.item.product,
        variantId: item.item.variantId,
        branch: item.item.branch,
        name: item.item.name,
        image: item.item.image,
        count: item.count,
        price: item.item.price,
        itemTotal: item.item.price * item.count,
      })),
      deliveryLocation,
      pickupLocations,
    });

    const savedOrder = await newOrder.save();
    return reply.status(201).send(savedOrder);
  } catch (error) {
    console.error("Error in createOrder:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

// Renamed from comfirmOrder to confirmOrder
export const confirmOrder = async (req, reply) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return reply.status(400).send({ message: "Invalid orderId format." });
    }

    const { deliveryPersonLocation } = req.body; // userId removed from body
    const userId = req.user?.userId; // userId from token

    if (!userId) {
      return reply.status(401).send({ message: "Unauthorized: User ID not found in token." });
    }

    const deliveryPerson = await DeliveryPartner.findById(userId);
    if (!deliveryPerson) {
      return reply.status(404).send({ message: "Delivery Person not Found" });
    }
    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    if (order.status !== "ready") { // Assuming "ready" is the status before confirmation
      return reply.status(400).send({ message: "Order is not available for confirmation" });
    }

    order.deliveryPartner = userId;
    order.status = "assigned"; // Status after confirmation
    if (!order.statusTimestamps) order.statusTimestamps = {};
    order.statusTimestamps.assignedAt = new Date();
    // Add deliveryPersonLocation if it's part of your schema and logic
    // order.deliveryPersonLastLocation = deliveryPersonLocation;

    await order.save();

    if (req.server?.io) {
      req.server.io.to(orderId).emit("orderConfirmed", order); // Event name updated
    }

    return reply.send(order);
  } catch (error) {
    console.error("Error in confirmOrder:", error.message, error.stack); // Function name updated
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

// The detailed updateOrderStatus function (previously commented out)
export const updateOrderStatus = async (req, reply) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return reply.status(400).send({ message: "Invalid orderId format." });
    }

    const { status, deliveryPersonLocation } = req.body;
    const userId = req.user?.userId; // userId from token

    if (!userId) {
      return reply.status(401).send({ message: "Unauthorized: User ID not found in token." });
    }

    // Validate status if necessary (e.g., using an enum or allowed list)
    // const allowedStatuses = ["processing", "dispatched", "arriving", "delivered", "cancelled"];
    // if (!allowedStatuses.includes(status)) {
    //    return reply.status(400).send({ message: "Invalid status provided." });
    // }

    const deliveryPerson = await DeliveryPartner.findById(userId); // Or generic User model if other roles can update
    if (!deliveryPerson) { // This check might be redundant if verifyToken ensures user exists
      return reply.status(404).send({ message: "User (Delivery person) not found" });
    }

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    if (["cancelled", "delivered"].includes(order.status)) {
      return reply.status(400).send({ message: "Order cannot be updated as it's already completed or cancelled." });
    }

    // Ensure only assigned delivery partner can update (or other roles if logic permits)
    if (!order.deliveryPartner || order.deliveryPartner.toString() !== userId) {
      return reply.status(403).send({ message: "Unauthorized to update this order's status." });
    }

    order.status = status;
    if (deliveryPersonLocation) { // Only update if provided
        // order.deliveryPersonLastLocation = deliveryPersonLocation; // Store location if schema supports
    }

    // Update appropriate timestamp
    if (!order.statusTimestamps) order.statusTimestamps = {};
    const timestampField = `${status}At`; // e.g. processingAt, deliveredAt
    order.statusTimestamps[timestampField] = new Date();


    await order.save();

    if (req.server?.io) { // Notify clients if using WebSockets
        req.server.io.to(orderId).emit("LiveTrackingUpdates", order); // Or a more generic "orderStatusUpdate"
    }
    return reply.send(order);
  } catch (error) {
    console.error("Error in updateOrderStatus:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};


export const getOrder = async (req, reply) => {
  try {
    const { status, branchId } = req.query;
    const { userId } = req.user; // Assuming userId is from JWT and represents the customer

    let query = { customer: userId };

    if (status) query.status = status;
    // if (branchId) query.branch = branchId; // Customer orders are usually not filtered by branch directly

    const orders = await Order.find(query)
      .populate("customer", "name phone email") // Populate specific fields
      .populate("deliveryPartner", "name phone")
      .populate("items.product", "name image price") // Populate fields from product
      .populate("items.branch", "name") // Populate branch name for items
      .sort({ createdAt: -1 });

    return reply.send(orders);
  } catch (error) {
    console.error("Error in getOrder:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const getOrderById = async (req, reply) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return reply.status(400).send({ message: "Invalid orderId format." });
    }
    const { userId } = req.user; // Assuming userId is from JWT

    const order = await Order.findById(orderId)
      .populate("customer", "name phone email")
      .populate("deliveryPartner", "name phone")
      .populate("items.product") // Populate full product for details
      .populate("items.branch", "name location"); // Populate branch details

    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    const customerId = order.customer?._id?.toString() || order.customer?.toString();
    const deliveryPartnerId = order.deliveryPartner?._id?.toString() || order.deliveryPartner?.toString();

    // Allow access if user is the customer or the assigned delivery partner.
    // Add other roles (e.g., admin) if they should also have access.
    if (customerId !== userId && deliveryPartnerId !== userId) {
      // TODO: Add admin role check here if admins should bypass this
      // const userMakingRequest = await User.findById(userId); (assuming a generic User model or Admin model)
      // if (userMakingRequest.role !== 'Admin') {
      return reply.status(403).send({ message: "Unauthorized access to this order." });
      // }
    }

    return reply.send(order);
  } catch (error) {
    console.error("Error in getOrderById:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

// getAllOrders remains largely unchanged in its core logic, only error handling.
export async function getAllOrders(query = {}) {
  try {
    const { status, startDate, endDate, limit = 10, page = 1 } = query;
    let queryConditions = {};
    if (status) queryConditions.status = status;
    if (startDate || endDate) {
      queryConditions.createdAt = {};
      if (startDate) queryConditions.createdAt.$gte = new Date(startDate);
      if (endDate) queryConditions.createdAt.$lte = new Date(endDate);
    }
    const skip = (page - 1) * limit;
    const orders = await Order.find(queryConditions)
      .populate("customer", "name phone email")
      .populate("deliveryPartner", "name phone")
      .populate("items.branch", "name address") // Changed from 'branch' to 'items.branch'
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
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
    // This function is not a route handler, so it throws error for service layer handling
    console.error("Error in getAllOrders service:", error.message, error.stack);
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }
}


export const getOrdersForFC = async (req, reply) => {
  try {
    const { _id, branch } = req.user; // Assuming branch is part of FC user token
    const { status } = req.query;

    if (!branch) {
      return reply.status(400).send({ message: "Branch ID missing in user token for FC" });
    }
    if (!mongoose.Types.ObjectId.isValid(branch)) {
        return reply.status(400).send({ message: "Invalid Branch ID format in token."});
    }

    const queryConditions = { "items.branch": branch }; // Query by items.branch
    if (status) queryConditions.status = status;

    const orders = await Order.find(queryConditions)
      .sort({ createdAt: -1 })
      .populate("customer", "name phone")
      .populate("deliveryPartner", "name phone")
      .populate("items.product", "name image");

    return reply.send({ orders }); // Consider consistent response { orders: orders }
  } catch (error) {
    console.error("Error in getOrdersForFC:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const getOrdersForDeliveryPartner = async (req, reply) => {
  try {
    const { userId } = req.user; // userId from token
    if (!mongoose.Types.ObjectId.isValid(userId)) { // Though token should ensure valid ID
        return reply.status(400).send({ message: "Invalid Delivery Partner ID format."});
    }

    const orders = await Order.find({ deliveryPartner: userId })
      .populate("customer", "name phone address") // Populate more customer details if needed
      .populate("items.branch", "name address location") // Branch details for items
      .populate("pickupLocations.branch", "name address location") // Pickup branch details
      .sort({ createdAt: -1 });

    return reply.send(orders);
  } catch (error) {
    console.error("Error in getOrdersForDeliveryPartner:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const getAvailableOrdersForDelivery = async (req, reply) => {
  try {
    // userId from token, not query
    const deliveryPartnerId = req.user?.userId;
    if (!deliveryPartnerId) {
      return reply.status(401).send({ message: "Unauthorized: User ID not found in token." });
    }
     if (!mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
        return reply.status(400).send({ message: "Invalid Delivery Partner ID format in token."});
    }


    // Fetch orders that are 'ready' and not yet assigned
    const availableOrders = await Order.find({
      status: "ready", // Assuming 'ready' means ready for pickup
      deliveryPartner: null, // Not yet assigned
    })
      .populate("customer", "name phone address")
      .populate("items.product", "name image") // Simplified product info
      .populate("items.branch", "name address")
      .populate("pickupLocations.branch", "name address location")
      .sort({ createdAt: -1 });

    // Fetch orders assigned to this delivery partner that are not yet delivered
    const assignedOrders = await Order.find({
        deliveryPartner: deliveryPartnerId,
        status: { $nin: ["delivered", "cancelled"] } // Exclude completed/cancelled
    })
      .populate("customer", "name phone address")
      .populate("items.product", "name image")
      .populate("items.branch", "name address")
      .populate("pickupLocations.branch", "name address location")
      .sort({ createdAt: -1 });

    // Fetch orders delivered by this partner (optional, for history)
    const deliveredOrders = await Order.find({
        deliveryPartner: deliveryPartnerId,
        status: "delivered"
    })
      .populate("customer", "name phone address")
      .populate("items.product", "name image")
      .populate("items.branch", "name address")
      .populate("pickupLocations.branch", "name address location")
      .sort({ createdAt: -1 }).limit(10); // Example: limit history


    return reply.send({ available: availableOrders, assigned: assignedOrders, delivered: deliveredOrders });
  } catch (error) {
    console.error("Error in getAvailableOrdersForDelivery:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};


export const acceptOrderByDeliveryPartner = async (req, reply) => {
  try {
    const { userId } = req.user; // userId from token
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return reply.status(400).send({ message: "Invalid orderId format." });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) { // Though token should ensure valid ID
        return reply.status(400).send({ message: "Invalid Delivery Partner ID format in token."});
    }


    const deliveryPartner = await DeliveryPartner.findById(userId);
    if (!deliveryPartner) {
      return reply.status(404).send({ message: "Delivery Partner not found" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    if (order.deliveryPartner) {
      return reply.status(400).send({ message: "Order is already assigned to a delivery partner" });
    }

    if (order.status !== "ready") { // Assuming 'ready' is the state for available orders
      return reply.status(400).send({ message: "Order is not in an assignable state (must be 'ready')" });
    }

    order.deliveryPartner = userId;
    order.status = "assigned"; // Or 'processing', 'confirmed' depending on your flow
    order.statusTimestamps = {
      ...order.statusTimestamps,
      assignedAt: new Date(), // Or 'confirmedAt', 'processingAt'
    };

    await order.save();

    if (req.server?.io) {
      req.server.io.to(orderId).emit("orderAccepted", order); // Or "orderAssigned"
    }

    return reply.send({ message: "Order accepted successfully", order });
  } catch (error) {
    console.error("Error in acceptOrderByDeliveryPartner:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

// Helper for summarizing order, can be expanded
function orderSummary(order) {
  return {
    _id: order._id,
    status: order.status,
    customer: order.customer?.name || order.customer?.toString(),
    deliveryPartner: order.deliveryPartner?.name || order.deliveryPartner?.toString(),
    totalPrice: order.totalPrice,
    updatedAt: order.updatedAt,
    statusTimestamps: order.statusTimestamps,
  };
}

// Helper for setting status timestamps (can be integrated into status updates or kept separate)
// This helper is not directly used in the refactored code but kept for potential utility
function setStatusTimestamp(order, status) {
  if (!order.statusTimestamps) order.statusTimestamps = {};
  const now = new Date();
  const statusTimestampMap = {
    pending: "pendingAt", // Or whatever initial status you have
    confirmed: "confirmedAt", // Example if you have a manual confirm step
    processing: "processingAt",
    packed: "packedAt",
    ready: "readyAt",
    dispatched: "dispatchedAt", // Example, if 'arriving' is more like 'out for delivery'
    arriving: "arrivingAt",
    delivered: "deliveredAt",
    cancelled: "cancelledAt",
  };
  const timestampKey = statusTimestampMap[status];
  if (timestampKey) {
    order.statusTimestamps[timestampKey] = now;
  }
}

export const updateItemPackingStatus = async (req, reply) => {
  const { orderId, itemId } = req.params;
  const { branchId, newStatus } = req.body;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return reply.status(400).send({ message: "Invalid orderId format." });
  }
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return reply.status(400).send({ message: "Invalid itemId format." });
  }
  if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) { // branchId is required here
    return reply.status(400).send({ message: "Invalid branchId format." });
  }
  if (!branchId) {
    return reply.status(400).send({ message: "branchId is required." });
  }


  if (!["packing", "packed"].includes(newStatus)) {
    return reply.status(400).send({ message: "Invalid newStatus. Must be 'packing' or 'packed'." });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }

    const item = order.items.id(itemId); // Mongoose subdocument lookup by _id
    if (!item) {
      return reply.status(404).send({ message: "Item not found in order" });
    }

    if (item.branch.toString() !== branchId) {
      return reply.status(403).send({ message: "Item does not belong to the specified branch." });
    }

    item.status = newStatus; // Update status of the specific item

    // If this item is being marked as 'packed', update its packedAt timestamp
    if (newStatus === 'packed') {
        item.packedAt = new Date(); // Assuming you add 'packedAt' to item schema
    }


    // Check if all items for this branch are packed
    const branchItems = order.items.filter((i) => i.branch.toString() === branchId);
    const allBranchItemsPacked = branchItems.every((i) => i.status === "packed");

    let message = `Item status updated to ${newStatus}.`;

    if (allBranchItemsPacked) {
      // Optionally, update a branch-specific packing status in the order if your schema supports it
      // e.g., order.branchPackingStatus.find(bps => bps.branch.toString() === branchId).status = 'packed';
      message += " All items for your branch are now packed.";

      const allOrderItemsPacked = order.items.every((i) => i.status === "packed");
      if (allOrderItemsPacked) {
        order.status = "packed"; // Overall order status
        if (!order.statusTimestamps) order.statusTimestamps = {};
        order.statusTimestamps.packedAt = new Date();
        message += " All items in the order are packed. Order status updated to 'packed'.";
      }
    }

    await order.save();

    if (req.server?.io) { // Notify clients
        req.server.io.to(orderId).emit("itemPackingUpdate", { orderId, itemId, newStatus, branchId, overallOrderStatus: order.status });
    }

    return reply.send({ message, order });
  } catch (error) {
    console.error("Error in updateItemPackingStatus:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const getPendingOrdersForBranch = async (req, reply) => {
  const { branchId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    return reply.status(400).send({ message: "Invalid branchId format." });
  }

  try {
    // Statuses that mean an order is active and might need branch attention
    const relevantStatuses = ["pending", "confirmed", "processing", "packing", "packed", "ready"];

    const orders = await Order.find({
      status: { $in: relevantStatuses },
      "items.branch": branchId, // Find orders that have at least one item from this branch
    })
      .populate("customer", "name address.area address.pinCode") // Customer details
      .populate("deliveryPartner", "name phone") // If assigned
      .populate("items.product", "name image sku") // Product details for items
      .select("customer slot orderId status createdAt totalPrice items pickupLocations deliveryLocation statusTimestamps") // Select specific fields
      .sort({ createdAt: -1 });

    // Filter items within each order to only those belonging to the specified branch for the response
    const filteredOrders = orders.map((order) => {
      const itemsForThisBranch = order.items.filter(
        (item) => item.branch.toString() === branchId && item.status !== 'cancelled' // Exclude cancelled items
      );
      return {
        ...order.toObject(), // Convert Mongoose doc to plain object
        items: itemsForThisBranch, // Replace items with only those for this branch
      };
    }).filter(o => o.items.length > 0); // Only return orders that still have items for this branch

    return reply.send(filteredOrders);
  } catch (error) {
    console.error("Error in getPendingOrdersForBranch:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const getOrderByIdFC = async (req, reply) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return reply.status(400).send({ message: "Invalid orderId format." });
    }

    const order = await Order.findById(orderId)
      .populate("customer", "name phone email address") // More customer details
      .populate("deliveryPartner", "name phone")
      .populate("items.product") // Full product
      .populate("items.branch", "name location") // Branch for each item
      .populate("pickupLocations.branch", "name location address"); // Branch for each pickup location

    if (!order) {
      return reply.status(404).send({ message: "Order not found" });
    }
    // Add authorization if FC users are tied to specific branches/orders
    // const fcUserBranch = req.user?.branch;
    // if (!order.items.some(item => item.branch.toString() === fcUserBranch)) {
    //    return reply.status(403).send({ message: "Unauthorized access to this order for your branch." });
    // }

    return reply.send(order);
  } catch (error) {
    console.error("Error in getOrderByIdFC:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const updateOrderStatusByFC = async (req, reply) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return reply.status(400).send({ message: "Invalid orderId format." });
    }

    const { status, itemIndex, itemId, itemStatus } = req.body; // itemStatus for specific item, status for overall order
    const fcUserBranch = req.user?.branch; // Assuming FC user has a branch in their token

    if (!fcUserBranch) {
        return reply.status(401).send({ message: "Unauthorized: FC user branch not found."});
    }
     if (!mongoose.Types.ObjectId.isValid(fcUserBranch)) {
        return reply.status(400).send({ message: "Invalid Branch ID format in FC token."});
    }


    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    if (["cancelled", "delivered"].includes(order.status)) {
      return reply.status(400).send({ message: "Cannot modify a completed or cancelled order." });
    }

    // Logic for updating a specific item's status (e.g., packed, cancelled by FC)
    if (itemId && itemStatus) {
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return reply.status(400).send({ message: "Invalid itemId format for item status update." });
        }
        const itemToUpdate = order.items.id(itemId);
        if (!itemToUpdate) {
            return reply.status(404).send({ message: `Item with ID ${itemId} not found in this order.` });
        }
        // Ensure FC is updating an item related to their branch
        if (itemToUpdate.branch.toString() !== fcUserBranch) {
            return reply.status(403).send({ message: `Not authorized to update this item. Item belongs to branch ${itemToUpdate.branch}. Your branch is ${fcUserBranch}` });
        }
        const allowedItemUpdateStatuses = ["packing", "packed", "cancelled_by_fc"]; // Example
        if (!allowedItemUpdateStatuses.includes(itemStatus)) {
            return reply.status(400).send({ message: `Invalid item status: ${itemStatus}` });
        }
        itemToUpdate.status = itemStatus;
        // itemToUpdate.statusHistory.push({ status: itemStatus, updatedAt: new Date(), updatedBy: req.user.userId });
    }
    // Logic for updating overall order status (e.g., to 'ready' or 'cancelled_by_fc')
    else if (status) {
        const allowedOrderUpdateStatuses = ["ready", "processing", "cancelled_by_fc"]; // Example
        if (!allowedOrderUpdateStatuses.includes(status)) {
            return reply.status(400).send({ message: `Invalid order status: ${status}` });
        }
        // If setting to 'ready', check if all items are packed (or handle partial readiness)
        if (status === "ready") {
            const allItemsForFcBranchPacked = order.items
                .filter(item => item.branch.toString() === fcUserBranch)
                .every((item) => item.status === "packed");

            if (!allItemsForFcBranchPacked && !order.items.every(item => item.status === "packed")) { // Check if ALL items are packed if not specific to FC branch logic
                 return reply.status(400).send({ message: "All items (for this FC's branch or all branches) must be packed before setting order to ready." });
            }
        }
        order.status = status;
        if (!order.statusTimestamps) order.statusTimestamps = {};
        order.statusTimestamps[`${status}At`] = new Date(); // e.g. readyAt
        // order.statusHistory.push({ status: status, updatedAt: new Date(), updatedBy: req.user.userId });
    } else {
        return reply.status(400).send({ message: "No valid status update provided (neither itemStatus nor overall order status)." });
    }

    await order.save();

    if (req.server?.io) {
      req.server.io.to(orderId).emit("FCOrderUpdate", order); // Notify clients
    }

    return reply.send({ message: "Order successfully updated by FC.", order });
  } catch (error) {
    console.error("Error in updateOrderStatusByFC:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};


export const updateOrderStatusByDeliveryPartner = async (req, reply) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return reply.status(400).send({ message: "Invalid orderId format." });
    }

    const { status, paymentStatus, paymentMethod, deliveryLocation } = req.body; // deliveryLocation for live tracking
    const userId = req.user?.userId; // userId from token

    if (!userId) {
      return reply.status(401).send({ message: "Unauthorized: User ID not found in token." });
    }
     if (!mongoose.Types.ObjectId.isValid(userId)) {
        return reply.status(400).send({ message: "Invalid User ID format in token."});
    }


    const allowedStatuses = ["arriving", "delivered", "cancelled_by_dp", "undeliverable"]; // DP specific statuses
    if (!status || !allowedStatuses.includes(status)) {
      return reply.status(400).send({ message: `Invalid status. Must be one of: ${allowedStatuses.join(", ")}` });
    }

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    if (!order.deliveryPartner || order.deliveryPartner.toString() !== userId) {
      return reply.status(403).send({ message: "Not authorized to update this order. You are not the assigned delivery partner." });
    }

    if (["cancelled", "delivered", "cancelled_by_fc", "undeliverable"].includes(order.status)) {
      return reply.status(400).send({ message: `Order is already in a final state: ${order.status}` });
    }

    order.status = status;
    if (paymentStatus) order.payment.status = paymentStatus;
    if (paymentMethod) order.payment.method = paymentMethod;
    // if (deliveryLocation) order.deliveryPersonLastLocation = deliveryLocation; // Store current location

    if (!order.statusTimestamps) order.statusTimestamps = {};
    order.statusTimestamps[`${status}At`] = new Date(); // e.g. deliveredAt

    await order.save();

    if (req.server?.io) {
      req.server.io.to(orderId).emit("DeliveryOrderUpdate", order);
    }

    return reply.send({
      message: `Order status updated to ${status}.`,
      order: orderSummary(order), // Use helper for concise response
    });
  } catch (error) {
    console.error("Error in updateOrderStatusByDeliveryPartner:", error.message, error.stack);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const getAssignedPendingOrdersForDeliveryPartner = async (req, reply) => {
  try {
    const deliveryPartnerId = req.user?.userId; // userId from token
    if (!deliveryPartnerId) {
      return reply.status(401).send({ message: "Unauthorized: User ID not found in token." });
    }
    if (!mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
        return reply.status(400).send({ message: "Invalid Delivery Partner ID format in token."});
    }


    // Statuses meaning order is active and assigned but not yet final
    const pendingStatuses = ["assigned", "processing", "packing", "packed", "ready", "dispatched", "arriving"];

    const orders = await Order.find({
      deliveryPartner: deliveryPartnerId,
      status: { $in: pendingStatuses },
    })
      .populate("customer", "name phone address")
      .populate("items.product", "name image") // Minimal product details
      .populate("items.branch", "name address") // Branch for items
      .populate("pickupLocations.branch", "name address location") // Pickup locations
      .sort({ "statusTimestamps.assignedAt": -1, createdAt: -1 }); // Sort by assignment time then creation

    reply.send(orders);
  } catch (error) { // Changed err to error
    console.error("Error in getAssignedPendingOrdersForDeliveryPartner:", error.message, error.stack);
    reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};
