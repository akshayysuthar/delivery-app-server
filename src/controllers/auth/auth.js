import jwt from "jsonwebtoken";
import { Admin, Customer, DeliveryPartner } from "../../models/user.js";
// Removed Address import as it's embedded now: import { Address } from "../../models/address.js";

export const refreshToken = async (req, reply) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return reply.status(401).send({ message: "Refresh token required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    let user;

    // This logic might need adjustment based on which user types actually use refresh tokens
    if (decoded.role === "Customer") {
      user = await Customer.findById(decoded.userId);
    } else if (decoded.role === "DeliveryPartner") {
      user = await DeliveryPartner.findById(decoded.userId);
    } else if (decoded.role === "Admin" || decoded.role === "FcAdmin" || decoded.role === "BranchAdmin" || decoded.role === "Picker" || decoded.role === "Seller") {
      // Assuming Admins and other roles might also use refresh tokens
      user = await Admin.findById(decoded.userId) || // General Admin
             await DeliveryPartner.findById(decoded.userId) || // For other user types if they share a common login or refresh path
             await Customer.findById(decoded.userId); // Fallback or specific role check
      // Add specific model checks if different models are used for FcAdmin, BranchAdmin etc.
    }


    if (!user) {
      return reply.status(404).send({ message: "User not found for refresh token" });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    return reply.send({
      message: "Token Refreshed",
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh Token Error:", error); // Standardized error logging
    return reply.status(403).send({ message: "Invalid Refresh Token. Please login again." }); // Standardized error message
  }
};

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user._id, role: user.role }, // Ensure user.role is correctly populated
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1d" }
  );
  const refreshToken = jwt.sign(
    { userId: user._id, role: user.role }, // Ensure user.role is correctly populated
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
};

export const loginCustomer = async (req, reply) => {
  try {
    const { phone } = req.body;

    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      return reply
        .status(400)
        .send({ message: "Phone number is required and must be a string" });
    }

    let customer = await Customer.findOne({ phone });

    if (!customer) {
      customer = new Customer({
        phone,
        // email: phone, // Optional: consider if email should default to phone
        role: "Customer",
        isActivated: false, // Corrected typo: isActived -> isActivated
      });
      await customer.save();

      const { accessToken, refreshToken } = generateTokens(customer);

      return reply.send({
        message: "User created, onboarding needed",
        accessToken,
        refreshToken,
        customer,
        onboardingRequired: true,
      });
    }

    // For existing customers, password check would be needed if they set one up
    // This flow assumes phone OTP or a different login mechanism if password isn't used here
    const { accessToken, refreshToken } = generateTokens(customer);

    return reply.send({
      message: "Login Successful",
      accessToken,
      refreshToken,
      customer,
    });
  } catch (error) {
    console.error("Login Error [loginCustomer]:", error); // Standardized
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." }); // Standardized
  }
};

export const onboarding = async (request, reply) => {
  try {
    const userId = request.user?.userId;

    if (!userId) {
      return reply
        .status(401)
        .send({ message: "Unauthorized. No user ID found." });
    }

    const { name, gender, address } = request.body;

    if (!name || !gender || !address) {
      return reply.status(400).send({ message: "Missing required fields (name, gender, address)." });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      userId,
      {
        $set: {
          name,
          gender,
          address: address, // Assuming 'address' from body is a complete object for the embedded schema
          onboardingStatus: "complete",
          isActivated: true,
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
    console.error("Onboarding Error:", error); // Standardized
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." }); // Standardized
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

    const fcUser = await Admin.findOne({ email }); // Assuming FcUser is an Admin
    if (!fcUser) {
      return reply.status(404).send({ message: "User not found" }); // Generic message
    }

    const isMatch = await fcUser.comparePassword(password);
    if (!isMatch) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = generateTokens(fcUser);

    return reply.send({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: fcUser, // Consider what user data to return
    });
  } catch (error) {
    console.error("Login Error [loginFcUser]:", error); // Standardized
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." }); // Standardized
  }
};

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
      return reply.status(404).send({ message: "User not found" }); // Generic message
    }

    const isMatch = await deliveryPartner.comparePassword(password);
    if (!isMatch) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = generateTokens(deliveryPartner);

    return reply.send({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: deliveryPartner, // Consider what user data to return
    });
  } catch (error) {
    console.error("Login Error [loginDeliveryPartner]:", error); // Standardized
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." }); // Standardized
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
    // Add all relevant models you want to check against for universal login
    const modelsToTry = [Admin, DeliveryPartner, Customer, /* Picker, Seller, BranchAdmin */];

    for (const Model of modelsToTry) {
      user = await Model.findOne({ email });
      if (user) break;
    }

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    if (typeof user.comparePassword !== 'function') {
        console.error("Login Error [universalLogin]: user object does not have comparePassword method.", user);
        return reply.status(500).send({ message: "An internal error occurred. Please try again later."});
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    // Ensure role is part of the user object if not directly on the model
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || user.constructor.modelName, // Fallback to model name if role field isn't there
    };


    const { accessToken, refreshToken } = generateTokens(userData);

    return reply.send({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: userData,
    });
  } catch (error) {
    console.error("Login Error [universalLogin]:", error); // Standardized
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." }); // Standardized
  }
};


