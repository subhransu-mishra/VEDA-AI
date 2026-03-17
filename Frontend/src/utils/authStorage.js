const SESSION_KEY = "veda_session";
const DOCTORS_KEY = "veda_doctors";
const PATIENTS_KEY = "veda_patients";

const readList = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};

const writeList = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const createSession = ({ user, role, token, fallbackFields = {} }) => ({
  id: user.id,
  token,
  role,
  name: user.fullName,
  email: user.email,
  patientId: user.patientId,
  doctorId: user.doctorId,
  verificationStatus: fallbackFields.verificationStatus,
  loggedInAt: new Date().toISOString(),
});

export const persistSession = (session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const upsertDoctorCache = (doctor) => {
  const doctors = readList(DOCTORS_KEY);
  const nextDoctor = {
    verificationStatus: "not_submitted",
    verificationReviewReason: "",
    ...doctor,
  };

  const nextDoctors = [
    nextDoctor,
    ...doctors.filter(
      (item) => item.email?.toLowerCase() !== doctor.email?.toLowerCase(),
    ),
  ];

  writeList(DOCTORS_KEY, nextDoctors);
  window.dispatchEvent(new Event("veda:doctor-updated"));
  return nextDoctor;
};

export const findDoctorCacheByEmail = (email) => {
  if (!email) return null;
  return readList(DOCTORS_KEY).find(
    (item) => item.email?.toLowerCase() === email.toLowerCase(),
  );
};

export const upsertPatientCache = (patient) => {
  const patients = readList(PATIENTS_KEY);
  const nextPatients = [
    patient,
    ...patients.filter(
      (item) => item.email?.toLowerCase() !== patient.email?.toLowerCase(),
    ),
  ];
  writeList(PATIENTS_KEY, nextPatients);
  return patient;
};

export const findPatientCacheByEmail = (email) => {
  if (!email) return null;
  return readList(PATIENTS_KEY).find(
    (item) => item.email?.toLowerCase() === email.toLowerCase(),
  );
};

export { DOCTORS_KEY, PATIENTS_KEY, SESSION_KEY };
