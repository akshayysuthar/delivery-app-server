// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=5&t=3638s

import {
  comfirmOrder,
  getOrder,
  updateOrderStatus,
  getOrderById,
  createOrder,
} from "../controllers/order/order.js";
import { verifyToken } from "../middleware/verifyToken.js";

export const orderRoutes = async (fastify, options) => {
  fastify.addHook("preHandler", async (request, reply) => {
    const isAuthenticated = await verifyToken(request, reply);
    if (!isAuthenticated) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    fastify.post("/order", createOrder);
    fastify.get("/order", getOrder);
    fastify.patch("/order/:orderId/status", updateOrderStatus);
    fastify.post("/order/:orderId/confirm", comfirmOrder);
    fastify.get("/order/:orderId", getOrderById);
  });
};
