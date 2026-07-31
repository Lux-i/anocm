// TODO: extract formatTimestamp, getInitials, getAvatarColor

import { TFunction } from "i18next";

export const formatTimestamp = (date: Date, t: TFunction): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t("common.now");
    if (diffMins < 60) return t("timeUnits.minute", { count: diffMins });
    if (diffMins < 1440) return t("timeUnits.hour", { count: Math.floor(diffMins / 60) });
    return t("timeUnits.day", { count: Math.floor(diffMins / 1440) });
};

export const getInitials = (name: string): string => {
    if (!name || name.length === 0) return "??";

    return name
        .split(" ")
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export const getAvatarColor = (name: string, isAnonymous: boolean) => {
    if (isAnonymous) return "bg-purple-500";

    // Fallback
    if (!name || name.length === 0) return "bg-gray-500";

    const colors = [
        "bg-blue-500",
        "bg-green-500",
        "bg-orange-500",
        "bg-red-500",
        "bg-purple-500",
        "bg-teal-500",
        "bg-pink-500",
        "bg-indigo-500",
    ];

    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
}