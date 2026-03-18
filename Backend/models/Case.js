import mongoose from "mongoose";

const caseSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    aiAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    status: {
      type: String,
      enum: [
        "created",
        "ai_completed",
        "doctor_requested",
        "doctor_assigned",
        "consultation_active",
        "completed",
      ],
      default: "created",
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Case", caseSchema);
