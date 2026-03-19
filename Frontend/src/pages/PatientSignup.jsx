import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/authApi";
import { createSession, upsertPatientCache } from "../utils/authStorage";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\d{10}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const LineInput = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
  options = [],
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const isActive = isFocused || value?.toString().trim().length > 0;

  return (
    <motion.div layout className="relative flex w-full flex-col pt-6">
      <motion.label
        layout
        className={`absolute left-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
          isActive
            ? "top-0 text-xs font-semibold tracking-widest text-slate-500 uppercase"
            : "top-6 text-lg text-slate-400"
        }`}
      >
        {label}
      </motion.label>

      {type === "textarea" ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="peer min-h-10 w-full resize-none border-b-2 border-slate-200 bg-transparent py-2 text-xl font-medium text-slate-900 transition-colors duration-300 focus:border-slate-900 focus:outline-none"
          {...props}
        />
      ) : type === "select" ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`peer w-full appearance-none border-b-2 border-slate-200 bg-transparent py-2 text-xl font-medium transition-colors duration-300 focus:border-slate-900 focus:outline-none cursor-pointer ${value ? "text-slate-900" : "text-transparent"}`}
          {...props}
        >
          <option value="" disabled className="text-slate-400">
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-slate-900">
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="peer w-full border-b-2 border-slate-200 bg-transparent py-2 text-xl font-medium text-slate-900 transition-colors duration-300 focus:border-slate-900 focus:outline-none"
          {...props}
        />
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -5 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-2 text-sm font-medium text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function PatientSignup({ onSignup }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    age: "",
    height: "",
    weight: "",
    gender: "",
    bloodGroup: "",
    city: "",
    emergencyName: "",
    emergencyPhone: "",
    primaryConcern: "",
    knownConditions: "",
    allergies: "",
    consent: false,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const next = {};
    if (form.fullName.trim().length < 3) next.fullName = t("patientSignup.errors.fullName");
    if (!emailRegex.test(form.email.trim())) next.email = t("patientSignup.errors.email");
    if (!phoneRegex.test(form.phone.trim())) next.phone = t("patientSignup.errors.phone");
    if (!passwordRegex.test(form.password)) next.password = t("patientSignup.errors.password");
    if (form.confirmPassword !== form.password) next.confirmPassword = t("patientSignup.errors.confirmPassword");

    const age = Number(form.age);
    if (!Number.isFinite(age) || age < 1 || age > 120) next.age = t("patientSignup.errors.age");

    const height = Number(form.height);
    if (!Number.isFinite(height) || height < 50 || height > 300) next.height = t("patientSignup.errors.height");
    const weight = Number(form.weight);
    if (!Number.isFinite(weight) || weight < 2 || weight > 500) next.weight = t("patientSignup.errors.weight");

    if (!form.gender) next.gender = t("patientSignup.errors.selection");
    if (!form.bloodGroup) next.bloodGroup = t("patientSignup.errors.selection");
    if (form.city.trim().length < 2) next.city = t("patientSignup.errors.city");
    if (form.emergencyName.trim().length < 3) next.emergencyName = t("patientSignup.errors.emergencyName");
    if (!phoneRegex.test(form.emergencyPhone.trim())) next.emergencyPhone = t("patientSignup.errors.phone");
    if (form.primaryConcern.trim().length < 8) next.primaryConcern = t("patientSignup.errors.primaryConcern");
    if (!form.consent) next.consent = t("patientSignup.errors.consent");

    return next;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      age: Number(form.age),
      height: Number(form.height),
      weight: Number(form.weight),
      bloodType: form.bloodGroup,
      gender: form.gender,
      phoneNumber: form.phone.trim(),
      city: form.city.trim(),
      emergencyContactName: form.emergencyName.trim(),
      emergencyPhone: form.emergencyPhone.trim(),
    };

    setIsSubmitting(true);

    try {
      const response = await authApi.patientSignup(payload);
      const patient = {
        ...response.patient,
        role: "patient",
        primaryConcern: form.primaryConcern.trim(),
        knownConditions: form.knownConditions.trim(),
        allergiesNotes: form.allergies.trim(),
      };

      upsertPatientCache(patient);

      const session = createSession({
        user: response.patient,
        role: "patient",
        token: response.token,
      });

      onSignup?.(session);
      toast.success(response.message || "Patient registered successfully");
      navigate("/dashboard/patient");
    } catch (error) {
      toast.error(error.message || "Patient signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", damping: 20, stiffness: 100 },
    },
  };

  return (
    <main className="relative min-h-screen bg-[#F5F5F7] px-6 py-20 selection:bg-slate-300 sm:px-12 lg:px-24">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      <div className="relative z-10 mx-auto w-full max-w-3xl">
        <motion.div whileTap={{ scale: 0.98 }} className="mb-20 inline-block cursor-default">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-slate-500">
            {t("patientSignup.sectionLabel")}
          </p>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 sm:text-4xl">
            {t("patientSignup.titlePrefix")}{" "}
            <span className="italic text-slate-500 transition-colors duration-500 hover:text-slate-900">
              {t("patientSignup.titleAccent")}
            </span>
          </h1>
        </motion.div>

        <motion.form
          variants={containerVariants}
          initial="hidden"
          animate="show"
          onSubmit={onSubmit}
          className="flex flex-col gap-10"
        >
          <motion.div variants={itemVariants} className="grid grid-cols-1 gap-10 sm:grid-cols-2">
            <LineInput label={t("patientSignup.legalName")} name="fullName" value={form.fullName} onChange={onChange} error={errors.fullName} />
            <LineInput label={t("patientSignup.emailAddress")} name="email" type="email" value={form.email} onChange={onChange} error={errors.email} />
          </motion.div>

          <motion.div variants={itemVariants} className="grid grid-cols-1 gap-10 sm:grid-cols-4">
            <LineInput label={t("patientSignup.age")} name="age" type="number" value={form.age} onChange={onChange} error={errors.age} />
            <LineInput label={t("patientSignup.height")} name="height" type="number" value={form.height} onChange={onChange} error={errors.height} />
            <LineInput label={t("patientSignup.weight")} name="weight" type="number" value={form.weight} onChange={onChange} error={errors.weight} />
            <LineInput
              label={t("patientSignup.bloodType")}
              name="bloodGroup"
              type="select"
              value={form.bloodGroup}
              onChange={onChange}
              error={errors.bloodGroup}
              placeholder={t("patientSignup.selectPlaceholder")}
              options={[
                { value: "A+", label: "A+" },
                { value: "A-", label: "A-" },
                { value: "B+", label: "B+" },
                { value: "B-", label: "B-" },
                { value: "AB+", label: "AB+" },
                { value: "AB-", label: "AB-" },
                { value: "O+", label: "O+" },
                { value: "O-", label: "O-" },
              ]}
            />
          </motion.div>

          <motion.div variants={itemVariants} className="grid grid-cols-1 gap-10 sm:grid-cols-2">
            <LineInput
              label={t("patientSignup.genderIdentity")}
              name="gender"
              type="select"
              value={form.gender}
              onChange={onChange}
              error={errors.gender}
              placeholder={t("patientSignup.selectPlaceholder")}
              options={[
                { value: "female", label: t("patientSignup.genderOptions.female") },
                { value: "male", label: t("patientSignup.genderOptions.male") },
                { value: "non-binary", label: t("patientSignup.genderOptions.nonBinary") },
                { value: "prefer-not-to-say", label: t("patientSignup.genderOptions.preferNotToSay") },
              ]}
            />
            <LineInput label={t("patientSignup.phoneNumber")} name="phone" value={form.phone} onChange={onChange} error={errors.phone} />
          </motion.div>

          <motion.div variants={itemVariants}>
            <LineInput label={t("patientSignup.cityOfResidence")} name="city" value={form.city} onChange={onChange} error={errors.city} />
          </motion.div>

          <motion.div variants={itemVariants} className="mt-8 grid grid-cols-1 gap-10 border-t border-slate-200 pt-8 sm:grid-cols-2">
            <LineInput label={t("patientSignup.emergencyContactName")} name="emergencyName" value={form.emergencyName} onChange={onChange} error={errors.emergencyName} />
            <LineInput label={t("patientSignup.emergencyPhone")} name="emergencyPhone" value={form.emergencyPhone} onChange={onChange} error={errors.emergencyPhone} />
          </motion.div>

          <motion.div variants={itemVariants} className="mt-8 grid grid-cols-1 gap-10">
            <LineInput label={t("patientSignup.primaryConcern")} name="primaryConcern" type="textarea" value={form.primaryConcern} onChange={onChange} error={errors.primaryConcern} />
            <LineInput label={t("patientSignup.knownConditions")} name="knownConditions" type="textarea" value={form.knownConditions} onChange={onChange} />
            <LineInput label={t("patientSignup.allergies")} name="allergies" type="textarea" value={form.allergies} onChange={onChange} />
          </motion.div>

          <motion.div variants={itemVariants} className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-2">
            <LineInput label={t("patientSignup.createPassword")} name="password" type="password" value={form.password} onChange={onChange} error={errors.password} />
            <LineInput label={t("patientSignup.confirmPassword")} name="confirmPassword" type="password" value={form.confirmPassword} onChange={onChange} error={errors.confirmPassword} />
          </motion.div>

          <motion.div variants={itemVariants} className="mt-16 flex flex-col gap-8">
            <motion.label layout className="group flex cursor-pointer items-start gap-4">
              <div className="relative mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 border-slate-300 transition-colors group-hover:border-slate-900">
                <input
                  type="checkbox"
                  name="consent"
                  checked={form.consent}
                  onChange={onChange}
                  className="peer absolute h-full w-full cursor-pointer opacity-0"
                />
                <motion.svg
                  initial={false}
                  animate={{
                    scale: form.consent ? 1 : 0,
                    opacity: form.consent ? 1 : 0,
                  }}
                  className="pointer-events-none h-3 w-3 fill-slate-900"
                  viewBox="0 0 12 12"
                >
                  <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                </motion.svg>
              </div>
              <span className="text-lg text-slate-500 transition-colors group-hover:text-slate-900">
                {t("patientSignup.consent")}
              </span>
            </motion.label>

            <AnimatePresence>
              {errors.consent && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-red-500"
                >
                  {errors.consent}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between border-t border-slate-200 pt-8">
              <Link
                to="/signup"
                className="text-sm font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-900"
              >
                {t("patientSignup.cancel")}
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative overflow-hidden rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold uppercase tracking-widest text-white transition-all hover:bg-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="relative z-10 flex items-center gap-3">
                  {isSubmitting ? t("patientSignup.submitting") : t("patientSignup.submit")}{" "}
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    &rarr;
                  </span>
                </span>
              </button>
            </div>
          </motion.div>
        </motion.form>
      </div>
    </main>
  );
}
