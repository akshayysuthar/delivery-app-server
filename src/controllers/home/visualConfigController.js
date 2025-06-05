import VisualConfig from "../../models/visual.js";

export const getVisualConfig = async (req, reply) => {
  try {
    // Assuming single config, fetch latest
    const config = await VisualConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      return reply.status(404).send({ message: "Visual config not found" });
    }
    return reply.send(config);
  } catch (error) {
    console.error("Error fetching visual config:", error);
    return reply.status(500).send({ message: "Internal server error" });
  }
};

export const updateVisualConfig = async (req, reply) => {
  try {
    const {
      bgImageUrl,
      lottieAnimationUrl,
      gradientColors,
      animationHeight,
      cloudImageUrl,
    } = req.body;

    // Update if exists, else create new
    let config = await VisualConfig.findOne();
    if (config) {
      config.bgImageUrl = bgImageUrl ?? config.bgImageUrl;
      config.lottieAnimationUrl =
        lottieAnimationUrl ?? config.lottieAnimationUrl;
      config.gradientColors = gradientColors ?? config.gradientColors;
      config.animationHeight = animationHeight ?? config.animationHeight;
      config.cloudImageUrl = cloudImageUrl ?? config.cloudImageUrl;
      config.updatedAt = new Date();
      await config.save();
    } else {
      config = new VisualConfig({
        bgImageUrl,
        lottieAnimationUrl,
        gradientColors,
        animationHeight,
        cloudImageUrl,
      });
      await config.save();
    }

    return reply.send({ message: "Visual config updated", config });
  } catch (error) {
    console.error("Error updating visual config:", error);
    return reply.status(500).send({ message: "Internal server error" });
  }
};
