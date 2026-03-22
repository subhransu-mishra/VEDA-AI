import { analyzeWithGemini } from "../../services/geminiService.js";

const buildVoiceParsePrompt = (
  voiceText,
) => `You are a medical data extraction assistant.

Convert the given patient voice input into structured JSON.

Input:
"${voiceText}"

Extract the following fields:

{
  "age": number,
  "gender": "",
  "symptoms": "",
  "symptomDuration": "",
  "existingConditions": [],
  "medications": [],
  "painLevel": number,
  "additionalNotes": ""
}

Rules:
- Do NOT guess unknown values
- Keep missing fields empty
- Return ONLY valid JSON
- No extra explanation`;

const safeParseJsonObject = (rawText = "") => {
  const cleaned = String(rawText)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("AI did not return valid JSON");
  }
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStringOrEmpty = (value) => {
  if (value === null || value === undefined) return "";
  const out = String(value).trim();
  return out;
};

const toStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toStringOrEmpty(item)).filter(Boolean);
};

const normalizeParsedVoiceData = (raw = {}) => ({
  age: toNumberOrNull(raw.age),
  gender: toStringOrEmpty(raw.gender),
  symptoms: toStringOrEmpty(raw.symptoms),
  symptomDuration: toStringOrEmpty(raw.symptomDuration),
  existingConditions: toStringArray(raw.existingConditions),
  medications: toStringArray(raw.medications),
  painLevel: toNumberOrNull(raw.painLevel),
  additionalNotes: toStringOrEmpty(raw.additionalNotes),
});

const fallbackParseFromText = (text) => {
  const lower = String(text || "").toLowerCase();

  const ageMatch = lower.match(/\b(?:i am|i'm|age is|aged?)\s*(\d{1,3})\b/i);
  const durationMatch = lower.match(
    /(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months)/i,
  );
  const painMatch = lower.match(
    /(?:pain(?:\s*level)?|severity)\s*(?:is|:)?\s*(\d{1,2})/i,
  );

  const gender = /\bmale\b/i.test(lower)
    ? "male"
    : /\bfemale\b/i.test(lower)
      ? "female"
      : /\bother\b/i.test(lower)
        ? "other"
        : "";

  const duration = durationMatch
    ? `${durationMatch[1]} ${durationMatch[2]}`
    : "";

  return normalizeParsedVoiceData({
    age: ageMatch?.[1] || null,
    gender,
    symptoms: String(text || "").trim(),
    symptomDuration: duration,
    existingConditions: [],
    medications: [],
    painLevel: painMatch?.[1] || null,
    additionalNotes: String(text || "").trim(),
  });
};

const tryGeminiVoiceParse = async (prompt) => {
  const modelsToTry = ["gemini-1.5-flash", "gemini-3-flash-preview"];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await analyzeWithGemini(prompt, { model });
      return safeParseJsonObject(response);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No Gemini model available");
};

export const parseVoiceInput = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();

    if (!text) {
      return res.status(400).json({
        message: "text is required",
      });
    }

    const prompt = buildVoiceParsePrompt(text);

    let normalized;
    try {
      const parsed = await tryGeminiVoiceParse(prompt);
      normalized = normalizeParsedVoiceData(parsed);
    } catch (aiError) {
      console.error("Voice parse AI failed, using fallback parser:", aiError);
      normalized = fallbackParseFromText(text);
    }

    return res.status(200).json({
      parsed: normalized,
    });
  } catch (error) {
    console.error("Voice parse failed:", error);
    return res.status(500).json({
      message: "Failed to parse voice input",
    });
  }
};
