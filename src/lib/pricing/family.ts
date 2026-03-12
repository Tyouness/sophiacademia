import { PRICING } from "@/lib/pricing/configPricing";
import { calculateTransport } from "@/lib/pricing/transport";

function round2(value: number) {
  return Number(value.toFixed(2));
}

function validateHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("invalid_hours");
  }
}

export function calculateFamilyPrice(
  distanceAllerKm: number,
  carCv: number | null | undefined,
  hours: number,
) {
  validateHours(hours);
  const transport = calculateTransport(distanceAllerKm, carCv);

  const prixCoursRaw = PRICING.baseFamilyHourly * hours;
  const totalFamilyPriceRaw = prixCoursRaw + transport.familyTransportFee;
  const familyPricePerHourRaw = totalFamilyPriceRaw / hours;

  return {
    prixCours: round2(prixCoursRaw),
    familyTransportFee: round2(transport.familyTransportFee),
    totalFamilyPrice: round2(totalFamilyPriceRaw),
    familyPricePerHour: round2(familyPricePerHourRaw),
  };
}
