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
} from "../controllers/order/order.js";
import { verifyToken } from "../middleware/verifyToken.js";

export const orderRoutes = async (fastify, options) => {
  // Apply `verifyToken` to all routes in this file
  fastify.addHook("preHandler", verifyToken);

  fastify.post("/order", createOrder);
  fastify.get("/order", getOrder);
  fastify.get("/order/:orderId", getOrderById);
};
