import Doctor from "../models/Doctor.js";
import Consultation from "../models/Consultation.js";
import {
  getSpecialistLabel,
  normalizeSpecialist,
} from "./specialistService.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeRating = (rating) => clamp(Number(rating) || 0, 0, 5) / 5;

const normalizeExperience = (experience, maxExperience) => {
  if (!maxExperience) return 0;
  return clamp(Number(experience) || 0, 0, maxExperience) / maxExperience;
};

export const rankDoctors = (doctors) => {
  const maxExperience = doctors.reduce(
    (max, doctor) => Math.max(max, Number(doctor.experience) || 0),
    0,
  );

  return doctors
    .map((doctor) => {
      const ratingScore = normalizeRating(doctor.rating) * 40;
      const experienceScore =
        normalizeExperience(doctor.experience, maxExperience) * 20;
      const availabilityScore = doctor.availability ? 20 : 0;
      const finalScore = ratingScore + experienceScore + availabilityScore;

      return {
        doctor,
        score: Number(finalScore.toFixed(2)),
      };
    })
    .sort((a, b) => b.score - a.score);
};

export const findMatchingDoctors = async ({
  primarySpecialist,
  onlyAvailable = false,
  limit = 5,
}) => {
  const normalizedSpecialist = normalizeSpecialist(primarySpecialist);
  if (!normalizedSpecialist) {
    return [];
  }

  const query = {
    isVerified: true,
  };

  if (onlyAvailable) {
    query.availability = true;
  }

  const doctors = await Doctor.find(query).lean();
  const specialistDoctors = doctors.filter(
    (doctor) =>
      normalizeSpecialist(doctor.specialization) === normalizedSpecialist,
  );

  const rankedDoctors = rankDoctors(specialistDoctors).slice(0, limit);

  const doctorIds = rankedDoctors.map(({ doctor }) => doctor._id);
  const consultationCounts = doctorIds.length
    ? await Consultation.aggregate([
        {
          $match: {
            doctorId: { $in: doctorIds },
            status: { $in: ["accepted", "completed"] },
          },
        },
        {
          $group: {
            _id: "$doctorId",
            count: { $sum: 1 },
          },
        },
      ])
    : [];

  const countMap = new Map(
    consultationCounts.map((row) => [String(row._id), row.count]),
  );

  return rankedDoctors.map(({ doctor, score }) => ({
    _id: doctor._id,
    doctorId: doctor.doctorId,
    name: doctor.fullName,
    specialization:
      normalizeSpecialist(doctor.specialization) || normalizedSpecialist,
    specializationLabel: getSpecialistLabel(doctor.specialization),
    experience: doctor.experience,
    rating: doctor.rating,
    casesHandled: countMap.get(String(doctor._id)) || 0,
    availability: doctor.availability,
    isVerified: doctor.isVerified,
    score,
  }));
};
