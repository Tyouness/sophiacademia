import { PRICING } from "@/lib/pricing/configPricing";
import { calculateFamilyPrice } from "@/lib/pricing/family";
import { calculateTransport } from "@/lib/pricing/transport";

function round2(value: number) {
  return Number(value.toFixed(2));
}

function validateHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("invalid_hours");
  }
}

export function calculateSophiacademiaMargin(
  distanceAllerKm: number,
  carCv: number | null | undefined,
  hours: number,
) {
  validateHours(hours);

  const family = calculateFamilyPrice(distanceAllerKm, carCv, hours);
  const transport = calculateTransport(distanceAllerKm, carCv);

  const brutSessionRaw = PRICING.profBrutHourly * hours;
  const employerChargesRaw = brutSessionRaw * PRICING.estEmployerRate;
  const totalProfCostInternalRaw =
    brutSessionRaw +
    employerChargesRaw +
    transport.ikFinal +
    PRICING.forfaitFraisProPerSession;

  const marginGrossRaw = family.totalFamilyPrice - totalProfCostInternalRaw;
  const marginNetRaw = marginGrossRaw * (1 - PRICING.corporateTaxRate);

  return {
    revenue: round2(family.totalFamilyPrice),
    costInternal: round2(totalProfCostInternalRaw),
    marginGross: round2(marginGrossRaw),
    marginNet: round2(marginNetRaw),
  };
}
