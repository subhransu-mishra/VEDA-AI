import { api } from "./authApi";

const extractErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message || error?.message || fallbackMessage;

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const doctorDashboardApi = {
  async getAssignedRequests({ token }) {
    try {
      const { data } = await api.get(
        "/consultation/doctor/requests",
        authHeaders(token),
      );
      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch doctor requests"),
      );
    }
  },

  async updateConsultationStatus({ token, consultationId, status }) {
    try {
      const { data } = await api.patch(
        `/consultation/doctor/${consultationId}/status`,
        { status },
        authHeaders(token),
      );
      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Failed to update consultation status"),
      );
    }
  },
};
