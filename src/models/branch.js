import mongoose from "mongoose";

const operationalHoursSchema = new mongoose.Schema(
  {
    open: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Time should be in HH:MM format",
      },
    },
    close: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Time should be in HH:MM format",
      },
    },
  },
  { _id: false }
);

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["Owned", "Partnered"], required: true },
    code: { type: String, unique: true, required: true },

    // location: {
    //   type: {
    //     type: String,
    //     enum: ["Point"],
    //     default: "Point",
    //   },

    //   coordinates: {
    //     type: [Number],
    //     required: true,
    //     validate: {
    //       validator: function (v) {
    //         return (
    //           v.length === 2 &&
    //           v[0] >= -180 &&
    //           v[0] <= 180 &&
    //           v[1] >= -90 &&
    //           v[1] <= 90
    //         );
    //       },
    //       message: "Invalid coordinates",
    //     },
    //   },
    // },

    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },

    pinCode: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return /^\d{6}$/.test(v);
        },
        message: "Pincode must be 6 digits",
      },
    },
    city: { type: String, required: true },
    state: { type: String, required: true },
    address: { type: String, required: true },
    contactNumber: {
      type: String,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: "Contact number must be 10 digits",
      },
    },
    email: {
      type: String,
      validate: {
        validator: function (v) {
          return /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(v);
        },
        message: "Invalid email format",
      },
    },

    deliveryPartners: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryPartner",
      },
    ],

    operationalHours: operationalHoursSchema,
    isActive: { type: Boolean, default: true },
    serviceRadiusKm: {
      type: Number,
      default: 5,
      min: 0,
      max: 50,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
branchSchema.index({ location: "2dsphere" });
branchSchema.index({ pinCode: 1 });
branchSchema.index({ code: 1 });

const Branch = mongoose.model("Branch", branchSchema);

export default Branch;

// v1

// import mongoose from "mongoose";

// const branchSchema = new mongoose.Schema(
//   {
//     name: { type: String, required: true },
//     type: { type: String, enum: ["Owned", "Partnered"], required: true },

//     location: {
//       latitude: { type: Number, required: true },
//       longitude: { type: Number, required: true },
//     },

//     pinCode: { type: Number, required: true },
//     city: { type: String },
//     state: { type: String },

//     address: { type: String, required: true },
//     contactNumber: { type: String },
//     email: { type: String },

//     deliveryPartners: [
//       {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "DeliveryPartner",
//       },
//     ],

//     operationalHours: {
//       open: { type: String, required: true },
//       close: { type: String, required: true },
//     },

//     isActive: { type: Boolean, default: true },
//     serviceRadiusKm: { type: Number, default: 5 },
//   },
//   { timestamps: true }
// );

// const Branch = mongoose.model("Branch", branchSchema);

// export default Branch;
