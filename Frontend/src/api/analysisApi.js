import { api } from "./authApi";

const extractErrorMessage = (error, fallbackMessage) => {
  return error?.response?.data?.message || error?.message || fallbackMessage;
};

export const analysisApi = {
  async parseVoiceInput({ token, text }) {
    try {
      const { data } = await api.post(
        "/voice/parse",
        { text },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Voice parsing failed"));
    }
  },

  async analyzeCase({ token, payload, reports = [] }) {
    try {
      const formData = new FormData();

      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        formData.append(key, String(value));
      });

      reports.forEach((file) => {
        formData.append("reports", file);
      });

      const { data } = await api.post("/case/analyze", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Case analysis failed"));
    }
  },

  async getMatchedDoctors({
    token,
    caseId,
    specialist = "",
    onlyAvailable = true,
  }) {
    try {
      const { data } = await api.get(`/doctors/match/${caseId}`, {
        params: {
          onlyAvailable,
          ...(specialist ? { specialist } : {}),
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Doctor matching failed"));
    }
  },

  async createConsultation({ token, caseId, doctorId }) {
    try {
      const payload = { caseId };
      if (doctorId) payload.doctorId = doctorId;

      const { data } = await api.post("/consultation/create", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Consultation creation failed"),
      );
    }
  },

  async getConsultationById({ token, consultationId }) {
    try {
      const { data } = await api.get(`/consultation/${consultationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch consultation"),
      );
    }
  },
};
