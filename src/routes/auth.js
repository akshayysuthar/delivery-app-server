import {
  fetchUser,
  loginCustomer,
  loginDeliveryPartner,
  onboarding,
  refreshToken,
} from "../controllers/auth/auth.js";
import { updateUser } from "../controllers/tracking/user.js";
import { verifyToken } from "../middleware/verifyToken.js";

export const authRoutes = async (fastify, options) => {
  fastify.post("/customer/login", loginCustomer);
  fastify.post("/delivery/login", loginDeliveryPartner);
  fastify.post("/refresh-token", refreshToken);
  fastify.post("/user", { preHandler: [verifyToken] }, fetchUser);
  fastify.patch("/user", { preHandler: [verifyToken] }, updateUser);
  fastify.patch(
    "/customer/onboarding",
    { preHandler: [verifyToken] },
    onboarding
  );
};
