import { User } from "@anocm/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createAnonymousUser, loginUser, registerUser } from "../api/authApi";

export const useAuth = () => {
    const { t } = useTranslation();

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loginForm, setLoginForm] = useState({ username: "", password: "" });
    const [authMode, setAuthMode] = useState<"login" | "register">("login");
    const [authError, setAuthError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const handleLogin = async (asAnonymous = false) => {
        console.log("Login startet...");
        setAuthError(null);
        
        if (asAnonymous) {
            const result = await createAnonymousUser();

            if (result.success) {
                setAuthError(null);
                setSuccessMessage(
                    t("successMessages.accountCreated", { userId: result.userId })
                );
            } else {
                setAuthError(
                    t("errorMessages.authError.anoUserCreationFailed", {
                        error: result.tError,
                    }),
                );
            }
        } else {
            if (!loginForm.username) return; // Nur Username erforderlich

            const result = await loginUser(loginForm.username, loginForm.password);
            
            if (result.success) {
                const newUser = {
                    userId: result.userId!,
                    username: loginForm.username,
                    isOnline: true,
                    isAnonymous: !loginForm.password, // Anonym wenn kein Passwort
                    token: result.token!,
                };

                console.log("Setze beide States gleichzeitig...");

                setCurrentUser(newUser);
                setIsAuthenticated(true);
            } else {
                console.error("Login fehlgeschlagen:", result.tError);
                setAuthError(
                    t("errorMessages.authError.loginFailed", { error: result.tError }),
                );
            }
        }
    };

    const handleRegister = async () => {
        setAuthError(null);

        if (!loginForm.username || !loginForm.password) {
            setAuthError(t("errorMessage.authError.missingParameters"));
            return;
        }

        const result = await registerUser(loginForm.username, loginForm.password);
        if (!result.success) {
            setAuthError(
                t("errorMessages.authError.missingParameters", {
                    error: result.tError
                }),
            );
            return;
        }
    
        const loginResult = await loginUser(loginForm.username, loginForm.password);
        if (loginResult.success) {
            const newUser = {
                userId: loginResult.userId!,
                username: loginForm.username,
                isOnline: true,
                isAnonymous: false,
                token: loginResult.token,
            };

            setCurrentUser(newUser);
            setIsAuthenticated(true);
        }
    };

    const handleAuthLogout = () => {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setLoginForm({ username: "", password: "" });
    };

    return {
        isAuthenticated,
        currentUser,
        loginForm,
        setLoginForm,
        authMode,
        setAuthMode,
        authError,
        successMessage,
        handleLogin,
        handleRegister,
        handleAuthLogout,
    };
};