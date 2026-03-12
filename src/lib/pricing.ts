export type PricingMode = "A" | "B";

export type PricingConfig = {
  mode: PricingMode;
  defaultBrutPerHour: number;
  clientPriceLow: number;
  clientPriceHigh: number;
  netMinLow: number;
  netMinHigh: number;
  capModeA: { maxKm: number; cap: number }[];
  capModeB: { maxKm: number; cap: number }[];
  kmRates: Record<string, number>;
};

export type PricingInput = {
  level: string | null | undefined;
  hours: number;
  coursesCount: number;
  distanceKmOneway: number;
  carHp: number;
  config?: Partial<PricingConfig>;
};

export type PricingOutput = {
  client_total_ttc: number;
  indemn_km: number;
  prof_net: number;
  prof_total_cap: number;
  employer_cost_estimate: number;
};

import { computeCourseBreakdown } from "@/lib/payroll/computeCourseBreakdown";
import { getClientPriceForLevel } from "@/lib/payroll/policies/pricing_v1";

export { getClientPriceForLevel };

const defaultConfig: PricingConfig = {
  mode: "A",
  defaultBrutPerHour: 15.0,
  clientPriceLow: 45.0,
  clientPriceHigh: 50.0,
  netMinLow: 18.0,
  netMinHigh: 19.0,
  capModeA: [
    { maxKm: 10, cap: 23 },
    { maxKm: 20, cap: 25 },
    { maxKm: 30, cap: 30 },
    { maxKm: Number.POSITIVE_INFINITY, cap: 38 },
  ],
  capModeB: [
    { maxKm: 10, cap: 23 },
    { maxKm: Number.POSITIVE_INFINITY, cap: 29 },
  ],
  kmRates: {
    "3": 0.529,
    "4": 0.606,
    "5": 0.636,
    "6": 0.665,
    "7": 0.697,
    default: 0.45,
  },
};

export function calculatePricing(input: PricingInput): PricingOutput {
  void input.coursesCount;
  void input.carHp;
  const config: PricingConfig = { ...defaultConfig, ...(input.config ?? {}) };
  const breakdown = computeCourseBreakdown({
    hours: input.hours,
    level: input.level,
    distanceKmOneWay: input.distanceKmOneway,
    distanceKmRoundTrip: input.distanceKmOneway * 2,
    baseGrossHourly: config.defaultBrutPerHour,
  });

  return {
    client_total_ttc: breakdown.client_total,
    indemn_km: breakdown.reimbursements_total,
    prof_net: breakdown.net_hourly,
    prof_total_cap: breakdown.cap_per_hour,
    employer_cost_estimate: breakdown.employer_contribs_total,
  };
}

export const pricingConfig = defaultConfig;
