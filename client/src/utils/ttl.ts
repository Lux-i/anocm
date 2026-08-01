import { TFunction } from "i18next";

export const formatTTL = (seconds: number, t: TFunction): string => {
    if (seconds < 0) return t("ttlPresets.permanent");
    if (seconds === 0) return t("ttlPresets.broadcast");
    if (seconds < 60) return t("timeUnits.second", { count: seconds });
    if (seconds < 3600) return t("timeUnits.minute", { count: Math.floor(seconds / 60) });
    if (seconds < 86400) return t("timeUnits.hour", { count: Math.floor(seconds / 3600) });
    return t("timeUnits.day", { count: Math.floor(seconds / 86400) });
};

export const cleanTTL = (val: any, fallback: number): number => {
    console.log(`val: ${val}`);

    const n = Number(val);
    return Number.isNaN(n) ? fallback : n;
};

export function getTtlOptions(min: number, def: number, max: number): number[] {
    const presets = [
        min,
        def,
        max,
        300,
        900,
        3600,
        21600,
        86400,
        604800,
        2592000,
    ];
    return Array.from(
        new Set(presets.filter((x) => x >= min && x <= max))
    ).sort((a, b) => a - b);
};

export function checkIfTTLIsValid(ttl: number, min: number, max: number): boolean {
    if (ttl == -1 && max == -1) return true;
    if (min == -1 && max == -1 && ttl != -1) return false;
    if (ttl < min && min != -1) return false;
    if (ttl > max && max != -1) return false;
    return true;
};