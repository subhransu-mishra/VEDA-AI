import mongoose from "mongoose";

const consultationSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed"],
      default: "pending",
      index: true,
    },
    doctorResponse: {
      caseNotes: {
        type: String,
        default: "",
        trim: true,
      },
      medicationPlan: {
        type: String,
        default: "",
        trim: true,
      },
      testRequirements: {
        type: String,
        default: "",
        trim: true,
      },
      followUpAfter: {
        type: String,
        default: "",
        trim: true,
      },
      severity: {
        type: String,
        enum: ["normal", "medium", "serious", "critical"],
        default: "normal",
      },
      confirmedByDoctor: {
        type: Boolean,
        default: false,
      },
      submittedAt: {
        type: Date,
        default: null,
      },
    },
    doctorStructuredReport: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Consultation", consultationSchema);
