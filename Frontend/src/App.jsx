// src/App.jsx
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useInRouterContext,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import LoginModal from "./components/LoginModal";
import SignupModal from "./components/SignupModal";

import Hero from "./components/Hero";
const About = lazy(() => import("./components/About"));
const Features = lazy(() => import("./components/Features"));
const HowToUse = lazy(() => import("./components/HowToUse"));
const Testimonials = lazy(() => import("./components/Testimonials"));

const PatientSignup = lazy(() => import("./pages/PatientSignup"));
const DoctorDashboard = lazy(() => import("./pages/DoctorDashboard"));
const DoctorCaseFormPage = lazy(() => import("./pages/DoctorCaseFormPage"));
const PatientDashboard = lazy(() => import("./pages/PatientDashboard"));
const AdminVerificationPanel = lazy(
  () => import("./pages/AdminVerificationPanel"),
);
const PatientAnalysisPage = lazy(() => import("./pages/PatientAnalysisPage"));
const EmergencyPage = lazy(() => import("./pages/EmergencyPage"));

const DoctorSignup = lazy(() => import("./components/DoctorSignup"));
const DoctorVerification = lazy(
  () => import("./components/DoctorVerification"),
);
import {
  clearSession,
  DOCTORS_KEY,
  persistSession,
  SESSION_KEY,
} from "./utils/authStorage";

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function readList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function getDoctorByEmail(email) {
  if (!email) return null;
  return readList(DOCTORS_KEY).find(
    (d) => d.email?.toLowerCase() === email.toLowerCase(),
  );
}

function RouteLoader() {
  return <div className="min-h-[40vh] bg-transparent" />;
}

function ProtectedRole({ session, role, children }) {
  if (!session?.email) return <Navigate to="/" replace />;
  if (session.role !== role) {
    if (session.role === "doctor") {
      return <Navigate to="/doctor/verification" replace />;
    }
    if (session.role === "admin") {
      return <Navigate to="/admin/verification" replace />;
    }
    return <Navigate to="/dashboard/patient" replace />;
  }
  return children;
}

function ProtectedDoctorDashboard({
  session,
  doctorVerificationStatus,
  children,
}) {
  if (!session?.email) return <Navigate to="/" replace />;
  if (session.role !== "doctor") {
    if (session.role === "admin") {
      return <Navigate to="/admin/verification" replace />;
    }
    return <Navigate to="/dashboard/patient" replace />;
  }
  if (doctorVerificationStatus !== "verified") {
    return <Navigate to="/doctor/verification" replace />;
  }
  return children;
}

function ProtectedDoctorVerification({
  session,
  doctorVerificationStatus,
  children,
}) {
  if (!session?.email) return <Navigate to="/" replace />;
  if (session.role !== "doctor") {
    if (session.role === "admin") {
      return <Navigate to="/admin/verification" replace />;
    }
    return <Navigate to="/dashboard/patient" replace />;
  }
  if (doctorVerificationStatus === "verified") {
    return <Navigate to="/dashboard/doctor" replace />;
  }
  return children;
}

function ProtectedAdmin({ session, children }) {
  if (!session?.email) return <Navigate to="/" replace />;
  if (session.role !== "admin") {
    if (session.role === "doctor") {
      return <Navigate to="/doctor/verification" replace />;
    }
    if (session.role === "patient") {
      return <Navigate to="/dashboard/patient" replace />;
    }
    return <Navigate to="/" replace />;
  }
  return children;
}

function LandingPage({
  isLoggedIn,
  session,
  onOpenLogin,
  onOpenSignup,
  onGetStarted,
  onOpenEmergency,
}) {
  return (
    <>
      <section id="home">
        <Hero
          isLoggedIn={isLoggedIn}
          session={session}
          onOpenLogin={onOpenLogin}
          onOpenSignup={onOpenSignup}
          onGetStarted={onGetStarted}
          onOpenEmergency={onOpenEmergency}
        />
      </section>
      <Suspense fallback={<RouteLoader />}>
        <section id="about">
          <About />
        </section>
        <section id="features">
          <Features />
        </section>
        <section id="how-to-use">
          <HowToUse />
        </section>
        <section id="reviews">
          <Testimonials />
        </section>
      </Suspense>
    </>
  );
}

function AppInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [session, setSession] = useState(readSession);
  const [doctorRefresh, setDoctorRefresh] = useState(0);

  const isLoggedIn = useMemo(() => Boolean(session?.email), [session]);
  const isHome = location.pathname === "/";

  const doctorProfile = useMemo(() => {
    void doctorRefresh;

    if (session?.role !== "doctor" || !session?.email) return null;
    return getDoctorByEmail(session.email);
  }, [session, doctorRefresh]);

  const doctorVerificationStatus =
    doctorProfile?.verificationStatus || "not_submitted";

  const modal = searchParams.get("modal");
  const loginOpen = modal === "login" && !isLoggedIn;
  const signupOpen = modal === "signup" && !isLoggedIn;

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === SESSION_KEY) setSession(readSession());
      if (e.key === DOCTORS_KEY) setDoctorRefresh((v) => v + 1);
    };
    const onDoctorUpdated = () => setDoctorRefresh((v) => v + 1);

    window.addEventListener("storage", onStorage);
    window.addEventListener("veda:doctor-updated", onDoctorUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("veda:doctor-updated", onDoctorUpdated);
    };
  }, []);

  const clearModalFromUrl = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("modal");
    next.delete("role");
    setSearchParams(next, { replace: true });
  };

  const openLogin = (role = "patient") => {
    if (location.pathname !== "/") {
      navigate(`/?modal=login&role=${role}`);
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("modal", "login");
    next.set("role", role);
    setSearchParams(next, { replace: false });
  };

  const openSignup = () => {
    if (location.pathname !== "/") {
      navigate("/?modal=signup");
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("modal", "signup");
    next.delete("role");
    setSearchParams(next, { replace: false });
  };

  const onAuth = (nextSession) => {
    persistSession(nextSession);
    setSession(nextSession);
    setDoctorRefresh((v) => v + 1);
    clearModalFromUrl();
  };

  const onLogout = () => {
    clearSession();
    setSession(null);
    clearModalFromUrl();
  };

  const goToGetStarted = () => {
    if (!isLoggedIn) {
      openLogin("patient");
      return;
    }

    if (session?.role === "admin") {
      navigate("/admin/verification");
      return;
    }

    if (session?.role === "doctor") {
      navigate(
        doctorVerificationStatus === "verified"
          ? "/dashboard/doctor"
          : "/doctor/verification",
      );
      return;
    }

    navigate("/analysis");
  };

  const goToEmergency = () => {
    navigate("/emergency");
  };

  return (
    <>
      <Navbar
        session={session}
        doctorVerificationStatus={doctorVerificationStatus}
        onLogout={onLogout}
        onOpenLogin={openLogin}
        onOpenSignup={openSignup}
        onGetStarted={goToGetStarted}
        onOpenEmergency={goToEmergency}
      />

      <main className={isHome ? "" : "pt-22 sm:pt-24"}>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route
              path="/"
              element={
                <LandingPage
                  isLoggedIn={isLoggedIn}
                  session={session}
                  onOpenLogin={openLogin}
                  onOpenSignup={openSignup}
                  onGetStarted={goToGetStarted}
                  onOpenEmergency={goToEmergency}
                />
              }
            />

            <Route path="/emergency" element={<EmergencyPage session={session} />} />

            <Route
              path="/login"
              element={<Navigate to="/?modal=login&role=patient" replace />}
            />
            <Route
              path="/login/patient"
              element={<Navigate to="/?modal=login&role=patient" replace />}
            />
            <Route
              path="/login/doctor"
              element={<Navigate to="/?modal=login&role=doctor" replace />}
            />

            <Route path="/signup" element={<Navigate to="/" replace />} />
            <Route
              path="/signup/doctor"
              element={
                isLoggedIn ? (
                  <Navigate to="/" replace />
                ) : (
                  <DoctorSignup onSignup={onAuth} />
                )
              }
            />
            <Route
              path="/signup/patient"
              element={
                isLoggedIn ? (
                  <Navigate to="/" replace />
                ) : (
                  <PatientSignup onSignup={onAuth} />
                )
              }
            />

            <Route
              path="/doctor/verification"
              element={
                <ProtectedDoctorVerification
                  session={session}
                  doctorVerificationStatus={doctorVerificationStatus}
                >
                  <DoctorVerification session={session} />
                </ProtectedDoctorVerification>
              }
            />

            <Route
              path="/dashboard/doctor"
              element={
                <ProtectedDoctorDashboard
                  session={session}
                  doctorVerificationStatus={doctorVerificationStatus}
                >
                  <DoctorDashboard session={session} onLogout={onLogout} />
                </ProtectedDoctorDashboard>
              }
            />

            <Route
              path="/dashboard/case/:id"
              element={
                <ProtectedDoctorDashboard
                  session={session}
                  doctorVerificationStatus={doctorVerificationStatus}
                >
                  <DoctorCaseFormPage session={session} />
                </ProtectedDoctorDashboard>
              }
            />

            <Route
              path="/dashboard/patient"
              element={
                <ProtectedRole session={session} role="patient">
                  <PatientDashboard session={session} onLogout={onLogout} />
                </ProtectedRole>
              }
            />

            <Route
              path="/analysis"
              element={
                <ProtectedRole session={session} role="patient">
                  <PatientAnalysisPage session={session} />
                </ProtectedRole>
              }
            />

            <Route
              path="/admin/verification"
              element={
                <ProtectedAdmin session={session}>
                  <AdminVerificationPanel session={session} />
                </ProtectedAdmin>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <Footer />

      <LoginModal
        open={loginOpen}
        onClose={clearModalFromUrl}
        onLogin={onAuth}
        onOpenSignup={openSignup}
      />
      <SignupModal
        open={signupOpen}
        onClose={clearModalFromUrl}
        onOpenLogin={openLogin}
      />
    </>
  );
}

export default function App() {
  const inRouter = useInRouterContext();
  if (inRouter) return <AppInner />;

  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

