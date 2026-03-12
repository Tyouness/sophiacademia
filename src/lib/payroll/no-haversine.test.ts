import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("pricing/payroll official flow", () => {
  it("does not contain haversine usage", () => {
    const files = [
      "src/lib/payroll/computeCourseBreakdown.ts",
      "src/lib/payroll/computeMonthlyPayslip.ts",
      "src/lib/payroll/course-approval.ts",
      "src/lib/pricing.ts",
    ];

    for (const relativePath of files) {
      const absolutePath = path.join(process.cwd(), relativePath);
      const content = fs.readFileSync(absolutePath, "utf8").toLowerCase();
      expect(content.includes("haversine")).toBe(false);
    }
  });
});
