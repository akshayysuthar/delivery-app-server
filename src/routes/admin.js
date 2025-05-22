import { universalLogin } from "../controllers/auth/auth.js";
import {
  getAllOrders,
  getOrdersForDeliveryPartner,
  getOrdersForFC,
  updateOrderStatusByFC,
} from "../controllers/order/order.js";
import { authenticate } from "../middleware/verifyToken.js";

export const adminRoutes = async (fastify, options) => {
  // Apply `verifyToken` to all routes in this file
  // fastify.addHook("preHandler", verifyToken);

  fastify.decorate("authenticate", authenticate);

  fastify.get("/order/all", getAllOrders);
  fastify.get(
    "/fc/orders",
    { preHandler: [fastify.authenticate] },
    getOrdersForFC
  );

  fastify.patch("/fc/order/:orderId/status", updateOrderStatusByFC);
  fastify.get("/delivery/orders", getOrdersForDeliveryPartner);
};
