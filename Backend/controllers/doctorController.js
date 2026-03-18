import mongoose from "mongoose";
import Case from "../models/Case.js";
import { findMatchingDoctors } from "../services/doctorMatchService.js";
import {
  getSpecialistLabel,
  normalizeSpecialist,
} from "../services/specialistService.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const getPrimarySpecialist = (aiAnalysis) =>
  aiAnalysis?.recommended_resolution?.primary_specialist ||
  aiAnalysis?.recommendedResolution?.primarySpecialist ||
  "";

export const getMatchedDoctors = async (req, res) => {
  try {
    const { caseId: caseIdentifier } = req.params;
    const onlyAvailable =
      String(req.query.onlyAvailable || "true").toLowerCase() !== "false";
    const specialistFromQuery = normalizeSpecialist(req.query.specialist || "");

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

    const primarySpecialist =
      specialistFromQuery ||
      normalizeSpecialist(getPrimarySpecialist(caseData.aiAnalysis));

    if (!primarySpecialist) {
      return res.status(422).json({
        message:
          "primary_specialist is missing in aiAnalysis.recommended_resolution",
      });
    }

    const doctors = await findMatchingDoctors({
      primarySpecialist,
      onlyAvailable,
      limit: 5,
    });

    if (caseData.status === "ai_completed") {
      caseData.status = "doctor_requested";
      await caseData.save();
    }

    return res.status(200).json({
      caseId: caseData.caseId || String(caseData._id),
      caseObjectId: caseData._id,
      primarySpecialist,
      specialistLabel: getSpecialistLabel(primarySpecialist),
      doctors,
    });
  } catch (error) {
    console.error("Get Matched Doctors Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
