import { describe, expect, it } from "vitest";
import { toProfessorSafeOffer } from "@/app/api/professor/offers/sanitize";

describe("professor offers payload sanitization", () => {
  it("never exposes margin and family-side sensitive fields", () => {
    const sanitized = toProfessorSafeOffer({
      offerKey: "family-1:Maths:0",
      familyId: "family-1",
      repFirst: "Jean",
      repLast: "Dupont",
      level: "Seconde",
      subject: "Maths",
      subjects: ["Maths"],
      children: [],
      freq: "weekly",
      periods: ["weekend"],
      duration: 1,
      startDate: null,
      address: {
        postcode: "75001",
        city: "Paris",
        country: "France",
      },
      distance_km_oneway: 18,
      pricing: {
        netProfTotalEst: 36.3,
        netSalarialEst: 12.48,
        ikFinal: 21.82,
        forfaitFraisProPerSession: 2,
        marginGross: 18.59,
        marginNet: 13.94,
        schoolContribution: 7,
        totalFamilyPrice: 64.82,
      },
      approx: {
        center: { lat: 48.85, lng: 2.35 },
        radius_m: 300,
      },
      request_status: null,
    });

    const payload = JSON.parse(JSON.stringify(sanitized)) as Record<string, unknown>;
    const pricing = payload.pricing as Record<string, unknown>;

    expect(pricing.marginGross).toBeUndefined();
    expect(pricing.marginNet).toBeUndefined();
    expect(pricing.schoolContribution).toBeUndefined();
    expect(pricing.totalFamilyPrice).toBeUndefined();

    expect(pricing.netProfTotalEst).toBe(36.3);
    expect(pricing.netSalarialEst).toBe(12.48);
    expect(pricing.ikFinal).toBe(21.82);
    expect(pricing.forfaitFraisProPerSession).toBe(2);
  });
});
