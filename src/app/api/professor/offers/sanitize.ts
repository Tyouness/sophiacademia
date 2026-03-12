export type ProfessorSafePricing = {
  netProfTotalEst: number;
  netSalarialEst: number;
  ikFinal: number;
  forfaitFraisProPerSession: number;
};

export type ProfessorOfferSanitizeInput = {
  offerKey: string;
  familyId: string;
  repFirst: string | null;
  repLast: string | null;
  level: string | null;
  subject: string | null;
  subjects: string[] | null;
  children: Array<{
    firstName: string | null;
    lastName: string | null;
    level: string | null;
    subjects: string[];
  }>;
  freq: string | null;
  periods: string[] | null;
  duration: number | null;
  startDate: string | null;
  address: {
    postcode: string | null;
    city: string | null;
    country: string | null;
  };
  distance_km_oneway: number | null;
  pricing:
    | {
        netProfTotalEst: number;
        netSalarialEst: number;
        ikFinal: number;
        forfaitFraisProPerSession: number;
        marginGross?: number;
        marginNet?: number;
        schoolContribution?: number;
        totalFamilyPrice?: number;
      }
    | null;
  approx: {
    center: { lat: number; lng: number };
    radius_m: number;
  };
  request_status: string | null;
};

export type ProfessorSafeOffer = {
  offerKey: string;
  familyId: string;
  repFirst: string | null;
  repLast: string | null;
  level: string | null;
  subject: string | null;
  subjects: string[] | null;
  children: ProfessorOfferSanitizeInput["children"];
  freq: string | null;
  periods: string[] | null;
  duration: number | null;
  startDate: string | null;
  address: {
    postcode: string | null;
    city: string | null;
    country: string | null;
  };
  distance_km_oneway: number | null;
  pricing: ProfessorSafePricing | null;
  approx: {
    center: { lat: number; lng: number };
    radius_m: number;
  };
  request_status: string | null;
};

export function toProfessorSafeOffer(offer: ProfessorOfferSanitizeInput): ProfessorSafeOffer {
  return {
    offerKey: offer.offerKey,
    familyId: offer.familyId,
    repFirst: offer.repFirst,
    repLast: offer.repLast,
    level: offer.level,
    subject: offer.subject,
    subjects: offer.subjects,
    children: offer.children,
    freq: offer.freq,
    periods: offer.periods,
    duration: offer.duration,
    startDate: offer.startDate,
    address: offer.address,
    distance_km_oneway: offer.distance_km_oneway,
    pricing: offer.pricing
      ? {
          netProfTotalEst: offer.pricing.netProfTotalEst,
          netSalarialEst: offer.pricing.netSalarialEst,
          ikFinal: offer.pricing.ikFinal,
          forfaitFraisProPerSession: offer.pricing.forfaitFraisProPerSession,
        }
      : null,
    approx: offer.approx,
    request_status: offer.request_status,
  };
}
