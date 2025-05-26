import mongoose from "mongoose";
import Counter from "./counter.js";


const supportTicketSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true }, // Custom ticket ID
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  issue: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  resolutionNote: { type: String },
  csAgent: { type: String },
  actionsTaken: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Function to get next sequence value from Counter
async function getNextSequenceValue(sequenceName) {
  const sequenceDocument = await Counter.findOneAndUpdate(
    { name: sequenceName },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.sequence_value;
}

// Pre-save hook to generate ticketId
supportTicketSchema.pre("save", async function (next) {
  if (this.isNew && !this.ticketId) {
    const sequenceValue = await getNextSequenceValue("ticketId");
    this.ticketId = `TKT${sequenceValue.toString().padStart(5, "0")}`;
  }
  next();
});

const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);

export default SupportTicket;
