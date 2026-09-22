import { DatabaseResponse } from "@anocm/shared";
import { t } from "i18next";

const API_V2 = "/api/v2";

export class AuthenticationService {
  public createAnonymousUser = async (): Promise<{
    success: boolean;
    userId?: string;
    error?: string;
  }> => {
    try {
      const res = await fetch(`${API_V2}/user/newano`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as DatabaseResponse;

      if (data.success) {
        return { success: true, userId: data.id }; // Das ist die clientId zum Einloggen
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error("Netzwerkfehler:", err);
      return { success: false, error: t("errorMessages.networkError") };
    }
  };

  public loginUser = async (
    username: string,
    password: string,
  ): Promise<{
    success: boolean;
    userId?: string;
    token?: string;
    error?: string;
  }> => {
    try {
      const res = await fetch(`${API_V2}/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId_username: username,
          ...(password && { password }),
        }),
      });
      const data = (await res.json()) as DatabaseResponse;
      console.log("Login Response:", data);
      if (data.success) {
        // v2 liefert entweder [userId, token] oder [token]
        if (Array.isArray(data.userData) && data.userData.length >= 2) {
          return {
            success: true,
            userId: data.userData[0],
            token: data.userData[1],
          };
        } else if (typeof data.userData === "string") {
          return { success: true, userId: data.id, token: data.userData };
        } else {
          return {
            success: false,
            error: t("errorMessages.unexpectedResponse"),
          };
        }
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error("Netzwerkfehler:", err);
      return { success: false, error: t("errorMessages.networkError") };
    }
  };

  public registerUser = async (
    username: string,
    password: string,
  ): Promise<{ success: boolean; userId?: string; error?: string }> => {
    try {
      const res = await fetch(`${API_V2}/user/newuser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as DatabaseResponse;
      if (data.success) {
        return { success: true, userId: data.id };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error("Netzwerkfehler:", err);
      return { success: false, error: t("errorMessages.networkError") };
    }
  };
}
