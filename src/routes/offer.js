import { validateCoupon } from "../controllers/offer.js";

export const offerRoutes = async (fastify, options) => {
  fastify.post("/validate-coupon", validateCoupon);
};
