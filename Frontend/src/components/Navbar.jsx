import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Menu,
  LogOut,
  LayoutDashboard,
  ChevronRight,
  Home,
  Star,
  ShieldCheck,
  Sparkles,
  ShieldAlert,
  LockKeyhole,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const easeSmooth = [0.4, 0, 0.2, 1];

const drawerVariants = {
  closed: {
    x: "100%",
    transition: { duration: 0.24, ease: [0.4, 0, 1, 1] },
  },
  open: {
    x: 0,
    transition: {
      duration: 0.28,
      ease: easeSmooth,
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
};

const linkVariants = {
  closed: { opacity: 0, x: 20 },
  open: { opacity: 1, x: 0, transition: { duration: 0.4, ease: easeSmooth } },
};

const urgentPulse = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(185,56,47,0.20), 0 12px 26px -16px rgba(185,56,47,0.85)",
      "0 0 0 7px rgba(185,56,47,0.06), 0 18px 38px -16px rgba(185,56,47,1)",
      "0 0 0 0 rgba(185,56,47,0.20), 0 12px 26px -16px rgba(185,56,47,0.85)",
    ],
    scale: [1, 1.015, 1],
  },
  transition: {
    duration: 1.8,
    repeat: Number.POSITIVE_INFINITY,
    ease: "easeInOut",
  },
};

