// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=5&t=3638s

import { adminRoutes } from "./admin.js";
import { authRoutes } from "./auth.js";
import { homeRoutes } from "./home.js";
import { loggingRoutes } from "./logging.js";
import { orderRoutes } from "./order.js";
import { categoryRoutes, productRoutes } from "./products.js";
import fastifyCors from "@fastify/cors";

const prefix = "/api";

export const registerRoutes = async (fastify) => {
  fastify.register(fastifyCors, {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // Include PATCH here
  });
  fastify.register(authRoutes, { prefix: prefix });
  fastify.register(productRoutes, { prefix: prefix });
  fastify.register(categoryRoutes, { prefix: prefix });
  fastify.register(orderRoutes, { prefix: prefix });
  fastify.register(homeRoutes, { prefix: prefix });
  fastify.register(adminRoutes, { prefix: prefix });
  fastify.register(loggingRoutes, { prefix });
};
