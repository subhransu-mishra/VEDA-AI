import Diagnosis from "../../Schema/diagnosisSchema.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateCaseId = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CASE-${ts}-${rand}`;
};

const generateUniqueCaseId = async () => {
  let caseId = generateCaseId();
  while (await Diagnosis.exists({ caseId })) {
    caseId = generateCaseId();
  }
  return caseId;
};

// Handles both comma-separated strings (multipart) and proper JSON arrays
const parseArrayField = (val) => {
  if (!val) return [];
  if (Array.isArray(val))
    return val.map((v) => String(v).trim()).filter(Boolean);
  return String(val)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

// ─── POST /api/diagnosis/submit ───────────────────────────────────────────────
export const submitDiagnosis = async (req, res) => {
  try {
    const {
      symptoms,
      symptomDuration,
      existingConditions,
      currentMedications,
      allergies,
      painLevel,
      additionalNotes,
    } = req.body;

    // Required field presence check
    if (
      !symptoms ||
      !symptomDuration ||
      painLevel === undefined ||
      painLevel === null ||
      painLevel === ""
    ) {
      return res.status(400).json({
        message: "symptoms, symptomDuration, and painLevel are required",
      });
    }

    const parsedPainLevel = Number(painLevel);
    if (
      !Number.isFinite(parsedPainLevel) ||
      parsedPainLevel < 0 ||
      parsedPainLevel > 10
    ) {
      return res
        .status(400)
        .json({ message: "painLevel must be a number between 0 and 10" });
    }

    const parsedSymptoms = parseArrayField(symptoms);
    if (parsedSymptoms.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one symptom is required" });
    }

    // Map multer files to a clean upload record
    const uploads = (req.files || []).map((file) => ({
      originalName: file.originalname,
      fileName: file.filename,
      filePath: file.path.replace(/\\/g, "/"), // normalise for cross-platform
      fileType: file.mimetype,
    }));

    const caseId = await generateUniqueCaseId();

    const diagnosis = await Diagnosis.create({
      caseId,
      patientId: req.patient.patientId,
      patientObjectId: req.patient._id,
      symptoms: parsedSymptoms,
      symptomDuration: String(symptomDuration).trim(),
      existingConditions: parseArrayField(existingConditions),
      currentMedications: parseArrayField(currentMedications),
      allergies: parseArrayField(allergies),
      painLevel: parsedPainLevel,
      additionalNotes: additionalNotes ? String(additionalNotes).trim() : "",
      uploads,
    });

    return res.status(201).json({
      message: "Diagnosis case submitted successfully",
      case: diagnosis,
    });
  } catch (error) {
    console.error("Submit Diagnosis Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// ─── GET /api/diagnosis/my-cases ─────────────────────────────────────────────
export const getPatientCases = async (req, res) => {
  try {
    const cases = await Diagnosis.find({ patientId: req.patient.patientId })
      .sort({ createdAt: -1 })
      .select("-patientObjectId");

    return res.status(200).json({
      message: "Cases fetched successfully",
      count: cases.length,
      cases,
    });
  } catch (error) {
    console.error("Get Patient Cases Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// ─── GET /api/diagnosis/case/:caseId ─────────────────────────────────────────
export const getCaseById = async (req, res) => {
  try {
    const { caseId } = req.params;

    const diagnosisCase = await Diagnosis.findOne({
      caseId,
      patientId: req.patient.patientId, // patients can only read their own cases
    }).select("-patientObjectId");

    if (!diagnosisCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    return res.status(200).json({
      message: "Case fetched successfully",
      case: diagnosisCase,
    });
  } catch (error) {
    console.error("Get Case By ID Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
