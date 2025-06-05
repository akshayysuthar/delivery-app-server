// /routes/notificationRoutes.js

import { sendNotification } from "../../controllers/notication/fcmService.js";

export default async function notificationRoutes(fastify, opts) {
  fastify.post("/send-notification", async (request, reply) => {
    const { token, title, body } = request.body;

    if (!token || !title || !body) {
      reply.code(400);
      return {
        success: false,
        message: "Missing token, title, or body",
      };
    }

    try {
      const result = await sendNotification(token, title, body);
      return {
        success: true,
        message: "Notification sent successfully",
        result,
      };
    } catch (error) {
      fastify.log.error("Notification error:", error);
      reply.code(500);
      return {
        success: false,
        message: "Failed to send notification",
        error: error.message,
      };
    }
  });
}
