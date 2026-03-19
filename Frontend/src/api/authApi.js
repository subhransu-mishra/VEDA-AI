import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

const extractErrorMessage = (error, fallbackMessage) => {
  return error?.response?.data?.message || error?.message || fallbackMessage;
};

export const authApi = {
  async adminLogin(payload) {
    try {
      const { data } = await api.post("/auth/admin/login", payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Admin login failed"));
    }
  },

  async patientSignup(payload) {
    try {
      const { data } = await api.post("/auth/patient/signup", payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Patient signup failed"));
    }
  },

  async patientLogin(payload) {
    try {
      const { data } = await api.post("/auth/patient/login", payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Patient login failed"));
    }
  },

  async doctorSignup(payload) {
    try {
      const { data } = await api.post("/auth/doctor/signup", payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Doctor signup failed"));
    }
  },

  async doctorLogin(payload) {
    try {
      const { data } = await api.post("/auth/doctor/login", payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Doctor login failed"));
    }
  },
};

export { api };
