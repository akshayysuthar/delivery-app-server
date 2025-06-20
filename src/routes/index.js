// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=5&t=3638s

import { adminRoutes } from "./admin.js";
import { authRoutes } from "./auth.js";
import { homeRoutes } from "./home.js";
import { loggingRoutes } from "./logging.js";
import { offerRoutes } from "./offer.js";
import { orderRoutes } from "./order.js";
import { categoryRoutes, productRoutes } from "./products.js";
import fastifyCors from "@fastify/cors";
import { supportRoutes } from "./support.js";
// import notificationRoutes from "./notication/notificationRoutes.js";

const prefix = "/api";

export const registerRoutes = async (fastify) => {
  // Register CORS FIRST!
  await fastify.register(fastifyCors, {
    origin: ["http://localhost:3000", "https://fc-henna.vercel.app"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  fastify.register(authRoutes, { prefix: prefix });
  fastify.register(productRoutes, { prefix: prefix });
  fastify.register(categoryRoutes, { prefix: prefix });
  fastify.register(orderRoutes, { prefix: prefix });
  fastify.register(homeRoutes, { prefix: prefix });
  fastify.register(adminRoutes, { prefix: prefix });
  fastify.register(loggingRoutes, { prefix });
  fastify.register(offerRoutes, { prefix: prefix });
  fastify.register(supportRoutes, { prefix: prefix });
  
  // fastify.register(notificationRoutes, { prefix: prefix });
};
