import mongoose from "mongoose";

const ServiceAreaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    pinCode: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return /^\d{6}$/.test(v);
        },
        message: "Pincode must be 6 digits",
      },
    },
    areas: [
      {
        type: String,
        required: true,
      },
    ],
    deliveryCharges: {
      type: Number,
      default: 30,
      min: 0,
    },

    slots: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Slots",
        required: true,
      },
    ],
    branches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        required: true,
      },
    ],
    isActive: { type: Boolean, default: true },
    cutoffBufferMins: {
      type: Number,
      default: 120,
      min: 0,
    },
    freeDeliveryAbove: {
      type: Number,
      min: 0,
    },
    minimumOrderAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // slotFees: [slotFeeSchema],
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
ServiceAreaSchema.index({ pinCode: 1 });
ServiceAreaSchema.index({ branches: 1 });
ServiceAreaSchema.index({ isActive: 1 });

const ServiceArea = mongoose.model("ServiceArea", ServiceAreaSchema);

export default ServiceArea;
