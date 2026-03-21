import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  Eye,
  MessageCircle,
  PhoneCall,
  Send,
  Sparkles,
  Stethoscope,
  Upload,
  X,
  UserRound,
} from "lucide-react";
import { Triangle } from "react-loader-spinner";
import { useTranslation } from "react-i18next";
import { analysisApi } from "../api/analysisApi";
import { findPatientCacheByEmail } from "../utils/authStorage";
import {
  createAnalysisCase,
  getAnalysisCasesForPatient,
  updateAnalysisCaseById,
} from "../utils/analysisStorage";

const easeSmooth = [0.22, 1, 0.36, 1];
const Motion = motion;

const STATUS_STEPS = [
  "ai_completed",
  "doctor_requested",
  "doctor_assigned",
  "consultation_active",
  "completed",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const makeChatId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const aiFollowUp = (text, ai, tr) => {
  const q = text.toLowerCase();

  if (q.includes("serious") || q.includes("danger")) {
    return tr(
      "analysisPage.aiReplies.serious",
      "This can be serious depending on symptom progression. If pain increases, breathing issues start, or bleeding appears, seek urgent care.",
    );
  }
  if (q.includes("medicine") || q.includes("tablet")) {
    return tr(
      "analysisPage.aiReplies.medicine",
      "Please avoid self-medication from AI chat alone. Let a doctor confirm medicine based on your case history.",
    );
  }
  if (q.includes("doctor") || q.includes("connect")) {
    return tr(
      "analysisPage.aiReplies.doctor",
      'You can use the "Connect to Doctor" button above. Recommended specialist: {{doctor}}.',
      {
        doctor:
          ai?.recommendedDoctor ||
          tr("analysisPage.generalPhysician", "General Physician"),
      },
    );
  }
  if (q.includes("summary")) {
    return (
      ai?.summary ||
      tr(
        "analysisPage.aiReplies.summary",
        "I can summarize your case after you submit details.",
      )
    );
  }

  return tr(
    "analysisPage.aiReplies.default",
    "I understood. I have added this to your context. If you are ready, connect with a doctor so they receive your complete summary.",
  );
};

const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "");

const extractPrimarySpecialist = (report) =>
  report?.recommendedResolution?.primarySpecialist ||
  report?.recommended_resolution?.primary_specialist ||
  "";

