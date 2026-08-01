import { describe, it, expect } from "vitest";
import { getInitials, getAvatarColor } from "../utils/formatting";

describe("getInitials", () => {
    it("should return the first letter of each of two words, uppercased", () => {
        expect(getInitials("john doe")).toBe("JD");
    });

    it("should uppercase initials even if the name is lowercase", () => {
        expect(getInitials("alice bob")).toBe("AB");
    });

    it("should return a single initial for a one-word name", () => {
        expect(getInitials("madonna")).toBe("M");
    });

    it("should slice to a maximum of 2 characters for names with 3+ words", () => {
        expect(getInitials("john jacob smith")).toBe("JJ");
    });

    it("should return '??' for an empty string", () => {
        expect(getInitials("")).toBe("??");
    });

    it("should return '??' for undefined/null-like falsy input", () => {
        // @ts-expect-error testing runtime guard against non-string falsy input
        expect(getInitials(undefined)).toBe("??");
    });

    it("should handle multiple spaces between words", () => {
        // split(" ") on "john  doe" produces ["john", "", "doe"];
        // the empty string's charAt(0) is "", so the middle initial is dropped
        expect(getInitials("john  doe")).toBe("JD");
    });

    it("should handle a name with leading/trailing whitespace", () => {
        // split(" ") on " john doe" produces ["", "john", "doe"];
        // first "word" is empty, so its charAt(0) contributes ""
        expect(getInitials(" john doe")).toBe("JD");
    });
});

describe("getAvatarColor", () => {
    it("should always return purple for anonymous users, regardless of name", () => {
        expect(getAvatarColor("Alice", true)).toBe("bg-purple-500");
        expect(getAvatarColor("", true)).toBe("bg-purple-500");
    });

    it("should return gray as the fallback for an empty name", () => {
        expect(getAvatarColor("", false)).toBe("bg-gray-500");
    });

    it("should deterministically return the same color for the same name", () => {
        const first = getAvatarColor("Alice", false);
        const second = getAvatarColor("Alice", false);
        expect(first).toBe(second);
    });

    it("should map different starting characters to potentially different colors", () => {
        // "A".charCodeAt(0) = 65, 65 % 8 = 1 -> "bg-green-500"
        expect(getAvatarColor("Alice", false)).toBe("bg-green-500");
        // "B".charCodeAt(0) = 66, 66 % 8 = 2 -> "bg-orange-500"
        expect(getAvatarColor("Bob", false)).toBe("bg-orange-500");
    });

    it("should only use the first character of the name to determine color", () => {
        expect(getAvatarColor("Alice", false)).toBe(getAvatarColor("Aaron", false));
    });
});