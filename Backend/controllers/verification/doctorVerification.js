import Doctor from "../../Schema/doctorSchema.js";
import cloudinary from "../../config/cloudinary.js";

const REQUIRED_TEXT_FIELDS = [
  "registrationCouncil",
  "registrationNumber",
  "registrationYear",
  "highestDegree",
  "universityName",
  "govtIdType",
  "govtIdNumber",
];

const REQUIRED_DOCUMENT_FIELDS = [
  "licenseDocument",
  "degreeDocument",
  "idDocument",
  "selfieDocument",
];

const ALLOWED_GOVT_ID_TYPES = new Set([
  "Aadhaar",
  "PAN",
  "Passport",
  "Voter ID",
]);

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
};

const getSingleFile = (files, fieldName) => {
  const list = files?.[fieldName] || [];
  return list[0] || null;
};

const uploadBufferToCloudinary = (file, folder) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }

        resolve({
          originalName: file.originalname,
          mimeType: file.mimetype,
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format || "",
          bytes: Number(result.bytes || 0),
        });
      },
    );

    uploadStream.end(file.buffer);
  });

const sanitizePayload = (body) => ({
  registrationCouncil: String(body?.registrationCouncil || "").trim(),
  registrationNumber: String(body?.registrationNumber || "").trim(),
  registrationYear: String(body?.registrationYear || "").trim(),
  highestDegree: String(body?.highestDegree || "").trim(),
  universityName: String(body?.universityName || "").trim(),
  govtIdType: String(body?.govtIdType || "").trim(),
  govtIdNumber: String(body?.govtIdNumber || "").trim(),
  acceptDeclaration: toBoolean(body?.acceptDeclaration),
  acceptTerms: toBoolean(body?.acceptTerms),
});

const getVerificationResponse = (doctor) => ({
  doctorId: doctor._id,
  doctorEmail: doctor.email,
  status: doctor.verificationStatus,
  reviewReason: doctor.verificationReviewReason,
  section3: {
    registrationCouncil: doctor.verificationDetails?.registrationCouncil || "",
    registrationNumber: doctor.verificationDetails?.registrationNumber || "",
    registrationYear: doctor.verificationDetails?.registrationYear || "",
    highestDegree: doctor.verificationDetails?.highestDegree || "",
    universityName: doctor.verificationDetails?.universityName || "",
    govtIdType: doctor.verificationDetails?.govtIdType || "Aadhaar",
    govtIdNumber: doctor.verificationDetails?.govtIdNumber || "",
  },
  documents: doctor.verificationDetails?.documents || {},
  declaration: {
    accepted: Boolean(doctor.verificationDetails?.declarationAcceptedAt),
    acceptedTerms: Boolean(doctor.verificationDetails?.termsAcceptedAt),
    acceptedAt: doctor.verificationDetails?.declarationAcceptedAt || null,
  },
  submittedAt: doctor.verificationSubmittedAt,
  reviewedAt: doctor.verificationReviewedAt,
  updatedAt: doctor.updatedAt,
});

