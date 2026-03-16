import Tesseract from "tesseract.js";

/**
 * Runs OCR on an image file (JPEG, PNG, WEBP) and returns extracted text.
 * Tesseract.recognize handles worker lifecycle internally when called this way.
 * @param {string} filePath - Path to the image file on disk
 * @returns {Promise<string>} Extracted plain text
 */
export const extractTextFromImage = async (filePath) => {
  const {
    data: { text },
  } = await Tesseract.recognize(filePath, "eng", {
    logger: () => {}, // suppress verbose progress logs
  });
  return text?.trim() || "";
};
