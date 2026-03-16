const ANALYSIS_CASES_KEY = "veda_analysis_cases";

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const readJson = (key, fallback) => {
  if (!canUseStorage()) return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  if (!canUseStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
};

export const getAnalysisCasesForPatient = (patientEmail = "") => {
  const all = readJson(ANALYSIS_CASES_KEY, []);
  const filtered = patientEmail
    ? all.filter(
        (row) =>
          (row.patientEmail || "").toLowerCase() === patientEmail.toLowerCase()
      )
    : all;

  return filtered.sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime()
  );
};

export const createAnalysisCase = ({
  session,
  form,
  uploads = [],
  ai,
  doctorFlow,
  chat = [],
}) => {
  const now = new Date().toISOString();

  const row = {
    id: makeId(),
    patientName: session?.name || "Patient",
    patientEmail: session?.email || "",
    createdAt: now,
    updatedAt: now,
    form,
    uploads,
    ai,
    doctorFlow,
    chat,
  };

  const all = readJson(ANALYSIS_CASES_KEY, []);
  const next = [row, ...all].slice(0, 200);
  writeJson(ANALYSIS_CASES_KEY, next);
  return row;
};

export const updateAnalysisCaseById = (caseId, updater) => {
  const all = readJson(ANALYSIS_CASES_KEY, []);
  let updatedCase = null;

  const next = all.map((row) => {
    if (row.id !== caseId) return row;
    const updated =
      typeof updater === "function" ? updater(row) : { ...row, ...updater };
    updatedCase = { ...updated, updatedAt: new Date().toISOString() };
    return updatedCase;
  });

  writeJson(ANALYSIS_CASES_KEY, next);
  return updatedCase;
};
