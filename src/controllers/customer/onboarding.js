export const completeOnboarding = async (req, reply) => {
  try {
    const { userId } = req.user; // assuming you're using JWT auth middleware
    const {
      name,
      gender,
      address, // object with all address fields
    } = req.body;

    const customer = await Customer.findByIdAndUpdate(
      userId,
      {
        name,
        gender,
        address,
        onboardingStatus: "completed",
      },
      { new: true }
    );

    if (!customer) {
      return reply.status(404).send({ message: "Customer not found" });
    }

    return reply.send({ message: "Onboarding completed", customer });
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Failed to complete onboarding", error });
  }
};
