import mongoose from "mongoose";

// Base User Schema
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, default: "Guest" },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    role: {
      type: String,
      enum: [
        "Customer",
        "Admin",
        "DeliveryPartner",
        "Shopper",
        "FcAdmin",
        "Picker",
        "BranchAdmin",
        "Seller",
      ],
      required: true,
    },
    isActivated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Customer Schema
const customerSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, unique: true, sparse: true, lowercase: true },
    password: { type: String },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: { type: String, enum: ["Customer"], default: "Customer" },
    onboardingStatus: {
      type: String,
      enum: ["pending", "complete"],
      default: "pending",
    },
    liveLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    userType: {
      type: String,
      enum: ["all", "new", "existing"],
      default: "new",
    }, // Added field
    address: {
      // type: mongoose.Schema.Types.ObjectId,
      // ref: "Address",
      houseNo: { type: String },
      streetAddress: { type: String },
      landmark: { type: String },
      city: { type: String },
      state: { type: String },
      pinCode: { type: String },
      area: { type: String },
      country: { type: String, default: "India" },
      isDefault: { type: Boolean, default: false },
      location: {
        latitude: { type: Number },
        longitude: { type: Number },
        updatedAt: { type: Date },
      },
    },
  },
  { timestamps: true }
);

// Virtual to determine userType based on order count
customerSchema.virtual("calculatedUserType").get(function () {
  // Assume this.ordersCount is set/populated elsewhere
  if (typeof this.ordersCount === "number") {
    return this.ordersCount > 5 ? "existing" : "new";
  }
  return "new";
});

// Delivery Partner Schema
const deliveryPartnerSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: {
      type: String,
      enum: ["DeliveryPartner"],
      default: "DeliveryPartner",
    },
    liveLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    address: { type: String },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
  },
  { timestamps: true }
);

// Admin Schema
const adminSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: {
      type: String,
      enum: ["Admin", "FcAdmin", "BranchAdmin"],
      default: "Admin",
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
  },
  { timestamps: true }
);

// Picker Schema
const pickerSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: { type: String, enum: ["Picker"], default: "Picker" },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
  },
  { timestamps: true }
);

// Seller Schema
const sellerSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: { type: String, enum: ["Seller"], default: "Seller" },
    gstin: { type: String },
    pan: { type: String },
    address: {
      street: String,
      city: String,
      state: String,
      pinCode: String,
      country: String,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const branchAdminSchema = new mongoose.Schema(
  {
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => /^\d{10,15}$/.test(v),
        message: "Phone number must be 10-15 digits",
      },
    },
    role: { type: String, enum: ["BranchAdmin"], default: "BranchAdmin" },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
  },
  { timestamps: true }
);

export const BranchAdmin =
  mongoose.models.BranchAdmin ||
  mongoose.model("BranchAdmin", branchAdminSchema);

export const Customer = mongoose.model("Customer", customerSchema);
export const DeliveryPartner = mongoose.model(
  "DeliveryPartner",
  deliveryPartnerSchema
);
export const Admin = mongoose.model("Admin", adminSchema);
export const Picker = mongoose.model("Picker", pickerSchema);
export const SellerUser = mongoose.model("SellerUser", sellerSchema);

// v1
// import mongoose from "mongoose";

// // Base User Schema

// const userSchema = new mongoose.Schema({
//   name: { type: String },
//   geneder: {
//     type: String,
//     enum: ["male", "female"],
//   },

//   role: {
//     type: String,
//     enum: ["Customer", "Admin", "DeliveryPartner", "Shopper", "FcAdmin"],
//     require: true,
//   },
//   isActivated: { type: Boolean, default: false },
// });

// // Customer Schema

// const customerSchema = new mongoose.Schema({
//   ...userSchema.obj,
//   email: { type: String, unique: true, sparse: true },
//   password: { type: String },
//   phone: { type: Number, required: true, unique: true },
//   role: { type: String, enum: ["Customer"], default: "Customer" },
//   onboardingStatus: {
//     type: String,
//     enum: ["pending", "complete"],
//     default: "pending",
//   },
//   address: {
//     name: { type: String }, // name of customer
//     phone: { type: Number },
//     houseNo: { type: String },
//     streetAddress: { type: String },
//     landmark: { type: String },
//     city: { type: String },
//     state: { type: String },
//     pinCode: { type: String },
//   },
//   LiveLocation: {
//     latitude: { type: Number },
//     longitude: { type: Number },
//   },
// });

// const DeliveryPartnerSchema = new mongoose.Schema({
//   ...userSchema.obj,
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   phone: { type: Number, required: true, unique: true },
//   role: { type: String, enum: ["DeliveryPartner"], default: "DeliveryPartner" },
//   LiveLocation: {
//     latitude: { type: Number },
//     longitude: { type: Number },
//   },
//   address: { type: String },
//   branch: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Branch",
//   },
// });

// // admin schema

// const adminSchema = new mongoose.Schema({
//   ...userSchema.obj,
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   phone: { type: Number, required: true, unique: true },
//   role: { type: String, enum: ["Admin"], default: "Admin" },
//   branch: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Branch",
//   },
// });

// export const Customer = mongoose.model("Customer", customerSchema);
// export const DeliveryPartner = mongoose.model(
//   "DeliveryPartner",
//   DeliveryPartnerSchema
// );
// export const Admin = mongoose.model("Admin", adminSchema);
// // export const Customer = mongoose.model("Customer", customerSchema);
