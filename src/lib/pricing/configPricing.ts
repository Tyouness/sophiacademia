export const PRICING = {
  baseFamilyHourly: 50,
  profBrutHourly: 16,
  forfaitFraisProPerSession: 2,
  schoolMaxTransportContribution: 7,
  profIkCapPerSession: 30,
  estEmployeeRate: 0.22,
  estEmployerRate: 0.4,
  corporateTaxRate: 0.25,
  defaultCarCv: 4,
  kmRateByCv: {
    3: 0.529,
    4: 0.606,
    5: 0.636,
    6: 0.665,
    7: 0.697,
    default: 0.45,
  } as const,
};

export type KmRateByCvKey = Exclude<keyof typeof PRICING.kmRateByCv, "default">;
