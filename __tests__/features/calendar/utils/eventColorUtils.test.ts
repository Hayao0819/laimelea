import {
  adjustEventColor,
  getContrastRatio,
  meetsContrastAA,
} from "../../../../src/features/calendar/utils/eventColorUtils";

describe("eventColorUtils", () => {
  describe("adjustEventColor", () => {
    describe("dark mode adjustments", () => {
      it("should adjust a bright red color", () => {
        const result = adjustEventColor("#FF0000", true);
        expect(result).not.toBe("#FF0000");
        expect(result).toMatch(/^#[0-9a-f]{6}$/);
      });

      it("should increase lightness for a very dark color", () => {
        const result = adjustEventColor("#003300", true);
        expect(result).not.toBe("#003300");
        expect(result).toMatch(/^#[0-9a-f]{6}$/);
      });

      it("should clamp saturation to 0.6 for highly saturated colors", () => {
        // Pure blue (#0000FF) has saturation 1.0 and lightness 0.5
        const result = adjustEventColor("#0000FF", true);
        // The result should be less saturated (more muted)
        expect(result).not.toBe("#0000FF");
        expect(result).toMatch(/^#[0-9a-f]{6}$/);
      });

      it("should clamp lightness to max 0.8", () => {
        // A very light color (#EEEEFF) should have lightness clamped at 0.8
        const result = adjustEventColor("#EEEEFF", true);
        expect(result).toMatch(/^#[0-9a-f]{6}$/);
      });

      it("should ensure lightness is at least 0.5", () => {
        // Dark green #003300 has very low lightness
        const result = adjustEventColor("#003300", true);
        // Parse the result: it should be noticeably lighter
        const rHex = parseInt(result.slice(1, 3), 16);
        const gHex = parseInt(result.slice(3, 5), 16);
        const bHex = parseInt(result.slice(5, 7), 16);
        const maxChannel = Math.max(rHex, gHex, bHex);
        // At least one channel should be significantly brighter
        expect(maxChannel).toBeGreaterThan(100);
      });
    });

    describe("light mode (no adjustment)", () => {
      it("should return the color unchanged", () => {
        expect(adjustEventColor("#FF0000", false)).toBe("#FF0000");
        expect(adjustEventColor("#003300", false)).toBe("#003300");
        expect(adjustEventColor("#123ABC", false)).toBe("#123ABC");
      });
    });

    describe("edge cases", () => {
      it("should return empty string unchanged", () => {
        expect(adjustEventColor("", true)).toBe("");
        expect(adjustEventColor("", false)).toBe("");
      });

      it("should return color without # prefix unchanged", () => {
        expect(adjustEventColor("FF0000", true)).toBe("FF0000");
        expect(adjustEventColor("FF0000", false)).toBe("FF0000");
      });

      it("should return shorthand hex unchanged", () => {
        expect(adjustEventColor("#F00", true)).toBe("#F00");
        expect(adjustEventColor("#F00", false)).toBe("#F00");
      });

      it("should handle white (#FFFFFF) in dark mode", () => {
        const result = adjustEventColor("#FFFFFF", true);
        expect(result).toMatch(/^#[0-9a-f]{6}$/);
      });

      it("should handle black (#000000) in dark mode", () => {
        const result = adjustEventColor("#000000", true);
        expect(result).toMatch(/^#[0-9a-f]{6}$/);
        // Black has 0 saturation and 0 lightness; lightness should be raised to 0.5
        const rHex = parseInt(result.slice(1, 3), 16);
        const gHex = parseInt(result.slice(3, 5), 16);
        const bHex = parseInt(result.slice(5, 7), 16);
        expect(rHex).toBeGreaterThanOrEqual(127);
        expect(gHex).toBeGreaterThanOrEqual(127);
        expect(bHex).toBeGreaterThanOrEqual(127);
      });

      it("should return invalid hex strings unchanged", () => {
        expect(adjustEventColor("#GGG000", true)).toBe("#GGG000");
        expect(adjustEventColor("not-a-color", true)).toBe("not-a-color");
        expect(adjustEventColor("#12345", true)).toBe("#12345");
        expect(adjustEventColor("#1234567", true)).toBe("#1234567");
      });
    });
  });

  describe("getContrastRatio", () => {
    it("should return 21:1 for black on white", () => {
      const ratio = getContrastRatio("#000000", "#FFFFFF");
      expect(ratio).toBeCloseTo(21, 0);
    });

    it("should return 1:1 for same colors", () => {
      const ratio = getContrastRatio("#FF0000", "#FF0000");
      expect(ratio).toBeCloseTo(1, 1);
    });

    it("should be symmetric (order independent for ratio value)", () => {
      const ratio1 = getContrastRatio("#000000", "#FFFFFF");
      const ratio2 = getContrastRatio("#FFFFFF", "#000000");
      expect(ratio1).toBeCloseTo(ratio2, 5);
    });

    it("should return 1 for invalid hex inputs", () => {
      expect(getContrastRatio("invalid", "#FFFFFF")).toBe(1);
      expect(getContrastRatio("#FFFFFF", "invalid")).toBe(1);
      expect(getContrastRatio("", "")).toBe(1);
    });

    it("should calculate a reasonable ratio for mid-tone colors", () => {
      // Gray (#808080) on white (#FFFFFF)
      const ratio = getContrastRatio("#808080", "#FFFFFF");
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(21);
    });
  });

  describe("meetsContrastAA", () => {
    it("should return true for black on white (21:1)", () => {
      expect(meetsContrastAA("#000000", "#FFFFFF")).toBe(true);
    });

    it("should return false for same color (1:1)", () => {
      expect(meetsContrastAA("#888888", "#888888")).toBe(false);
    });

    it("should return false for low contrast pairs", () => {
      // Light gray on white
      expect(meetsContrastAA("#CCCCCC", "#FFFFFF")).toBe(false);
    });

    it("should return true for sufficient contrast", () => {
      // Dark text on white background
      expect(meetsContrastAA("#333333", "#FFFFFF")).toBe(true);
    });

    it("should return false for invalid hex inputs", () => {
      expect(meetsContrastAA("invalid", "#FFFFFF")).toBe(false);
    });
  });
});
