import jwt from "jsonwebtoken";
import { Admin, Customer, DeliveryPartner } from "../../models/user.js";

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
      customer = new Customer({
        phone,
        email: phone,
        role: "Customer",
        isActived: false,
      });
      await customer.save();

      // ✅ Generate token even if onboarding is pending
      const { accessToken, refreshToken } = generateTokens(customer);

      return reply.send({
        message: "User created, onboarding needed",
        accessToken,
        refreshToken,
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

export const onboarding = async (request, reply) => {
  console.log(request.body);
  try {
    const userId = request.user?.userId;

    console.log("🔍 Onboarding Request by userId:", userId);
    console.log("📦 Body Payload:", request.body);

    if (!userId) {
      return reply
        .status(401)
        .send({ message: "Unauthorized. No user ID found." });
    }

    const { name, gender, address } = request.body;

    if (!name || !gender || !address) {
      return reply.status(400).send({ message: "Missing required fields" });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      userId,
      {
        $set: {
          name,
          gender,
          address,
          onboardingStatus: "complete",
          isActivated: true,
        },
      },
      { new: true }
    );

    if (!updatedCustomer) {
      return reply.status(404).send({ message: "Customer not found" });
    }
    console.log("✅ Customer updated:", updatedCustomer);

    const { accessToken, refreshToken } = generateTokens(updatedCustomer);

    return reply.status(200).send({
      message: "Onboarding completed successfully",
      accessToken,
      refreshToken,
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("🔥 Onboarding Error:", error);
    return reply
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
};

export const loginFcUser = async (req, reply) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply
        .status(400)
        .send({ message: "Email and password are required" });
    }

    // Check if FC user exists
    const fcUser = await Admin.findOne({ email });
    if (!fcUser) {
      return reply.status(404).send({ message: "FC User not found" });
    }

    // Simple plain password check (use hashing in prod)
    if (fcUser.password !== password) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = generateTokens(fcUser);

    return reply.send({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: fcUser,
    });
  } catch (error) {
    console.error("FC User login error:", error);
    return reply
      .status(500)
      .send({ message: "Internal server error", error: error.message });
  }
};

// Login controller for Delivery Partner (fixed bugs)
export const loginDeliveryPartner = async (req, reply) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply
        .status(400)
        .send({ message: "Email and password are required" });
    }

    const deliveryPartner = await DeliveryPartner.findOne({ email });
    if (!deliveryPartner) {
      return reply.status(404).send({ message: "Delivery Partner not found" });
    }

    if (deliveryPartner.password !== password) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = generateTokens(deliveryPartner);

    return reply.send({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: deliveryPartner,
    });
  } catch (error) {
    console.error("Delivery Partner login error:", error);
    return reply
      .status(500)
      .send({ message: "Internal server error", error: error.message });
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


export const universalLogin = async (req, reply) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply.status(400).send({ message: "Email and password are required" });
    }

    let user = null;
    let role = "";

    // 1. Try Admin
    user = await Admin.findOne({ email });
    if (user) {
      role = "Admin";
    } else {
      // 2. Try Delivery Partner
      user = await DeliveryPartner.findOne({ email });
      if (user) {
        role = "DeliveryPartner";
      }
    }

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    // 🔐 Replace with bcrypt in production
    if (user.password !== password) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    // Attach role to user object
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: role,
    };

    const { accessToken, refreshToken } = generateTokens(userData);

    return reply.send({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: userData,
    });
  } catch (error) {
    console.error("Login error:", error);
    return reply.status(500).send({ message: "Internal server error", error: error.message });
  }
};
