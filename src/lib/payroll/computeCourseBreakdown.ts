import { getRateSet } from "@/lib/payroll/rates";
import { getPricingPolicy } from "@/lib/payroll/policies";
import { roundingV1 } from "@/lib/payroll/rounding";

export type CourseBreakdownInput = {
  hours: number;
  level?: string | null;
  distanceKmOneWay?: number | null;
  distanceKmRoundTrip?: number | null;
  ikAmount?: number | null;
  rateSetVersion?: string | null;
  pricingPolicyVersion?: string | null;
  roundingPolicyVersion?: string | null;
  baseGrossHourly?: number | null;
};

export type CourseBreakdownOutput = {
  rate_set_version: string;
  pricing_policy_version: string;
  rounding_policy_version: string;
  distance_km_one_way: number;
  distance_km_round_trip: number;
  cap_per_hour: number;
  cap_total: number;
  gross_hourly: number;
  gross_total: number;
  net_hourly: number;
  net_total: number;
  reimbursements_total: number;
  teacher_total: number;
  employer_contribs_total: number;
  employee_contribs: {
    retraite_ss_plaf: number;
    retraite_ss_deplaf: number;
    agirc_arrco_t1: number;
    ciid: number;
    csg_deductible: number;
    csg_non_deductible: number;
    crds: number;
    total: number;
  };
  smic_guard_applied: boolean;
  cap_exceeded: boolean;
  client_price_per_hour: number;
  client_total: number;
};

function clamp(value: number) {
  return value < 0 ? 0 : value;
}

function isLowerLevel(level?: string | null) {
  if (!level) {
    return false;
  }
  const s = level.toLowerCase();
  return /(\b6e\b|\b5e\b|\b4e\b|\b3e\b|six|cinq|quatre|trois|college|coll[eè]ge|primaire)/i.test(
    s,
  );
}

export function computeCourseBreakdown(input: CourseBreakdownInput): CourseBreakdownOutput {
  const rateSet = getRateSet(input.rateSetVersion ?? undefined);
  const pricingPolicy = getPricingPolicy(input.pricingPolicyVersion ?? undefined);
  const hours = clamp(input.hours ?? 0);
  const distanceOneWay = clamp(input.distanceKmOneWay ?? 0);
  const distanceRoundTrip =
    input.distanceKmRoundTrip != null
      ? clamp(input.distanceKmRoundTrip)
      : distanceOneWay * 2;

  if (pricingPolicy.caps.length === 0) {
    throw new Error(`pricing_policy_caps_empty:${pricingPolicy.version}`);
  }
  let capPerHour = 0;
  for (const step of pricingPolicy.caps) {
    if (distanceOneWay <= step.maxKm) {
      capPerHour = step.cap;
      break;
    }
  }
  if (!capPerHour) {
    capPerHour = pricingPolicy.caps[pricingPolicy.caps.length - 1].cap;
  }
  const capTotal = roundingV1.money(capPerHour * hours);

  const baseGrossHourly = input.baseGrossHourly ?? rateSet.defaultGrossHourly;
  const guardedGrossHourly = Math.max(baseGrossHourly, rateSet.smicHourly);
  const smicGuardApplied = guardedGrossHourly !== baseGrossHourly;

  const grossTotal = roundingV1.money(guardedGrossHourly * hours);
  const bcsg = guardedGrossHourly * rateSet.csgBaseRatio;

  const empRetPlaf = guardedGrossHourly * rateSet.employeeRates.retraiteSsPlaf;
  const empRetDepl = guardedGrossHourly * rateSet.employeeRates.retraiteSsDeplaf;
  const empArrco = guardedGrossHourly * rateSet.employeeRates.agircArrcoT1;
  const empCiid = guardedGrossHourly * rateSet.employeeRates.ciid;
  const empCsgDed = bcsg * rateSet.csgDeductibleRate;
  const empCsgNonDed = bcsg * rateSet.csgNonDeductibleRate;
  const empCrds = bcsg * rateSet.crdsRate;

  const employeeTotal =
    empRetPlaf + empRetDepl + empArrco + empCiid + empCsgDed + empCsgNonDed + empCrds;

  const netHourly = roundingV1.money(Math.max(0, guardedGrossHourly - employeeTotal));
  const netTotal = roundingV1.money(netHourly * hours);

  const employerRateSum =
    rateSet.employerRates.maladieMaterniteInvalDeces +
    rateSet.employerRates.csa +
    rateSet.employerRates.complIncapInvalDeces +
    rateSet.employerRates.atMp +
    rateSet.employerRates.retraiteSsPlaf +
    rateSet.employerRates.retraiteSsDeplaf +
    rateSet.employerRates.agircArrcoT1 +
    rateSet.employerRates.famille +
    rateSet.employerRates.chomage +
    rateSet.employerRates.autres +
    rateSet.employerRates.santeTravail;

  const employerPerHour = Math.max(
    0,
    guardedGrossHourly * employerRateSum - rateSet.employerDeductionPerHour,
  );
  const employerTotal = roundingV1.money(employerPerHour * hours);

  const ikAmount =
    input.ikAmount != null
      ? clamp(input.ikAmount)
      : roundingV1.money(distanceRoundTrip * rateSet.ikRatePerKm);

  const teacherTotal = roundingV1.money(netTotal + ikAmount);
  const capExceeded = teacherTotal > capTotal && hours > 0;

  const clientPricePerHour = isLowerLevel(input.level)
    ? pricingPolicy.clientPriceLow
    : pricingPolicy.clientPriceHigh;
  const clientTotal = roundingV1.money(clientPricePerHour * hours);

  return {
    rate_set_version: rateSet.version,
    pricing_policy_version: pricingPolicy.version,
    rounding_policy_version: roundingV1.version,
    distance_km_one_way: roundingV1.money(distanceOneWay),
    distance_km_round_trip: roundingV1.money(distanceRoundTrip),
    cap_per_hour: capPerHour,
    cap_total: capTotal,
    gross_hourly: roundingV1.money(guardedGrossHourly),
    gross_total: grossTotal,
    net_hourly: netHourly,
    net_total: netTotal,
    reimbursements_total: roundingV1.money(ikAmount),
    teacher_total: teacherTotal,
    employer_contribs_total: employerTotal,
    employee_contribs: {
      retraite_ss_plaf: roundingV1.money(empRetPlaf * hours),
      retraite_ss_deplaf: roundingV1.money(empRetDepl * hours),
      agirc_arrco_t1: roundingV1.money(empArrco * hours),
      ciid: roundingV1.money(empCiid * hours),
      csg_deductible: roundingV1.money(empCsgDed * hours),
      csg_non_deductible: roundingV1.money(empCsgNonDed * hours),
      crds: roundingV1.money(empCrds * hours),
      total: roundingV1.money(employeeTotal * hours),
    },
    smic_guard_applied: smicGuardApplied,
    cap_exceeded: capExceeded,
    client_price_per_hour: clientPricePerHour,
    client_total: clientTotal,
  };
}
