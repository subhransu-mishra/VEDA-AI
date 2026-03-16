import jwt from "jsonwebtoken";
import Patient from "../Schema/patientSchema.js";

export const protectPatient = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "patient") {
      return res
        .status(403)
        .json({ message: "Forbidden: Patient access only" });
    }

    const patient = await Patient.findById(decoded.userId).select("-password");
    if (!patient) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Patient not found" });
    }

    req.patient = patient;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid or expired token" });
  }
};
