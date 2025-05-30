import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      example: "Morning 9am – 11am",
    },
    startTime: {
      type: String, // "09:00"
      required: true,
    },
    endTime: {
      type: String, // "11:00"
      required: true,
    },
    availableOnDays: {
      type: [String],
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      default: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    minOrderTimeMinutes: {
      type: Number,
      default: 60, // minimum buffer before slot can be shown (e.g., show only if at least 60 mins before slot start)
    },
    maxOrders: {
      type: Number,
      default: 100, // max orders allowed in a slot, optional
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

const Slots = mongoose.model("Slots", slotSchema);

export default Slots;