export default function PatientAnalysisPage({ session }) {
  const { t } = useTranslation();
  const tr = (key, defaultValue, options = {}) =>
    t(key, { defaultValue, ...options });

  const navigate = useNavigate();

  const statusLabelMap = useMemo(
    () => ({
      ai_completed: tr("analysisPage.status.aiCompleted", "AI completed"),
      doctor_requested: tr(
        "analysisPage.status.doctorRequested",
        "Doctor requested",
      ),
      doctor_assigned: tr(
        "analysisPage.status.doctorAssigned",
        "Doctor assigned",
      ),
      consultation_active: tr(
        "analysisPage.status.consultationActive",
        "Consultation active",
      ),
      completed: tr("analysisPage.status.completed", "Completed"),
    }),
    [t],
  );

  const loadingTexts = useMemo(
    () => [
      tr("analysisPage.loading.processing", "Processing request..."),
      tr(
        "analysisPage.loading.analyzingSymptoms",
        "AI is analyzing your symptoms...",
      ),
      tr(
        "analysisPage.loading.buildingReport",
        "Building your structured medical report...",
      ),
      tr(
        "analysisPage.loading.preparingSpecialist",
        "Preparing specialist recommendation...",
      ),
    ],
    [t],
  );

  const durationOptions = useMemo(
    () => [
      {
        value: "Less than 24h",
        label: tr("analysisPage.duration.lessThan24h", "Less than 24h"),
      },
      {
        value: "1-2 days",
        label: tr("analysisPage.duration.oneToTwoDays", "1-2 days"),
      },
      {
        value: "3-7 days",
        label: tr("analysisPage.duration.threeToSevenDays", "3-7 days"),
      },
      {
        value: "1+ weeks",
        label: tr("analysisPage.duration.onePlusWeeks", "1+ weeks"),
      },
    ],
    [t],
  );

  const situationOptions = useMemo(
    () => [
      {
        value: "normal",
        label: tr("analysisPage.situation.normal", "Normal"),
      },
      {
        value: "medium",
        label: tr("analysisPage.situation.medium", "Medium"),
      },
      {
        value: "emergency",
        label: tr("analysisPage.situation.emergency", "Emergency"),
      },
    ],
    [t],
  );

  const [form, setForm] = useState({
    age: "",
    gender: "",
    symptoms: "",
    duration: "1-2 days",
    situationLevel: "normal",
    severity: 5,
    medications: "",
    allergies: "",
    notes: "",
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [connectingDoctor, setConnectingDoctor] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [activeCase, setActiveCase] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [matchedDoctors, setMatchedDoctors] = useState([]);
  const [matchedSpecialistLabel, setMatchedSpecialistLabel] = useState("");
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationError, setConsultationError] = useState("");
  const [consultationInfo, setConsultationInfo] = useState(null);
  const [doctorReportOpen, setDoctorReportOpen] = useState(false);
  const [doctorProgressIndex, setDoctorProgressIndex] = useState(0);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  const history = useMemo(() => {
    void refreshTick;
    return getAnalysisCasesForPatient(session?.email || "");
  }, [session?.email, refreshTick]);

  const currentStatus = activeCase?.doctorFlow?.status || "not_started";
  const currentStatusIndex = STATUS_STEPS.indexOf(currentStatus);
  const isDoctorAssigned = [
    "doctor_assigned",
    "consultation_active",
    "completed",
  ].includes(currentStatus);
  const doctorStructuredReport =
    activeCase?.doctorFlow?.doctorStructuredReport || null;
  const isEmergencyFromCase = Boolean(
    activeCase?.ai?.report?.isEmergencyCase ||
    ["high", "critical"].includes(
      String(
        activeCase?.ai?.report?.emergencyAssessment?.level || "",
      ).toLowerCase(),
    ),
  );
  const emergencyContactName =
    activeCase?.ai?.emergencyContactName ||
    activeCase?.ai?.patientEmergencyContactName ||
    "Emergency contact";
  const emergencyContactPhone =
    activeCase?.ai?.emergencyPhone ||
    activeCase?.ai?.patientEmergencyPhone ||
    "112";
  const showDoctorProgress =
    Boolean(activeCase?.doctorFlow?.consultationId) &&
    !doctorStructuredReport &&
    ["doctor_requested", "doctor_assigned", "consultation_active"].includes(
      currentStatus,
    );

  useEffect(() => {
    if (!submitting) {
      setLoadingTextIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % loadingTexts.length);
    }, 1700);

    return () => clearInterval(intervalId);
  }, [submitting, loadingTexts]);

  useEffect(() => {
    if (!showDoctorProgress) {
      setDoctorProgressIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      setDoctorProgressIndex((prev) => (prev + 1) % 3);
    }, 1800);

    return () => clearInterval(intervalId);
  }, [showDoctorProgress]);

  useEffect(() => {
    const consultationId = activeCase?.doctorFlow?.consultationId;
    if (!consultationId || !session?.token) return;

    let mounted = true;

    const mapConsultationStatus = (status) => {
      if (status === "completed") return "completed";
      if (status === "accepted") return "consultation_active";
      if (status === "pending") return "doctor_assigned";
      if (status === "rejected") return "doctor_requested";
      return "doctor_assigned";
    };

    const syncConsultation = async () => {
      try {
        const response = await analysisApi.getConsultationById({
          token: session.token,
          consultationId,
        });

        if (!mounted) return;
        const consultation = response?.consultation;
        if (!consultation) return;

        const nextStatus = mapConsultationStatus(consultation.status);
        const doctorName =
          consultation?.doctorId?.fullName ||
          activeCase?.doctorFlow?.doctorName ||
          "";

        const updated = updateAnalysisCaseById(activeCase.id, (prev) => {
          const prevFlow = prev.doctorFlow || {};
          const lastTimelineStatus = prevFlow.timeline?.length
            ? prevFlow.timeline[prevFlow.timeline.length - 1]?.status
            : "";

          return {
            ...prev,
            doctorFlow: {
              ...prevFlow,
              status: nextStatus,
              doctorName,
              consultationId,
              doctorResponse: consultation?.doctorResponse || null,
              doctorStructuredReport:
                consultation?.doctorStructuredReport ||
                prevFlow.doctorStructuredReport ||
                null,
              timeline:
                lastTimelineStatus === nextStatus
                  ? prevFlow.timeline || []
                  : [
                      ...(prevFlow.timeline || []),
                      {
                        status: nextStatus,
                        label: statusLabelMap[nextStatus],
                        at: new Date().toISOString(),
                      },
                    ],
            },
          };
        });

        if (updated) {
          setActiveCase(updated);
          refresh();
        }

        if (consultation.status === "completed") {
          setConsultationInfo(consultation);
        }
      } catch {
        // Silent polling failure to avoid noisy UI.
      }
    };

    void syncConsultation();
    const interval = setInterval(() => {
      void syncConsultation();
    }, 6000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [
    activeCase?.id,
    activeCase?.doctorFlow?.consultationId,
    session?.token,
    statusLabelMap,
  ]);

  const refresh = () => setRefreshTick((v) => v + 1);

  const appendChat = (role, text) => {
    if (!activeCase?.id || !text.trim()) return null;
    const now = new Date().toISOString();

    const updated = updateAnalysisCaseById(activeCase.id, (prev) => ({
      ...prev,
      chat: [
        ...(prev.chat || []),
        {
          id: makeChatId(),
          role,
          text: text.trim(),
          createdAt: now,
        },
      ],
    }));

    setActiveCase(updated);
    refresh();
    return updated;
  };

  const updateStatus = (status, extra = {}) => {
    if (!activeCase?.id) return;
    const now = new Date().toISOString();

    const updated = updateAnalysisCaseById(activeCase.id, (prev) => ({
      ...prev,
      doctorFlow: {
        ...(prev.doctorFlow || {}),
        ...extra,
        status,
        timeline:
          (prev.doctorFlow?.timeline || []).slice(-1)[0]?.status === status
            ? prev.doctorFlow?.timeline || []
            : [
                ...(prev.doctorFlow?.timeline || []),
                { status, label: statusLabelMap[status], at: now },
              ],
      },
    }));

    setActiveCase(updated);
    refresh();
    return updated;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.symptoms.trim()) return;

    setSubmitting(true);
    setAnalysisError("");
    setEmergencyModalOpen(false);

    const patientProfile = findPatientCacheByEmail(session?.email || "") || {};

    const payload = {
      age: form.age || patientProfile.age || session?.age,
      gender: form.gender || patientProfile.gender || session?.gender,
      symptoms: form.symptoms,
      symptomDuration: form.duration,
      situationLevel: form.situationLevel,
      existingConditions: patientProfile.knownConditions || "",
      medications: form.medications,
      allergies: form.allergies || patientProfile.allergiesNotes || "",
      painLevel: form.severity,
      additionalNotes: form.notes,
      patientFullName: session?.name || patientProfile.fullName || "",
      patientEmail: session?.email || patientProfile.email || "",
      patientId: session?.patientId || patientProfile.patientId || "",
      patientPhone: patientProfile.phoneNumber || "",
      patientCity: patientProfile.city || "",
      bloodType: patientProfile.bloodType || "",
      emergencyContactName: patientProfile.emergencyContactName || "",
      emergencyPhone: patientProfile.emergencyPhone || "",
      primaryConcern: patientProfile.primaryConcern || "",
    };

    if (!session?.token) {
      setAnalysisError(
        tr(
          "analysisPage.errors.sessionExpiredGenerate",
          "Session expired. Please log in again to generate AI diagnosis.",
        ),
      );
      setSubmitting(false);
      return;
    }

    try {
      const response = await analysisApi.analyzeCase({
        token: session?.token,
        payload,
        reports: selectedFiles,
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

      const uploads = selectedFiles.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }));

      const ai = {
        model: "gemini-1.5-flash",
        summary:
          structuredReport?.summary ||
          tr(
            "analysisPage.aiTriageCompleted",
            "AI triage completed. Please consult a doctor for confirmation.",
          ),
        urgency: structuredReport?.urgency || "moderate",
        patientReportedSituation:
          structuredReport?.patientReportedSituation || form.situationLevel,
        isEmergencyCase: Boolean(
          structuredReport?.isEmergencyCase ||
          ["high", "critical"].includes(
            String(
              structuredReport?.emergencyAssessment?.level || "",
            ).toLowerCase(),
          ),
        ),
        emergencyContactName:
          response?.patientProfile?.emergencyContactName ||
          payload.emergencyContactName ||
          "",
        emergencyPhone:
          response?.patientProfile?.emergencyPhone ||
          payload.emergencyPhone ||
          "112",
        recommendedDoctor:
          structuredReport?.recommendedSpecialist ||
          tr("analysisPage.generalPhysician", "General Physician"),
        keyPoints: [
          tr(
            "analysisPage.keyPoints.topPossibility",
            "Top possibility: {{value}}",
            {
              value: topCondition,
            },
          ),
          tr("analysisPage.keyPoints.likelyCause", "Likely cause: {{value}}", {
            value: topCause,
          }),
          tr(
            "analysisPage.keyPoints.emergencyLevel",
            "Emergency level: {{value}}",
            {
              value: structuredReport?.emergencyAssessment?.level || "moderate",
            },
          ),
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

      const primarySpecialist = extractPrimarySpecialist(structuredReport);

      const created = createAnalysisCase({
        session,
        form,
        backendCaseId: response?.case?._id || null,
        backendPublicCaseId: response?.case?.caseId || "",
        uploads,
        ai,
        doctorFlow: {
          status: response?.case?.status || "ai_completed",
          specialist: primarySpecialist,
          specialistLabel: response?.specialistLabel || "",
          doctorName: "",
          consultationId: "",
          timeline: [
            {
              status: response?.case?.status || "ai_completed",
              label: statusLabelMap[response?.case?.status || "ai_completed"],
              at: new Date().toISOString(),
            },
          ],
        },
        chat: [
          {
            id: makeChatId(),
            role: "ai",
            text: tr(
              "analysisPage.aiIntro",
              "I analyzed your details. {{summary}}",
              {
                summary: ai.summary,
              },
            ),
            createdAt: new Date().toISOString(),
          },
        ],
      });

      setActiveCase(created);
      setChatOpen(true);
      setReportOpen(false);
      setMatchedDoctors([]);
      setMatchedSpecialistLabel("");
      setConsultationInfo(null);
      setConsultationError("");
      setEmergencyModalOpen(ai.isEmergencyCase);
      refresh();
    } catch (err) {
      setAnalysisError(
        err?.message ||
          tr(
            "analysisPage.errors.failedGenerateDiagnosis",
            "Failed to generate AI diagnosis",
          ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onSendChat = async () => {
    const text = chatInput.trim();
    if (!text || !activeCase?.id) return;

    appendChat("patient", text);
    setChatInput("");

    await sleep(550);
    appendChat("ai", aiFollowUp(text, activeCase.ai, tr));
  };

  const onConnectDoctor = async () => {
    if (
      !activeCase ||
      connectingDoctor ||
      consultationLoading ||
      isDoctorAssigned
    ) {
      return;
    }

    if (!session?.token) {
      setConsultationError(
        tr(
          "analysisPage.errors.sessionExpiredConsultation",
          "Session expired. Please log in again to continue consultation.",
        ),
      );
      return;
    }

    const caseIdentifier =
      activeCase.backendCaseId || activeCase.backendPublicCaseId;

    if (!caseIdentifier) {
      setConsultationError(
        tr(
          "analysisPage.errors.caseIdMissing",
          "Case ID missing. Please regenerate AI diagnosis.",
        ),
      );
      return;
    }

    const specialist =
      extractPrimarySpecialist(activeCase?.ai?.report) ||
      activeCase?.doctorFlow?.specialist ||
      "";

    setConnectingDoctor(true);
    setConsultationError("");
    setMatchedDoctors([]);
    setMatchedSpecialistLabel("");

    try {
      const response = await analysisApi.getMatchedDoctors({
        token: session.token,
        caseId: caseIdentifier,
        specialist,
      });

      const doctors = response?.doctors || [];
      setMatchedDoctors(doctors);
      setMatchedSpecialistLabel(response?.specialistLabel || "");
      updateStatus("doctor_requested", {
        matchedDoctors: doctors,
        specialist: response?.primarySpecialist || specialist,
        specialistLabel: response?.specialistLabel || "",
      });

      if (!doctors.length) {
        setConsultationError(
          tr(
            "analysisPage.errors.noVerifiedDoctors",
            "No verified doctors available for this specialist right now.",
          ),
        );
      }
    } catch (err) {
      setConsultationError(
        err?.message ||
          tr(
            "analysisPage.errors.failedFetchDoctors",
            "Failed to fetch matching doctors",
          ),
      );
    } finally {
      setConnectingDoctor(false);
    }
  };

  const onCreateConsultation = async (doctorId) => {
    const caseIdentifier =
      activeCase?.backendCaseId || activeCase?.backendPublicCaseId;

    if (!caseIdentifier || !session?.token) return;

    setConsultationLoading(true);
    setConsultationError("");

    try {
      const mapConsultationStatus = (status) => {
        if (status === "completed") return "completed";
        if (status === "accepted") return "consultation_active";
        if (status === "pending") return "doctor_assigned";
        if (status === "rejected") return "doctor_requested";
        return "doctor_assigned";
      };

      const createResponse = await analysisApi.createConsultation({
        token: session.token,
        caseId: caseIdentifier,
        doctorId,
      });

      const consultationId = createResponse?.consultation?._id;
      let doctorName =
        matchedDoctors.find(
          (doc) => doc._id === createResponse?.consultation?.doctorId,
        )?.name || tr("analysisPage.assignedDoctor", "Assigned Doctor");

      if (consultationId) {
        const consultationResponse = await analysisApi.getConsultationById({
          token: session.token,
          consultationId,
        });
        const detail = consultationResponse?.consultation || null;
        if (detail?.doctorId?.fullName) {
          doctorName = detail.doctorId.fullName;
        }
        setConsultationInfo(detail);
      }

      const nextStatus = mapConsultationStatus(
        createResponse?.consultation?.status,
      );

      updateStatus(nextStatus, {
        doctorName,
        consultationId: consultationId || "",
      });

      appendChat(
        "ai",
        tr(
          "analysisPage.consultationCreated",
          "Consultation request created successfully. Doctor assigned: {{doctorName}}.",
          { doctorName },
        ),
      );

      setMatchedDoctors([]);
    } catch (err) {
      setConsultationError(
        err?.message ||
          tr(
            "analysisPage.errors.failedCreateConsultation",
            "Failed to create consultation",
          ),
      );
    } finally {
      setConsultationLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,#e8f4ff_0%,#f8fcff_48%,#edf8f5_100%)] text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-sky-400/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-emerald-300/25 blur-[130px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[radial-gradient(#2f78d9_1px,transparent_1px)] bg-size-[24px_24px]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pt-10">
        <Motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeSmooth }}
          className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_22px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                {tr("analysisPage.coreFlow", "VedaAI Core Flow")}
              </p>
              <h1 className="mt-1 p-0.5 bg-linear-to-r from-blue-900 via-blue-800 to-blue-700 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                {tr("analysisPage.title", "Start Diagnosis with AI")}
              </h1>
              {isEmergencyFromCase ? (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                  <AlertTriangle size={12} />
                  {tr("analysisPage.emergencyBadge", "Emergency")}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigate("/dashboard/patient")}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <ArrowLeft size={14} />
                {tr("analysisPage.dashboard", "Dashboard")}
              </button>

              <button
                type="button"
                onClick={() => setChatOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                  chatOpen
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <MessageCircle size={14} />
                {chatOpen
                  ? tr("analysisPage.hideChat", "Hide Chat")
                  : tr("analysisPage.aiChat", "AI Chat")}
              </button>

              <button
                onClick={onConnectDoctor}
                disabled={
                  !activeCase ||
                  connectingDoctor ||
                  consultationLoading ||
                  isDoctorAssigned
                }
                className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                <Stethoscope size={14} />
                {isDoctorAssigned
                  ? tr("analysisPage.doctorConnected", "Doctor Connected")
                  : connectingDoctor
                    ? tr("analysisPage.findingDoctors", "Finding doctors...")
                    : tr("analysisPage.connectDoctor", "Connect to Doctor")}
              </button>
            </div>
          </div>
        </Motion.div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
          <Motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.02, ease: easeSmooth }}
            className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_22px_55px_-35px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              {tr("analysisPage.patientIntake", "Start Diagnosis")}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {tr(
                "analysisPage.intakeSubtitle",
                "Submit required details once. AI creates summary and chat context.",
              )}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={form.age}
                onChange={(e) =>
                  setForm((p) => ({ ...p, age: e.target.value }))
                }
                placeholder={tr("analysisPage.age", "Age")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              />
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm((p) => ({ ...p, gender: e.target.value }))
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="">{tr("analysisPage.gender", "Gender")}</option>
                <option>{tr("analysisPage.male", "Male")}</option>
                <option>{tr("analysisPage.female", "Female")}</option>
                <option>{tr("analysisPage.other", "Other")}</option>
              </select>
            </div>

            <input
              required
              value={form.symptoms}
              onChange={(e) =>
                setForm((p) => ({ ...p, symptoms: e.target.value }))
              }
              placeholder={tr(
                "analysisPage.mainSymptom",
                "Main symptom / concern",
              )}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={form.duration}
                onChange={(e) =>
                  setForm((p) => ({ ...p, duration: e.target.value }))
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              >
                {durationOptions.map((option) => (
                  <option key={option.value}>{option.label}</option>
                ))}
              </select>

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">
                  {tr("analysisPage.severity", "Severity of pain")}:{" "}
                  {form.severity}/10
                </p>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={form.severity}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, severity: Number(e.target.value) }))
                  }
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs text-slate-500">
                {tr(
                  "analysisPage.situation.label",
                  "Current situation (self-reported)",
                )}
              </p>
              <select
                value={form.situationLevel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, situationLevel: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              >
                {situationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              value={form.medications}
              onChange={(e) =>
                setForm((p) => ({ ...p, medications: e.target.value }))
              }
              placeholder={tr(
                "analysisPage.currentMedications",
                "Current medications (optional)",
              )}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />

            <input
              value={form.allergies}
              onChange={(e) =>
                setForm((p) => ({ ...p, allergies: e.target.value }))
              }
              placeholder={tr("analysisPage.allergies", "Allergies (optional)")}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />

            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              placeholder={tr(
                "analysisPage.additionalDetails",
                "Additional details",
              )}
              className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />

            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Upload size={14} />
              {tr("analysisPage.uploadDocs", "Upload docs/images (optional)")}
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) =>
                  setSelectedFiles(Array.from(e.target.files || []))
                }
              />
            </label>

            {selectedFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedFiles.map((f) => (
                  <span
                    key={`${f.name}-${f.size}`}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                  >
                    {f.name}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Sparkles size={14} />
                {submitting
                  ? tr("analysisPage.analyzing", "Analyzing...")
                  : tr(
                      "analysisPage.generateDiagnosis",
                      "Generate AI Diagnosis",
                    )}
              </button>
            </div>

            {analysisError ? (
              <p className="mt-3 text-sm font-medium text-red-600">
                {analysisError}
              </p>
            ) : null}

            {activeCase?.ai && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-blue-700">
                  {tr("analysisPage.aiSnapshot", "AI Snapshot")}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {activeCase.ai.summary}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {isEmergencyFromCase ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                      <AlertTriangle size={12} />
                      {tr("analysisPage.emergencyBadge", "Emergency")}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {tr("analysisPage.urgency", "Urgency")}:{" "}
                    {String(activeCase.ai.urgency || "").toUpperCase()}
                  </span>
                  <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {activeCase.ai.recommendedDoctor}
                  </span>
                </div>
              </div>
            )}
          </Motion.form>

          <Motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: easeSmooth }}
            className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_22px_55px_-35px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
          >
            {submitting ? (
              <div className="flex h-full min-h-130 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4 text-center">
                <Triangle
                  visible={true}
                  height="80"
                  width="80"
                  color="#4fa94d"
                  ariaLabel="triangle-loading"
                  wrapperStyle={{}}
                  wrapperClass=""
                />
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {tr("analysisPage.aiConversation", "AI Conversation")}
                </p>
                <motion.p
                  key={loadingTextIndex}
                  initial={{ opacity: 0.2, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: easeSmooth }}
                  className="mt-2 text-sm font-semibold text-slate-700"
                >
                  {loadingTexts[loadingTextIndex]}
                </motion.p>
              </div>
            ) : chatOpen ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {tr("analysisPage.aiConversation", "AI Conversation")}
                    </p>
                    <p className="text-sm text-slate-600">
                      {tr(
                        "analysisPage.aiConversationSubtitle",
                        "Chat with AI before doctor handoff.",
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeCase?.ai?.report ? (
                      <button
                        type="button"
                        onClick={() => setReportOpen(true)}
                        className="inline-flex items-center cursor-pointer gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-[0_8px_18px_-10px_rgba(16,185,129,0.75)]"
                      >
                        <Eye size={13} />
                        {tr("analysisPage.viewReports", "View Reports")}
                      </button>
                    ) : null}

                    <button
                      onClick={onConnectDoctor}
                      disabled={
                        !activeCase ||
                        connectingDoctor ||
                        consultationLoading ||
                        isDoctorAssigned
                      }
                      className="inline-flex items-center cursor-pointer  gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      <Stethoscope size={13} />
                      {connectingDoctor
                        ? tr(
                            "analysisPage.findingDoctors",
                            "Finding doctors...",
                          )
                        : tr("analysisPage.connectDoctor", "Connect to Doctor")}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {STATUS_STEPS.map((step, i) => {
                    const done = currentStatusIndex >= i;
                    return (
                      <span
                        key={step}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          done
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <Clock3 size={12} />
                        )}
                        {statusLabelMap[step]}
                      </span>
                    );
                  })}
                </div>

                {showDoctorProgress ? (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                      {tr(
                        "analysisPage.consultationProgress",
                        "Consultation Progress",
                      )}
                    </p>
                    <motion.p
                      key={`${currentStatus}-${doctorProgressIndex}`}
                      initial={{ opacity: 0.2, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: easeSmooth }}
                      className="mt-1 text-sm font-medium text-blue-800"
                    >
                      {
                        [
                          tr(
                            "analysisPage.progress.findingDoctor",
                            "Finding doctor for your case...",
                          ),
                          tr(
                            "analysisPage.progress.reportSent",
                            "Case report sent to doctor...",
                          ),
                          tr(
                            "analysisPage.progress.reviewing",
                            "Doctor is reviewing your case...",
                          ),
                        ][doctorProgressIndex]
                      }
                    </motion.p>
                  </div>
                ) : null}

                {currentStatus === "doctor_assigned" && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {tr("analysisPage.doctorAssigned", "Doctor Assigned")}:{" "}
                    {activeCase?.doctorFlow?.doctorName ||
                      tr("analysisPage.pending", "Pending")}
                    {activeCase?.doctorFlow?.consultationId
                      ? ` � ${tr("analysisPage.consultationId", "Consultation ID")}: ${activeCase.doctorFlow.consultationId}`
                      : ""}
                  </div>
                )}

                {doctorStructuredReport ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-sm font-semibold text-emerald-700">
                      {tr(
                        "analysisPage.progress.doctorReportReady",
                        "Doctor consult report is ready",
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDoctorReportOpen(true)}
                      className="mt-2 inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700"
                    >
                      <Eye size={13} />
                      {tr(
                        "analysisPage.doctorConsultReport",
                        "Doctor Consult Report",
                      )}
                    </button>
                  </div>
                ) : null}

                {!!matchedDoctors.length && !consultationLoading && (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          {tr("analysisPage.selectDoctor", "Select a Doctor")}
                        </p>
                        <p className="text-xs text-slate-600">
                          {tr("analysisPage.specialist", "Specialist")}:{" "}
                          {matchedSpecialistLabel ||
                            activeCase?.doctorFlow?.specialistLabel ||
                            activeCase?.doctorFlow?.specialist ||
                            tr(
                              "analysisPage.generalPhysician",
                              "General Physician",
                            )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onCreateConsultation()}
                        className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700"
                      >
                        {tr("analysisPage.autoAssign", "Auto-Assign")}
                      </button>
                    </div>

                    <div className="mt-2 space-y-2">
                      {matchedDoctors.map((doctor) => (
                        <div
                          key={doctor._id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {doctor.name}
                            </p>
                            <p className="text-xs text-slate-600">
                              {doctor.specializationLabel ||
                                doctor.specialization}{" "}
                              � {doctor.experience}{" "}
                              {tr("analysisPage.yearsShort", "yrs")} �{" "}
                              {tr("analysisPage.casesHandled", "Cases handled")}{" "}
                              {doctor.casesHandled ?? 0} �{" "}
                              {tr("analysisPage.rating", "Rating")}{" "}
                              {doctor.rating ?? 0}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onCreateConsultation(doctor._id)}
                            className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                          >
                            {tr("analysisPage.select", "Select")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {consultationLoading ? (
                  <p className="mt-3 text-sm font-medium text-blue-700">
                    {tr(
                      "analysisPage.creatingConsultation",
                      "Creating consultation request...",
                    )}
                  </p>
                ) : null}

                {consultationError ? (
                  <p className="mt-3 text-sm font-medium text-red-600">
                    {consultationError}
                  </p>
                ) : null}

                {consultationInfo?.status ? (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {tr(
                      "analysisPage.consultationStatus",
                      "Consultation status",
                    )}
                    : {consultationInfo.status}
                  </p>
                ) : null}

                <div className="mt-4 h-107.5 overflow-y-auto rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-3">
                  {!activeCase ? (
                    <div className="grid h-full place-items-center text-center text-sm text-slate-500">
                      {tr(
                        "analysisPage.submitIntakeToStart",
                        "Submit intake details to start AI chat.",
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(activeCase.chat || []).map((msg) => {
                        const isAi = msg.role === "ai";
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isAi ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                                isAi
                                  ? "border border-slate-200 bg-white text-slate-700"
                                  : "bg-slate-900 text-white"
                              }`}
                            >
                              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                                {isAi ? (
                                  <Bot size={11} />
                                ) : (
                                  <UserRound size={11} />
                                )}
                                {isAi
                                  ? tr("analysisPage.ai", "AI")
                                  : tr("analysisPage.you", "You")}
                              </div>
                              <p>{msg.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSendChat();
                      }
                    }}
                    disabled={!activeCase}
                    placeholder={
                      activeCase
                        ? tr(
                            "analysisPage.askAiPlaceholder",
                            "Ask AI anything about your case...",
                          )
                        : tr(
                            "analysisPage.submitIntakeToEnable",
                            "Submit intake to enable chat",
                          )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none disabled:bg-slate-50"
                  />
                  <button
                    onClick={onSendChat}
                    disabled={!activeCase || !chatInput.trim()}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    <Send size={13} />
                    {tr("analysisPage.send", "Send")}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-130 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4 text-center">
                {activeCase?.ai?.report ? (
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="mb-3 inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-[0_8px_18px_-10px_rgba(16,185,129,0.75)]"
                  >
                    <Eye size={13} />
                    {tr("analysisPage.viewReports", "View Reports")}
                  </button>
                ) : null}
                <MessageCircle size={30} className="text-slate-400" />
              </div>
            )}
          </Motion.div>
        </div>

        <Motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: easeSmooth }}
          className="mt-4 rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_22px_55px_-35px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            {tr("analysisPage.recentCases", "Recent Analysis Cases")}
          </p>
          {!history.length ? (
            <p className="mt-2 text-sm text-slate-500">
              {tr("analysisPage.noHistory", "No history yet.")}
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((row) => (
                <button
                  key={row.id}
                  onClick={() => {
                    setActiveCase(row);
                    setMatchedDoctors(row?.doctorFlow?.matchedDoctors || []);
                    setMatchedSpecialistLabel(
                      row?.doctorFlow?.specialistLabel || "",
                    );
                    setConsultationInfo(null);
                    setConsultationError("");
                    setEmergencyModalOpen(false);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                >
                  <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                    {row.form?.symptoms ||
                      tr("analysisPage.untitledCase", "Untitled case")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(row.createdAt)}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <Stethoscope size={12} />
                    {row.ai?.recommendedDoctor ||
                      tr("analysisPage.generalPhysician", "General Physician")}
                  </p>
                  {(row?.ai?.report?.isEmergencyCase ||
                    ["high", "critical"].includes(
                      String(
                        row?.ai?.report?.emergencyAssessment?.level || "",
                      ).toLowerCase(),
                    )) && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                      <AlertTriangle size={12} />
                      {tr("analysisPage.emergencyBadge", "Emergency")}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </Motion.div>
      </div>

      {emergencyModalOpen && isEmergencyFromCase ? (
        <div className="fixed inset-0 z-170 grid place-items-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <AlertTriangle size={18} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">
                  {tr("analysisPage.emergencyBadge", "Emergency")}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {tr(
                    "analysisPage.emergencyModal.title",
                    "This case may need urgent attention",
                  )}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {tr(
                    "analysisPage.emergencyModal.body",
                    "Your inputs and AI triage indicate elevated risk. Please contact emergency support immediately and avoid delaying care.",
                  )}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {emergencyContactName}: {emergencyContactPhone}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `tel:${emergencyContactPhone}`;
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <PhoneCall size={14} />
                {tr(
                  "analysisPage.emergencyModal.contact",
                  "Call Emergency Contact",
                )}
              </button>
              <button
                type="button"
                onClick={() => setEmergencyModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {tr("analysisPage.emergencyModal.dismiss", "I Understand")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reportOpen && activeCase?.ai?.report ? (
        <div className="fixed inset-0 z-160 grid place-items-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  {tr("analysisPage.structuredReport", "AI Structured Report")}
                </p>
                <h3 className="text-base font-semibold text-slate-900">
                  {activeCase.form?.symptoms ||
                    tr("analysisPage.patientAnalysis", "Patient analysis")}
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
                  {activeCase.ai.report.summary}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  {tr("analysisPage.possibleConditions", "Possible Conditions")}
                </p>
                <div className="mt-2 space-y-2">
                  {(
                    activeCase.ai.report.conditionAnalysis
                      ?.possibleConditions || []
                  ).map((item) => (
                    <div
                      key={`${item.name}-${item.likelihood}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-2.5"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">
                        {tr("analysisPage.likelihood", "Likelihood")}:{" "}
                        {item.likelihood}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.whyItFits}
                      </p>
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
                    {(
                      activeCase.ai.report.conditionAnalysis?.possibleCauses ||
                      []
                    ).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {tr(
                      "analysisPage.emergencyAssessment",
                      "Emergency Assessment",
                    )}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-rose-700">
                    {tr("analysisPage.level", "Level")}:{" "}
                    {String(
                      activeCase.ai.report.emergencyAssessment?.level ||
                        "moderate",
                    ).toUpperCase()}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {activeCase.ai.report.emergencyAssessment?.why}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                    {(
                      activeCase.ai.report.emergencyAssessment?.redFlags || []
                    ).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  {tr("analysisPage.resolutionPlan", "Resolution Plan")}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {tr("analysisPage.immediateSteps", "Immediate Steps")}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
                  {(
                    activeCase.ai.report.recommendedResolution
                      ?.immediateSteps || []
                  ).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {tr("analysisPage.homeCare", "Home Care")}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
                  {(
                    activeCase.ai.report.recommendedResolution?.homeCare || []
                  ).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {tr("analysisPage.testsToConsider", "Tests To Consider")}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
                  {(
                    activeCase.ai.report.recommendedResolution
                      ?.testsToConsider || []
                  ).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {tr(
                    "analysisPage.specialistsToConsult",
                    "Specialists To Consult",
                  )}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
                  {(
                    activeCase.ai.report.recommendedResolution
                      ?.specialistsToConsult || []
                  ).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <p className="mt-3 text-sm text-slate-700">
                  <span className="font-semibold">
                    {tr("analysisPage.followUp", "Follow up")}:
                  </span>{" "}
                  {activeCase.ai.report.recommendedResolution?.followUpWindow}
                </p>
              </section>

              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {activeCase.ai.report.disclaimer}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {doctorReportOpen && doctorStructuredReport ? (
        <div className="fixed inset-0 z-160 grid place-items-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  {tr(
                    "analysisPage.doctorConsultReport",
                    "Doctor Consult Report",
                  )}
                </p>
                <h3 className="text-base font-semibold text-slate-900">
                  {doctorStructuredReport?.patient_details?.name ||
                    tr("analysisPage.patientReport", "Patient Report")}
                </h3>
              </div>
              <button
                onClick={() => setDoctorReportOpen(false)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[calc(88vh-68px)] space-y-3 overflow-y-auto px-4 py-4 sm:px-5 text-sm text-slate-700">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p>
                  <span className="font-semibold">Name:</span>{" "}
                  {doctorStructuredReport?.patient_details?.name ||
                    "Not Provided"}
                </p>
                <p>
                  <span className="font-semibold">Age:</span>{" "}
                  {doctorStructuredReport?.patient_details?.age ||
                    "Not Provided"}
                </p>
                <p>
                  <span className="font-semibold">Gender:</span>{" "}
                  {doctorStructuredReport?.patient_details?.gender ||
                    "Not Provided"}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                <p>
                  <span className="font-semibold">Patient Query:</span>{" "}
                  {doctorStructuredReport?.consultation_details
                    ?.patient_query || "Not Provided"}
                </p>
                <p>
                  <span className="font-semibold">Doctor Name:</span>{" "}
                  {doctorStructuredReport?.consultation_details?.doctor_name ||
                    "Not Provided"}
                </p>
                <p>
                  <span className="font-semibold">Consultation Date:</span>{" "}
                  {doctorStructuredReport?.consultation_details
                    ?.consultation_date || "Not Provided"}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="font-semibold">Diagnosis Summary</p>
                <p>
                  {doctorStructuredReport?.diagnosis_summary || "Not Provided"}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="font-semibold">Symptoms Noted</p>
                <ul className="mt-1 list-disc pl-5">
                  {(doctorStructuredReport?.symptoms_noted?.length
                    ? doctorStructuredReport.symptoms_noted
                    : ["Not Provided"]
                  ).map((item, idx) => (
                    <li key={`sym-${idx}`}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="font-semibold">Medications</p>
                <div className="mt-2 space-y-2">
                  {(doctorStructuredReport?.medications?.length
                    ? doctorStructuredReport.medications
                    : [
                        {
                          medicine_name: "Not Provided",
                          dosage: "Not Provided",
                          frequency: "Not Provided",
                          duration: "Not Provided",
                          instructions: "Not Provided",
                        },
                      ]
                  ).map((item, idx) => (
                    <div
                      key={`med-${idx}`}
                      className="rounded-xl bg-slate-50 p-2"
                    >
                      <p>
                        <span className="font-semibold">Medicine:</span>{" "}
                        {item.medicine_name || "Not Provided"}
                      </p>
                      <p>
                        <span className="font-semibold">Dosage:</span>{" "}
                        {item.dosage || "Not Provided"}
                      </p>
                      <p>
                        <span className="font-semibold">Frequency:</span>{" "}
                        {item.frequency || "Not Provided"}
                      </p>
                      <p>
                        <span className="font-semibold">Duration:</span>{" "}
                        {item.duration || "Not Provided"}
                      </p>
                      <p>
                        <span className="font-semibold">Instructions:</span>{" "}
                        {item.instructions || "Not Provided"}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                <p>
                  <span className="font-semibold">Tests Recommended:</span>
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {(doctorStructuredReport?.tests_recommended?.length
                    ? doctorStructuredReport.tests_recommended
                    : ["Not Provided"]
                  ).map((item, idx) => (
                    <li key={`test-${idx}`}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  <span className="font-semibold">Doctor Advice:</span>{" "}
                  {doctorStructuredReport?.doctor_advice || "Not Provided"}
                </p>
                <p>
                  <span className="font-semibold">Follow Up:</span>{" "}
                  {doctorStructuredReport?.follow_up || "Not Provided"}
                </p>
                <p>
                  <span className="font-semibold">Raw Doctor Notes:</span>{" "}
                  {doctorStructuredReport?.raw_doctor_notes || "Not Provided"}
                </p>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
