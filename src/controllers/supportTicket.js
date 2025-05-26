import Order from "../models/order.js";
import SupportTicket from "../models/SupportTicket.js";
import { Customer } from "../models/user.js";

export const createSupportTicket = async (req, reply) => {
  console.log(req.body);
  try {
    const { orderId, userId, issue = req.body.message } = req.body;

    const customer = await Customer.findById(userId);
    const order = await Order.findById(orderId);

    if (!customer || !order) {
      return reply.status(404).send({ message: "User or Order not found" });
    }

    const ticket = await new SupportTicket({
      user: userId,
      order: orderId,
      issue,
    }).save();

    return reply.status(201).send(ticket);
  } catch (err) {
    console.error("Error creating support ticket:", err);
    return reply
      .status(500)
      .send({ message: "Failed to create support ticket", error: err });
  }
};

export const getSupportTickets = async (req, reply) => {
  try {
    const tickets = await SupportTicket.find().populate("order");

    return reply.send(tickets);
  } catch (err) {
    console.error("Error fetching support tickets:", err);
    return reply
      .status(500)
      .send({ message: "Failed to get tickets", error: err });
  }
};

export const updateSupportTicket = async (req, reply) => {
  try {
    const { id } = req.params;
    const { resolutionNote, csAgent, actionsTaken, status } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) return reply.status(404).send({ message: "Ticket not found" });

    ticket.resolutionNote = resolutionNote || ticket.resolutionNote;
    ticket.csAgent = csAgent || ticket.csAgent;
    ticket.actionsTaken = actionsTaken || ticket.actionsTaken;
    ticket.status = status || ticket.status;

    await ticket.save();
    return reply.send(ticket);
  } catch (err) {
    console.error("Error updating support ticket:", err);
    return reply
      .status(500)
      .send({ message: "Failed to update ticket", error: err });
  }
};
// Get support tickets by user ID with order info and status
export const getUserSupportTickets = async (req, reply) => {
  try {
    const { userId } = req.params;

    const tickets = await SupportTicket.find({ user: userId })
      .populate("order", "orderId status totalPrice createdAt")
      .sort({ createdAt: -1 });

    return reply.send(tickets);
  } catch (err) {
    console.error("Error fetching user support tickets:", err);
    return reply
      .status(500)
      .send({ message: "Failed to get support tickets", error: err });
  }
};
