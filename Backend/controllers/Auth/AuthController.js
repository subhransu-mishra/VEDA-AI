import Doctor from "../../Schema/doctorSchema.js";
import Patient from "../../Schema/patientSchema.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ─── Doctor Signup ───────────────────────────────────────────────────────────
export const doctorSignup = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      specialization,
      experience,
      phoneNumber,
      clinicAddress,
      licenseNumber,
      clinicName,
      city,
    } = req.body;

    // Validate required fields
    if (
      !fullName ||
      !email ||
      !password ||
      !specialization ||
      !experience ||
      !phoneNumber ||
      !clinicAddress ||
      !licenseNumber ||
      !clinicName ||
      !city
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if doctor already exists
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res
        .status(409)
        .json({ message: "Doctor already registered with this email" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create doctor
    const doctor = await Doctor.create({
      fullName,
      email,
      password: hashedPassword,
      specialization,
      experience,
      phoneNumber,
      clinicAddress,
      licenseNumber,
      clinicName,
      city,
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
      doctor: {
        id: doctor._id,
        fullName: doctor.fullName,
        email: doctor.email,
        specialization: doctor.specialization,
      },
    });
  } catch (error) {
    console.error("Doctor Signup Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// ─── Doctor Login ─────────────────────────────────────────────────────────────
export const doctorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

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
      doctor: {
        id: doctor._id,
        fullName: doctor.fullName,
        email: doctor.email,
        specialization: doctor.specialization,
      },
    });
  } catch (error) {
    console.error("Doctor Login Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// ─── Patient Signup / Login (TODO) ───────────────────────────────────────────
export const patientSignup = () => {};
export const patientLogin = () => {};
