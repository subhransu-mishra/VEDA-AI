import mongoose from "mongoose";

const verificationDocumentSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      default: "",
      trim: true,
    },
    mimeType: {
      type: String,
      default: "",
      trim: true,
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
    publicId: {
      type: String,
      default: "",
      trim: true,
    },
    resourceType: {
      type: String,
      default: "",
      trim: true,
    },
    format: {
      type: String,
      default: "",
      trim: true,
    },
    bytes: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

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
    verificationStatus: {
      type: String,
      enum: ["not_submitted", "pending", "rejected", "verified"],
      default: "not_submitted",
      index: true,
    },
    verificationReviewReason: {
      type: String,
      default: "",
      trim: true,
    },
    verificationSubmittedAt: {
      type: Date,
      default: null,
    },
    verificationReviewedAt: {
      type: Date,
      default: null,
    },
    verificationDetails: {
      registrationCouncil: {
        type: String,
        default: "",
        trim: true,
      },
      registrationNumber: {
        type: String,
        default: "",
        trim: true,
      },
      registrationYear: {
        type: String,
        default: "",
        trim: true,
      },
      highestDegree: {
        type: String,
        default: "",
        trim: true,
      },
      universityName: {
        type: String,
        default: "",
        trim: true,
      },
      govtIdType: {
        type: String,
        enum: ["Aadhaar", "PAN", "Passport", "Voter ID"],
        default: "Aadhaar",
      },
      govtIdNumber: {
        type: String,
        default: "",
        trim: true,
      },
      declarationAcceptedAt: {
        type: Date,
        default: null,
      },
      termsAcceptedAt: {
        type: Date,
        default: null,
      },
      documents: {
        licenseDocument: {
          type: verificationDocumentSchema,
          default: () => ({}),
        },
        degreeDocument: {
          type: verificationDocumentSchema,
          default: () => ({}),
        },
        idDocument: {
          type: verificationDocumentSchema,
          default: () => ({}),
        },
        selfieDocument: {
          type: verificationDocumentSchema,
          default: () => ({}),
        },
      },
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