function statusStyle(status) {
  if (status === "verified") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (status === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "pending") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function EmergencyCta({ label, onClick, mobile = false }) {
  if (mobile) {
    return (
      <motion.button
        variants={linkVariants}
        animate={urgentPulse.animate}
        transition={urgentPulse.transition}
        onClick={onClick}
        className="relative flex w-full items-center justify-between overflow-hidden  bg-[linear-gradient(135deg,#b9382f_0%,#d14b40_55%,#8f231c_100%)] px-4 py-4 text-left text-white"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(255,196,180,0.18),transparent_34%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/14 backdrop-blur-sm">
            <ShieldAlert size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/72">
              Emergency
            </p>
            <p className="mt-1 text-sm font-semibold">{label}</p>
          </div>
        </div>
        <ChevronRight size={18} className="relative text-white/82" />
      </motion.button>
    );
  }

  return (
    <motion.button
      animate={urgentPulse.animate}
      transition={urgentPulse.transition}
      onClick={onClick}
      className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/18 bg-[linear-gradient(135deg,#b9382f_0%,#d14b40_55%,#8f231c_100%)] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_38%)]" />
      <ShieldAlert size={12} className="relative" />
      <span className="relative">{label}</span>
    </motion.button>
  );
}

function PrivateConcernCta({ label, onClick, mobile = false }) {
  if (mobile) {
    return (
      <motion.button
        variants={linkVariants}
        onClick={onClick}
        className="relative flex w-full items-center justify-between overflow-hidden  border border-[rgba(47,36,29,0.12)] bg-[linear-gradient(135deg,#2f241d_0%,#4b392d_58%,#735847_100%)] px-4 py-4 text-left text-[#f8f0e7] shadow-[0_20px_40px_-28px_rgba(47,36,29,0.9)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_36%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <LockKeyhole size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e4c8ae]">
              Private
            </p>
            <p className="mt-1 text-sm font-semibold">{label}</p>
          </div>
        </div>
        <ChevronRight size={18} className="relative text-[#f8f0e7]/82" />
      </motion.button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-[#2f241d] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#f8f0e7] shadow-[0_16px_32px_-24px_rgba(47,36,29,0.9)] transition hover:bg-[#241b16]"
    >
      <LockKeyhole size={12} />
      {label}
    </button>
  );
}

export default function Navbar({
  session,
  doctorVerificationStatus = "not_submitted",
  onLogout,
  onOpenLogin,
  onOpenSignup,
  onGetStarted,
  onOpenEmergency,
  onOpenPrivateConcern,
  onOpenPricing,
}) {
  const { t, i18n } = useTranslation();
  const tr = (key, defaultValue, options = {}) =>
    t(key, { defaultValue, ...options });

  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      label: tr("common.home", "Home"),
      type: "section",
      target: "home",
      icon: Home,
    },
    {
      label: tr("common.reviews", "Reviews"),
      type: "section",
      target: "reviews",
      icon: Star,
    },
    {
      label: tr("common.pricing", "Pricing"),
      type: "route",
      target: "/pricing",
      icon: Sparkles,
    },
  ];

  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isLoggedIn = Boolean(session?.email);
  const isDoctor = session?.role === "doctor";
  const isAdmin = session?.role === "admin";
  const isPatient = session?.role === "patient";
  const isAnalysisPage = location.pathname === "/analysis";
  const doctorNeedsVerification =
    isDoctor && doctorVerificationStatus !== "verified";
  const showGetStarted = isLoggedIn && isPatient;

  const dashboardPath = useMemo(
    () =>
      session?.role === "doctor" ? "/dashboard/doctor" : "/dashboard/patient",
    [session?.role],
  );

  const modalType = useMemo(
    () => new URLSearchParams(location.search).get("modal"),
    [location.search],
  );
  const loginActive =
    !isLoggedIn && location.pathname === "/" && modalType === "login";
  const signupActive =
    !isLoggedIn && location.pathname === "/" && modalType === "signup";

  useEffect(() => {
    document.body.style.overflow =
      menuOpen || showLogoutConfirm ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, showLogoutConfirm]);

  const handleSectionNav = (id) => {
    setMenuOpen(false);

    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 140);
      return;
    }

    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleNavItemClick = (item) => {
    if (item.type === "section") {
      handleSectionNav(item.target);
      return;
    }

    setMenuOpen(false);
    navigate(item.target);
  };

  const goPrimaryAuthRoute = () => {
    setMenuOpen(false);
    if (!isLoggedIn) return;

    if (isPatient) {
      navigate(isAnalysisPage ? "/dashboard/patient" : "/analysis");
      return;
    }

    if (isAdmin) {
      navigate("/admin/verification");
      return;
    }

    if (doctorNeedsVerification) {
      navigate("/doctor/verification");
      return;
    }

    navigate(dashboardPath);
  };

  const goEmergency = () => {
    setMenuOpen(false);
    onOpenEmergency?.();
  };

  const goPrivateConcern = () => {
    setMenuOpen(false);
    onOpenPrivateConcern?.();
  };

  const goPricing = () => {
    setMenuOpen(false);
    onOpenPricing?.();
  };

  const primaryLabel = isAdmin
    ? tr("common.adminPanel", "Admin Panel")
    : doctorNeedsVerification
      ? tr("common.verification", "Verification")
      : isPatient
        ? isAnalysisPage
          ? tr("common.dashboard", "Dashboard")
          : tr("common.getStarted", "Begin Diagnosis")
        : tr("common.dashboard", "Dashboard");

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="pointer-events-none fixed inset-x-0 top-0 z-3200 px-4 py-4 sm:px-6 sm:py-5"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 lg:gap-5">
          <div className="flex min-w-0 flex-1 justify-start lg:flex-[0_0_auto]">
            <button
              onClick={() => handleSectionNav("home")}
              className="pointer-events-auto flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0a1128,#1b2d67)] text-white shadow-lg">
                <span className="text-lg font-serif italic">V</span>
              </div>
              <span className="truncate text-lg font-bold tracking-tighter text-slate-900">
                VEDA
                <span className="ml-0.5 text-xs font-light italic text-slate-400">
                  AI
                </span>
              </span>
            </button>
          </div>

          <nav className="pointer-events-auto hidden flex-1 items-center justify-center gap-1 rounded-full border border-slate-200/60 bg-white/76 px-2 py-1.5 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl lg:flex">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavItemClick(item)}
                className="rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-100/70 hover:text-slate-900 xl:px-4"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="pointer-events-auto hidden items-center justify-end gap-2 lg:flex lg:flex-[0_0_auto]">
            <div className="rounded-full border border-slate-200/60 bg-white/80 px-1.5 py-1 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="rounded-full bg-transparent px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 outline-none"
              >
                <option value="en">EN</option>
                <option value="hi">HI</option>
                <option value="or">OR</option>
              </select>
            </div>

            <div className="flex items-center gap-1 cursor-pointer rounded-full border border-slate-200/60 bg-white/76 p-1 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <EmergencyCta
                label={tr("common.urgentHelp", "Need Help?")}
                onClick={goEmergency}
              />
              <PrivateConcernCta
                label={tr("common.privateConcern", "Private Concern")}
                onClick={goPrivateConcern}
              />

              {!isLoggedIn ? (
                <>
                  <button
                    onClick={() => onOpenLogin?.("patient")}
                    className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors xl:px-5 ${loginActive ? "text-blue-600" : "text-slate-900"}`}
                  >
                    {tr("common.login", "Login")}
                  </button>
                  <button
                    onClick={onOpenSignup}
                    className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors xl:px-5 ${signupActive ? "bg-blue-700 text-white" : "bg-[#0a1128] text-white"}`}
                  >
                    {tr("common.signUp", "Sign up")}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  {isDoctor && (
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${statusStyle(doctorVerificationStatus)}`}
                    >
                      {doctorVerificationStatus}
                    </span>
                  )}
                  {isAdmin && (
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-700">
                      {tr("common.admin", "admin")}
                    </span>
                  )}
                  {showGetStarted && (
                    <button
                      onClick={onGetStarted}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700"
                    >
                      <Sparkles size={12} />
                      {tr("common.getStarted", "Begin Diagnosis")}
                    </button>
                  )}
                  <button
                    onClick={goPrimaryAuthRoute}
                    className="rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600 xl:px-5"
                  >
                    {primaryLabel}
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-500 xl:px-5"
                  >
                    {tr("common.logout", "Logout")}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pointer-events-auto flex flex-1 justify-end lg:hidden">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={
                menuOpen
                  ? tr("common.close", "Close")
                  : tr("common.navigation", "Navigation")
              }
              className="touch-manipulation flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence initial={false}>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-3180 bg-black/30 lg:hidden"
            />
            <motion.aside
              id="mobile-nav-drawer"
              variants={drawerVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed right-0 top-0 z-3190 flex h-full w-[84%] max-w-92.5 flex-col bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] will-change-transform lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-7">
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
                  {tr("common.navigation", "Navigation")}
                </span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="touch-manipulation text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4 px-4 pt-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                  <select
                    value={i18n.language}
                    onChange={(e) => i18n.changeLanguage(e.target.value)}
                    className="w-full rounded-xl bg-white cursor-pointer px-3 py-3 text-sm font-semibold text-slate-700 outline-none"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="or">Odia</option>
                  </select>
                </div>

                <EmergencyCta
                  label={tr("common.urgentHelp", "Need Help?")}
                  onClick={goEmergency}
                  mobile
                />
                <PrivateConcernCta
                  label={tr("common.privateConcern", "Private Concern")}
                  onClick={goPrivateConcern}
                  mobile
                />
              </div>

              <div className="flex flex-col px-4 py-6">
                {navItems.map((item) => (
                  <motion.button
                    key={item.label}
                    variants={linkVariants}
                    onClick={() => handleNavItemClick(item)}
                    className="group flex items-center justify-between rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-4">
                      <item.icon
                        size={20}
                        className="text-slate-300 group-hover:text-[#0a1128]"
                      />
                      <span className="text-lg font-medium text-slate-600 group-hover:text-slate-900">
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-slate-200 group-hover:text-slate-900"
                    />
                  </motion.button>
                ))}
              </div>

              <motion.div
                variants={linkVariants}
                className="mt-auto space-y-3 bg-slate-50/80 p-6"
              >
                {!isLoggedIn ? (
                  <>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenLogin?.("patient");
                      }}
                      className={`w-full rounded-2xl border py-4 text-[10px] font-bold uppercase tracking-widest ${loginActive ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-900"}`}
                    >
                      {tr("common.login", "Login")}
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenSignup?.();
                      }}
                      className={`w-full rounded-2xl py-4 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-900/10 ${signupActive ? "bg-blue-700 text-white" : "bg-[#0a1128] text-white"}`}
                    >
                      {tr("common.signUp", "Sign up")}
                    </button>
                  </>
                ) : (
                  <>
                    {isDoctor && (
                      <div
                        className={`flex items-center justify-center gap-2 rounded-2xl border py-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusStyle(doctorVerificationStatus)}`}
                      >
                        <ShieldCheck size={14} />
                        {doctorVerificationStatus}
                      </div>
                    )}
                    {isAdmin && (
                      <div className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700">
                        <ShieldCheck size={14} />
                        {tr("common.admin", "admin")}
                      </div>
                    )}
                    {showGetStarted && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onGetStarted?.();
                        }}
                        className="flex w-full items-center cursor-pointer justify-center gap-2 rounded-2xl bg-emerald-50 py-4 text-[10px] font-bold uppercase tracking-widest text-emerald-700"
                      >
                        <Sparkles size={14} />
                        {tr("common.getStarted", "Begin Diagnosis")}
                      </button>
                    )}
                    <button
                      onClick={goPrimaryAuthRoute}
                      className="flex w-full items-center cursor-pointer justify-center gap-2 rounded-2xl bg-[#0a1128] py-4 text-[10px] font-bold uppercase tracking-widest text-white"
                    >
                      <LayoutDashboard size={14} /> {primaryLabel}
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                      className="flex w-full items-center cursor-pointer justify-center gap-2 rounded-2xl bg-red-50 py-4 text-[10px] font-bold uppercase tracking-widest text-red-500"
                    >
                      <LogOut size={14} /> {tr("common.logout", "Logout")}
                    </button>
                  </>
                )}
              </motion.div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-3300 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-[#0a1128]/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm rounded-[2.5rem] bg-white p-10 text-center shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
                <LogOut size={28} />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                {tr("navbar.confirmLogoutTitle", "Wait!")}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {tr(
                  "navbar.confirmLogoutText",
                  "Are you sure you want to log out of your portal?",
                )}
              </p>
              <div className="mt-10 flex flex-col gap-3">
                <button
                  onClick={() => {
                    onLogout?.();
                    setShowLogoutConfirm(false);
                  }}
                  className="w-full rounded-2xl bg-red-500 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-red-600"
                >
                  {tr("common.yesSignOut", "Yes, Sign Out")}
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full rounded-2xl bg-slate-100 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400"
                >
                  {tr("common.stayLoggedIn", "Stay Logged In")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
