import mongoose from "mongoose";

// Base User Schema

const userSchema = new mongoose.Schema({
  name: { type: String },
  geneder: {
    type: String,
    enum: ["male", "female"],
  },

  role: {
    type: String,
    enum: ["Customer", "Admin", "DeliveryPartner", "Shopper", "FcAdmin"],
    require: true,
  },
  isActivated: { type: Boolean, default: false },
});

// Customer Schema

const customerSchema = new mongoose.Schema({
  ...userSchema.obj,
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  phone: { type: Number, required: true, unique: true },
  role: { type: String, enum: ["Customer"], default: "Customer" },
  onboardingStatus: {
    type: String,
    enum: ["pending", "complete"],
    default: "pending",
  },
  address: {
    name: { type: String }, // name of customer
    phone: { type: Number },
    houseNo: { type: String },
    streetAddress: { type: String },
    landmark: { type: String },
    city: { type: String },
    state: { type: String },
    pinCode: { type: String },
  },
  LiveLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
});

const DeliveryPartnerSchema = new mongoose.Schema({
  ...userSchema.obj,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: Number, required: true, unique: true },
  role: { type: String, enum: ["DeliveryPartner"], default: "DeliveryPartner" },
  LiveLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  address: { type: String },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
  },
});

// admin schema

const adminSchema = new mongoose.Schema({
  ...userSchema.obj,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: Number, required: true, unique: true },
  role: { type: String, enum: ["Admin"], default: "Admin" },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
  },
});

export const Customer = mongoose.model("Customer", customerSchema);
export const DeliveryPartner = mongoose.model(
  "DeliveryPartner",
  DeliveryPartnerSchema
);
export const Admin = mongoose.model("Admin", adminSchema);
// export const Customer = mongoose.model("Customer", customerSchema);
