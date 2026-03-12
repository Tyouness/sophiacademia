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

export function calculateProfPay(
  distanceAllerKm: number,
  carCv: number | null | undefined,
  hours: number,
) {
  validateHours(hours);
  const transport = calculateTransport(distanceAllerKm, carCv);

  const brutSessionRaw = PRICING.profBrutHourly * hours;
  const netSalarialEstRaw = brutSessionRaw * (1 - PRICING.estEmployeeRate);
  const netProfTotalEstRaw =
    netSalarialEstRaw + transport.ikFinal + PRICING.forfaitFraisProPerSession;

  return {
    brutSession: round2(brutSessionRaw),
    netSalarialEst: round2(netSalarialEstRaw),
    ikFinal: round2(transport.ikFinal),
    forfaitFraisProPerSession: round2(PRICING.forfaitFraisProPerSession),
    netProfTotalEst: round2(netProfTotalEstRaw),
  };
}
