import { describe, expect, it } from "vitest";
import { getClientStatus, getPaymentStatus, registerClient, submitInvoice } from "@/lib/urssaf/client";

describe("urssaf sandbox client", () => {
  it("registers a client in sandbox mode", async () => {
    process.env.URSSAF_MODE = "sandbox";
    const result = await registerClient({
      familyId: "fam-1",
      firstName: "Jean",
      lastName: "Dupont",
      birthDate: "1990-01-01",
      email: "jean@example.com",
      phone: "0600000000",
      fiscalNumber: "12345678901234",
      address: {
        addr1: "1 rue test",
        postcode: "75001",
        city: "Paris",
        country: "France",
      },
    });
    expect(result.customerId).toContain("sandbox-");
  });

  it("submits invoice and returns pending in sandbox", async () => {
    process.env.URSSAF_MODE = "sandbox";
    const result = await submitInvoice({
      invoiceId: "inv-1",
      familyUrssafCustomerId: "sandbox-fam-1",
      amount: 100,
      issuedAt: new Date().toISOString(),
      description: "Cours de maths",
    });
    expect(result.paymentId).toContain("sandbox-payment");
    expect(result.status).toBe("pending_validation");
  });

  it("returns validated status in sandbox", async () => {
    process.env.URSSAF_MODE = "sandbox";
    const status = await getPaymentStatus("sandbox-payment-inv-1");
    expect(status.status).toBe("validated");
  });

  it("getClientStatus returns registered in sandbox", async () => {
    process.env.URSSAF_MODE = "sandbox";
    const status = await getClientStatus("sandbox-fam-1");
    expect(status.status).toBe("registered");
  });
});
