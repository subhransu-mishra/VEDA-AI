import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error("Only PDF and image files are allowed"), false);
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 4,
  },
});

const wrapUpload = (multerFn) => (req, res, next) => {
  multerFn(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

export const uploadDoctorVerificationDocuments = wrapUpload(
  upload.fields([
    { name: "licenseDocument", maxCount: 1 },
    { name: "degreeDocument", maxCount: 1 },
    { name: "idDocument", maxCount: 1 },
    { name: "selfieDocument", maxCount: 1 },
  ]),
);
