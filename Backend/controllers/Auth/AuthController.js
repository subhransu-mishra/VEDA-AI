import Doctor from "../../Schema/doctorSchema.js";
import Patient from "../../Schema/patientSchema.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  getAllowedSpecialists,
  normalizeSpecialist,
} from "../../services/specialistService.js";

const generateCandidateId = (prefix) => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${timestampPart}-${randomPart}`;
};

const generateUniqueId = async (model, field, prefix) => {
  let candidate = generateCandidateId(prefix);
  let exists = await model.exists({ [field]: candidate });

  while (exists) {
    candidate = generateCandidateId(prefix);
    exists = await model.exists({ [field]: candidate });
  }

  return candidate;
};

const formatDoctorAuthResponse = (doctor) => ({
  id: doctor._id,
  doctorId: doctor.doctorId,
  fullName: doctor.fullName,
  email: doctor.email,
  specialization: doctor.specialization,
});

// ─── Doctor Signup ───────────────────────────────────────────────────────────
export const doctorSignup = async (req, res) => {
  try {
    const rawSpecialization = String(req.body?.specialization || "").trim();

    const normalizedSpecialization = normalizeSpecialist(rawSpecialization);

    const payload = {
      fullName: String(req.body?.fullName || "").trim(),
      email: String(req.body?.email || "")
        .trim()
        .toLowerCase(),
      password: String(req.body?.password || ""),
      specialization: normalizedSpecialization,
      experience: Number(req.body?.experience),
      phoneNumber: String(req.body?.phoneNumber || "").trim(),
      clinicAddress: String(req.body?.clinicAddress || "").trim(),
      licenseNumber: String(req.body?.licenseNumber || "").trim(),
      clinicName: String(req.body?.clinicName || "").trim(),
      city: String(req.body?.city || "").trim(),
    };

    // Validate required fields using raw input values.
    // Specialization is validated separately so unsupported values return a precise message.
    const missingFields = [];
    if (!payload.fullName) missingFields.push("fullName");
    if (!payload.email) missingFields.push("email");
    if (!payload.password) missingFields.push("password");
    if (!rawSpecialization) missingFields.push("specialization");
    if (Number.isNaN(payload.experience)) missingFields.push("experience");
    if (!payload.phoneNumber) missingFields.push("phoneNumber");
    if (!payload.clinicAddress) missingFields.push("clinicAddress");
    if (!payload.licenseNumber) missingFields.push("licenseNumber");
    if (!payload.clinicName) missingFields.push("clinicName");
    if (!payload.city) missingFields.push("city");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "All fields are required",
        missingFields,
      });
    }

    if (!normalizedSpecialization) {
      return res.status(400).json({
        message: "Unsupported specialization",
        allowedSpecializations: getAllowedSpecialists(),
      });
    }

    if (!Number.isFinite(payload.experience) || payload.experience < 0) {
      return res
        .status(400)
        .json({ message: "Experience must be a valid number" });
    }

    // Check if doctor already exists
    const existingDoctor = await Doctor.findOne({ email: payload.email });
    if (existingDoctor) {
      return res
        .status(409)
        .json({ message: "Doctor already registered with this email" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(payload.password, salt);
    const doctorId = await generateUniqueId(Doctor, "doctorId", "DOC");

    // Create doctor
    const doctor = await Doctor.create({
      doctorId,
      fullName: payload.fullName,
      email: payload.email,
      password: hashedPassword,
      specialization: payload.specialization,
      experience: payload.experience,
      phoneNumber: payload.phoneNumber,
      clinicAddress: payload.clinicAddress,
      licenseNumber: payload.licenseNumber,
      clinicName: payload.clinicName,
      city: payload.city,
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: doctor._id, role: "doctor" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    return res.status(201).json({
      message: "Doctor registered successfully",
      token,
      doctor: formatDoctorAuthResponse(doctor),
    });
  } catch (error) {
    console.error("Doctor Signup Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// ─── Doctor Login ─────────────────────────────────────────────────────────────
export const doctorLogin = async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Find doctor by email
    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Verify password
    const isPasswordCorrect = await bcrypt.compare(password, doctor.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: doctor._id, role: "doctor" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      doctor: formatDoctorAuthResponse(doctor),
    });
  } catch (error) {
    console.error("Doctor Login Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const patientSignupRequiredFields = [
  "fullName",
  "email",
  "password",
  "age",
  "height",
  "weight",
  "bloodType",
  "gender",
  "phoneNumber",
  "city",
  "emergencyContactName",
  "emergencyPhone",
];

const formatPatientAuthResponse = (patient) => ({
  id: patient._id,
  patientId: patient.patientId,
  fullName: patient.fullName,
  email: patient.email,
  age: patient.age,
  height: patient.height,
  weight: patient.weight,
  bloodType: patient.bloodType,
  gender: patient.gender,
  phoneNumber: patient.phoneNumber,
  city: patient.city,
  emergencyContactName: patient.emergencyContactName,
  emergencyPhone: patient.emergencyPhone,
});

export const patientSignup = async (req, res) => {
  try {
    const missingFields = patientSignupRequiredFields.filter(
      (field) => !req.body?.[field],
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "All fields are required",
        missingFields,
      });
    }

    const payload = {
      fullName: String(req.body.fullName).trim(),
      email: String(req.body.email).trim().toLowerCase(),
      password: String(req.body.password),
      age: Number(req.body.age),
      height: Number(req.body.height),
      weight: Number(req.body.weight),
      bloodType: String(req.body.bloodType).trim(),
      gender: String(req.body.gender).trim(),
      phoneNumber: String(req.body.phoneNumber).trim(),
      city: String(req.body.city).trim(),
      emergencyContactName: String(req.body.emergencyContactName).trim(),
      emergencyPhone: String(req.body.emergencyPhone).trim(),
    };

    if (payload.password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    if (!Number.isFinite(payload.age) || payload.age <= 0) {
      return res.status(400).json({ message: "Age must be a valid number" });
    }

    if (!Number.isFinite(payload.height) || payload.height <= 0) {
      return res.status(400).json({ message: "Height must be a valid number" });
    }

    if (!Number.isFinite(payload.weight) || payload.weight <= 0) {
      return res.status(400).json({ message: "Weight must be a valid number" });
    }

    const existingPatient = await Patient.findOne({ email: payload.email });
    if (existingPatient) {
      return res
        .status(409)
        .json({ message: "Patient already registered with this email" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(payload.password, salt);
    const patientId = await generateUniqueId(Patient, "patientId", "PAT");

    const patient = await Patient.create({
      patientId,
      ...payload,
      password: hashedPassword,
    });

    const token = jwt.sign(
      { userId: patient._id, role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    return res.status(201).json({
      message: "Patient registered successfully",
      token,
      patient: formatPatientAuthResponse(patient),
    });
  } catch (error) {
    console.error("Patient Signup Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const patientLogin = async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const patient = await Patient.findOne({ email });
    if (!patient) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, patient.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: patient._id, role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      patient: formatPatientAuthResponse(patient),
    });
  } catch (error) {
    console.error("Patient Login Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
