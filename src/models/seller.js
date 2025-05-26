import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      pinCode: String,
      country: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(v);
        },
        message: "Invalid email format",
      },
    },
    phone: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^\d{10,15}$/.test(v);
        },
        message: "Phone number must be 10-15 digits",
      },
    },
    type: { type: String, enum: ["individual", "company"], required: true },
    gstin: { type: String },
    pan: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Seller = mongoose.model("Seller", sellerSchema);

export default Seller;
