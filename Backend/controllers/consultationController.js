import mongoose from "mongoose";
import Case from "../models/Case.js";
import Doctor from "../models/Doctor.js";
import Consultation from "../models/Consultation.js";
import { findMatchingDoctors } from "../services/doctorMatchService.js";
import { analyzeWithGemini } from "../services/geminiService.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const getRefId = (ref) => {
  if (!ref) return "";
  if (typeof ref === "object" && ref._id) return String(ref._id);
  return String(ref);
};

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

const safeParseJsonResponse = (rawText) => {
  const cleaned = String(rawText || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
};

const buildDoctorStructuringPrompt = (
  rawInput,
) => `You are a medical report structuring assistant.

Your task is to convert the raw doctor consultation data into a clean, structured, and easy-to-understand patient report.

IMPORTANT RULES:
1. DO NOT change, modify, or interpret any medical information.
2. DO NOT add any new information.
3. DO NOT remove any information.
4. Preserve all original medical terms, medicine names, dosages, and instructions EXACTLY as provided.
5. Only organize and format the data for clarity.
6. If any field is missing, keep it as "Not Provided".

OUTPUT FORMAT (STRICT JSON):

{
  "patient_details": {
    "name": "",
    "age": "",
    "gender": ""
  },
  "consultation_details": {
    "patient_query": "",
    "doctor_name": "",
    "consultation_date": ""
  },
  "diagnosis_summary": "",
  "symptoms_noted": [],
  "medications": [
    {
      "medicine_name": "",
      "dosage": "",
      "frequency": "",
      "duration": "",
      "instructions": ""
    }
  ],
  "tests_recommended": [],
  "doctor_advice": "",
  "follow_up": "",
  "raw_doctor_notes": ""
}

INPUT:
Raw Doctor Data:
${JSON.stringify(rawInput, null, 2)}

OUTPUT:
Return only the structured JSON. No explanation.`;

const formatConsultationItem = ({ consultation, currentDoctorId }) => {
  const caseData = consultation.caseId || {};
  const patient = consultation.patientId || {};
  const assignedDoctor = consultation.doctorId || {};
  const ai = caseData.aiAnalysis || {};

  return {
    id: caseData.caseId || String(caseData._id || consultation._id),
    consultationId: String(consultation._id),
    caseObjectId: caseData._id || null,
    patientName: patient.fullName || "Unknown Patient",
    patientEmail: patient.email || "",
    patientAge: Number.isFinite(Number(patient.age))
      ? Number(patient.age)
      : null,
    patientGender: patient.gender || "",
    patientHeight: Number.isFinite(Number(patient.height))
      ? Number(patient.height)
      : null,
    patientWeight: Number.isFinite(Number(patient.weight))
      ? Number(patient.weight)
      : null,
    patientBloodType: patient.bloodType || "",
    complaint: getComplaint(ai),
    risk: toRiskTier(ai),
    waitMins: minutesSince(consultation.createdAt),
    status: consultation.status,
    assignedDoctor: assignedDoctor.fullName || "Unassigned",
    assignedDoctorId: assignedDoctor._id ? String(assignedDoctor._id) : "",
    summary:
      String(ai?.summary || "").trim() ||
      "AI triage summary not available for this case.",
    aiReport:
      String(ai?.summary || "").trim() ||
      "AI report not available for this case.",
    aiAnalysis: ai,
    aiReportText: JSON.stringify(ai, null, 2),
    isAssignedToCurrentDoctor:
      currentDoctorId && assignedDoctor?._id
        ? String(assignedDoctor._id) === String(currentDoctorId)
        : false,
    lastUpdate: formatRelative(consultation.updatedAt),
    reportStatus: "not_generated",
    doctorResponse: consultation.doctorResponse || null,
    doctorStructuredReport: consultation.doctorStructuredReport || null,
    caseStatus: caseData.status || "doctor_assigned",
    createdAt: consultation.createdAt,
    updatedAt: consultation.updatedAt,
  };
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

    const existingConsultation = await Consultation.findOne({
      caseId: caseData._id,
      patientId: req.patient._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (existingConsultation) {
      return res.status(200).json({
        consultation: {
          _id: existingConsultation._id,
          caseId: existingConsultation.caseId,
          patientId: existingConsultation.patientId,
          doctorId: existingConsultation.doctorId,
          status: existingConsultation.status,
          createdAt: existingConsultation.createdAt,
        },
        case: {
          _id: caseData._id,
          status: caseData.status,
        },
      });
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
      .populate("patientId", "fullName age gender")
      .lean();

    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found" });
    }

    if (getRefId(consultation.patientId) !== String(req.patient._id)) {
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
      .populate(
        "patientId",
        "fullName email patientId age gender height weight bloodType",
      )
      .populate("doctorId", "fullName")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const items = consultations.map((consultation) =>
      formatConsultationItem({
        consultation,
        currentDoctorId: req.doctor._id,
      }),
    );

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

export const getAllDoctorCases = async (req, res) => {
  try {
    const consultations = await Consultation.find({
      doctorId: req.doctor._id,
      status: { $in: ["pending", "accepted", "completed", "rejected"] },
    })
      .populate("caseId", "caseId aiAnalysis status createdAt updatedAt")
      .populate(
        "patientId",
        "fullName email patientId age gender height weight bloodType",
      )
      .populate("doctorId", "fullName")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const items = consultations.map((consultation) =>
      formatConsultationItem({
        consultation,
        currentDoctorId: req.doctor._id,
      }),
    );

    return res.status(200).json({
      message: "All doctor cases fetched successfully",
      count: items.length,
      items,
    });
  } catch (error) {
    console.error("Get All Doctor Cases Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getDoctorCaseByCaseId = async (req, res) => {
  try {
    const caseId = String(req.params.caseId || "").trim();
    if (!caseId) {
      return res.status(400).json({ message: "caseId is required" });
    }

    const lookup = isValidObjectId(caseId) ? { _id: caseId } : { caseId };

    const caseData = await Case.findOne(lookup).select("_id").lean();
    if (!caseData) {
      return res.status(404).json({ message: "Case not found" });
    }

    const consultation = await Consultation.findOne({
      caseId: caseData._id,
      doctorId: req.doctor._id,
      status: { $in: ["accepted", "completed", "pending"] },
    })
      .populate("caseId", "caseId aiAnalysis status createdAt updatedAt")
      .populate(
        "patientId",
        "fullName email patientId age gender height weight bloodType",
      )
      .populate("doctorId", "fullName")
      .lean();

    if (!consultation) {
      return res
        .status(404)
        .json({ message: "Case not found for this doctor" });
    }

    return res.status(200).json({
      item: formatConsultationItem({
        consultation,
        currentDoctorId: req.doctor._id,
      }),
    });
  } catch (error) {
    console.error("Get Doctor Case By CaseId Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const submitDoctorCaseResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      caseNotes,
      medicationPlan,
      testRequirements,
      followUpAfter,
      severity,
      confirmedByDoctor,
    } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid consultation id" });
    }

    if (!String(medicationPlan || "").trim()) {
      return res.status(400).json({
        message: "medicationPlan is required",
      });
    }

    if (!String(followUpAfter || "").trim()) {
      return res.status(400).json({
        message: "followUpAfter is required",
      });
    }

    const normalizedSeverity = String(severity || "normal")
      .trim()
      .toLowerCase();
    if (
      !["normal", "medium", "serious", "critical"].includes(normalizedSeverity)
    ) {
      return res.status(400).json({
        message: "severity must be normal, medium, serious, or critical",
      });
    }

    if (confirmedByDoctor !== true) {
      return res.status(400).json({
        message: "confirmedByDoctor must be true",
      });
    }

    const consultation = await Consultation.findById(id)
      .populate("patientId", "fullName age gender")
      .populate("doctorId", "fullName")
      .populate("caseId", "caseId aiAnalysis");
    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found" });
    }

    if (getRefId(consultation.doctorId) !== String(req.doctor._id)) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not your consultation" });
    }

    consultation.doctorResponse = {
      caseNotes: String(caseNotes || "").trim(),
      medicationPlan: String(medicationPlan || "").trim(),
      testRequirements: String(testRequirements || "").trim(),
      followUpAfter: String(followUpAfter || "").trim(),
      severity: normalizedSeverity,
      confirmedByDoctor: true,
      submittedAt: new Date(),
    };

    const rawInput = {
      patient: {
        name: consultation?.patientId?.fullName || "Not Provided",
        age:
          consultation?.patientId?.age !== undefined &&
          consultation?.patientId?.age !== null
            ? String(consultation.patientId.age)
            : "Not Provided",
        gender: consultation?.patientId?.gender || "Not Provided",
      },
      consultation: {
        patient_query:
          consultation?.caseId?.aiAnalysis?.summary || "Not Provided",
        doctor_name: consultation?.doctorId?.fullName || "Not Provided",
        consultation_date: consultation?.updatedAt
          ? new Date(consultation.updatedAt).toISOString()
          : "Not Provided",
      },
      doctor_response: {
        case_notes: consultation.doctorResponse.caseNotes || "Not Provided",
        medication_plan:
          consultation.doctorResponse.medicationPlan || "Not Provided",
        test_requirements:
          consultation.doctorResponse.testRequirements || "Not Provided",
        follow_up_after:
          consultation.doctorResponse.followUpAfter || "Not Provided",
        severity: consultation.doctorResponse.severity || "Not Provided",
      },
    };

    let structuredReport = null;
    try {
      const rawGeminiText = await analyzeWithGemini(
        buildDoctorStructuringPrompt(rawInput),
      );
      structuredReport = safeParseJsonResponse(rawGeminiText);
    } catch (error) {
      console.error(
        "Doctor Structured Report Generation Error:",
        error.message,
      );
      structuredReport = {
        patient_details: {
          name: rawInput.patient.name,
          age: rawInput.patient.age,
          gender: rawInput.patient.gender,
        },
        consultation_details: {
          patient_query: rawInput.consultation.patient_query,
          doctor_name: rawInput.consultation.doctor_name,
          consultation_date: rawInput.consultation.consultation_date,
        },
        diagnosis_summary: rawInput.doctor_response.case_notes,
        symptoms_noted: [],
        medications: [
          {
            medicine_name: rawInput.doctor_response.medication_plan,
            dosage: "Not Provided",
            frequency: "Not Provided",
            duration: "Not Provided",
            instructions: "Not Provided",
          },
        ],
        tests_recommended: rawInput.doctor_response.test_requirements
          ? [rawInput.doctor_response.test_requirements]
          : [],
        doctor_advice: rawInput.doctor_response.case_notes,
        follow_up: rawInput.doctor_response.follow_up_after,
        raw_doctor_notes: rawInput.doctor_response.case_notes,
      };
    }

    consultation.doctorStructuredReport = structuredReport;
    consultation.status = "completed";
    await consultation.save();

    const caseData = await Case.findById(consultation.caseId);
    if (caseData) {
      caseData.status = "completed";
      await caseData.save();
    }

    return res.status(200).json({
      message: "Doctor response submitted successfully",
      consultation: {
        _id: consultation._id,
        status: consultation.status,
        doctorResponse: consultation.doctorResponse,
        doctorStructuredReport: consultation.doctorStructuredReport,
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
    console.error("Submit Doctor Case Response Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAssignableDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ isVerified: true })
      .select("_id fullName specialization availability")
      .sort({ fullName: 1 })
      .lean();

    const items = doctors.map((doctor) => ({
      id: String(doctor._id),
      name: doctor.fullName,
      specialization: doctor.specialization,
      availability: Boolean(doctor.availability),
      isCurrentDoctor: String(doctor._id) === String(req.doctor._id),
    }));

    return res.status(200).json({
      message: "Assignable doctors fetched successfully",
      count: items.length,
      items,
    });
  } catch (error) {
    console.error("Get Assignable Doctors Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const claimConsultationByDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid consultation id" });
    }

    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found" });
    }

    if (consultation.status === "completed") {
      return res.status(409).json({
        message: "Completed consultations cannot be claimed",
      });
    }

    consultation.doctorId = req.doctor._id;
    consultation.status = "accepted";
    await consultation.save();

    const caseData = await Case.findById(consultation.caseId);
    if (caseData) {
      caseData.status = "consultation_active";
      await caseData.save();
    }

    return res.status(200).json({
      message: "Consultation assigned to current doctor",
      consultation: {
        _id: consultation._id,
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
    console.error("Claim Consultation Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const reassignConsultationByDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = String(req.body?.doctorId || "").trim();

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid consultation id" });
    }

    if (!isValidObjectId(doctorId)) {
      return res.status(400).json({ message: "Invalid target doctor id" });
    }

    const targetDoctor = await Doctor.findById(doctorId).select(
      "_id fullName isVerified",
    );
    if (!targetDoctor) {
      return res.status(404).json({ message: "Target doctor not found" });
    }

    if (!targetDoctor.isVerified) {
      return res.status(400).json({ message: "Target doctor is not verified" });
    }

    const consultation = await Consultation.findById(id);
    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found" });
    }

    if (consultation.status === "completed") {
      return res.status(409).json({
        message: "Completed consultations cannot be reassigned",
      });
    }

    consultation.doctorId = targetDoctor._id;
    consultation.status = "pending";
    await consultation.save();

    const caseData = await Case.findById(consultation.caseId);
    if (caseData) {
      caseData.status = "doctor_assigned";
      await caseData.save();
    }

    return res.status(200).json({
      message: "Consultation reassigned successfully",
      consultation: {
        _id: consultation._id,
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
    console.error("Reassign Consultation Error:", error.message);
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

    if (getRefId(consultation.doctorId) !== String(req.doctor._id)) {
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
