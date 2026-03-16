import mongoose from "mongoose";

const uploadedFileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileType: { type: String, required: true },
  },
  { _id: false },
);

const diagnosisSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // Human-readable patient reference (from custom patientId field)
    patientId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // ObjectId reference for potential populate() usage
    patientObjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    symptoms: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one symptom is required",
      },
    },
    symptomDuration: {
      type: String,
      required: true,
      trim: true,
    },
    existingConditions: {
      type: [String],
      default: [],
    },
    currentMedications: {
      type: [String],
      default: [],
    },
    allergies: {
      type: [String],
      default: [],
    },
    painLevel: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    additionalNotes: {
      type: String,
      trim: true,
      default: "",
    },
    uploads: {
      type: [uploadedFileSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "under_review", "reviewed", "closed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Diagnosis", diagnosisSchema);
