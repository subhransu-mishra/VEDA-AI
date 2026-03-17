import { api } from "./authApi";

const extractErrorMessage = (error, fallbackMessage) => {
  return error?.response?.data?.message || error?.message || fallbackMessage;
};

export const analysisApi = {
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
};
