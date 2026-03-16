import mongoose from "mongoose";
const doctorSchema = new mongoose.Schema({
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
});
export default mongoose.model("Doctor", doctorSchema);
