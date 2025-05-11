import mongoose from "mongoose";
import { Pass, Stickies } from "react-bootstrap-icons";

// Base User Schema

const userSchema = new mongoose.Schema({
  name: { type: String },
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
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: Number, required: true, unique: true },
  role: { type: String, enum: ["Customer"], default: "Customer" },
  LiveLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  address: { type: String },
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
    ref: "Branch", // in porduction change to FC
  },
});

// admin schema

const adminSchema = new mongoose.Schema({
  ...userSchema.obj,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: Number, required: true, unique: true },
  role: { type: String, enum: ["Admin"], default: "Admin" },
});

export const Customer = mongoose.model("Customer", customerSchema);
export const DeliveryPartner = mongoose.model(
  "DeliveryPartner",
  DeliveryPartnerSchema
);
export const Admin = mongoose.model("Admin", adminSchema);
// export const Customer = mongoose.model("Customer", customerSchema);
