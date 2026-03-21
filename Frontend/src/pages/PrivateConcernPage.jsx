import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
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
      "For exposure concerns, unusual discharge, sores, itching, intimacy-related pain, or symptoms that feel hard to say directly.",
    prompts: [
      "Burning or irritation",
      "Unusual discharge",
      "Pain during intimacy",
      "Sores or bumps",
      "Exposure concern",
    ],
  },
  {
    id: "reproductive_health",
    title: "Reproductive health",
    detail:
      "For period changes, pelvic pain, pregnancy-linked symptoms, fertility worries, or hormonal changes that need calm review.",
    prompts: [
      "Period delay or change",
      "Pelvic pain",
      "Pregnancy concern",
      "Heavy bleeding",
      "Hormonal symptoms",
    ],
  },
  {
    id: "urinary_intimate_pain",
    title: "Urinary or intimate pain",
    detail:
      "For burning, swelling, pressure, trouble passing urine, or pain in areas patients often avoid describing clearly.",
    prompts: [
      "Burning while urinating",
      "Frequent urge",
      "Swelling or pressure",
      "Trouble passing urine",
      "Lower abdominal pain",
    ],
  },
  {
    id: "skin_sensitive",
    title: "Skin or private-area changes",
    detail:
      "For rashes, itching, bumps, irritation, or visible skin changes in intimate or sensitive areas.",
    prompts: [
      "Rash or redness",
      "Itching",
      "Bumps or spots",
      "Dryness or peeling",
      "Sudden skin change",
    ],
  },
  {
    id: "other_private",
    title: "Describe it yourself",
    detail:
      "Use your own words if none of the guided categories match your concern closely enough.",
    prompts: [
      "It feels unusual",
      "It started suddenly",
      "It is getting worse",
      "It feels private to explain",
      "I need guidance first",
    ],
  },
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
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(PRIVATE_DRAFT_KEY) || "null");
  } catch {
    return null;
  }
};

