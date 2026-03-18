import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    doctorId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    specialization: {
      type: String,
      required: true,
      index: true,
    },
    experience: {
      type: Number,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    clinicAddress: {
      type: String,
      required: true,
      trim: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    clinicName: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    availability: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Doctor", doctorSchema);
