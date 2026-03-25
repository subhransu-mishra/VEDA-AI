import { readFile } from "fs/promises";

/**
 * Extracts all text content from a PDF file.
 * @param {string} filePath - Path to the PDF file on disk
 * @returns {Promise<string>} Extracted plain text
 */
export const extractTextFromPdf = async (filePath) => {
  const dataBuffer = await readFile(filePath);

  // Lazy import prevents optional native PDF dependencies from crashing server startup.
  const pdfParseModule = await import("pdf-parse");
  const PDFParseClass = pdfParseModule?.PDFParse;

  if (!PDFParseClass) {
    throw new Error("PDF parser is not available in current runtime");
  }

  const parser = new PDFParseClass({ data: dataBuffer });

  try {
    const result = await parser.getText();
    return result.text?.trim() || "";
  } finally {
    await parser.destroy();
  }
};