const writeDraft = (value) => {
  if (typeof window === "undefined") return;
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

  const durationUnitOptions = useMemo(
    () => [
      { value: "minutes", label: tr("privateConcernPage.duration.minutes", "Minutes") },
      { value: "hours", label: tr("privateConcernPage.duration.hours", "Hours") },
      { value: "days", label: tr("privateConcernPage.duration.days", "Days") },
    ],
    [t],
  );

  const [selectedConcern, setSelectedConcern] = useState("sexual_health");
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [durationValue, setDurationValue] = useState("1");
  const [durationUnit, setDurationUnit] = useState("days");
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
    setSelectedPrompts(Array.isArray(draft.selectedPrompts) ? draft.selectedPrompts : []);
    setDurationValue(String(draft.durationValue || "1"));
    setDurationUnit(draft.durationUnit || "days");
    setSeverity(Number(draft.severity) || 4);
    setSymptoms(draft.symptoms || "");
    setNotes(draft.notes || "");
    setContactPreference(draft.contactPreference || "chat_first");
    setNeedsDoctorSoon(typeof draft.needsDoctorSoon === "boolean" ? draft.needsDoctorSoon : true);
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

  const selectedConcernMeta = concernTypes.find((item) => item.id === selectedConcern) || concernTypes[0];

  useEffect(() => {
    setSelectedPrompts((prev) => prev.filter((item) => selectedConcernMeta.prompts.includes(item)));
  }, [selectedConcernMeta]);

  const formattedDuration = useMemo(() => {
    const rawValue = String(durationValue || "").trim();
    if (!rawValue) return "";
    const unitOption = durationUnitOptions.find((option) => option.value === durationUnit);
    const label = unitOption?.label || durationUnit || "";
    return `${rawValue} ${label}`.trim();
  }, [durationUnit, durationUnitOptions, durationValue]);

  const progressScore = useMemo(() => {
    let score = 0;
    if (selectedConcern) score += 1;
    if (selectedPrompts.length) score += 1;
    if (formattedDuration) score += 1;
    if (severity > 0) score += 1;
    if (symptoms.trim()) score += 2;
    if (notes.trim()) score += 1;
    if (redFlags.length) score += 1;
    return Math.min(100, Math.round((score / 8) * 100));
  }, [formattedDuration, notes, redFlags.length, selectedConcern, selectedPrompts.length, severity, symptoms]);

  const activeStage = useMemo(() => {
    if (!selectedConcern) return 1;
    if (!selectedPrompts.length && !symptoms.trim()) return 2;
    if (!formattedDuration) return 3;
    return 4;
  }, [formattedDuration, selectedConcern, selectedPrompts.length, symptoms]);

  const assessment = useMemo(() => {
    const symptomText = `${selectedPrompts.join(" ")} ${symptoms} ${notes}`.toLowerCase();
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
      "swelling rapidly",
    ].some((term) => symptomText.includes(term));

    const emergencyScore =
      (redFlags.length >= 2 ? 2 : 0) +
      (severity >= 8 ? 2 : severity >= 6 ? 1 : 0) +
      (hasCriticalKeyword ? 2 : 0);

    if (emergencyScore >= 4) {
      return {
        tone: "emergency",
        title: tr("privateConcernPage.assessment.emergencyTitle", "Urgent red flags detected"),
        body: tr("privateConcernPage.assessment.emergencyBody", "Your details suggest you should seek urgent medical help now, especially if symptoms are worsening or you feel unsafe."),
        tag: tr("privateConcernPage.assessment.emergencyTag", "Act now"),
        ring: "border-red-200 bg-red-50 text-red-800",
        chip: "bg-red-100 text-red-700 border-red-200",
      };
    }

    if (redFlags.length > 0 || severity >= 6 || needsDoctorSoon) {
      return {
        tone: "priority",
        title: tr("privateConcernPage.assessment.priorityTitle", "Priority review recommended"),
        body: tr("privateConcernPage.assessment.priorityBody", "This concern deserves timely review. A doctor consultation within the next day would be a safer next step."),
        tag: tr("privateConcernPage.assessment.priorityTag", "Doctor soon"),
        ring: "border-amber-200 bg-amber-50 text-amber-900",
        chip: "bg-amber-100 text-amber-700 border-amber-200",
      };
    }

    return {
      tone: "guided",
      title: tr("privateConcernPage.assessment.guidedTitle", "Private guidance is a good start"),
      body: tr("privateConcernPage.assessment.guidedBody", "You do not show strong urgent red flags yet, but you should keep monitoring changes and continue with a diagnosis review if symptoms persist."),
      tag: tr("privateConcernPage.assessment.guidedTag", "Monitor closely"),
      ring: "border-emerald-200 bg-emerald-50 text-emerald-900",
      chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }, [needsDoctorSoon, notes, redFlags.length, severity, selectedPrompts, symptoms, t]);

  const summary = useMemo(() => {
    const patientName = session?.name || patientProfile?.fullName || "Patient";
    const redFlagLine = redFlags.length ? redFlags.join(", ") : "None selected";
    const cueLine = selectedPrompts.length ? selectedPrompts.join(", ") : "No guided cues selected";
    const symptomLine = symptoms.trim() || "Not entered yet";
    const notesLine = notes.trim() || "No extra notes";
    const doctorLine = needsDoctorSoon ? "Patient would like timely doctor review." : "Patient prefers a calmer first review unless urgency increases.";
    return [
      `Private concern summary for ${patientName}`,
      `Concern type: ${selectedConcernMeta.title}`,
      `Guided cues selected: ${cueLine}`,
      `Duration: ${formattedDuration || "Not specified"}`,
      `Severity: ${severity}/10`,
      `Preferred support style: ${contactPreference.replaceAll("_", " ")}`,
      `Red flags: ${redFlagLine}`,
      `Primary description: ${symptomLine}`,
      `Additional notes: ${notesLine}`,
      doctorLine,
      `Current assessment: ${assessment.title}`,
    ].join("\n");
  }, [assessment.title, contactPreference, formattedDuration, needsDoctorSoon, notes, patientProfile?.fullName, redFlags, selectedConcernMeta.title, selectedPrompts, session?.name, severity, symptoms]);

  const togglePrompt = (prompt) => {
    setSelectedPrompts((prev) =>
      prev.includes(prompt) ? prev.filter((item) => item !== prompt) : [...prev, prompt],
    );
  };

  const toggleRedFlag = (flag) => {
    setRedFlags((prev) =>
      prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag],
    );
  };

  const saveDraft = () => {
    writeDraft({
      selectedConcern,
      selectedPrompts,
      durationValue,
      durationUnit,
      severity,
      symptoms,
      notes,
      contactPreference,
      needsDoctorSoon,
      redFlags,
      updatedAt: new Date().toISOString(),
    });
    setSavedMessage(tr("privateConcernPage.saved", "Private draft saved on this device."));
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const supportOptions = [
    { value: "chat_first", label: tr("privateConcernPage.support.chatFirst", "Chat first, then doctor"), detail: tr("privateConcernPage.support.chatFirstBody", "Start gently and decide the next step after AI review.") },
    { value: "doctor_direct", label: tr("privateConcernPage.support.doctorDirect", "Doctor review directly"), detail: tr("privateConcernPage.support.doctorDirectBody", "You already know you want a faster clinical review.") },
    { value: "gentle_guidance", label: tr("privateConcernPage.support.gentleGuidance", "Gentle guidance before deciding"), detail: tr("privateConcernPage.support.gentleGuidanceBody", "Keep the tone calmer before choosing consultation.") },
  ];

  const onAnalyze = async () => {
    if (!symptoms.trim() && !selectedPrompts.length) {
      setAnalysisError(tr("privateConcernPage.errors.primaryRequired", "Please select guided cues or describe the concern before running private analysis."));
      return;
    }

    if (!session?.token) {
      setAnalysisError(tr("privateConcernPage.errors.sessionExpired", "Please log in as a patient to run private analysis."));
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
      symptoms: [
        `${selectedConcernMeta.title}`,
        selectedPrompts.length ? `Guided cues: ${selectedPrompts.join(", ")}` : "",
        symptoms.trim() ? `Patient description: ${symptoms.trim()}` : "",
      ].filter(Boolean).join(". "),
      symptomDuration: formattedDuration || tr("analysisPage.duration.fallback", "Not specified"),
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
      ].filter(Boolean).join("\n"),
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
      const response = await analysisApi.analyzeCase({ token: session.token, payload, reports: [] });
      const structuredReport = response?.analysis || {};
      const topCondition = structuredReport?.conditionAnalysis?.possibleConditions?.[0]?.name || tr("analysisPage.notEnoughData", "Not enough data");
      const topCause = structuredReport?.conditionAnalysis?.possibleCauses?.[0] || tr("analysisPage.causeNotIdentified", "Cause not clearly identified");
      const testPreview = (structuredReport?.recommendedResolution?.testsToConsider || []).slice(0, 2).join(", ");

      const ai = {
        model: "gemini-1.5-flash",
        summary: structuredReport?.summary || tr("analysisPage.aiTriageCompleted", "AI triage completed. Please consult a doctor for confirmation."),
        urgency: structuredReport?.urgency || "moderate",
        recommendedDoctor: structuredReport?.recommendedSpecialist || tr("analysisPage.generalPhysician", "General Physician"),
        keyPoints: [
          tr("analysisPage.keyPoints.topPossibility", "Top possibility: {{value}}", { value: topCondition }),
          tr("analysisPage.keyPoints.likelyCause", "Likely cause: {{value}}", { value: topCause }),
          tr("analysisPage.keyPoints.emergencyLevel", "Emergency level: {{value}}", { value: structuredReport?.emergencyAssessment?.level || "moderate" }),
          tr("analysisPage.keyPoints.tests", "Tests: {{value}}", { value: testPreview || tr("analysisPage.noSpecificTestsSuggested", "No specific tests suggested") }),
        ],
        report: structuredReport,
      };

      const created = createAnalysisCase({
        session,
        form: {
          age: payload.age || "",
          gender: payload.gender || "",
          symptoms: payload.symptoms,
          duration: payload.symptomDuration,
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
          timeline: [{ status: response?.case?.status || "ai_completed", label: tr("analysisPage.status.aiCompleted", "AI completed"), at: new Date().toISOString() }],
        },
        chat: [{ id: makeChatId(), role: "ai", text: tr("analysisPage.aiIntro", "I analyzed your details. {{summary}}", { summary: ai.summary }), createdAt: new Date().toISOString() }],
      });

      setCreatedCase(created);
      saveDraft();
      setReportOpen(true);
    } catch (error) {
      setAnalysisError(error?.message || tr("privateConcernPage.errors.failedAnalyze", "Private analysis could not be completed right now."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,#eff6ff_0%,#f9fcff_46%,#edf8f3_100%)] text-slate-900">
      <div className="pointer-events-none absolute -left-28 top-10 h-80 w-80 rounded-full bg-sky-400/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full bg-emerald-300/20 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,#2f78d9_1px,transparent_1px),linear-gradient(to_bottom,#2f78d9_1px,transparent_1px)] [background-size:4.5rem_4.5rem]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: easeSmooth }} className="rounded-[2rem] border border-white/70 bg-white/72 p-5 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.42)] backdrop-blur-2xl sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                <LockKeyhole size={13} />
                {tr("privateConcernPage.label", "Sensitive Care")}
              </div>
              <h1 className="mt-4 bg-[linear-gradient(90deg,#0f172a,#1d4ed8,#15803d)] bg-clip-text text-3xl font-bold text-transparent sm:text-4xl lg:text-[3.2rem]">
                {tr("privateConcernPage.title", "Private Health Check")}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                {tr("privateConcernPage.subtitle", "This is a disclosure-first flow for concerns people often hesitate to describe directly. Choose what feels closest, answer gently guided prompts, then run the same medical analysis pipeline without jumping to the general diagnosis form.")}
              </p>
            </div>
            <div className="rounded-[1.8rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.45)]">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>{tr("privateConcernPage.privateMode", "Private mode active")}</span>
                <span>{progressScore}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#2f78d9,#22a37a)]" style={{ width: `${progressScore}%` }} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[tr("privateConcernPage.stage.concern", "Concern"), tr("privateConcernPage.stage.guided", "Guided prompts"), tr("privateConcernPage.stage.context", "Timing + context"), tr("privateConcernPage.stage.summary", "Summary")].map((label, index) => (
                  <FlowMarker key={label} label={label} active={activeStage >= index + 1} current={activeStage === index + 1} />
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {session?.name || patientProfile?.fullName ? `${tr("privateConcernPage.welcomeBack", "Preparing a confidential draft for")} ${session?.name || patientProfile?.fullName}.` : tr("privateConcernPage.noIdentityNeeded", "You can complete this draft quietly before moving into diagnosis.")}
              </p>
            </div>
          </div>
        </motion.section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <motion.form onSubmit={(event) => { event.preventDefault(); void onAnalyze(); }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.03, ease: easeSmooth }} className="rounded-[2rem] border border-white/70 bg-white/76 p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.42)] backdrop-blur-2xl sm:p-6">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="h-px w-8 bg-[linear-gradient(90deg,#94a3b8,transparent)]" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">{tr("privateConcernPage.intakeLabel", "Private Intake Flow")}</p>
            </div>

            <section className="mt-6">
              <SectionLead eyebrow={tr("privateConcernPage.stepOne", "Step 1")} title={tr("privateConcernPage.chooseConcern", "Choose what feels closest")} body={tr("privateConcernPage.chooseConcernBody", "Start with a category, not a blank form. This is the main difference from the standard diagnosis page.")} />
              <div className="mt-5 flex flex-wrap gap-3">
                {concernTypes.map((concern) => {
                  const Icon = concernIcons[concern.id] || MessageSquareText;
                  const active = selectedConcern === concern.id;
                  return (
                    <button key={concern.id} type="button" onClick={() => setSelectedConcern(concern.id)} className={`group inline-flex items-center gap-3 rounded-full border px-4 py-3 text-left transition ${active ? "border-slate-900 bg-slate-900 text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.76)]" : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300"}`}>
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${active ? "bg-white/12 text-white" : "bg-slate-100 text-slate-700"}`}><Icon size={16} /></span>
                      <span>
                        <span className="block text-sm font-semibold">{concern.title}</span>
                        <span className={`block text-xs ${active ? "text-white/72" : "text-slate-500"}`}>{tr("privateConcernPage.tapToSelect", "Tap to select")}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <motion.div key={selectedConcernMeta.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: easeSmooth }} className="mt-5 overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_58%,#ecfaf3_100%)] px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{tr("privateConcernPage.selectedConcern", "Selected concern")}</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">{selectedConcernMeta.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{selectedConcernMeta.detail}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700"><Sparkles size={13} />{tr("privateConcernPage.disclosureMode", "Disclosure-first mode")}</div>
                </div>
              </motion.div>
            </section>

            <section className="mt-10 border-t border-slate-200/80 pt-8">
              <SectionLead eyebrow={tr("privateConcernPage.stepTwo", "Step 2")} title={tr("privateConcernPage.guidedPrompts", "Use guided prompts before free text")} body={tr("privateConcernPage.guidedPromptsBody", "Tap the cues that feel true. We will carry them into the summary so you do not need to phrase everything perfectly.")} />
              <div className="mt-5 flex flex-wrap gap-2.5">
                {selectedConcernMeta.prompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => togglePrompt(prompt)} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${selectedPrompts.includes(prompt) ? "border-blue-200 bg-blue-600 text-white shadow-[0_16px_30px_-24px_rgba(37,99,235,0.88)]" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
                    {prompt}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-500">{tr("privateConcernPage.guidedPromptsHint", "This guided layer is what makes the private flow different from the general symptom form. It helps patients disclose sensitive concerns step by step.")}</p>
            </section>

            <section className="mt-10 border-t border-slate-200/80 pt-8">
              <SectionLead eyebrow={tr("privateConcernPage.stepThree", "Step 3")} title={tr("privateConcernPage.contextTitle", "Add timing, intensity, and support preference")} body={tr("privateConcernPage.contextBody", "Give just enough clinical context for urgency review and structured routing.")} />
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-[1.8rem] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tr("privateConcernPage.duration.label", "How long since it started?")}</p>
                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <input type="number" min="0" step="1" value={durationValue} onChange={(event) => setDurationValue(event.target.value)} placeholder={tr("privateConcernPage.duration.placeholder", "Enter time")} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none" />
                    <select value={durationUnit} onChange={(event) => setDurationUnit(event.target.value)} className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none sm:w-32">
                      {durationUnitOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tr("privateConcernPage.severity", "Discomfort severity")}</p>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{severity}/10</span>
                    </div>
                    <input type="range" min="1" max="10" value={severity} onChange={(event) => setSeverity(Number(event.target.value))} className="mt-3 h-2 w-full accent-slate-900" />
                    <div className="mt-3 flex justify-between text-[11px] font-medium text-slate-400">
                      <span>{tr("privateConcernPage.mild", "Mild")}</span>
                      <span>{tr("privateConcernPage.severe", "Severe")}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 rounded-[1.8rem] bg-[linear-gradient(180deg,#ffffff,#f9fcff)] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tr("privateConcernPage.supportStyle", "Preferred support style")}</p>
                  {supportOptions.map((option) => (
                    <button key={option.value} type="button" onClick={() => setContactPreference(option.value)} className={`w-full rounded-[1.2rem] border px-4 py-3 text-left transition ${contactPreference === option.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className={`mt-1 text-xs leading-6 ${contactPreference === option.value ? "text-white/72" : "text-slate-500"}`}>{option.detail}</p>
                    </button>
                  ))}
                  <div className="mt-2 flex items-center justify-between gap-4 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tr("privateConcernPage.doctorSoonLabel", "Doctor preference")}</p>
                      <p className="mt-1 text-sm text-slate-600">{tr("privateConcernPage.doctorSoon", "Would you prefer a doctor to review this soon?")}</p>
                    </div>
                    <button type="button" onClick={() => setNeedsDoctorSoon((prev) => !prev)} className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${needsDoctorSoon ? "bg-slate-900" : "bg-slate-300"}`} aria-pressed={needsDoctorSoon}>
                      <span className={`h-6 w-6 rounded-full bg-white shadow transition ${needsDoctorSoon ? "translate-x-7" : "translate-x-1"}`} />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-10 border-t border-slate-200/80 pt-8">
              <SectionLead eyebrow={tr("privateConcernPage.stepFour", "Step 4")} title={tr("privateConcernPage.describeTitle", "Describe it in your own words")} body={tr("privateConcernPage.describeBody", "Now that the guided layer is done, add anything only you can explain.")} />
              <label className="mt-5 block rounded-[1.8rem] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-5 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tr("privateConcernPage.primaryDescription", "Tell us what is happening")}</span>
                <textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder={tr("privateConcernPage.primaryPlaceholder", "Example: burning, unusual discharge, private-area rash, sudden pelvic pain, or anything you want to describe in your own words.")} className="mt-3 min-h-32 w-full resize-none bg-transparent text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400" />
              </label>
              <label className="mt-4 block rounded-[1.8rem] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-5 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tr("privateConcernPage.extraNotes", "Anything else we should know?")}</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={tr("privateConcernPage.notesPlaceholder", "Mention previous episodes, triggers, medication use, pregnancy concerns, or anything that adds context.")} className="mt-3 min-h-24 w-full resize-none bg-transparent text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400" />
              </label>
            </section>

            <section className="mt-10 border-t border-slate-200/80 pt-8">
              <SectionLead eyebrow={tr("privateConcernPage.stepFive", "Safety check")} title={tr("privateConcernPage.redFlagsTitle", "Mark any red flags")} body={tr("privateConcernPage.redFlagsBody", "These are used for urgency screening. Mark only what truly applies.")} />
              <div className="mt-5 flex flex-wrap gap-2.5">
                {redFlagOptions.map((flag) => {
                  const active = redFlags.includes(flag);
                  return (
                    <button key={flag} type="button" onClick={() => toggleRedFlag(flag)} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${active ? "border-red-200 bg-red-600 text-white shadow-[0_16px_30px_-24px_rgba(220,38,38,0.9)]" : "border-red-100 bg-red-50 text-slate-700 hover:border-red-200"}`}>
                      {flag}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200/80 pt-6">
              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.75)] disabled:opacity-60">
                <Sparkles size={15} />
                {submitting ? tr("privateConcernPage.analyzing", "Running private analysis...") : tr("privateConcernPage.runAnalysis", "Run Private Analysis")}
              </button>
              <button type="button" onClick={saveDraft} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
                <ShieldCheck size={15} />
                {tr("privateConcernPage.saveDraft", "Save private draft")}
              </button>
              <p className="text-sm text-slate-500">{tr("privateConcernPage.footerHint", "Same medical analysis endpoint, but a calmer disclosure-first path.")}</p>
            </div>

            {analysisError ? <p className="mt-4 text-sm font-medium text-red-600">{analysisError}</p> : null}
            {savedMessage ? <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 size={13} />{savedMessage}</p> : null}
          </motion.form>

          <motion.aside initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06, ease: easeSmooth }} className="rounded-[2rem] border border-white/70 bg-white/76 p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.42)] backdrop-blur-2xl sm:p-6">
            <div className="sticky top-6 space-y-4">
              <div className={`overflow-hidden rounded-[1.8rem] border p-5 ${assessment.ring}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${assessment.chip}`}><Clock3 size={12} />{assessment.tag}</div>
                  {assessment.tone === "emergency" ? (
                    <button type="button" onClick={() => navigate("/emergency")} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-[0_18px_38px_-24px_rgba(220,38,38,0.65)]">
                      {tr("privateConcernPage.openEmergency", "Open emergency support")}
                      <ArrowRight size={13} />
                    </button>
                  ) : null}
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">{assessment.title}</h2>
                <p className="mt-2 text-sm leading-7 opacity-90">{assessment.body}</p>
              </div>

              {submitting ? (
                <div className="rounded-[1.8rem] border border-blue-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{tr("privateConcernPage.aiWorking", "AI Working")}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{tr("privateConcernPage.aiWorkingBody", "We are sending your private concern through the same analysis pipeline used for general symptom diagnosis.")}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-1/2 animate-pulse rounded-full bg-[linear-gradient(90deg,#2f78d9,#22a37a)]" /></div>
                </div>
              ) : null}

              {createdCase?.ai ? (
                <div className="rounded-[1.8rem] border border-blue-200 bg-blue-50/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-blue-700">{tr("analysisPage.aiSnapshot", "AI Snapshot")}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">{createdCase.ai.summary}</p>
                    </div>
                    <button type="button" onClick={() => setReportOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700"><Eye size={13} />{tr("analysisPage.viewReports", "View Reports")}</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">{tr("analysisPage.urgency", "Urgency")}: {String(createdCase.ai.urgency || "").toUpperCase()}</span>
                    <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">{createdCase.ai.recommendedDoctor}</span>
                  </div>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)]">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-slate-700"><FileText size={16} /><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{tr("privateConcernPage.summaryLabel", "Doctor-ready summary")}</p></div>
                    <button type="button" onClick={copySummary} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"><Copy size={12} />{copied ? tr("privateConcernPage.copied", "Copied") : tr("privateConcernPage.copy", "Copy")}</button>
                  </div>
                </div>
                <pre className="max-h-[24rem] overflow-y-auto whitespace-pre-wrap px-5 py-4 text-sm leading-7 text-slate-700">{summary}</pre>
              </div>

              <div className="rounded-[1.8rem] bg-slate-900 p-5 text-white">
                <div className="flex items-center gap-2 text-white/70"><UserRound size={15} /><p className="text-xs font-semibold uppercase tracking-[0.16em]">{tr("privateConcernPage.nextStepLabel", "Why this flow is different")}</p></div>
                <p className="mt-3 text-lg font-semibold tracking-[-0.03em]">{tr("privateConcernPage.nextStepTitle", "Standard diagnosis solves analysis. This flow solves disclosure first.")}</p>
                <p className="mt-2 text-sm leading-7 text-white/72">{createdCase?.ai ? tr("privateConcernPage.nextStepBodyAfterAnalysis", "We already saved this private case into your analysis history, so you can continue later without rewriting everything again.") : tr("privateConcernPage.nextStepBody", "People often know something feels wrong but do not know how to phrase it. This flow guides what to say before medical analysis begins.")}</p>
                {createdCase?.backendPublicCaseId ? <p className="mt-3 inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/82">{tr("privateConcernPage.caseId", "Case ID")}: {createdCase.backendPublicCaseId}</p> : null}
              </div>
            </div>
          </motion.aside>
        </div>
      </div>

      {reportOpen && createdCase?.ai?.report ? (
        <div className="fixed inset-0 z-160 grid place-items-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{tr("analysisPage.structuredReport", "AI Structured Report")}</p>
                <h3 className="text-base font-semibold text-slate-900">{selectedConcernMeta.title}</h3>
              </div>
              <button onClick={() => setReportOpen(false)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600"><X size={14} /></button>
            </div>
            <div className="max-h-[calc(88vh-68px)] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{tr("analysisPage.summary", "Summary")}</p>
                <p className="mt-1 text-sm text-slate-700">{createdCase.ai.report.summary}</p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{tr("analysisPage.possibleConditions", "Possible Conditions")}</p>
                <div className="mt-2 space-y-2">
                  {(createdCase.ai.report.conditionAnalysis?.possibleConditions || []).map((item) => (
                    <div key={`${item.name}-${item.likelihood}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">{tr("analysisPage.likelihood", "Likelihood")}: {item.likelihood}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.whyItFits}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{tr("analysisPage.possibleCauses", "Possible Causes")}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">{(createdCase.ai.report.conditionAnalysis?.possibleCauses || []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{tr("analysisPage.emergencyAssessment", "Emergency Assessment")}</p>
                  <p className="mt-2 text-sm font-semibold text-rose-700">{tr("analysisPage.level", "Level")}: {String(createdCase.ai.report.emergencyAssessment?.level || "moderate").toUpperCase()}</p>
                  <p className="mt-2 text-sm text-slate-600">{createdCase.ai.report.emergencyAssessment?.reasoning || tr("analysisPage.pending", "Pending")}</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionLead({ eyebrow, title, body }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-[2rem]">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{body}</p>
    </div>
  );
}

function FlowMarker({ label, active, current }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${active ? current ? "border-slate-900 bg-slate-900 text-white" : "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-400"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-current" : "bg-slate-300"}`} />
      {label}
      {active ? <ChevronRight size={12} /> : null}
    </div>
  );
}
