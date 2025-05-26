import {
  updateSupportTicket,
  createSupportTicket,
  getSupportTickets,
  getUserSupportTickets,
} from "../controllers/supportTicket.js";

export const supportRoutes = async (fastify, options) => {
  // Apply `verifyToken` to all routes in this file
  // fastify.addHook("preHandler", verifyToken);

  fastify.post("/support", createSupportTicket);
  fastify.get("/support", getSupportTickets);
  fastify.patch("/support/:id", updateSupportTicket);
  // Assuming using Fastify or Express-style router
fastify.get('/support-tickets/user/:userId', getUserSupportTickets);

};
