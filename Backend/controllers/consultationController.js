import mongoose from "mongoose";
import Case from "../models/Case.js";
import Doctor from "../models/Doctor.js";
import Consultation from "../models/Consultation.js";
import { findMatchingDoctors } from "../services/doctorMatchService.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const getPrimarySpecialist = (aiAnalysis) =>
  aiAnalysis?.recommended_resolution?.primary_specialist ||
  aiAnalysis?.recommendedResolution?.primarySpecialist ||
  "";

const assignDoctor = async ({ caseData, doctorId }) => {
  if (doctorId) {
    if (!isValidObjectId(doctorId)) {
      throw new Error("Invalid doctorId");
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    if (!doctor.isVerified) {
      throw new Error("Doctor is not verified");
    }

    return doctor;
  }

  const primarySpecialist = getPrimarySpecialist(caseData.aiAnalysis);
  if (!primarySpecialist) {
    throw new Error(
      "primary_specialist is missing in aiAnalysis.recommended_resolution",
    );
  }

  const matchedDoctors = await findMatchingDoctors({
    primarySpecialist,
    onlyAvailable: true,
    limit: 1,
  });

  if (!matchedDoctors.length) {
    throw new Error("No available doctor found for this specialist");
  }

  const doctor = await Doctor.findById(matchedDoctors[0]._id);
  if (!doctor) {
    throw new Error("Auto-assigned doctor no longer exists");
  }

  return doctor;
};

export const createConsultation = async (req, res) => {
  try {
    const { caseId: caseIdentifier, doctorId } = req.body || {};

    if (!caseIdentifier) {
      return res.status(400).json({ message: "caseId is required" });
    }

    const lookup = isValidObjectId(caseIdentifier)
      ? { _id: caseIdentifier }
      : { caseId: String(caseIdentifier || "").trim() };

    const caseData = await Case.findOne(lookup);
    if (!caseData) {
      return res.status(404).json({ message: "Case not found" });
    }

    if (String(caseData.patientId) !== String(req.patient._id)) {
      return res.status(403).json({ message: "Forbidden: Not your case" });
    }

    if (!["ai_completed", "doctor_requested"].includes(caseData.status)) {
      return res.status(409).json({
        message: "Case is not ready for doctor consultation",
      });
    }

    const doctor = await assignDoctor({ caseData, doctorId });

    const consultation = await Consultation.create({
      caseId: caseData._id,
      patientId: req.patient._id,
      doctorId: doctor._id,
      status: "pending",
    });

    caseData.status = "doctor_assigned";
    await caseData.save();

    return res.status(201).json({
      consultation: {
        _id: consultation._id,
        caseId: consultation.caseId,
        patientId: consultation.patientId,
        doctorId: consultation.doctorId,
        status: consultation.status,
        createdAt: consultation.createdAt,
      },
      case: {
        _id: caseData._id,
        status: caseData.status,
      },
    });
  } catch (error) {
    const knownMessage = [
      "Invalid doctorId",
      "Doctor not found",
      "Doctor is not verified",
      "No available doctor found for this specialist",
      "Auto-assigned doctor no longer exists",
      "primary_specialist is missing in aiAnalysis.recommended_resolution",
    ];

    if (knownMessage.includes(error.message)) {
      return res.status(400).json({ message: error.message });
    }

    console.error("Create Consultation Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getConsultationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid consultation id" });
    }

    const consultation = await Consultation.findById(id)
      .populate(
        "doctorId",
        "doctorId fullName specialization experience rating availability",
      )
      .populate("caseId", "status aiAnalysis")
      .lean();

    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found" });
    }

    if (String(consultation.patientId) !== String(req.patient._id)) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not your consultation" });
    }

    return res.status(200).json({ consultation });
  } catch (error) {
    console.error("Get Consultation Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
