import { extractTextFromPdf } from "../../services/pdfExtractor.js";
import { extractTextFromImage } from "../../services/ocrExtractor.js";
import { analyzeWithGemini } from "../../services/geminiService.js";

// ─── Prompt Builder ───────────────────────────────────────────────────────────

const buildMedicalPrompt = ({
  age,
  gender,
  symptoms,
  symptomDuration,
  existingConditions,
  medications,
  allergies,
  painLevel,
  additionalNotes,
  reportText,
}) => `You are an AI medical triage assistant.

Analyze the following patient data and medical report information.

Patient Information:
Age: ${age}
Gender: ${gender}
Symptoms: ${symptoms}
Duration: ${symptomDuration}
Existing Conditions: ${existingConditions}
Medications: ${medications}
Allergies: ${allergies}
Pain Level: ${painLevel}/10
Notes: ${additionalNotes}

Medical Report Text:
${reportText}

Your task:
1. Identify possible medical conditions.
2. Determine urgency level (low, medium, high, emergency).
3. Recommend the type of specialist the patient should consult.
4. Suggest possible diagnostic tests.
5. Provide a short summary of the patient's situation.

IMPORTANT:
Return the response ONLY in valid JSON format. No extra text, no markdown, no code blocks outside the JSON.

{
  "possible_conditions": [],
  "urgency_level": "",
  "recommended_specialist": "",
  "recommended_tests": [],
  "summary": ""
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

// ─── POST /api/case/analyze ───────────────────────────────────────────────────

/**
 * Receives patient medical data + optional uploaded reports,
 * extracts report text, builds an AI prompt, sends it to Gemini,
 * and returns a structured triage analysis.
 */
export const analyzeCase = async (req, res) => {
  try {
    const {
      age,
      gender,
      symptoms,
      symptomDuration,
      existingConditions,
      medications,
      allergies,
      painLevel,
      additionalNotes,
    } = req.body;

    // ── Input validation ───────────────────────────────────────────────────────
    if (
      !age ||
      !gender ||
      !symptoms ||
      !symptomDuration ||
      painLevel === undefined ||
      painLevel === null ||
      painLevel === ""
    ) {
      return res.status(400).json({
        message:
          "age, gender, symptoms, symptomDuration, and painLevel are required",
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

    const prompt = buildMedicalPrompt({
      age: String(age),
      gender: String(gender),
      symptoms: symptomsStr,
      symptomDuration: String(symptomDuration).trim(),
      existingConditions: normalizeField(existingConditions),
      medications: normalizeField(medications),
      allergies: normalizeField(allergies),
      painLevel: parsedPainLevel.toString(),
      additionalNotes: normalizeField(additionalNotes),
      reportText: reportText.trim() || "No medical reports uploaded",
    });

    // ── Step 3: Send prompt to Gemini AI ───────────────────────────────────────
    const rawGeminiResponse = await analyzeWithGemini(prompt);

    // ── Step 4: Safely parse the JSON response from Gemini ─────────────────────
    let analysis;
    try {
      analysis = safeParseGeminiResponse(rawGeminiResponse);
    } catch (parseErr) {
      console.error(
        "Failed to parse Gemini JSON response:",
        rawGeminiResponse,
      );
      return res.status(502).json({
        message: "AI returned an unreadable response. Please try again.",
      });
    }

    // ── Step 5: Return the structured analysis ─────────────────────────────────
    return res.status(200).json({ analysis });
  } catch (error) {
    console.error("Analyze Case Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
