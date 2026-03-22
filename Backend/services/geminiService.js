import { GoogleGenerativeAI } from "@google/generative-ai";

// Lazily instantiated so the key is read after dotenv.config() runs
let genAIInstance = null;

const getGenAI = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAIInstance;
};

/**
 * Sends a prompt to Gemini 1.5 Flash and returns the raw text response.
 * @param {string} prompt
 * @param {{ model?: string }} [options]
 * @returns {Promise<string>} Raw text from the model
 */
export const analyzeWithGemini = async (prompt, options = {}) => {
  const modelName = options.model || "gemini-3-flash-preview";
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return result.response.text();
};
