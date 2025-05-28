import {
  updatelocation,
  fetchAddressById,
  fetchUser,
  loginCustomer,
  loginDeliveryPartner,
  loginFcUser,
  onboarding,
  refreshToken,
  universalLogin,
  updateCustomerAddress,
  updateCustomerName,
} from "../controllers/auth/auth.js";
import { updateUser } from "../controllers/tracking/user.js";
import { verifyToken } from "../middleware/verifyToken.js";

export const authRoutes = async (fastify, options) => {
  fastify.post("/customer/login", loginCustomer);
  fastify.post("/auth/loginUni", universalLogin);
  fastify.post("/delivery/login", loginDeliveryPartner);
  fastify.post("/refresh-token", refreshToken);
  fastify.get("/address/:addressId", fetchAddressById);
  fastify.post("/user", { preHandler: [verifyToken] }, fetchUser);
  fastify.patch("/user", { preHandler: [verifyToken] }, updateUser);
  fastify.post("/login/fcuser", loginFcUser);
  fastify.post("/login/deliverypartner", loginDeliveryPartner);
  fastify.patch(
    "/customer/name",
    { preHandler: [verifyToken] },
    updateCustomerName
  );

  fastify.patch(
    "/customer/address",
    { preHandler: [verifyToken] },
    updateCustomerAddress
  );

  fastify.patch(
    "/customer/onboarding",
    { preHandler: [verifyToken] },
    onboarding
  );
  fastify.post("/updatelocation", updatelocation);
};
