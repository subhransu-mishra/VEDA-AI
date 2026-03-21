import { extractTextFromPdf } from "../../services/pdfExtractor.js";
import { extractTextFromImage } from "../../services/ocrExtractor.js";
import { analyzeWithGemini } from "../../services/geminiService.js";
import Case from "../../models/Case.js";
import { getAllowedSpecialists } from "../../services/specialistService.js";

const generateCaseId = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CASE-${ts}-${rand}`;
};

const generateUniqueCaseId = async () => {
  let caseId = generateCaseId();

  while (await Case.exists({ caseId })) {
    caseId = generateCaseId();
  }

  return caseId;
};

// ─── Prompt Builder ───────────────────────────────────────────────────────────

const buildMedicalPrompt = ({
  patientProfile,
  intake,
  reportText,
}) => `You are a clinical AI triage assistant.

Your goal is to analyze patient data and generate a structured, practical medical triage report.

Use:
- Patient profile
- Current symptom intake
- Uploaded medical report text (if available)

----------------------------
PATIENT PROFILE
----------------------------
${JSON.stringify(patientProfile, null, 2)}

----------------------------
CURRENT INTAKE
----------------------------
${JSON.stringify(intake, null, 2)}

----------------------------
MEDICAL REPORT TEXT
----------------------------
${reportText || "No report text available"}

----------------------------
INSTRUCTIONS
----------------------------
1. Keep the report concise, structured, and easy to understand.
2. Suggest likely conditions with reasoning (not definitive diagnosis).
3. Explain possible causes clearly.
4. Recommend practical next steps.
5. Identify the MOST RELEVANT PRIMARY SPECIALIST for this case.
6. Also include additional specialists if needed.
7. Provide urgency level and red-flag symptoms.
8. Suggest useful diagnostic tests.
9. Avoid unnecessary medical jargon.

----------------------------
CRITICAL RULES
----------------------------
- ALWAYS return valid JSON (no markdown, no extra text).
- DO NOT include explanations outside JSON.
- Ensure all fields are present even if empty.
- Keep values short and structured.
- "primary_specialist" MUST be ONE of the predefined categories.

----------------------------
SPECIALIST NORMALIZATION
----------------------------
Use ONLY one of the following values for "primary_specialist":

["general_physician", "dermatologist", "cardiologist", "neurologist", "orthopedic", "gastroenterologist", "endocrinologist", "psychiatrist", "pulmonologist", "ent_specialist"]

----------------------------
OUTPUT FORMAT (STRICT JSON)
----------------------------
{
  "condition_analysis": {
    "possible_conditions": [
      {
        "name": "",
        "likelihood": "low|medium|high",
        "why_it_fits": ""
      }
    ],
    "possible_causes": [""],
    "patient_friendly_explanation": ""
  },
  "recommended_resolution": {
    "immediate_steps": [""],
    "home_care": [""],
    "tests_to_consider": [""],
    "specialists_to_consult": [""],
    "primary_specialist": "",
    "follow_up_window": ""
  },
  "emergency_assessment": {
    "level": "low|moderate|high|critical",
    "why": "",
    "red_flags": [""]
  },
  "triage_signal": {
    "patient_reported_situation": "normal|medium|emergency",
    "is_emergency_case": false,
    "reason": ""
  },
  "summary": "",
  "confidence_score": 0,
  "disclaimer": ""
}

