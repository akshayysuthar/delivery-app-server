import mongoose from "mongoose";
import bcrypt from 'bcrypt';

// Base User Schema
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, default: "Guest" },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    role: {
      type: String,
      enum: [
        "Customer",
        "Admin",
        "DeliveryPartner",
        "Shopper",
        "FcAdmin",
        "Picker",
        "BranchAdmin",
        "Seller",
      ],
      required: true,
    },
    isActivated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Password Hashing and Comparison Functions
async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
}

function comparePassword(candidatePassword) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidatePassword, this.password);
}

// Customer Schema
const customerSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, unique: true, sparse: true, lowercase: true },
    password: { type: String },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: { type: String, enum: ["Customer"], default: "Customer" },
    onboardingStatus: {
      type: String,
      enum: ["pending", "complete"],
      default: "pending",
    },
    liveLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    userType: {
      type: String,
      enum: ["all", "new", "existing"],
      default: "new",
    },
    address: {
      houseNo: { type: String },
      streetAddress: { type: String },
      landmark: { type: String },
      city: { type: String },
      state: { type: String },
      pinCode: { type: String },
      area: { type: String },
      country: { type: String, default: "India" },
      isDefault: { type: Boolean, default: false },
      location: {
        latitude: { type: Number },
        longitude: { type: Number },
        updatedAt: { type: Date },
      },
    },
  },
  { timestamps: true }
);

customerSchema.pre('save', hashPassword);
customerSchema.methods.comparePassword = comparePassword;

// Virtual to determine userType based on order count
customerSchema.virtual("calculatedUserType").get(function () {
  if (typeof this.ordersCount === "number") {
    return this.ordersCount > 5 ? "existing" : "new";
  }
  return "new";
});

// Delivery Partner Schema
const deliveryPartnerSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: {
      type: String,
      enum: ["DeliveryPartner"],
      default: "DeliveryPartner",
    },
    liveLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    address: { type: String },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
  },
  { timestamps: true }
);

deliveryPartnerSchema.pre('save', hashPassword);
deliveryPartnerSchema.methods.comparePassword = comparePassword;

// Admin Schema
const adminSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: {
      type: String,
      enum: ["Admin", "FcAdmin", "BranchAdmin"], // FcAdmin and BranchAdmin can also be general admins
      default: "Admin",
    },
    branch: { // Optional: Admin might not be tied to a specific branch
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
  },
  { timestamps: true }
);

adminSchema.pre('save', hashPassword);
adminSchema.methods.comparePassword = comparePassword;

// Picker Schema
const pickerSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: { type: String, enum: ["Picker"], default: "Picker" },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true, // Picker should be associated with a branch
    },
  },
  { timestamps: true }
);

pickerSchema.pre('save', hashPassword);
pickerSchema.methods.comparePassword = comparePassword;

// Seller Schema
const sellerSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: { type: String, enum: ["Seller"], default: "Seller" },
    gstin: { type: String },
    pan: { type: String },
    address: { // Changed to match general address structure, if desired
      street: String,
      city: String,
      state: String,
      pinCode: String,
      country: String,
    },
    isActive: { type: Boolean, default: true }, // Renamed from isActivated for consistency if this is different
  },
  { timestamps: true }
);

sellerSchema.pre('save', hashPassword);
sellerSchema.methods.comparePassword = comparePassword;

// BranchAdmin Schema (Specific, if different from general Admin with BranchAdmin role)
const branchAdminSchema = new mongoose.Schema(
  {
    ...userSchema.obj, // Ensure this doesn't conflict with adminSchema if they are distinct types
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: { type: String, enum: ["BranchAdmin"], default: "BranchAdmin" },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true, // BranchAdmin must be associated with a branch
    },
  },
  { timestamps: true }
);

branchAdminSchema.pre('save', hashPassword);
branchAdminSchema.methods.comparePassword = comparePassword;

export const BranchAdmin =
  mongoose.models.BranchAdmin ||
  mongoose.model("BranchAdmin", branchAdminSchema);

export const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
export const DeliveryPartner = mongoose.models.DeliveryPartner || mongoose.model("DeliveryPartner", deliveryPartnerSchema);
export const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema);
export const Picker = mongoose.models.Picker || mongoose.model("Picker", pickerSchema);
export const SellerUser = mongoose.models.SellerUser || mongoose.model("SellerUser", sellerSchema);
