import { pricingV1 } from "@/lib/payroll/policies/pricing_v1";

export type PricingPolicy = typeof pricingV1;

export function getPricingPolicy(version?: string): PricingPolicy {
  if (!version || version === pricingV1.version) {
    return pricingV1;
  }
  throw new Error(`unknown_pricing_policy:${version}`);
}