export const submitDoctorVerification = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.doctor._id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const payload = sanitizePayload(req.body);
    const missingFields = REQUIRED_TEXT_FIELDS.filter(
      (field) => !payload[field],
    );
    if (missingFields.length) {
      return res.status(400).json({
        message: "All verification fields are required",
        missingFields,
      });
    }

    if (!ALLOWED_GOVT_ID_TYPES.has(payload.govtIdType)) {
      return res.status(400).json({
        message: "Invalid govtIdType",
        allowedGovtIdTypes: Array.from(ALLOWED_GOVT_ID_TYPES),
      });
    }

    if (!payload.acceptDeclaration || !payload.acceptTerms) {
      return res.status(400).json({
        message: "acceptDeclaration and acceptTerms must be true",
      });
    }

    const existingDocuments = doctor.verificationDetails?.documents || {};
    const documents = { ...existingDocuments };

    for (const field of REQUIRED_DOCUMENT_FIELDS) {
      const file = getSingleFile(req.files, field);
      if (file) {
        documents[field] = await uploadBufferToCloudinary(
          file,
          `veda/doctor-verification/${doctor.doctorId || doctor._id}`,
        );
      }
    }

    const missingDocuments = REQUIRED_DOCUMENT_FIELDS.filter(
      (field) => !documents?.[field]?.url,
    );

    if (missingDocuments.length) {
      return res.status(400).json({
        message: "All verification documents are required",
        missingFields: missingDocuments,
      });
    }

    doctor.verificationDetails = {
      registrationCouncil: payload.registrationCouncil,
      registrationNumber: payload.registrationNumber,
      registrationYear: payload.registrationYear,
      highestDegree: payload.highestDegree,
      universityName: payload.universityName,
      govtIdType: payload.govtIdType,
      govtIdNumber: payload.govtIdNumber,
      declarationAcceptedAt: new Date(),
      termsAcceptedAt: new Date(),
      documents,
    };

    doctor.verificationStatus = "pending";
    doctor.verificationReviewReason = "";
    doctor.verificationSubmittedAt = new Date();
    doctor.verificationReviewedAt = null;
    doctor.isVerified = false;

    await doctor.save();

    return res.status(201).json({
      message: "Doctor verification submitted successfully",
      verification: getVerificationResponse(doctor),
    });
  } catch (error) {
    console.error("Submit Doctor Verification Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMyDoctorVerification = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.doctor._id).select("-password");
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    return res.status(200).json({
      message: "Doctor verification fetched successfully",
      verification: getVerificationResponse(doctor),
    });
  } catch (error) {
    console.error("Get My Doctor Verification Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const listDoctorVerificationApplications = async (req, res) => {
  try {
    const status = String(req.query?.status || "all").trim();
    const query = {};

    if (status && status !== "all") {
      query.verificationStatus = status;
    }

    const doctors = await Doctor.find(query)
      .select("-password")
      .sort({ verificationSubmittedAt: -1, createdAt: -1 })
      .lean();

    const items = doctors.map((doctor) => ({
      doctor: {
        _id: doctor._id,
        doctorId: doctor.doctorId,
        fullName: doctor.fullName,
        email: doctor.email,
        specialization: doctor.specialization,
        phoneNumber: doctor.phoneNumber,
        clinicAddress: doctor.clinicAddress,
        clinicName: doctor.clinicName,
        city: doctor.city,
        experience: doctor.experience,
        licenseNumber: doctor.licenseNumber,
        verificationStatus: doctor.verificationStatus,
        verificationReviewReason: doctor.verificationReviewReason,
        isVerified: doctor.isVerified,
      },
      verification: getVerificationResponse(doctor),
    }));

    return res.status(200).json({
      message: "Doctor verification applications fetched successfully",
      count: items.length,
      items,
    });
  } catch (error) {
    console.error(
      "List Doctor Verification Applications Error:",
      error.message,
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const reviewDoctorVerification = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const status = String(req.body?.status || "").trim();
    const reviewReason = String(req.body?.reviewReason || "").trim();

    if (!["verified", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: "status must be either verified or rejected" });
    }

    if (status === "rejected" && !reviewReason) {
      return res
        .status(400)
        .json({ message: "reviewReason is required for rejected status" });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctor.verificationStatus === "not_submitted") {
      return res
        .status(409)
        .json({ message: "Doctor has not submitted verification yet" });
    }

    doctor.verificationStatus = status;
    doctor.verificationReviewReason = status === "rejected" ? reviewReason : "";
    doctor.verificationReviewedAt = new Date();
    doctor.isVerified = status === "verified";

    await doctor.save();

    return res.status(200).json({
      message: `Doctor verification ${status}`,
      verification: getVerificationResponse(doctor),
    });
  } catch (error) {
    console.error("Review Doctor Verification Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
