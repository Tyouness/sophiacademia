import { PRICING } from "@/lib/pricing/configPricing";

function round2(value: number) {
  return Number(value.toFixed(2));
}

function validateDistance(distanceAllerKm: number) {
  if (!Number.isFinite(distanceAllerKm) || distanceAllerKm < 0) {
    throw new Error("invalid_distance");
  }
}

function resolveCv(carCv?: number | null) {
  if (Number.isInteger(carCv) && Number(carCv) > 0) {
    return Number(carCv);
  }
  return PRICING.defaultCarCv;
}

function resolveKmRate(effectiveCv: number) {
  const byCv = PRICING.kmRateByCv as Record<string, number>;
  return byCv[String(effectiveCv)] ?? PRICING.kmRateByCv.default;
}

export function calculateTransport(distanceAllerKm: number, carCv?: number | null) {
  validateDistance(distanceAllerKm);

  const effectiveCv = resolveCv(carCv);
  const ratePerKmRaw = resolveKmRate(effectiveCv);
  const distanceARRaw = distanceAllerKm * 2;
  const ikRawRaw = distanceARRaw * ratePerKmRaw;
  const ikFinalRaw = Math.min(ikRawRaw, PRICING.profIkCapPerSession);
  const schoolContributionRaw = Math.min(
    ikFinalRaw / 2,
    PRICING.schoolMaxTransportContribution,
  );
  const familyTransportFeeRaw = ikFinalRaw - schoolContributionRaw;

  return {
    effectiveCv,
    ratePerKm: round2(ratePerKmRaw),
    distanceAR: round2(distanceARRaw),
    ikRaw: round2(ikRawRaw),
    ikFinal: round2(ikFinalRaw),
    schoolContribution: round2(schoolContributionRaw),
    familyTransportFee: round2(familyTransportFeeRaw),
    forfaitFraisProPerSession: round2(PRICING.forfaitFraisProPerSession),
  };
}
