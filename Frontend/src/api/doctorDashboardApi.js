import { api } from "./authApi";

const extractErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message || error?.message || fallbackMessage;

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const doctorDashboardApi = {
  async getDoctorCaseByCaseId({ token, caseId }) {
    try {
      const { data } = await api.get(
        `/consultation/doctor/case/${encodeURIComponent(caseId)}`,
        authHeaders(token),
      );
      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch case details"),
      );
    }
  },

  async submitDoctorCaseResponse({ token, consultationId, payload }) {
    try {
      const { data } = await api.patch(
        `/consultation/doctor/${consultationId}/response`,
        payload,
        authHeaders(token),
      );
      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Failed to submit doctor response"),
      );
    }
  },

  async getAllCases({ token }) {
    try {
      const { data } = await api.get(
        "/consultation/doctor/all-cases",
        authHeaders(token),
      );
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Failed to fetch all cases"));
    }
  },

  async getAssignableDoctors({ token }) {
    try {
      const { data } = await api.get(
        "/consultation/doctor/assignees",
        authHeaders(token),
      );
      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch assignable doctors"),
      );
    }
  },

  async claimCase({ token, consultationId }) {
    try {
      const { data } = await api.patch(
        `/consultation/doctor/${consultationId}/claim`,
        {},
        authHeaders(token),
      );
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Failed to assign case"));
    }
  },

  async reassignCase({ token, consultationId, doctorId }) {
    try {
      const { data } = await api.patch(
        `/consultation/doctor/${consultationId}/reassign`,
        { doctorId },
        authHeaders(token),
      );
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Failed to reassign case"));
    }
  },

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
