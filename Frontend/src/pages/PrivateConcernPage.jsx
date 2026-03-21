import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FileText,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { analysisApi } from "../api/analysisApi";
import { findPatientCacheByEmail } from "../utils/authStorage";
import { createAnalysisCase } from "../utils/analysisStorage";

const easeSmooth = [0.22, 1, 0.36, 1];
const PRIVATE_DRAFT_KEY = "veda_private_concern_draft";

const concernTypes = [
  {
    id: "sexual_health",
    title: "Sexual health",
    detail:
      "Exposure concerns, discharge, itching, sores, or intimacy-related pain that may feel difficult to explain out loud.",
  },
  {
    id: "reproductive_health",
    title: "Reproductive health",
    detail:
      "Pregnancy-linked changes, period concerns, pelvic discomfort, fertility worries, or hormonal symptoms.",
  },
  {
    id: "urinary_intimate_pain",
    title: "Urinary or intimate pain",
    detail:
      "Burning, swelling, irritation, or discomfort in areas patients often avoid describing directly.",
  },
  {
    id: "skin_sensitive",
    title: "Skin or private-area changes",
    detail:
      "Rashes, bumps, itching, irritation, or visible changes in intimate areas that need review.",
  },
  {
    id: "other_private",
    title: "Describe it yourself",
    detail:
      "Use your own words if none of the guided categories match your concern closely enough.",
  },
];

const durationOptions = [
  "Started today",
  "1-2 days",
  "3-7 days",
  "More than a week",
  "Recurring on and off",
];

const redFlagOptions = [
  "Heavy bleeding",
  "Severe pain getting worse",
  "Fever with private symptoms",
  "Fainting or dizziness",
  "Difficulty passing urine",
  "Recent assault or forced contact",
];

const concernIcons = {
  sexual_health: ShieldCheck,
  reproductive_health: Sparkles,
  urinary_intimate_pain: AlertTriangle,
  skin_sensitive: Stethoscope,
  other_private: MessageSquareText,
};

const readDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(PRIVATE_DRAFT_KEY) || "null");
  } catch {
    return null;
  }
};

const writeDraft = (value) => {
  localStorage.setItem(PRIVATE_DRAFT_KEY, JSON.stringify(value));
};

const makeChatId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const extractPrimarySpecialist = (report) =>
  report?.recommendedResolution?.primarySpecialist ||
  report?.recommended_resolution?.primary_specialist ||
  "";

