const SPECIALIST_LABELS = {
  general_physician: "General Physician",
  dermatologist: "Dermatologist",
  cardiologist: "Cardiologist",
  neurologist: "Neurologist",
  orthopedic: "Orthopedic",
  gastroenterologist: "Gastroenterologist",
  endocrinologist: "Endocrinologist",
  psychiatrist: "Psychiatrist",
  pulmonologist: "Pulmonologist",
  ent_specialist: "ENT Specialist",
};

const SPECIALIST_ALIASES = {
  general_physician: [
    "general_physician",
    "general physician",
    "general_practitioner",
    "general practitioner",
    "general doctor",
    "physician",
    "internal medicine",
    "family medicine",
  ],
  dermatologist: ["dermatologist", "dermatology", "skin specialist"],
  cardiologist: ["cardiologist", "cardiology", "heart specialist"],
  neurologist: ["neurologist", "neurology", "neuro specialist"],
  orthopedic: [
    "orthopedic",
    "orthopaedic",
    "orthopedics",
    "orthopaedics",
    "ortho",
    "bone specialist",
  ],
  gastroenterologist: [
    "gastroenterologist",
    "gastro",
    "gastroenterology",
    "gi specialist",
  ],
  endocrinologist: ["endocrinologist", "endocrinology", "hormone specialist"],
  psychiatrist: ["psychiatrist", "psychiatry", "mental health specialist"],
  pulmonologist: ["pulmonologist", "pulmonology", "chest specialist"],
  ent_specialist: [
    "ent_specialist",
    "ent specialist",
    "ent",
    "ear nose throat",
    "otolaryngologist",
  ],
};

const SPECIALIST_LOOKUP = Object.entries(SPECIALIST_ALIASES).reduce(
  (acc, [canonical, aliases]) => {
    aliases.forEach((alias) => {
      acc[alias] = canonical;
    });
    return acc;
  },
  {},
);

const sanitize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");

export const normalizeSpecialist = (value) => {
  const sanitized = sanitize(value);
  if (!sanitized) return "";
  return SPECIALIST_LOOKUP[sanitized] || "";
};

export const getSpecialistLabel = (specialist) => {
  const normalized = normalizeSpecialist(specialist);
  return SPECIALIST_LABELS[normalized] || SPECIALIST_LABELS.general_physician;
};

export const getAllowedSpecialists = () => Object.keys(SPECIALIST_LABELS);
