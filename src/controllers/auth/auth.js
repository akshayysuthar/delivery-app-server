import jwt from "jsonwebtoken";
import { Admin, Customer, DeliveryPartner } from "../../models/user.js";
import { Address } from "../../models/address.js";

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
      // onboardingRequired: false,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return reply
      .status(500)
      .send({ message: "An error occurred", error: error.message });
  }
};

export const onboarding = async (request, reply) => {
  try {
    const userId = request.user?.userId; // Set by JWT middleware

    console.log("🔍 Onboarding Request by userId:", userId);
    console.log("📦 Body Payload:", request.body);

    if (!userId) {
      return reply
        .status(401)
        .send({ message: "Unauthorized. No user ID found." });
    }

    const { name, gender, address } = request.body;

    if (!name || !gender || !address) {
      return reply.status(400).send({ message: "Missing required fields." });
    }

    // Update customer
    const updatedCustomer = await Customer.findByIdAndUpdate(
      userId,
      {
        $set: {
          name,
          gender,
          address: address,
          onboardingStatus: "complete",
          isActivated: true, // ✅ Make sure this matches schema
        },
      },
      { new: true }
    );

    if (!updatedCustomer) {
      return reply.status(404).send({ message: "Customer not found" });
    }

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
      user = await Customer.findById(userId).populate("Address");
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

export const fetchAddressById = async (req, reply) => {
  try {
    const { addressId } = req.params;
    if (!addressId) {
      return reply.status(400).send({ message: "Address ID is required" });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      return reply.status(404).send({ message: "Address not found" });
    }

    return reply.send({ message: "Address fetched successfully", address });
  } catch (error) {
    console.error("Fetch address error:", error);
    return reply
      .status(500)
      .send({ message: "Failed to fetch address", error: error.message });
  }
};
export const universalLogin = async (req, reply) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply
        .status(400)
        .send({ message: "Email and password are required" });
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
    return reply
      .status(500)
      .send({ message: "Internal server error", error: error.message });
  }
};

export const updateCustomerName = async (req, reply) => {
  try {
    const userId = req.user?.userId;
    const { name } = req.body;
    if (!name) {
      return reply.status(400).send({ message: "Name is required" });
    }

    const updated = await Customer.findByIdAndUpdate(
      userId,
      { $set: { name } },
      { new: true }
    );
    if (!updated)
      return reply.status(404).send({ message: "Customer not found" });

    return reply.send({
      message: "Name updated",
      customer: updated,
    });
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Failed to update name", error: error.message });
  }
};
// Update customer address
export const updateCustomerAddress = async (req, reply) => {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { address } = req.body;
    if (!address) {
      return reply.status(400).send({ message: "Address is required" });
    }

    const customer = await Customer.findById(userId);
    let addressDoc;

    if (customer.address) {
      // Try to update existing address
      addressDoc = await Address.findByIdAndUpdate(
        customer.address,
        { ...address },
        { new: true }
      );
      // If not found, create new address and link
      if (!addressDoc) {
        addressDoc = await Address.create({ ...address, customerId: userId });
        customer.address = addressDoc._id;
        await customer.save();
      }
    } else {
      // No address linked, create new
      addressDoc = await Address.create({ ...address, customerId: userId });
      customer.address = addressDoc._id;
      await customer.save();
    }

    return reply.send({ message: "Address updated", address: addressDoc });
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Failed to update address", error: error.message });
  }
};



export const updatelocation = async (request, reply) => {
  try {
    const { latitude, longitude } = request.body;
    const userId = request.user?.userId || request.body.userId;

    if (!userId || latitude === undefined || longitude === undefined) {
      return reply
        .code(400)
        .send({ error: "userId, latitude, and longitude are required." });
    }

    const user = await Customer.findById(userId);
    if (!user) {
      return reply.code(404).send({ error: "User not found." });
    }

    // Ensure address exists
    if (!user.address) user.address = {};

    user.address.location = {
      latitude,
      longitude,
      updatedAt: new Date(),
    };

    await user.save();

    return reply.send({
      success: true,
      message: "Location updated successfully",
      location: user.address.location,
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: "Internal server error" });
  }
};

// to adjust the location of custoner addres if it is wrong 
export const addLocationAdjustment = async (req, reply) => {
  try {
    const { customerId } = req.params;
    const { latitude, longitude, notes, userId } = req.body;
    const updatedBy = req.user?._id || userId;

    if (!latitude || !longitude) {
      return reply
        .code(400)
        .send({ message: "Latitude and longitude are required." });
    }

    if (!updatedBy) {
      return reply.code(400).send({ message: "User ID not provided." });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return reply.code(404).send({ message: "Customer not found." });
    }

    customer.locationAdjustments.push({
      latitude,
      longitude,
      notes,
      updatedBy,
      updatedAt: new Date(),
    });

    await customer.save();

    return reply.send({
      message: "Location adjustment added successfully.",
      locationAdjustments: customer.locationAdjustments,
    });
  } catch (err) {
    req.log.error(
      { err, body: req.body, user: req.user },
      "Error in addLocationAdjustment"
    );
    return reply.code(500).send({ message: "Server error." });
  }
};

export const saveFcmToken = async (req, reply) => {
  try {
    const { userId, fcmToken } = req.body;

    if (!userId || !fcmToken) {
      return reply
        .code(400)
        .send({ message: "userId and fcmToken are required" });
    }

    const updated = await Customer.findByIdAndUpdate(
      userId,
      { fcmToken },
      { new: true }
    );
    if (!updated) {
      return reply.code(404).send({ message: "Customer not found" });
    }

    return reply.send({ message: "FCM token saved successfully" });
  } catch (err) {
    console.error("❌ Error saving FCM token:", err);
    return reply
      .code(500)
      .send({ message: "Internal server error", error: err.message });
  }
};
