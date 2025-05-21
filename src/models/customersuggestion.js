// models/CustomerSuggestion.ts
import mongoose from "mongoose";

const CustomerSuggestionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

const CustomerSuggestion = mongoose.model(
  "CustomerSuggestion",
  CustomerSuggestionSchema
);

export default CustomerSuggestion;
