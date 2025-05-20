import jwt from "jsonwebtoken";
import { Customer, DeliveryPartner } from "../../models/user.js";

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1d" }
  );
  const refreshToken = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
};
export const loginCustomer = async (req, reply) => {
  try {
    const { phone } = req.body;

    console.log("Received login request for phone:", phone);

    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      return reply
        .status(400)
        .send({ message: "Phone number is required and must be a string" });
    }

    let customer = await Customer.findOne({ phone });

    if (!customer) {
      console.log("No customer found, creating new user");
      customer = new Customer({
        phone,
        email: phone,
        role: "Customer",
        isActived: false,
      });
      await customer.save();
      console.log("New customer saved:", customer);

      return reply.send({
        message: "User created, onboarding needed",
        accessToken: null,
        refreshToken: null,
        customer,
        onboardingRequired: true,
      });
    }

    console.log("Existing customer found:", customer);

    const { accessToken, refreshToken } = generateTokens(customer);

    console.log("Tokens generated");

    return reply.send({
      message: "Login Successful",
      accessToken,
      refreshToken,
      customer,
      onboardingRequired: false,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return reply
      .status(500)
      .send({ message: "An error occurred", error: error.message });
  }
};

export const loginDeliveryPartner = async (req, reply) => {
  try {
    const { email, password } = req.body;
    let deliveryPartner = await DeliveryPartner.findOne({ email });
    if (!deliveryPartner) {
      return reply
        .status(404)
        .send({ message: "Delivery Partner not found, contact to Fc " });
    }

    const isMatch = password === deliveryPartner.password;
    if (!isMatch) {
      return reply.status(400).send({ message: "Invalid Credentails" });
    }
    const { accessToken, refreshToken } = generateTokens(customer);
    return reply.send({
      message: "Login Successful",
      accessToken,
      refreshToken,
      customer,
    });
  } catch (error) {
    return reply.status(500).send({ message: "An error occurred", error });
  }
};

export const refreshToken = async (req, reply) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return reply.status(401).send({ message: "Refresh token required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    let user;

    if (decoded.role === "Customer") {
      user = await Customer.findById(decoded.userId);
    } else if (decoded.role === "DeliveryPartner") {
      user = await DeliveryPartner.findById(decoded.userId);
    } else {
      return reply.status(403).send({ message: "Invalid Role" });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    return reply.send({
      message: "Token Refreshed",
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return reply.status(403).send({ message: "Invalid Refresh Token" });
  }
};

export const fetchUser = async (req, reply) => {
  try {
    const { userId, role } = req.user;
    let user;

    if (role === "Customer") {
      user = await Customer.findById(userId);
    } else if (role === "DeliveryPartner") {
      user = await DeliveryPartner.findById(userId);
    } else {
      return reply.status(403).send({ message: "Invalid Role" });
    }
    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }
    return reply.send({
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    return reply.status(500).send({ message: "An error occurred", error });
  }
};

export const onboarding = async (request, reply) => {
  console.log(request);
  try {
    const userId = request.user?.userId;

    console.log("🔍 Onboarding Request by userId:", userId);
    console.log("📦 Body Payload:", request.body);

    if (!userId) {
      return reply
        .status(401)
        .send({ message: "Unauthorized. No user ID found." });
    }

    const { name, gender, address, LiveLocation } = request.body;

    if (!name || !gender || !address || !LiveLocation) {
      return reply.status(400).send({ message: "Missing required fields" });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      userId,
      {
        $set: {
          name,
          gender,
          address,
          LiveLocation: {
            latitude: LiveLocation.lat,
            longitude: LiveLocation.lon,
          },

          onboardingStatus: "complete",
          isActivated: true,
        },
      },
      { new: true }
    );

    console.log("✅ Customer updated:", updatedCustomer);

    if (!updatedCustomer) {
      return reply.status(404).send({ message: "Customer not found" });
    }

    return reply.status(200).send({
      message: "Onboarding completed successfully",
      user: updatedCustomer,
    });
  } catch (error) {
    console.error("🔥 Onboarding Error:", error);
    return reply
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
};
