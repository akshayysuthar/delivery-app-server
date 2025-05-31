import invoiceHandler from "../controllers/invoice/main.js";
import {
  comfirmOrder,
  getOrder,
  updateOrderStatus,
  getOrderById,
  createOrder,
  getAllOrders,
  getAvailableOrdersForDeliveryPartner,
  acceptOrderByDeliveryPartner,
  getPendingOrdersForBranch,
  getOrderByOrderId,
} from "../controllers/order/order.js";
import { verifyToken } from "../middleware/verifyToken.js";

export const orderRoutes = async (fastify, options) => {
  // Apply `verifyToken` to all routes in this file
  // fastify.addHook("preHandler", verifyToken);

  fastify.post("/order", createOrder);
  fastify.get("/customer/order", getOrder);
  fastify.get("/order/:orderId", getOrderById);
  fastify.get('/orders/:orderId', getOrderByOrderId);
  
  // Register route in Fastify
};
