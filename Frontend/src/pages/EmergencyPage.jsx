import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  HeartPulse,
  LocateFixed,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldAlert,
  Siren,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { findPatientCacheByEmail, upsertPatientCache } from "../utils/authStorage";

const easeSmooth = [0.22, 1, 0.36, 1];
const CONTACT_KEY = "veda_emergency_contact";

const nearbyCare = [
  {
    id: "aiims",
    name: "AIIMS Bhubaneswar",
    area: "Patrapada, Bhubaneswar",
    phone: "+916742476789",
    displayPhone: "0674 2476789",
    mapsUrl: "https://maps.google.com/?q=AIIMS+Bhubaneswar+Patrapada+Bhubaneswar",
    sourceUrl: "https://aiimsbhubaneswar.nic.in/contact-us/",
    note: "Government tertiary care option with official hospital helpdesk contact.",
    accent: "#7b5f49",
    ribbon: "linear-gradient(135deg,#f8f1e9 0%,#efe1d0 100%)",
  },
  {
    id: "apollo",
    name: "Apollo Hospitals",
    area: "Sainik School Road, Unit 15",
    phone: "+916746660666",
    displayPhone: "0674 666 0666",
    mapsUrl: "https://maps.google.com/?q=Apollo+Hospitals+Unit+15+Sainik+School+Road+Bhubaneswar",
    sourceUrl: "https://www.apollohospitals.com/bhubaneswar/corporate-services/",
    note: "Private emergency and trauma access with official Apollo emergency contact.",
    accent: "#b9382f",
    ribbon: "linear-gradient(135deg,#fff1ef 0%,#f6d8d2 100%)",
  },
  {
    id: "care",
    name: "CARE Hospitals",
    area: "Chandrasekharpur, Bhubaneswar",
    phone: "+916746165656",
    displayPhone: "0674 6165 656",
    mapsUrl: "https://maps.google.com/?q=CARE+Hospitals+Prachi+Enclave+Road+Chandrasekharpur+Bhubaneswar",
    sourceUrl: "https://www.carehospitals.com/contact-us/care-super-specialty-hospital-bhubaneswar",
    note: "Super-speciality care option in Chandrasekharpur with official contact listing.",
    accent: "#8f6f58",
    ribbon: "linear-gradient(135deg,#f9f2ea 0%,#eadbca 100%)",
  },
];

const emergencyServices = [
  {
    id: "ambulance",
    title: "Ambulance",
    phone: "108",
    href: "tel:108",
    detail: "National ambulance response line",
  },
  {
    id: "national",
    title: "National Emergency",
    phone: "112",
    href: "tel:112",
    detail: "Police, medical, and urgent help dispatch",
  },
];

function readSavedContact() {
  if (typeof window === "undefined") return { name: "", phone: "" };
  try {
    return JSON.parse(localStorage.getItem(CONTACT_KEY) || '{"name":"","phone":""}');
  } catch {
    return { name: "", phone: "" };
  }
}

function normalizePhone(value) {
  return value.replace(/[^\d+]/g, "");
}

function buildInitialContact(session) {
  const fallback = readSavedContact();
  const patientProfile = findPatientCacheByEmail(session?.email || "") || {};

  return {
    name: patientProfile.emergencyContactName || fallback.name || "",
    phone: patientProfile.emergencyPhone || fallback.phone || "",
    source: patientProfile.emergencyContactName || patientProfile.emergencyPhone ? "signup" : fallback.name || fallback.phone ? "device" : "empty",
  };
}

