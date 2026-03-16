import { PDFParse } from "pdf-parse";
import { readFile } from "fs/promises";

/**
 * Extracts all text content from a PDF file.
 * @param {string} filePath - Path to the PDF file on disk
 * @returns {Promise<string>} Extracted plain text
 */
export const extractTextFromPdf = async (filePath) => {
  const dataBuffer = await readFile(filePath);

  const parser = new PDFParse({ data: dataBuffer });

  try {
    const result = await parser.getText();
    return result.text?.trim() || "";
  } finally {
    await parser.destroy();
  }
};
