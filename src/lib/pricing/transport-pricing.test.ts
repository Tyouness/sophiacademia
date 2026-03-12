import { describe, expect, it } from "vitest";
import { calculateTransport } from "@/lib/pricing/transport";
import { calculateFamilyPrice } from "@/lib/pricing/family";
import { calculateProfPay } from "@/lib/pricing/prof";
import { calculateSophiacademiaMargin } from "@/lib/pricing/margin";

describe("transport + pricing", () => {
  it("18km, 4CV, 1h => familyPricePerHour 64.82 and school cap 7", () => {
    const transport = calculateTransport(18, 4);
    const family = calculateFamilyPrice(18, 4, 1);

    expect(transport.schoolContribution).toBe(7);
    expect(family.familyPricePerHour).toBe(64.82);
  });

  it("18km, 4CV, 2h => familyPricePerHour 57.41", () => {
    const family = calculateFamilyPrice(18, 4, 2);
    expect(family.familyPricePerHour).toBe(57.41);
  });

  it("caps IK prof at 30€ on huge distance", () => {
    const transport = calculateTransport(1000, 7);
    expect(transport.ikFinal).toBe(30);
  });

  it("uses default 4CV when carCv missing", () => {
    const transport = calculateTransport(18, null);
    expect(transport.effectiveCv).toBe(4);
    expect(transport.ratePerKm).toBe(0.61);
  });

  it("includes 2€/session forfait in prof total and internal cost", () => {
    const prof = calculateProfPay(18, 4, 1);
    const margin = calculateSophiacademiaMargin(18, 4, 1);

    expect(prof.forfaitFraisProPerSession).toBe(2);
    expect(prof.netProfTotalEst).toBe(36.3);
    expect(margin.costInternal).toBe(46.22);
  });

  it("keeps marginGross = revenue - costInternal", () => {
    const margin = calculateSophiacademiaMargin(18, 4, 1.5);
    expect(Number((margin.revenue - margin.costInternal).toFixed(2))).toBe(margin.marginGross);
  });
});
