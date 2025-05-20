import { ServiceArea } from "../../models";

// Controller to fetch service area by pin code
const getServiceAreaByPinCode = async (req, res) => {
  try {
    const { pinCode } = req.params;
    if (!pinCode) {
      return res.status(400).json({ message: "Pin code is required" });
    }

    const serviceArea = await ServiceArea.findOne({ pinCode: pinCode });
    if (!serviceArea) {
      return res.status(404).json({ message: "Service area not found" });
    }

    res.status(200).json(serviceArea);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getServiceAreaByPinCode,
};
