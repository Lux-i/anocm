import { describe, it, expect } from "vitest";
import { formatTTL, cleanTTL, getTtlOptions, checkIfTTLIsValid } from "../utils/ttl";

// fake i18next TFunction — returns the key plus interpolation options
// so we can assert on which translation key + count was requested
const fakeT = ((key: string, opts?: Record<string, unknown>) =>
    opts ? `${key}:${JSON.stringify(opts)}` : key) as any;

describe("formatTTL", () => {
    it("should return the permanent label for negative TTL", () => {
        expect(formatTTL(-1, fakeT)).toBe("ttlPresets.permanent");
    });

    it("should return the broadcast label for zero TTL", () => {
        expect(formatTTL(0, fakeT)).toBe("ttlPresets.broadcast");
    });

    it("should format seconds when under a minute", () => {
        expect(formatTTL(30, fakeT)).toBe('timeUnits.second:{"count":30}');
    });

    it("should format minutes when under an hour", () => {
        expect(formatTTL(90, fakeT)).toBe('timeUnits.minute:{"count":1}');
    });

    it("should format hours when under a day", () => {
        expect(formatTTL(3661, fakeT)).toBe('timeUnits.hour:{"count":1}');
    });

    it("should format days for anything a day or longer", () => {
        expect(formatTTL(90000, fakeT)).toBe('timeUnits.day:{"count":1}');
    });

    it("should treat the minute/hour/day boundaries correctly", () => {
        expect(formatTTL(59, fakeT)).toBe('timeUnits.second:{"count":59}');
        expect(formatTTL(60, fakeT)).toBe('timeUnits.minute:{"count":1}');
        expect(formatTTL(3599, fakeT)).toBe('timeUnits.minute:{"count":59}');
        expect(formatTTL(3600, fakeT)).toBe('timeUnits.hour:{"count":1}');
        expect(formatTTL(86399, fakeT)).toBe('timeUnits.hour:{"count":23}');
        expect(formatTTL(86400, fakeT)).toBe('timeUnits.day:{"count":1}');
    });
});

describe("cleanTTL", () => {
    it("should return the numeric value when given a valid number", () => {
        expect(cleanTTL(3600, 999)).toBe(3600);
    });

    it("should return the numeric value when given a numeric string", () => {
        expect(cleanTTL("3600", 999)).toBe(3600);
    });

    it("should return the fallback when given undefined", () => {
        expect(cleanTTL(undefined, 999)).toBe(999);
    });

    it("should coerce null to 0 via Number(), not fall back", () => {
        // Number(null) === 0, so cleanTTL treats null the same as an explicit 0
        expect(cleanTTL(null, 999)).toBe(0);
    });

    it("should return the fallback when given a non-numeric string", () => {
        expect(cleanTTL("not-a-number", 999)).toBe(999);
    });

    it("should return 0, not the fallback, when given 0", () => {
        expect(cleanTTL(0, 999)).toBe(0);
    });

    it("should preserve -1 (the 'permanent' sentinel), not fall back", () => {
        expect(cleanTTL(-1, 999)).toBe(-1);
    });
});

describe("getTtlOptions", () => {
    it("should include min, def, and max plus in-range presets, deduped and sorted", () => {
        const result = getTtlOptions(300, 3600, 604800);
        expect(result).toEqual([300, 900, 3600, 21600, 86400, 604800]);
    });

    it("should exclude presets outside the min/max range", () => {
        const result = getTtlOptions(3600, 3600, 3600);
        // only 3600 itself survives the filter, deduped to a single entry
        expect(result).toEqual([3600]);
    });

    it("should handle the permanent sentinel (-1) for min/def/max together", () => {
        const result = getTtlOptions(-1, -1, -1);
        // none of the fixed presets (300, 900, ...) are >= -1 AND <= -1,
        // so only the -1 values themselves survive
        expect(result).toEqual([-1]);
    });

    it("should not include duplicate values when min/def/max overlap with presets", () => {
        const result = getTtlOptions(300, 300, 604800);
        expect(new Set(result).size).toBe(result.length);
    });

    it("should return values in ascending order", () => {
        const result = getTtlOptions(0, 3600, 2592000);
        const sorted = [...result].sort((a, b) => a - b);
        expect(result).toEqual(sorted);
    });
});

describe("checkIfTTLIsValid", () => {
    it("should allow a permanent ttl (-1) when max is also permanent (-1)", () => {
        expect(checkIfTTLIsValid(-1, 0, -1)).toBe(true);
    });

    it("should reject a non-permanent ttl when both min and max are permanent (-1)", () => {
        expect(checkIfTTLIsValid(100, -1, -1)).toBe(false);
    });

    it("should reject a ttl below min (when min is not the permanent sentinel)", () => {
        expect(checkIfTTLIsValid(50, 100, 1000)).toBe(false);
    });

    it("should reject a ttl above max (when max is not the permanent sentinel)", () => {
        expect(checkIfTTLIsValid(2000, 0, 1000)).toBe(false);
    });

    it("should accept a ttl within the min/max range", () => {
        expect(checkIfTTLIsValid(500, 0, 1000)).toBe(true);
    });

    it("should accept a ttl exactly at the min boundary", () => {
        expect(checkIfTTLIsValid(100, 100, 1000)).toBe(true);
    });

    it("should accept a ttl exactly at the max boundary", () => {
        expect(checkIfTTLIsValid(1000, 100, 1000)).toBe(true);
    });

    it("should accept any ttl above min when max is permanent (-1)", () => {
        expect(checkIfTTLIsValid(999999, 100, -1)).toBe(true);
    });

    it("should reject a ttl below min even when max is permanent (-1)", () => {
        expect(checkIfTTLIsValid(50, 100, -1)).toBe(false);
    });
});