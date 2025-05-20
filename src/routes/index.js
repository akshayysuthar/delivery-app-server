// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=5&t=3638s

import { authRoutes } from "./auth.js";
import { homeRoutes } from "./home.js";
import { orderRoutes } from "./order.js";
import { categoryRoutes, productRoutes } from "./products.js";

const prefix = "/api";

export const registerRoutes = async (fastify) => {
  fastify.register(authRoutes, { prefix: prefix });
  fastify.register(productRoutes, { prefix: prefix });
  fastify.register(categoryRoutes, { prefix: prefix });
  fastify.register(orderRoutes, { prefix: prefix });
  fastify.register(homeRoutes, { prefix: prefix });
};