----------------------------
IMPORTANT NOTES
----------------------------
- "primary_specialist" must be a single string from the allowed list.
- "specialists_to_consult" can contain multiple human-readable names.
- "confidence_score" should be between 0 and 1.
- Set "triage_signal.is_emergency_case" to true when risk is high/critical or patient_reported_situation is emergency.
`;

// ─── Safe JSON Parser ─────────────────────────────────────────────────────────

/**
 * Gemini occasionally wraps its response in markdown code fences.
 * This strips any such wrapping before parsing.
 */
const safeParseGeminiResponse = (rawText) => {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
};

// ─── Field normalizer ─────────────────────────────────────────────────────────

const normalizeField = (val) => {
  if (!val) return "None";
  if (Array.isArray(val)) return val.join(", ") || "None";
  const str = String(val).trim();
  return str || "None";
};

const normalizeSituationLevel = (value) => {
  const normalized = String(value || "normal")
    .trim()
    .toLowerCase();
  if (["normal", "medium", "emergency"].includes(normalized)) {
    return normalized;
  }
  return "normal";
};

const normalizeStringArray = (value, fallback = []) => {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : fallback;
};

const normalizeLikelihood = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["low", "medium", "high"].includes(normalized)) return normalized;
  return "medium";
};

const normalizeEmergencyLevel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["low", "moderate", "high", "critical"].includes(normalized)) {
    return normalized;
  }
  return "moderate";
};

const normalizeAnalysis = (raw) => {
  const possibleConditionsRaw = Array.isArray(
    raw?.condition_analysis?.possible_conditions,
  )
    ? raw.condition_analysis.possible_conditions
    : [];

  const possibleConditions = possibleConditionsRaw
    .map((item) => ({
      name: String(item?.name || "").trim(),
      likelihood: normalizeLikelihood(item?.likelihood),
      whyItFits: String(item?.why_it_fits || "").trim() || "Not specified",
    }))
    .filter((item) => item.name);

  const causes = normalizeStringArray(
    raw?.condition_analysis?.possible_causes,
    ["Cause could not be determined from available information."],
  );

  const explanation =
    String(
      raw?.condition_analysis?.patient_friendly_explanation || "",
    ).trim() ||
    "Your symptoms require clinical review to identify the exact cause.";

  const immediateSteps = normalizeStringArray(
    raw?.recommended_resolution?.immediate_steps,
    ["Consult a qualified doctor with your reports and symptom timeline."],
  );

  const homeCare = normalizeStringArray(
    raw?.recommended_resolution?.home_care,
    ["Maintain hydration and monitor symptoms closely."],
  );

  const testsToConsider = normalizeStringArray(
    raw?.recommended_resolution?.tests_to_consider,
    ["No specific tests suggested."],
  );

  const specialistsToConsult = normalizeStringArray(
    raw?.recommended_resolution?.specialists_to_consult,
    ["General Physician"],
  );

  const followUpWindow =
    String(raw?.recommended_resolution?.follow_up_window || "").trim() ||
    "Follow up within 24-72 hours or sooner if symptoms worsen.";

  const primarySpecialistRaw = String(
    raw?.recommended_resolution?.primary_specialist || "general_physician",
  )
    .trim()
    .toLowerCase();

  const allowedSpecialists = getAllowedSpecialists();

  const primarySpecialist = allowedSpecialists.includes(primarySpecialistRaw)
    ? primarySpecialistRaw
    : "general_physician";

  const emergencyLevel = normalizeEmergencyLevel(
    raw?.emergency_assessment?.level,
  );

  const emergencyWhy =
    String(raw?.emergency_assessment?.why || "").trim() ||
    "Emergency risk cannot be ruled out without physical examination.";

  const redFlags = normalizeStringArray(raw?.emergency_assessment?.red_flags, [
    "Severe worsening of symptoms",
  ]);

  const summary =
    String(raw?.summary || "").trim() ||
    "AI triage completed. Please consult a doctor for confirmation.";

  const disclaimer =
    String(raw?.disclaimer || "").trim() ||
    "This AI report is informational only and not a final medical diagnosis.";

  const patientReportedSituation = normalizeSituationLevel(
    raw?.triage_signal?.patient_reported_situation,
  );

  const triageEmergencyFlag = Boolean(raw?.triage_signal?.is_emergency_case);

  const isEmergencyCase =
    triageEmergencyFlag || ["high", "critical"].includes(emergencyLevel);

  return {
    conditionAnalysis: {
      possibleConditions,
      possibleCauses: causes,
      patientFriendlyExplanation: explanation,
    },
    recommendedResolution: {
      immediateSteps,
      homeCare,
      testsToConsider,
      specialistsToConsult,
      primarySpecialist,
      followUpWindow,
    },
    emergencyAssessment: {
      level: emergencyLevel,
      why: emergencyWhy,
      redFlags,
    },
    summary,
    disclaimer,
    recommendedSpecialist: specialistsToConsult[0] || "General Physician",
    urgency: emergencyLevel,
    patientReportedSituation,
    isEmergencyCase,
  };
};

// ─── POST /api/case/analyze ───────────────────────────────────────────────────

/**
 * Receives patient medical data + optional uploaded reports,
 * extracts report text, builds an AI prompt, sends it to Gemini,
 * and returns a structured triage analysis.
 */
export const analyzeCase = async (req, res) => {
  try {
    const {
      symptoms,
      symptomDuration,
      existingConditions,
      medications,
      allergies,
      painLevel,
      additionalNotes,
      age,
      gender,
      situationLevel,
    } = req.body;

    // ── Input validation ───────────────────────────────────────────────────────
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

    // ── Step 1: Extract text from each uploaded report file ────────────────────
    let reportText = "";
    const files = req.files || [];

    for (const file of files) {
      let extracted = "";
      try {
        if (file.mimetype === "application/pdf") {
          // PDF → pdf-parse
          extracted = await extractTextFromPdf(file.path);
        } else {
          // Image (JPEG, PNG, WEBP) → Tesseract OCR
          extracted = await extractTextFromImage(file.path);
        }
      } catch (extractErr) {
        // Non-fatal: log the warning and continue with remaining files
        console.warn(
          `Text extraction failed for "${file.originalname}": ${extractErr.message}`,
        );
        extracted = "[Text extraction failed for this file]";
      }

      reportText += `\n--- Report: ${file.originalname} ---\n${extracted}\n`;
    }

    // ── Step 2: Build structured Gemini prompt ─────────────────────────────────
    const symptomsStr = Array.isArray(symptoms)
      ? symptoms.join(", ")
      : String(symptoms);

    const patientProfile = {
      patientId: req.patient?.patientId || "Unknown",
      fullName: req.patient?.fullName || "Unknown",
      email: req.patient?.email || "Unknown",
      age: req.patient?.age,
      gender: req.patient?.gender,
      bloodType: req.patient?.bloodType,
      height: req.patient?.height,
      weight: req.patient?.weight,
      phoneNumber: req.patient?.phoneNumber,
      city: req.patient?.city,
      emergencyContactName: req.patient?.emergencyContactName,
      emergencyPhone: req.patient?.emergencyPhone,
    };

    const intake = {
      age: normalizeField(age || req.patient?.age),
      gender: normalizeField(gender || req.patient?.gender),
      symptoms: symptomsStr,
      symptomDuration: String(symptomDuration).trim(),
      patientReportedSituation: normalizeSituationLevel(situationLevel),
      existingConditions: normalizeField(existingConditions),
      medications: normalizeField(medications),
      allergies: normalizeField(allergies),
      painLevel: parsedPainLevel,
      additionalNotes: normalizeField(additionalNotes),
      uploadedFiles: files.map((f) => ({
        originalName: f.originalname,
        mimeType: f.mimetype,
      })),
    };

    const normalizedSituationLevel = normalizeSituationLevel(situationLevel);

    const prompt = buildMedicalPrompt({
      patientProfile,
      intake,
      reportText: reportText.trim() || "No medical reports uploaded",
    });

    // ── Step 3: Send prompt to Gemini AI ───────────────────────────────────────
    const rawGeminiResponse = await analyzeWithGemini(prompt);

    // ── Step 4: Safely parse the JSON response from Gemini ─────────────────────
    let analysis;
    try {
      const parsed = safeParseGeminiResponse(rawGeminiResponse);
      analysis = normalizeAnalysis(parsed);
    } catch (parseErr) {
      console.error("Failed to parse Gemini JSON response:", rawGeminiResponse);
      return res.status(502).json({
        message: "AI returned an unreadable response. Please try again.",
      });
    }

    analysis.patientReportedSituation =
      analysis.patientReportedSituation || normalizedSituationLevel;
    analysis.isEmergencyCase = Boolean(analysis.isEmergencyCase);

    // ── Step 5: Return the structured analysis ─────────────────────────────────
    const caseId = await generateUniqueCaseId();

    const createdCase = await Case.create({
      caseId,
      patientId: req.patient._id,
      aiAnalysis: analysis,
      status: "ai_completed",
      situationLevel: normalizedSituationLevel,
      isEmergencyCase: Boolean(analysis?.isEmergencyCase),
    });

    return res.status(200).json({
      case: {
        _id: createdCase._id,
        caseId: createdCase.caseId,
        status: createdCase.status,
        situationLevel: createdCase.situationLevel,
        isEmergencyCase: createdCase.isEmergencyCase,
      },
      analysis,
      intake,
      patientProfile,
    });
  } catch (error) {
    console.error("Analyze Case Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
