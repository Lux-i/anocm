import { Credentials } from "../contexts/CredentialContext";
import { t } from "i18next";

export const CredentialInput = (
  credentials: Credentials,
  setCredentials: React.Dispatch<React.SetStateAction<Credentials>>,
) => {
  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder={t("authPage.inputField.username")}
        value={credentials.username}
        onChange={(e) =>
          setCredentials((prev) => ({ ...prev, username: e.target.value }))
        }
        className="w-full px-4 py-4 bg-gray-50 border-0 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200"
      />

      <input
        type="password"
        placeholder={t("authPage.inputField.password")}
        value={credentials.password}
        onChange={(e) =>
          setCredentials((prev) => ({ ...prev, password: e.target.value }))
        }
        className="w-full px-4 py-4 bg-gray-50 border-0 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200"
      />
    </div>
  );
};
