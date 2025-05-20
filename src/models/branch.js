import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["Owned", "Partnered"], required: true },

    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },

    pinCode: { type: Number, required: true },
    city: { type: String },
    state: { type: String },

    address: { type: String, required: true },
    contactNumber: { type: String },
    email: { type: String },

    deliveryPartners: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryPartner",
      },
    ],

    operationalHours: {
      open: { type: String, required: true },
      close: { type: String, required: true },
    },

    isActive: { type: Boolean, default: true },
    serviceRadiusKm: { type: Number, default: 5 },
  },
  { timestamps: true }
);

const Branch = mongoose.model("Branch", branchSchema);

export default Branch;
