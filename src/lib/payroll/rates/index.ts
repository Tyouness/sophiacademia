import { FR_2026_01 } from "@/lib/payroll/rates/FR_2026_01";

export type RateSet = typeof FR_2026_01;

export function getRateSet(version?: string): RateSet {
  if (!version || version === FR_2026_01.version) {
    return FR_2026_01;
  }
  throw new Error(`unknown_rate_set:${version}`);
}