export default function PrivateConcernPage({ session }) {
  const { t } = useTranslation();
  const tr = (key, defaultValue, options = {}) =>
    t(key, { defaultValue, ...options });
  const navigate = useNavigate();

  const patientProfile = useMemo(
    () => findPatientCacheByEmail(session?.email || "") || null,
    [session?.email],
  );

  const [selectedConcern, setSelectedConcern] = useState("sexual_health");
  const [duration, setDuration] = useState(durationOptions[0]);
  const [severity, setSeverity] = useState(4);
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [contactPreference, setContactPreference] = useState("chat_first");
  const [needsDoctorSoon, setNeedsDoctorSoon] = useState(true);
  const [redFlags, setRedFlags] = useState([]);
  const [savedMessage, setSavedMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [createdCase, setCreatedCase] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;

    setSelectedConcern(draft.selectedConcern || "sexual_health");
    setDuration(draft.duration || durationOptions[0]);
    setSeverity(Number(draft.severity) || 4);
    setSymptoms(draft.symptoms || "");
    setNotes(draft.notes || "");
    setContactPreference(draft.contactPreference || "chat_first");
    setNeedsDoctorSoon(
      typeof draft.needsDoctorSoon === "boolean" ? draft.needsDoctorSoon : true,
    );
    setRedFlags(Array.isArray(draft.redFlags) ? draft.redFlags : []);
  }, []);

  useEffect(() => {
    if (!savedMessage) return;
    const timeoutId = setTimeout(() => setSavedMessage(""), 2600);
    return () => clearTimeout(timeoutId);
  }, [savedMessage]);

  useEffect(() => {
    if (!copied) return;
    const timeoutId = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timeoutId);
  }, [copied]);

  const selectedConcernMeta =
    concernTypes.find((item) => item.id === selectedConcern) || concernTypes[0];

  const progressScore = useMemo(() => {
    let score = 0;
    if (selectedConcern) score += 1;
    if (duration) score += 1;
    if (severity > 0) score += 1;
    if (symptoms.trim()) score += 2;
    if (notes.trim()) score += 1;
    if (contactPreference) score += 1;
    return Math.min(100, Math.round((score / 7) * 100));
  }, [contactPreference, duration, notes, selectedConcern, severity, symptoms]);

  const assessment = useMemo(() => {
    const symptomText = `${symptoms} ${notes}`.toLowerCase();
    const hasCriticalKeyword = [
      "bleeding",
      "faint",
      "unconscious",
      "severe pain",
      "cannot urinate",
      "assault",
      "forced",
      "pregnant and bleeding",
      "breathing",
    ].some((term) => symptomText.includes(term));

    const emergencyScore =
      (redFlags.length >= 2 ? 2 : 0) +
      (severity >= 8 ? 2 : severity >= 6 ? 1 : 0) +
      (hasCriticalKeyword ? 2 : 0);

    if (emergencyScore >= 4) {
      return {
        tone: "emergency",
        title: tr(
          "privateConcernPage.assessment.emergencyTitle",
          "Urgent red flags detected",
        ),
        body: tr(
          "privateConcernPage.assessment.emergencyBody",
          "Your details suggest you should seek urgent medical help now, especially if symptoms are worsening or you feel unsafe.",
        ),
        tag: tr("privateConcernPage.assessment.emergencyTag", "Act now"),
        ring: "border-red-200 bg-red-50 text-red-800",
        chip: "bg-red-100 text-red-700 border-red-200",
      };
    }

    if (redFlags.length > 0 || severity >= 6 || needsDoctorSoon) {
      return {
        tone: "priority",
        title: tr(
          "privateConcernPage.assessment.priorityTitle",
          "Priority review recommended",
        ),
        body: tr(
          "privateConcernPage.assessment.priorityBody",
          "This concern deserves timely review. A doctor consultation within the next day would be a safer next step.",
        ),
        tag: tr("privateConcernPage.assessment.priorityTag", "Doctor soon"),
        ring: "border-amber-200 bg-amber-50 text-amber-900",
        chip: "bg-amber-100 text-amber-700 border-amber-200",
      };
    }

    return {
      tone: "guided",
      title: tr(
        "privateConcernPage.assessment.guidedTitle",
        "Private guidance is a good start",
      ),
      body: tr(
        "privateConcernPage.assessment.guidedBody",
        "Your details do not show strong urgent red flags yet, but you should keep monitoring changes and continue with a diagnosis review if symptoms persist.",
      ),
      tag: tr("privateConcernPage.assessment.guidedTag", "Monitor closely"),
      ring: "border-emerald-200 bg-emerald-50 text-emerald-900",
      chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }, [needsDoctorSoon, notes, redFlags.length, severity, symptoms, t]);

  const summary = useMemo(() => {
    const patientName = session?.name || patientProfile?.fullName || "Patient";
    const redFlagLine = redFlags.length ? redFlags.join(", ") : "None selected";
    const symptomLine = symptoms.trim() || "Not entered yet";
    const notesLine = notes.trim() || "No extra notes";
    const doctorLine = needsDoctorSoon
      ? "Patient would like timely doctor review."
      : "Patient prefers a calmer first review unless urgency increases.";

    return [
      `Private concern summary for ${patientName}`,
      `Concern type: ${selectedConcernMeta.title}`,
      `Duration: ${duration}`,
      `Severity: ${severity}/10`,
      `Preferred support style: ${contactPreference.replaceAll("_", " ")}`,
      `Red flags: ${redFlagLine}`,
      `Primary description: ${symptomLine}`,
      `Additional notes: ${notesLine}`,
      doctorLine,
      `Current assessment: ${assessment.title}`,
    ].join("\n");
  }, [
    assessment.title,
    contactPreference,
    duration,
    needsDoctorSoon,
    notes,
    patientProfile?.fullName,
    redFlags,
    selectedConcernMeta.title,
    session?.name,
    severity,
    symptoms,
  ]);

  const toggleRedFlag = (flag) => {
    setRedFlags((prev) =>
      prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag],
    );
  };

  const saveDraft = () => {
    writeDraft({
      selectedConcern,
      duration,
      severity,
      symptoms,
      notes,
      contactPreference,
      needsDoctorSoon,
      redFlags,
      updatedAt: new Date().toISOString(),
    });
    setSavedMessage(
      tr("privateConcernPage.saved", "Private draft saved on this device."),
    );
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const onAnalyze = async () => {
    if (!symptoms.trim()) {
      setAnalysisError(
        tr(
          "privateConcernPage.errors.primaryRequired",
          "Please describe the concern before running private analysis.",
        ),
      );
      return;
    }

    if (!session?.token) {
      setAnalysisError(
        tr(
          "privateConcernPage.errors.sessionExpired",
          "Please log in as a patient to run private analysis.",
        ),
      );
      return;
    }

    setSubmitting(true);
    setAnalysisError("");

    const supportLabel = {
      chat_first: "Chat first, then doctor",
      doctor_direct: "Doctor review directly",
      gentle_guidance: "Gentle guidance before deciding",
    }[contactPreference] || contactPreference;

    const payload = {
      age: patientProfile?.age || session?.age,
      gender: patientProfile?.gender || session?.gender,
      symptoms: `${selectedConcernMeta.title}: ${symptoms.trim()}`,
      symptomDuration: duration,
      existingConditions: patientProfile?.knownConditions || "",
      medications: patientProfile?.medications || "",
      allergies: patientProfile?.allergiesNotes || "",
      painLevel: severity,
      additionalNotes: [
        `Private concern flow: yes`,
        `Concern detail: ${selectedConcernMeta.detail}`,
        `Preferred support style: ${supportLabel}`,
        `Doctor review preference: ${needsDoctorSoon ? "Soon" : "Not immediately"}`,
        `Red flags selected: ${redFlags.length ? redFlags.join(", ") : "None"}`,
        notes.trim() ? `Additional patient note: ${notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      patientFullName: session?.name || patientProfile?.fullName || "",
      patientEmail: session?.email || patientProfile?.email || "",
      patientId: session?.patientId || patientProfile?.patientId || "",
      patientPhone: patientProfile?.phoneNumber || "",
      patientCity: patientProfile?.city || "",
      bloodType: patientProfile?.bloodType || "",
      emergencyContactName: patientProfile?.emergencyContactName || "",
      emergencyPhone: patientProfile?.emergencyPhone || "",
      primaryConcern: selectedConcernMeta.title,
    };

    try {
      const response = await analysisApi.analyzeCase({
        token: session.token,
        payload,
        reports: [],
      });

      const structuredReport = response?.analysis || {};
      const topCondition =
        structuredReport?.conditionAnalysis?.possibleConditions?.[0]?.name ||
        tr("analysisPage.notEnoughData", "Not enough data");
      const topCause =
        structuredReport?.conditionAnalysis?.possibleCauses?.[0] ||
        tr("analysisPage.causeNotIdentified", "Cause not clearly identified");
      const testPreview = (
        structuredReport?.recommendedResolution?.testsToConsider || []
      )
        .slice(0, 2)
        .join(", ");

      const ai = {
        model: "gemini-1.5-flash",
        summary:
          structuredReport?.summary ||
          tr(
            "analysisPage.aiTriageCompleted",
            "AI triage completed. Please consult a doctor for confirmation.",
          ),
        urgency: structuredReport?.urgency || "moderate",
        recommendedDoctor:
          structuredReport?.recommendedSpecialist ||
          tr("analysisPage.generalPhysician", "General Physician"),
        keyPoints: [
          tr("analysisPage.keyPoints.topPossibility", "Top possibility: {{value}}", {
            value: topCondition,
          }),
          tr("analysisPage.keyPoints.likelyCause", "Likely cause: {{value}}", {
            value: topCause,
          }),
          tr("analysisPage.keyPoints.emergencyLevel", "Emergency level: {{value}}", {
            value: structuredReport?.emergencyAssessment?.level || "moderate",
          }),
          tr("analysisPage.keyPoints.tests", "Tests: {{value}}", {
            value:
              testPreview ||
              tr(
                "analysisPage.noSpecificTestsSuggested",
                "No specific tests suggested",
              ),
          }),
        ],
        report: structuredReport,
      };

      const created = createAnalysisCase({
        session,
        form: {
          age: payload.age || "",
          gender: payload.gender || "",
          symptoms: payload.symptoms,
          duration,
          severity,
          medications: payload.medications,
          allergies: payload.allergies,
          notes: payload.additionalNotes,
          concernType: selectedConcernMeta.title,
          privateConcern: true,
        },
        backendCaseId: response?.case?._id || null,
        backendPublicCaseId: response?.case?.caseId || "",
        uploads: [],
        ai,
        doctorFlow: {
          status: response?.case?.status || "ai_completed",
          specialist: extractPrimarySpecialist(structuredReport),
          specialistLabel: response?.specialistLabel || "",
          doctorName: "",
          consultationId: "",
          timeline: [
            {
              status: response?.case?.status || "ai_completed",
              label: tr("analysisPage.status.aiCompleted", "AI completed"),
              at: new Date().toISOString(),
            },
          ],
        },
        chat: [
          {
            id: makeChatId(),
            role: "ai",
            text: tr("analysisPage.aiIntro", "I analyzed your details. {{summary}}", {
              summary: ai.summary,
            }),
            createdAt: new Date().toISOString(),
          },
        ],
      });

      setCreatedCase(created);
      saveDraft();
      setReportOpen(true);
    } catch (error) {
      setAnalysisError(
        error?.message ||
          tr(
            "privateConcernPage.errors.failedAnalyze",
            "Private analysis could not be completed right now.",
          ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,#e8f4ff_0%,#f8fcff_48%,#edf8f5_100%)] text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-sky-400/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-emerald-300/25 blur-[130px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[radial-gradient(#2f78d9_1px,transparent_1px)] bg-size-[24px_24px]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pt-10">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeSmooth }}
          className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_22px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                <LockKeyhole size={13} />
                {tr("privateConcernPage.label", "Sensitive Care")}
              </div>
              <h1 className="mt-3 bg-linear-to-r from-slate-900 via-blue-800 to-emerald-700 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
                {tr("privateConcernPage.title", "Private Health Check")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                {tr(
                  "privateConcernPage.subtitle",
                  "A more private intake for concerns patients often hesitate to describe. Share only what you are comfortable with, and we will shape the next step with more clarity.",
                )}
              </p>
            </div>

            <div className="min-w-[16rem] rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>{tr("privateConcernPage.privateMode", "Private mode active")}</span>
                <span>{progressScore}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#2f78d9,#22a37a)]"
                  style={{ width: `${progressScore}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {session?.name || patientProfile?.fullName
                  ? `${tr("privateConcernPage.welcomeBack", "Preparing a confidential draft for")} ${session?.name || patientProfile?.fullName}.`
                  : tr(
                      "privateConcernPage.noIdentityNeeded",
                      "You can complete this draft quietly before moving into diagnosis.",
                    )}
              </p>
            </div>
          </div>
        </motion.section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <motion.form
            onSubmit={(event) => {
              event.preventDefault();
              void onAnalyze();
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.03, ease: easeSmooth }}
            className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_22px_55px_-35px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {tr("privateConcernPage.intakeLabel", "Private Intake")}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {tr(
                    "privateConcernPage.intakeSubtitle",
                    "Complete this once. We will keep the wording structured and prepare a cleaner handoff into diagnosis.",
                  )}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                <ShieldCheck size={14} />
                {tr("privateConcernPage.secureDraft", "Secure local draft")}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {tr("privateConcernPage.chooseConcern", "Choose what feels closest")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {concernTypes.map((item) => {
                  const Icon = concernIcons[item.id] || ShieldCheck;
                  const active = selectedConcern === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedConcern(item.id)}
                      className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow-[0_12px_28px_-18px_rgba(15,23,42,0.65)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <Icon size={15} />
                      <span className="truncate">{item.title}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {selectedConcernMeta.detail}
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {tr("privateConcernPage.duration", "How long has this been happening?")}
                </span>
                <select
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
                >
                  {durationOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {tr("privateConcernPage.intensity", "Discomfort level")}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{severity}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={severity}
                  onChange={(event) => setSeverity(Number(event.target.value))}
                  className="mt-3 w-full accent-[#2f78d9]"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {tr("privateConcernPage.supportStyle", "Preferred support style")}
                </span>
                <select
                  value={contactPreference}
                  onChange={(event) => setContactPreference(event.target.value)}
                  className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
                >
                  <option value="chat_first">Chat first, then doctor</option>
                  <option value="doctor_direct">Doctor review directly</option>
                  <option value="gentle_guidance">Gentle guidance before deciding</option>
                </select>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {tr("privateConcernPage.doctorSoonLabel", "Doctor preference")}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {tr(
                        "privateConcernPage.doctorSoon",
                        "Would you prefer a doctor to review this soon?",
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNeedsDoctorSoon((prev) => !prev)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                      needsDoctorSoon ? "bg-slate-900" : "bg-slate-300"
                    }`}
                    aria-pressed={needsDoctorSoon}
                  >
                    <span
                      className={`h-6 w-6 rounded-full bg-white shadow transition ${
                        needsDoctorSoon ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <label className="mt-4 block rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {tr("privateConcernPage.primaryDescription", "Tell us what is happening")}
              </span>
              <textarea
                value={symptoms}
                onChange={(event) => setSymptoms(event.target.value)}
                placeholder={tr(
                  "privateConcernPage.primaryPlaceholder",
                  "Example: burning, unusual discharge, private-area rash, sudden pelvic pain, or any symptom you want to describe in your own words.",
                )}
                className="mt-3 min-h-32 w-full resize-none bg-transparent text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>

            <label className="mt-4 block rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {tr("privateConcernPage.extraNotes", "Anything else we should know?")}
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={tr(
                  "privateConcernPage.notesPlaceholder",
                  "Mention previous episodes, triggers, medication use, pregnancy concerns, or anything that adds context.",
                )}
                className="mt-3 min-h-24 w-full resize-none bg-transparent text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>

            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50/70 px-4 py-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle size={16} />
                <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                  {tr("privateConcernPage.redFlags", "Red flag check")}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {redFlagOptions.map((flag) => {
                  const active = redFlags.includes(flag);
                  return (
                    <button
                      key={flag}
                      type="button"
                      onClick={() => toggleRedFlag(flag)}
                      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "border-red-300 bg-white text-red-700"
                          : "border-red-100 bg-red-50 text-slate-700 hover:border-red-200"
                      }`}
                    >
                      {flag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.72)] disabled:opacity-60"
              >
                <Sparkles size={14} />
                {submitting
                  ? tr("privateConcernPage.analyzing", "Running private analysis...")
                  : tr("privateConcernPage.runAnalysis", "Run Private Analysis")}
              </button>
              <button
                type="button"
                onClick={saveDraft}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <ShieldCheck size={14} />
                {tr("privateConcernPage.saveDraft", "Save private draft")}
              </button>
            </div>

            {analysisError ? (
              <p className="mt-4 text-sm font-medium text-red-600">{analysisError}</p>
            ) : null}
            {savedMessage ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={13} />
                {savedMessage}
              </p>
            ) : null}
          </motion.form>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06, ease: easeSmooth }}
            className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_22px_55px_-35px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
          >
            <div className="sticky top-6 space-y-4">
              <div className={`rounded-2xl border p-4 ${assessment.ring}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${assessment.chip}`}>
                    <Clock3 size={12} />
                    {assessment.tag}
                  </div>
                  {assessment.tone === "emergency" ? (
                    <button
                      type="button"
                      onClick={() => navigate("/emergency")}
                      className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-[0_18px_38px_-24px_rgba(220,38,38,0.65)]"
                    >
                      {tr("privateConcernPage.openEmergency", "Open emergency support")}
                      <ArrowRight size={13} />
                    </button>
                  ) : null}
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
                  {assessment.title}
                </h2>
                <p className="mt-2 text-sm leading-7 opacity-90">{assessment.body}</p>
              </div>

              {submitting ? (
                <div className="rounded-2xl border border-blue-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                    {tr("privateConcernPage.aiWorking", "AI Working")}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {tr(
                      "privateConcernPage.aiWorkingBody",
                      "We are sending your private concern through the same analysis pipeline used for general symptom diagnosis.",
                    )}
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-[linear-gradient(90deg,#2f78d9,#22a37a)]" />
                  </div>
                </div>
              ) : null}

              {createdCase?.ai ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-blue-700">
                        {tr("analysisPage.aiSnapshot", "AI Snapshot")}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {createdCase.ai.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700"
                    >
                      <Eye size={13} />
                      {tr("analysisPage.viewReports", "View Reports")}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {tr("analysisPage.urgency", "Urgency")}: {String(createdCase.ai.urgency || "").toUpperCase()}
                    </span>
                    <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {createdCase.ai.recommendedDoctor}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)]">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-slate-700">
                      <FileText size={16} />
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {tr("privateConcernPage.summaryLabel", "Doctor-ready summary")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={copySummary}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Copy size={12} />
                      {copied
                        ? tr("privateConcernPage.copied", "Copied")
                        : tr("privateConcernPage.copy", "Copy")}
                    </button>
                  </div>
                </div>
                <pre className="max-h-[22rem] overflow-y-auto whitespace-pre-wrap px-4 py-4 text-sm leading-7 text-slate-700">
                  {summary}
                </pre>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white">
                <div className="flex items-center gap-2 text-white/70">
                  <Sparkles size={15} />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                    {tr("privateConcernPage.nextStepLabel", "Next step")}
                  </p>
                </div>
                <p className="mt-3 text-lg font-semibold tracking-[-0.03em]">
                  {createdCase?.ai
                    ? tr(
                        "privateConcernPage.nextStepTitleAfterAnalysis",
                        "Your private concern has already been analyzed.",
                      )
                    : tr(
                        "privateConcernPage.nextStepTitle",
                        "Run analysis here instead of jumping into the general symptom page.",
                      )}
                </p>
                <p className="mt-2 text-sm leading-7 text-white/72">
                  {createdCase?.ai
                    ? tr(
                        "privateConcernPage.nextStepBodyAfterAnalysis",
                        "We saved this case in your analysis history, so you can continue with doctor matching later if needed.",
                      )
                    : tr(
                        "privateConcernPage.nextStepBody",
                        "Once you submit here, we send your concern to the same diagnosis endpoint and keep the result on this page.",
                      )}
                </p>

                {createdCase?.backendPublicCaseId ? (
                  <p className="mt-3 inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/82">
                    {tr("privateConcernPage.caseId", "Case ID")}: {createdCase.backendPublicCaseId}
                  </p>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {reportOpen && createdCase?.ai?.report ? (
        <div className="fixed inset-0 z-160 grid place-items-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  {tr("analysisPage.structuredReport", "AI Structured Report")}
                </p>
                <h3 className="text-base font-semibold text-slate-900">
                  {selectedConcernMeta.title}
                </h3>
              </div>
              <button
                onClick={() => setReportOpen(false)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[calc(88vh-68px)] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  {tr("analysisPage.summary", "Summary")}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {createdCase.ai.report.summary}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  {tr("analysisPage.possibleConditions", "Possible Conditions")}
                </p>
                <div className="mt-2 space-y-2">
                  {(createdCase.ai.report.conditionAnalysis?.possibleConditions || []).map((item) => (
                    <div
                      key={`${item.name}-${item.likelihood}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-2.5"
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">
                        {tr("analysisPage.likelihood", "Likelihood")}: {item.likelihood}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{item.whyItFits}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {tr("analysisPage.possibleCauses", "Possible Causes")}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                    {(createdCase.ai.report.conditionAnalysis?.possibleCauses || []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {tr("analysisPage.emergencyAssessment", "Emergency Assessment")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-rose-700">
                    {tr("analysisPage.level", "Level")}: {String(createdCase.ai.report.emergencyAssessment?.level || "moderate").toUpperCase()}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {createdCase.ai.report.emergencyAssessment?.reasoning ||
                      tr("analysisPage.pending", "Pending")}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  {tr("analysisPage.resolutionPlan", "Resolution Plan")}
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {tr("analysisPage.immediateSteps", "Immediate Steps")}
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
                      {(createdCase.ai.report.recommendedResolution?.immediateSteps || []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {tr("analysisPage.testsToConsider", "Tests To Consider")}
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
                      {(createdCase.ai.report.recommendedResolution?.testsToConsider || []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
