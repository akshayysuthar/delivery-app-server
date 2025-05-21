// POST /api/customer/suggestions

import CustomerSuggestion from "../../models/customersuggestion.js";

export const postSuggestion = async (req, reply) => {
  const { message, customerId } = req.body;

  if (!message || !customerId) {
    return reply
      .status(400)
      .send({ error: "Message and customer ID are required." });
  }

  const suggestion = new CustomerSuggestion({ message, customer: customerId });
  await suggestion.save();

  return reply.status(200).send({ message: "Thank you for your feedback!" });
};
