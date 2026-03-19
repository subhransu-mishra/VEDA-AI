import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const requiredCloudinaryEnvKeys = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missingCloudinaryEnvKeys = requiredCloudinaryEnvKeys.filter(
  (key) => !process.env[key],
);

export const isCloudinaryConfigured = missingCloudinaryEnvKeys.length === 0;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

if (!isCloudinaryConfigured) {
  console.warn(
    `Cloudinary env missing: ${missingCloudinaryEnvKeys.join(", ")}. Upload endpoints will fail until configured.`,
  );
}

export default cloudinary;
