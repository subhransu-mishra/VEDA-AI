import jwt from "jsonwebtoken";
import Patient from "../Schema/patientSchema.js";
import Doctor from "../Schema/doctorSchema.js";

const getBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return "";
  }
  return authHeader.split(" ")[1] || "";
};

export const protectPatient = async (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }
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

export const protectDoctor = async (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "doctor") {
      return res.status(403).json({ message: "Forbidden: Doctor access only" });
    }

    const doctor = await Doctor.findById(decoded.userId).select("-password");
    if (!doctor) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Doctor not found" });
    }

    req.doctor = doctor;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid or expired token" });
  }
};

export const protectAdmin = async (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admin access only" });
    }

    req.admin = {
      id: decoded.userId,
      role: decoded.role,
    };
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid or expired token" });
  }
};