function assessScenario(input) {
  const text = input.toLowerCase();

  const criticalMatches = [
    "chest pain",
    "breath",
    "breathing",
    "unconscious",
    "not responding",
    "seizure",
    "stroke",
    "can't move",
    "heavy bleeding",
    "bleeding heavily",
    "suicidal",
    "poison",
  ].filter((item) => text.includes(item));

  if (criticalMatches.length) {
    return {
      level: "Act Immediately",
      tone: "critical",
      summary:
        "Your description includes red-flag symptoms that should be treated as an emergency right now.",
      action:
        "Call emergency support or move to the nearest emergency department immediately. Do not wait for a routine consultation.",
      signals: criticalMatches,
    };
  }

  const urgentMatches = [
    "fracture",
    "broken",
    "high fever",
    "pregnant",
    "pregnancy",
    "severe pain",
    "vomiting blood",
    "dehydration",
    "burn",
    "child",
    "infant",
  ].filter((item) => text.includes(item));

  if (urgentMatches.length) {
    return {
      level: "Urgent Review",
      tone: "urgent",
      summary:
        "This sounds time-sensitive and should be reviewed by a doctor or emergency clinic soon, ideally within the next hour.",
      action:
        "Use the nearby Bhubaneswar emergency options below and be ready to share your symptom summary and current medicines.",
      signals: urgentMatches,
    };
  }

  return {
    level: "Needs Clinical Guidance",
    tone: "moderate",
    summary:
      "This may not read like an immediate red-flag emergency, but it still deserves prompt medical guidance if symptoms are worsening or feel unusual.",
    action:
      "Choose a nearby care option, call a trusted contact if needed, and continue with a doctor-led review rather than self-medicating.",
    signals: [],
  };
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(fromLat, fromLon, toLat, toLon) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLon = toRadians(toLon - fromLon);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return "";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

function formatNearbyAddress(tags = {}, fallback = "") {
  const parts = [
    tags["addr:suburb"],
    tags["addr:street"],
    tags["addr:city"],
    tags["addr:state"],
  ].filter(Boolean);

  return parts.join(", ") || fallback || "Nearby medical support";
}

function mapAmenityLabel(type = "") {
  if (type === "hospital") return "Hospital";
  if (type === "clinic") return "Clinic";
  if (type === "pharmacy") return "Pharmacy";
  return "Medical support";
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("reverse-geocode-failed");
  return response.json();
}

async function fetchNearbyMedicalPlaces(lat, lon) {
  const query = `
    [out:json][timeout:25];
    (
      node(around:5000,${lat},${lon})["amenity"~"hospital|clinic|pharmacy"];
      way(around:5000,${lat},${lon})["amenity"~"hospital|clinic|pharmacy"];
      relation(around:5000,${lat},${lon})["amenity"~"hospital|clinic|pharmacy"];
    );
    out center 20;
  `;

  const response = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
  );
  if (!response.ok) throw new Error("nearby-care-fetch-failed");

  const data = await response.json();
  const elements = Array.isArray(data?.elements) ? data.elements : [];

  return elements
    .map((element) => {
      const tags = element.tags || {};
      const placeLat = element.lat ?? element.center?.lat;
      const placeLon = element.lon ?? element.center?.lon;

      if (!placeLat || !placeLon) return null;

      const distanceKm = calculateDistanceKm(lat, lon, placeLat, placeLon);
      const amenity = tags.amenity || "medical";
      const phone = tags["contact:phone"] || tags.phone || "";
      const osmType =
        element.type === "node"
          ? "node"
          : element.type === "way"
            ? "way"
            : "relation";

      return {
        id: `${element.type}-${element.id}`,
        name: tags.name || `${mapAmenityLabel(amenity)} near you`,
        area: formatNearbyAddress(tags, tags["addr:full"]),
        phone: normalizePhone(phone),
        displayPhone: phone || "Phone not listed",
        mapsUrl: `https://maps.google.com/?q=${placeLat},${placeLon}`,
        sourceUrl: `https://www.openstreetmap.org/${osmType}/${element.id}`,
        note: `${mapAmenityLabel(amenity)} identified from your current location.`,
        accent:
          amenity === "hospital"
            ? "#b9382f"
            : amenity === "pharmacy"
              ? "#2f78d9"
              : "#7b5f49",
        ribbon:
          amenity === "hospital"
            ? "linear-gradient(135deg,#fff1ef 0%,#f6d8d2 100%)"
            : amenity === "pharmacy"
              ? "linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)"
              : "linear-gradient(135deg,#f8f1e9 0%,#efe1d0 100%)",
        typeLabel: mapAmenityLabel(amenity),
        distanceKm,
        distanceLabel: formatDistance(distanceKm),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 6);
}

export default function EmergencyPage({ session = null }) {
  const { t } = useTranslation();
  const tr = (key, defaultValue, options = {}) =>
    t(key, { defaultValue, ...options });

  const durationUnitOptions = useMemo(
    () => [
      { value: "minutes", label: tr("emergencyPage.duration.minutes", "Minutes") },
      { value: "hours", label: tr("emergencyPage.duration.hours", "Hours") },
      { value: "days", label: tr("emergencyPage.duration.days", "Days") },
    ],
    [t],
  );

  const [scenario, setScenario] = useState("");
  const [scenarioDurationValue, setScenarioDurationValue] = useState("30");
  const [scenarioDurationUnit, setScenarioDurationUnit] = useState("minutes");
  const [assessment, setAssessment] = useState(null);
  const [contact, setContact] = useState(() => buildInitialContact(session));
  const [savedState, setSavedState] = useState(false);
  const [userLocationLabel, setUserLocationLabel] = useState("");
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationError, setLocationError] = useState("");
  const [dynamicNearbyCare, setDynamicNearbyCare] = useState([]);

  useEffect(() => {
    setContact(buildInitialContact(session));
  }, [session?.email]);

  useEffect(() => {
    if (!savedState) return;
    const timer = setTimeout(() => setSavedState(false), 1800);
    return () => clearTimeout(timer);
  }, [savedState]);

  const trustedContactHref = useMemo(() => {
    const normalized = normalizePhone(contact.phone || "");
    return normalized ? `tel:${normalized}` : "";
  }, [contact.phone]);

  const visibleNearbyCare = dynamicNearbyCare.length ? dynamicNearbyCare : nearbyCare;

  const loadNearbyCare = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("error");
      setLocationError(
        tr(
          "emergencyPage.location.unsupported",
          "Location is not supported on this device. Showing fallback emergency options instead.",
        ),
      );
      return;
    }

    setLocationStatus("loading");
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const [reverseData, places] = await Promise.all([
            reverseGeocode(coords.latitude, coords.longitude),
            fetchNearbyMedicalPlaces(coords.latitude, coords.longitude),
          ]);

          const address = reverseData?.address || {};
          const label =
            [address.suburb, address.city || address.town || address.village]
              .filter(Boolean)
              .join(", ") ||
            reverseData?.display_name ||
            tr("emergencyPage.location.currentArea", "your current area");

          setUserLocationLabel(label);
          setDynamicNearbyCare(places);
          setLocationStatus("success");

          if (!places.length) {
            setLocationError(
              tr(
                "emergencyPage.location.noResults",
                "We could not find nearby live medical listings, so the fallback Bhubaneswar options are still shown below.",
              ),
            );
          }
        } catch {
          setLocationStatus("error");
          setLocationError(
            tr(
              "emergencyPage.location.fetchFailed",
              "We could not load nearby live medical details right now. Fallback emergency options are still available below.",
            ),
          );
        }
      },
      (error) => {
        const denied = error?.code === 1;
        setLocationStatus("error");
        setLocationError(
          denied
            ? tr(
                "emergencyPage.location.denied",
                "Location permission was denied. You can allow it and try again to load nearby clinics and hospitals automatically.",
              )
            : tr(
                "emergencyPage.location.unavailable",
                "We could not determine your current location. You can try again, and fallback emergency options remain available below.",
              ),
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 120000,
      },
    );
  };

  useEffect(() => {
    loadNearbyCare();
  }, []);

  const formattedScenarioDuration = useMemo(() => {
    const rawValue = String(scenarioDurationValue || "").trim();
    if (!rawValue) return "";
    const unitOption = durationUnitOptions.find((option) => option.value === scenarioDurationUnit);
    const label = unitOption?.label || scenarioDurationUnit || "";
    return `${rawValue} ${label}`.trim();
  }, [durationUnitOptions, scenarioDurationUnit, scenarioDurationValue]);

  const onAssess = () => {
    if (!scenario.trim()) return;
    const combinedScenario = [
      scenario.trim(),
      formattedScenarioDuration
        ? `Symptoms started about ${formattedScenarioDuration} ago.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    setAssessment(assessScenario(combinedScenario));
  };

  const saveContact = () => {
    if (typeof window === "undefined") return;

    localStorage.setItem(
      CONTACT_KEY,
      JSON.stringify({ name: contact.name, phone: contact.phone }),
    );

    if (session?.email) {
      const existing = findPatientCacheByEmail(session.email) || { email: session.email };
      upsertPatientCache({
        ...existing,
        emergencyContactName: contact.name,
        emergencyPhone: contact.phone,
      });
    }

    setSavedState(true);
  };

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f7eee9_0%,#f3e5dc_42%,#fbf6f1_100%)] px-4 py-22 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,#b9382f_1px,transparent_1px),linear-gradient(to_bottom,#b9382f_1px,transparent_1px)] [background-size:4.5rem_4.5rem]" />
        <div className="absolute left-[4%] top-10 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(185,56,47,0.12),transparent_72%)] blur-3xl" />
        <div className="absolute right-[6%] top-18 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(123,95,73,0.12),transparent_72%)] blur-3xl" />
        <div className="absolute left-1/2 top-[28rem] h-[26rem] w-[50rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,248,241,0.9),transparent_72%)] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="grid gap-10 border-b border-[rgba(185,56,47,0.12)] pb-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-end"
        >
          <div>
            <div className="flex items-center gap-3 text-[#b9382f]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#b9382f] text-white shadow-[0_18px_38px_-20px_rgba(185,56,47,0.9)]">
                <Siren size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b9382f]">
                  {tr("common.emergency", "Emergency")}
                </p>
                <p className="text-sm text-[#8e544d]">
                  {tr("emergencyPage.label", "Rapid support access")}
                </p>
              </div>
            </div>

            <h1 className="mt-6 max-w-[11ch] text-4xl font-semibold leading-[0.94] tracking-[-0.07em] text-[#211917] sm:text-5xl lg:text-[5rem]">
              {tr("emergencyPage.title", "Emergency Support")}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#6f5a54]">
              Fast action for Bhubaneswar patients who need urgent medical direction,
              nearby emergency care, and one-touch contact help without digging through the app.
            </p>
          </div>

          <div className="lg:justify-self-end">
            <div className="relative overflow-hidden rounded-[2.4rem] bg-[linear-gradient(135deg,#b9382f_0%,#d14b40_52%,#8f231c_100%)] px-6 py-6 text-white shadow-[0_32px_70px_-34px_rgba(185,56,47,0.95)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,206,190,0.18),transparent_36%)]" />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
                  Immediate use
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                  Nearby care, quick assessment, and direct calling.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/76">
                  <span className="rounded-full border border-white/18 px-3 py-1">Bhubaneswar</span>
                  <span className="rounded-full border border-white/18 px-3 py-1">Urgent path</span>
                  <span className="rounded-full border border-white/18 px-3 py-1">Private-friendly</span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="mt-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-[#7b5f49]">
              <div className="h-px w-10 bg-[linear-gradient(90deg,#7b5f49,transparent)]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em]">
                  {dynamicNearbyCare.length
                    ? tr(
                        "emergencyPage.location.liveHeading",
                        "Nearby medical support from your location",
                      )
                    : tr(
                        "emergencyPage.location.fallbackHeading",
                        "Nearby emergency care in Bhubaneswar",
                      )}
                </p>
                <p className="mt-1 text-sm text-[#8f7769]">
                  {userLocationLabel
                    ? tr(
                        "emergencyPage.location.detectedArea",
                        "Detected area: {{location}}",
                        { location: userLocationLabel },
                      )
                    : tr(
                        "emergencyPage.location.detecting",
                        "Trying to detect current location for live nearby medical support.",
                      )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadNearbyCare}
              disabled={locationStatus === "loading"}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(123,95,73,0.14)] bg-white/84 px-4 py-2 text-sm font-semibold text-[#5e4738] disabled:opacity-60"
            >
              {locationStatus === "loading" ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <LocateFixed size={15} />
              )}
              {locationStatus === "loading"
                ? tr("emergencyPage.location.loading", "Finding nearby care...")
                : tr("emergencyPage.location.retry", "Use my location")}
            </button>
          </div>

          {locationError ? (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
              {locationError}
            </div>
          ) : null}

          <div className="space-y-5">
            {visibleNearbyCare.map((place, index) => (
              <motion.article
                key={place.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.22 }}
                transition={{ duration: 0.55, delay: index * 0.06, ease: easeSmooth }}
                className={`relative overflow-hidden rounded-[2.8rem] px-6 py-6 shadow-[0_26px_60px_-40px_rgba(58,39,28,0.34)] sm:px-8 ${
                  index % 2 === 1 ? "lg:ml-14" : "lg:mr-14"
                }`}
                style={{ background: place.ribbon }}
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.3),transparent_44%)]" />
                <div className="pointer-events-none absolute right-[-4rem] top-[-4rem] h-40 w-40 rounded-full blur-3xl" style={{ background: `${place.accent}18` }} />

                <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={{ background: `${place.accent}12`, color: place.accent }}
                      >
                        <MapPin size={12} /> {place.area}
                      </span>
                      {place.typeLabel ? (
                        <span
                          className="inline-flex items-center gap-2 rounded-full bg-white/72 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                          style={{ color: place.accent }}
                        >
                          {place.typeLabel}
                        </span>
                      ) : null}
                      {place.distanceLabel ? (
                        <span
                          className="inline-flex items-center gap-2 rounded-full bg-white/72 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                          style={{ color: place.accent }}
                        >
                          {place.distanceLabel} away
                        </span>
                      ) : null}
                      <a
                        href={place.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b5f49]"
                      >
                        Official source <ArrowUpRight size={13} />
                      </a>
                    </div>

                    <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[#211917] sm:text-[2.3rem]">
                      {place.name}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6f5a54] sm:text-base">
                      {place.note}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 lg:items-end">
                    {place.phone ? (
                      <a
                        href={`tel:${place.phone}`}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#b9382f] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-22px_rgba(185,56,47,0.92)] transition hover:scale-[1.01]"
                      >
                        <Phone size={16} /> Contact now
                      </a>
                    ) : (
                      <div className="inline-flex items-center justify-center gap-2 rounded-full border border-dashed border-[rgba(123,95,73,0.2)] bg-white/70 px-5 py-3 text-sm font-semibold text-[#7b5f49]">
                        <Phone size={16} /> Phone not listed
                      </div>
                    )}
                    <a
                      href={place.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(123,95,73,0.14)] bg-white/84 px-5 py-3 text-sm font-semibold text-[#5e4738]"
                    >
                      <MapPin size={16} /> Open directions
                    </a>
                    <p className="text-sm font-medium text-[#7b5f49]">{place.displayPhone}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, ease: easeSmooth }}
            className="relative overflow-hidden rounded-[3rem] bg-[linear-gradient(180deg,#fffaf7_0%,#f6ebe2_100%)] px-6 py-7 shadow-[0_30px_72px_-42px_rgba(58,39,28,0.32)] sm:px-8"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(185,56,47,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(123,95,73,0.12),transparent_34%)]" />
            <div className="relative">
              <div className="flex items-center gap-3 text-[#b9382f]">
                <HeartPulse size={18} />
                <p className="text-xs font-semibold uppercase tracking-[0.24em]">
                  Quick assessment
                </p>
              </div>
              <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[#221917] sm:text-[2.6rem]">
                Describe what is happening right now.
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#6f5a54] sm:text-base">
                Tell us the situation in simple words. Mention symptoms, time started,
                severity, pregnancy, child age, bleeding, breathing trouble, chest pain,
                or loss of consciousness if any.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={scenarioDurationValue}
                  onChange={(e) => setScenarioDurationValue(e.target.value)}
                  placeholder={tr("emergencyPage.duration.placeholder", "How long ago?")}
                  className="min-w-0 rounded-full border border-[rgba(123,95,73,0.12)] bg-white/85 px-5 py-3 text-sm text-[#2a1d19] outline-none"
                />
                <select
                  value={scenarioDurationUnit}
                  onChange={(e) => setScenarioDurationUnit(e.target.value)}
                  className="w-32 rounded-full border border-[rgba(123,95,73,0.12)] bg-white/85 px-4 py-3 text-sm text-[#2a1d19] outline-none"
                >
                  {durationUnitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Example: Severe chest pain started 20 minutes ago, sweating, pain going to left arm, difficulty breathing."
                className="mt-3 min-h-[190px] w-full rounded-[2rem] border border-[rgba(123,95,73,0.12)] bg-white/80 px-5 py-4 text-sm leading-7 text-[#2a1d19] outline-none placeholder:text-[#9f8b7d]"
              />

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onAssess}
                  className="inline-flex items-center gap-2 rounded-full bg-[#2b201b] px-5 py-3 text-sm font-semibold text-[#fff7f3] shadow-[0_18px_36px_-24px_rgba(43,32,27,0.6)]"
                >
                  <ShieldAlert size={16} /> Assess now
                </button>
                <p className="text-sm text-[#7b5f49]">
                  This is a quick guide, not a confirmed diagnosis.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, delay: 0.05, ease: easeSmooth }}
            className="relative overflow-hidden rounded-[3rem] bg-[#2a1d19] px-6 py-7 text-[#fffaf7] shadow-[0_34px_80px_-40px_rgba(32,19,16,0.62)] sm:px-8"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(185,56,47,0.22),transparent_34%)]" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#efb3ab]">
                Assessment result
              </p>

              {!assessment ? (
                <div className="mt-8">
                  <h3 className="text-3xl font-semibold tracking-[-0.05em]">
                    We will interpret the situation after you describe it.
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-white/72">
                    The result here will classify urgency, highlight red-flag clues,
                    and point you to the fastest next action.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-6 inline-flex items-center rounded-full border border-white/14 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#efb3ab]">
                    {assessment.level}
                  </div>
                  <h3 className="mt-5 text-3xl font-semibold tracking-[-0.05em]">
                    {assessment.summary}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-white/72">
                    {assessment.action}
                  </p>
                  {assessment.signals.length ? (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {assessment.signals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-white/14 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/82"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </motion.div>
        </section>

        <section className="mt-14 grid gap-8 lg:grid-cols-[0.94fr_1.06fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, ease: easeSmooth }}
            className="relative overflow-hidden rounded-[3rem] bg-[linear-gradient(180deg,#f7ece3_0%,#f2e2d6_100%)] px-6 py-7 shadow-[0_28px_70px_-42px_rgba(58,39,28,0.3)] sm:px-8"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(185,56,47,0.12),transparent_28%)]" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b9382f]">
                Trusted contact
              </p>
              <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[#221917]">
                Retrieved from patient signup details.
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#6f5a54]">
                {contact.source === "signup"
                  ? "We prefilled this contact from the emergency contact you entered during patient signup."
                  : contact.source === "device"
                    ? "No signup contact was found, so we used the contact saved on this device."
                    : "No signup emergency contact was found yet. You can add one now."}
              </p>
              <div className="mt-6 grid gap-3">
                <input
                  value={contact.name}
                  onChange={(e) => setContact((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Trusted contact name"
                  className="w-full rounded-full border border-[rgba(123,95,73,0.14)] bg-white/85 px-5 py-3 text-sm text-[#2a1d19] outline-none"
                />
                <input
                  value={contact.phone}
                  onChange={(e) => setContact((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full rounded-full border border-[rgba(123,95,73,0.14)] bg-white/85 px-5 py-3 text-sm text-[#2a1d19] outline-none"
                />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveContact}
                  className="inline-flex items-center gap-2 rounded-full bg-[#2b201b] px-5 py-3 text-sm font-semibold text-white"
                >
                  <Save size={16} /> Save contact
                </button>
                {trustedContactHref ? (
                  <a
                    href={trustedContactHref}
                    className="inline-flex items-center gap-2 rounded-full bg-[#b9382f] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_-20px_rgba(185,56,47,0.9)]"
                  >
                    <Phone size={16} /> Contact now
                  </a>
                ) : null}
              </div>
              {savedState ? (
                <p className="mt-4 text-sm font-medium text-[#7b5f49]">Saved and synced for this device.</p>
              ) : null}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, delay: 0.05, ease: easeSmooth }}
            className="space-y-4"
          >
            <div className="mb-2 flex items-center gap-3 text-[#7b5f49]">
              <div className="h-px w-10 bg-[linear-gradient(90deg,#7b5f49,transparent)]" />
              <p className="text-xs font-semibold uppercase tracking-[0.24em]">
                Direct call options
              </p>
            </div>

            {emergencyServices.map((service, index) => (
              <motion.a
                key={service.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: index * 0.06, ease: easeSmooth }}
                href={service.href}
                className="group relative flex items-center justify-between overflow-hidden rounded-[2.4rem] px-6 py-6 shadow-[0_24px_58px_-40px_rgba(58,39,28,0.34)]"
                style={{
                  background:
                    service.id === "ambulance"
                      ? "linear-gradient(135deg,#b9382f 0%,#d14b40 52%,#8f231c 100%)"
                      : "linear-gradient(135deg,#f8f1e9 0%,#eadacc 100%)",
                  color: service.id === "ambulance" ? "#fff8f6" : "#2a1d19",
                }}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_34%)]" />
                <div className="relative">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${service.id === "ambulance" ? "text-white/72" : "text-[#7b5f49]"}`}>
                    {service.title}
                  </p>
                  <h4 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{service.phone}</h4>
                  <p className={`mt-2 text-sm ${service.id === "ambulance" ? "text-white/76" : "text-[#6f5a54]"}`}>
                    {service.detail}
                  </p>
                </div>
                <div
                  className={`relative flex h-12 w-12 items-center justify-center rounded-full transition group-hover:scale-105 ${
                    service.id === "ambulance" ? "bg-white/14 text-white" : "bg-[#b9382f] text-white"
                  }`}
                >
                  <Phone size={18} />
                </div>
              </motion.a>
            ))}
          </motion.div>
        </section>
      </div>
    </section>
  );
}

