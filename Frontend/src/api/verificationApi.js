import { api } from "./authApi";

const extractErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message || error?.message || fallbackMessage;

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const verificationApi = {
  async getMyVerification({ token }) {
    try {
      const { data } = await api.get(
        "/doctors/verification/me",
        authHeaders(token),
      );
      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch doctor verification"),
      );
    }
  },

  async submitVerification({ token, payload, files }) {
    try {
      const formData = new FormData();

      Object.entries(payload || {}).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      Object.entries(files || {}).forEach(([field, file]) => {
        if (file instanceof File) {
          formData.append(field, file);
        }
      });

      const { data } = await api.post("/doctors/verification", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Failed to submit verification"),
      );
    }
  },

  async listApplications({ token, status = "all" }) {
    try {
      const { data } = await api.get(
        "/doctors/verification/admin/applications",
        {
          params: { status },
          ...authHeaders(token),
        },
      );
      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch verification applications"),
      );
    }
  },

  async reviewApplication({ token, doctorId, status, reviewReason }) {
    try {
      const { data } = await api.patch(
        `/doctors/verification/admin/${doctorId}/review`,
        {
          status,
          reviewReason,
        },
        authHeaders(token),
      );
      return data;
    } catch (error) {
      throw new Error(
        extractErrorMessage(error, "Failed to review verification application"),
      );
    }
  },
};
