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

const toRiskTier = (aiAnalysis) => {
  const emergency = String(aiAnalysis?.emergencyAssessment?.level || "")
    .trim()
    .toLowerCase();

  if (["critical", "high"].includes(emergency)) return "high";
  if (emergency === "moderate") return "medium";
  return "low";
};

const getComplaint = (aiAnalysis) => {
  const firstCondition = aiAnalysis?.conditionAnalysis?.possibleConditions?.[0];
  if (firstCondition?.name) {
    return String(firstCondition.name);
  }

  const summary = String(aiAnalysis?.summary || "").trim();
  if (summary) {
    return summary.slice(0, 120);
  }

  return "Patient requested consultation";
};

const minutesSince = (isoDate) => {
  const timestamp = new Date(isoDate).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const diff = Date.now() - timestamp;
  return Math.max(0, Math.round(diff / 60000));
};

const formatRelative = (isoDate) => {
  const mins = minutesSince(isoDate);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

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

export const getDoctorConsultationRequests = async (req, res) => {
  try {
    const consultations = await Consultation.find({
      doctorId: req.doctor._id,
      status: { $in: ["pending", "accepted", "completed"] },
    })
      .populate("caseId", "caseId aiAnalysis status createdAt updatedAt")
      .populate("patientId", "fullName email patientId")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const items = consultations.map((consultation) => {
      const caseData = consultation.caseId || {};
      const patient = consultation.patientId || {};
      const ai = caseData.aiAnalysis || {};

      return {
        id: caseData.caseId || String(caseData._id || consultation._id),
        consultationId: String(consultation._id),
        caseObjectId: caseData._id || null,
        patientName: patient.fullName || "Unknown Patient",
        patientEmail: patient.email || "",
        complaint: getComplaint(ai),
        risk: toRiskTier(ai),
        waitMins: minutesSince(consultation.createdAt),
        status: consultation.status,
        assignedDoctor: req.doctor.fullName,
        summary:
          String(ai?.summary || "").trim() ||
          "AI triage summary not available for this case.",
        lastUpdate: formatRelative(consultation.updatedAt),
        reportStatus: "not_generated",
        aiAnalysis: ai,
        caseStatus: caseData.status || "doctor_assigned",
        createdAt: consultation.createdAt,
        updatedAt: consultation.updatedAt,
      };
    });

    return res.status(200).json({
      message: "Doctor consultation requests fetched successfully",
      count: items.length,
      items,
    });
  } catch (error) {
    console.error("Get Doctor Consultation Requests Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateConsultationStatusByDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || "")
      .trim()
      .toLowerCase();

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid consultation id" });
    }

    if (!["accepted", "rejected", "completed"].includes(status)) {
      return res.status(400).json({
        message: "status must be accepted, rejected, or completed",
      });
    }

    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found" });
    }

    if (String(consultation.doctorId) !== String(req.doctor._id)) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not your consultation" });
    }

    consultation.status = status;
    await consultation.save();

    const caseData = await Case.findById(consultation.caseId);
    if (caseData) {
      if (status === "accepted") {
        caseData.status = "consultation_active";
      } else if (status === "completed") {
        caseData.status = "completed";
      } else if (status === "rejected") {
        caseData.status = "doctor_requested";
      }
      await caseData.save();
    }

    return res.status(200).json({
      message: "Consultation status updated",
      consultation: {
        _id: consultation._id,
        caseId: consultation.caseId,
        patientId: consultation.patientId,
        doctorId: consultation.doctorId,
        status: consultation.status,
        updatedAt: consultation.updatedAt,
      },
      case: caseData
        ? {
            _id: caseData._id,
            caseId: caseData.caseId,
            status: caseData.status,
          }
        : null,
    });
  } catch (error) {
    console.error("Update Consultation Status By Doctor Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