export const fetchUser = async (req, reply) => {
  try {
    const { userId, role } = req.user; // From JWT
    let user;

    // Adjust based on your actual user models and roles
    if (role === "Customer") {
      user = await Customer.findById(userId); // Removed .populate("Address") as it's embedded
    } else if (role === "DeliveryPartner") {
      user = await DeliveryPartner.findById(userId);
    } else if (role === "Admin" || role === "FcAdmin" || role === "BranchAdmin") { // Example for admin roles
      user = await Admin.findById(userId);
    } else {
      // Add other roles like Picker, Seller if they can fetch their own user data
      return reply.status(403).send({ message: "Invalid or unsupported role for fetching user data" });
    }

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }
    return reply.send({
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    console.error("Fetch User Error:", error); // Standardized
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." }); // Standardized
  }
};

// This function might be obsolete if addresses are always embedded.
// If you still need to fetch standalone Address documents (e.g., for some admin task), keep it.
// Otherwise, it can be removed.
export const fetchAddressById = async (req, reply) => {
  try {
    const { addressId } = req.params;
    if (!addressId) {
      return reply.status(400).send({ message: "Address ID is required" });
    }

    // This implies Address is a separate model, which contradicts the embedded approach for Customer.
    // Clarify if Address model is still used or if this endpoint is needed.
    // For now, assuming it might be used for other purposes or by other models.
    // const address = await Address.findById(addressId);
    // if (!address) {
    //   return reply.status(404).send({ message: "Address not found" });
    // }
    // return reply.send({ message: "Address fetched successfully", address });
    console.warn("fetchAddressById may need review due to embedded addresses in Customer model.");
    return reply.status(404).send({ message: "Endpoint under review."});

  } catch (error) {
    console.error("Fetch Address Error:", error); // Standardized
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." }); // Standardized
  }
};

export const updateCustomerName = async (req, reply) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return reply.status(401).send({ message: "Unauthorized." });

    const { name } = req.body;
    if (!name) {
      return reply.status(400).send({ message: "Name is required" });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      userId,
      { $set: { name } },
      { new: true }
    );
    if (!updatedCustomer)
      return reply.status(404).send({ message: "Customer not found" });

    return reply.send({
      message: "Name updated",
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("Update Customer Name Error:", error); // Standardized
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." }); // Standardized
  }
};

export const updateCustomerAddress = async (req, reply) => {
  try {
    const userId = req.user?.userId; // Corrected: Use JWT user ID
    if (!userId) {
      return reply.status(401).send({ message: "Unauthorized." }); // Added check
    }

    const { address } = req.body;
    if (!address || typeof address !== 'object' || Object.keys(address).length === 0) {
      return reply.status(400).send({ message: "Address object is required and cannot be empty." });
    }

    const customer = await Customer.findById(userId);
    if (!customer) {
      return reply.status(404).send({ message: "Customer not found." });
    }

    // Update embedded address. Create it if it doesn't exist or merge.
    // This merges new address fields into existing, or sets new if no address existed.
    customer.address = { ...(customer.address || {}), ...address };
    await customer.save();

    return reply.send({ message: "Address updated", address: customer.address });
  } catch (error) {
    console.error("Update Customer Address Error:", error); // Standardized
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." }); // Standardized
  }
};

export const updatelocation = async (request, reply) => {
  try {
    const { latitude, longitude } = request.body;
    const userId = request.user?.userId; // Corrected: Use JWT user ID

    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized." }); // Standardized unauthorized
    }

    if (latitude === undefined || longitude === undefined) {
      return reply
        .code(400)
        .send({ error: "Latitude and longitude are required." });
    }

    const customer = await Customer.findById(userId);
    if (!customer) {
      return reply.code(404).send({ error: "User not found." });
    }

    // Ensure address object exists before trying to set location on it
    if (!customer.address) {
      customer.address = {}; // Initialize address if it's null/undefined
    }

    customer.address.location = {
      latitude,
      longitude,
      updatedAt: new Date(),
    };

    await customer.save();

    return reply.send({
      success: true,
      message: "Location updated successfully",
      location: customer.address.location,
    });
  } catch (err) {
    console.error("Update Location Error:", err); // Standardized
    // request.log.error(err); // Fastify's default logger, can be kept if preferred
    return reply.code(500).send({ message: "An internal error occurred. Please try again later." }); // Standardized
  }
};
