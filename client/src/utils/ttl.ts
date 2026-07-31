// TODO: extract cleanTTL, getTtlOptions, checkIfTTLIsValid

import { TFunction } from "i18next";

export const formatTTL = (seconds: number, t: TFunction): string => {
    if (seconds < 0) return t("ttlPresets.permanent");
    if (seconds === 0) return t("ttlPresets.broadcast");
    if (seconds < 60) return t("timeUnits.second", { count: seconds });
    if (seconds < 3600) return t("timeUnits.minute", { count: Math.floor(seconds / 60) });
    if (seconds < 86400) return t("timeUnits.hour", { count: Math.floor(seconds / 3600) });
    return t("timeUnits.day", { count: Math.floor(seconds / 86400) });
};