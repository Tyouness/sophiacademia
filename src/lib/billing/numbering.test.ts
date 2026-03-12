import { describe, expect, it } from "vitest";
import { formatInvoiceNumber } from "@/lib/billing/invoices";
import { formatPayslipNumber } from "@/lib/billing/payslips";

describe("legal numbering", () => {
  it("formats invoice numbers as FAC-YYYY-00001", () => {
    expect(formatInvoiceNumber(2025, 1)).toBe("FAC-2025-00001");
    expect(formatInvoiceNumber(2026, 42)).toBe("FAC-2026-00042");
  });

  it("formats payslip numbers as PAY-YYYY-00001", () => {
    expect(formatPayslipNumber(2025, 1)).toBe("PAY-2025-00001");
    expect(formatPayslipNumber(2026, 9)).toBe("PAY-2026-00009");
  });
});
