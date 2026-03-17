import { extractTextFromPdf } from "../../services/pdfExtractor.js";
import { extractTextFromImage } from "../../services/ocrExtractor.js";
import { analyzeWithGemini } from "../../services/geminiService.js";

// ─── Prompt Builder ───────────────────────────────────────────────────────────

const buildMedicalPrompt = ({
  patientProfile,
  intake,
  reportText,
}) => `You are a clinical AI triage assistant.

Use the provided patient profile, current symptom intake, and uploaded report text to generate a concise, structured triage report.

Patient Profile (from signup):
${JSON.stringify(patientProfile, null, 2)}

Current Intake:
${JSON.stringify(intake, null, 2)}

Medical Report Text:
${reportText || "No report text available"}

Instructions:
1. Keep the report practical and easy to understand.
2. Explain what the likely disease/condition can be and why it may have happened.
3. Explain what the patient should do to resolve/manage this.
4. Mention which specialist(s) to consult.
5. Provide emergency level and red-flag warning signs.
6. Include suggested diagnostic tests.
7. Do not claim a definitive diagnosis unless clearly supported.

IMPORTANT:
Return ONLY valid JSON, with this exact top-level structure:
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
    "follow_up_window": ""
  },
  "emergency_assessment": {
    "level": "low|moderate|high|critical",
    "why": "",
    "red_flags": [""]
  },
  "summary": "",
  "disclaimer": ""
}`;

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

    // ── Step 5: Return the structured analysis ─────────────────────────────────
    return res.status(200).json({
      analysis,
      intake,
      patientProfile,
    });
  } catch (error) {
    console.error("Analyze Case Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
