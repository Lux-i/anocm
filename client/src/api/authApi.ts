import { DatabaseResponse } from "@anocm/shared/dist/database";
import { API_V2 } from "../features/constants";

export type AuthResult = {
    success: boolean;
    userId?: string;
    token?: string; // loginUser
    tError?: string; // needs to go through TFunction
};

export const createAnonymousUser = async (): Promise<AuthResult> => {
    try {
        const res = await fetch(`${API_V2}/user/newano`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        const data = await res.json() as DatabaseResponse;
        
        if (data.success) {
            return { success: true, userId: data.id };
        } else {
            return { success: false, tError: data.error };
        }
    } catch (err) {
        console.error("Netzwerkfehler:", err);
        return { success: false, tError: "errorMessages.networkError" };
    }
};

export const loginUser = async (
    username: string,
    password: string,
): Promise<AuthResult> => {
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
                return { success: false, tError: "errorMessages.unexpectedResponse" };
            }
        } else {
            return { success: false, tError: data.error };
        }
    } catch (err) {
        console.error("Netzwerkfehler:", err);
        return { success: false, tError: "errorMessages.networkError" };
    }
};

export const registerUser = async (
    username: string,
    password: string,
): Promise<AuthResult> => {
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
            return { success: false, tError: data.error };
        }
    } catch (err) {
        console.error("Netzwerkfehler:", err);
        return { success: false, tError: "errorMessages.networkError" };
    }
};