import { logError } from "../controllers/logging/errorLogger.js";

export const loggingRoutes = async (fastify, options) => {
  fastify.post("/error-log", logError);
};
