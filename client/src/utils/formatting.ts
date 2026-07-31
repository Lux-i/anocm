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