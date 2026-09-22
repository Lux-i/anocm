import { t } from "i18next";
import { useNavigate } from "react-router";

export const TabSwitcher: React.FC<{
  activeTab: "login" | "register";
}> = ({ activeTab }) => {
  const navigate = useNavigate();

  return (
    <div className="relative bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
      <div className="flex relative">
        <div
          className={`absolute top-1 bottom-1 w-1/2 bg-white dark:bg-gray-900 rounded-lg shadow-sm transition-transform duration-300 ease-out ${
            activeTab === "register" ? "transform translate-x-full" : ""
          }`}
        />

        <button
          onClick={() => navigate("/login")}
          className={`flex-1 py-3 text-center font-medium transition-colors duration-300 relative z-10 ${
            activeTab === "login"
              ? "text-gray-900 dark:text-gray-100"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {t("authPage.tabSwitcher.login")}
        </button>
        <button
          onClick={() => navigate("/register")}
          className={`flex-1 py-3 text-center font-medium transition-colors duration-300 relative z-10 ${
            activeTab === "register"
              ? "text-gray-900 dark:text-gray-100"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {t("authPage.tabSwitcher.register")}
        </button>
      </div>
    </div>
  );
};
