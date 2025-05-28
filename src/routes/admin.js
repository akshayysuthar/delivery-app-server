import invoiceHandler from "../controllers/invoice/main.js";
import {
  comfirmOrder,
  getAvailableOrdersForDelivery,
  getOrderByIdFC,
  getPendingOrdersForBranch,
  updateOrderStatusByDeliveryPartner,
  updateOrderStatusByFC,
} from "../controllers/order/order.js";
import { authenticate } from "../middleware/verifyToken.js";

export const adminRoutes = async (fastify, options) => {
  // Apply `verifyToken` to all routes in this file
  // fastify.addHook("preHandler", verifyToken);

  fastify.decorate("authenticate", authenticate);

  // Fulfiiment route
  fastify.get("/orders/branch/:branchId/pending", getPendingOrdersForBranch);
  fastify.get("/orders/branch/:orderId", getOrderByIdFC);
  fastify.patch("/orders/branch/:orderId/status", updateOrderStatusByFC);

  // delivery route
  fastify.get("/orders/delivery/available", getAvailableOrdersForDelivery);
  fastify.post("/orders/delivery/:orderId/confirm", comfirmOrder);
  fastify.patch(
    "/orders/delivery/:orderId/status",
    updateOrderStatusByDeliveryPartner
  );
  fastify.get("/order/:orderId/invoice", invoiceHandler);
};
