import Offer from "../models/offer.js";

import { Customer } from "../models/user.js";

export const validateCoupon = async (req, reply) => {
  try {
    const { code, cartItems, userId, cartTotal } = req.body;

    if (!code) {
      return reply.status(400).send({ message: "Coupon code is required" });
    }

    // Find the offer by code and check if it's active and validTill not expired
    const offer = await Offer.findOne({
      code: code,
      isActive: true,
    });
    if (!offer) {
      return reply
        .status(404)
        .send({ message: "Invalid or expired coupon code" });
    }

    if (offer.validTill && offer.validTill < new Date()) {
      return reply.status(400).send({ message: "Coupon has expired" });
    }

    // Check minimum cart value condition
    if (
      offer.conditions?.minCartValue &&
      cartTotal < offer.conditions.minCartValue
    ) {
      return reply.status(400).send({
        message: `Minimum cart value to apply this coupon is ${offer.conditions.minCartValue}`,
      });
    }

    // Check user type condition
    if (offer.conditions?.userType && userId) {
      const customer = await Customer.findById(userId);
      if (!customer) {
        return reply.status(404).send({ message: "User not found" });
      }

      // userType condition: "new" = user with no orders, "existing" = user with orders
      if (offer.conditions.userType === "new") {
        const hasOrders = await Order.exists({ customer: userId });
        if (hasOrders) {
          return reply
            .status(400)
            .send({ message: "Coupon valid only for new users" });
        }
      }
      if (offer.conditions.userType === "existing") {
        const hasOrders = await Order.exists({ customer: userId });
        if (!hasOrders) {
          return reply
            .status(400)
            .send({ message: "Coupon valid only for existing users" });
        }
      }
    }

    // Check requiredProducts condition
    if (offer.conditions?.requiredProducts?.length) {
      // Check if cart contains at least one required product
      const productIdsInCart = cartItems.map((item) =>
        item.productId.toString()
      );
      const requiredProductIds = offer.conditions.requiredProducts.map((id) =>
        id.toString()
      );

      const hasRequiredProduct = requiredProductIds.some((requiredId) =>
        productIdsInCart.includes(requiredId)
      );

      if (!hasRequiredProduct) {
        return reply.status(400).send({
          message: "Coupon valid only if cart contains certain products",
        });
      }
    }

    // If all conditions pass, send offer rewards info
    return reply.send({
      message: "Coupon is valid",
      offer: {
        title: offer.title,
        rewards: offer.rewards,
        scope: offer.scope,
      },
    });
  } catch (error) {
    console.error("Coupon validation error:", error);
    return reply
      .status(500)
      .send({ message: "Failed to validate coupon", error });
  }
};
