import { postSuggestion } from "../controllers/customer/suggestions.js";
import { home } from "../controllers/home/home.js";

export const homeRoutes = async (fastify, options) => {
  fastify.get("/home", home); // /api/assign?pincode=395007
  fastify.post("/suggestion", postSuggestion); // /api/assign?pincode=395007
};
