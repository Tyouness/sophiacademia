import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getMonthKey } from "@/lib/billing/period";
import { getRateSet } from "@/lib/payroll/rates";
import { roundingV1 } from "@/lib/payroll/rounding";
import { computeCourseBreakdown } from "@/lib/payroll/computeCourseBreakdown";
import { getDistanceProvider } from "@/lib/distance/DistanceProvider";

const IK_RATE_VERSION = "IK_2026_6CV";

export async function ensureCoursePricingSnapshot(params: {
  courseId: string;
  manualDistanceKmOneWay?: number | null;
  distanceSource?: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, professor_id, family_id, hours, course_date, created_at, distance_km_one_way, distance_km_round_trip, duration_minutes, ik_amount, rate_set_version, pricing_policy_version, rounding_policy_version",
    )
    .eq("id", params.courseId)
    .single();

  if (!course) {
    throw new Error("course_not_found");
  }

  if (
    course.distance_km_one_way != null &&
    course.distance_km_round_trip != null &&
    course.duration_minutes != null &&
    course.ik_amount != null &&
    course.rate_set_version &&
    course.pricing_policy_version &&
    course.rounding_policy_version
  ) {
    return course;
  }

  const [{ data: profProfile }, { data: familyProfile }] = await Promise.all([
    supabase
      .from("professor_profiles")
      .select("lat, lng")
      .eq("id", course.professor_id)
      .single(),
    supabase
      .from("family_profiles")
      .select("lat, lng, level")
      .eq("id", course.family_id)
      .single(),
  ]);

  const manualDistance = params.manualDistanceKmOneWay;
  let distanceKm = manualDistance ?? null;
  let durationMinutes: number | null = null;
  let distanceSource = params.distanceSource ?? null;
  let distanceFetchedAt = new Date().toISOString();

  if (distanceKm == null) {
    if (!profProfile?.lat || !profProfile?.lng || !familyProfile?.lat || !familyProfile?.lng) {
      throw new Error("distance_missing_coordinates");
    }

    const provider = getDistanceProvider();
    const result = await provider.getDrivingDistanceKm(
      { lat: Number(profProfile.lat), lng: Number(profProfile.lng) },
      { lat: Number(familyProfile.lat), lng: Number(familyProfile.lng) },
    );

    distanceKm = result.distanceKm;
    durationMinutes = result.durationMinutes;
    distanceSource = result.source;
  } else {
    durationMinutes = 0;
  }

  const distanceRoundTrip = roundingV1.money(distanceKm * 2);
  const rateSet = getRateSet();
  const ikAmount = roundingV1.money(distanceRoundTrip * rateSet.ikRatePerKm);
  const hours = Number(course.hours ?? 0);

  const breakdown = computeCourseBreakdown({
    hours,
    level: familyProfile?.level ?? null,
    distanceKmOneWay: distanceKm,
    distanceKmRoundTrip: distanceRoundTrip,
    ikAmount,
    rateSetVersion: rateSet.version,
    pricingPolicyVersion: "pricing_v1",
    roundingPolicyVersion: roundingV1.version,
  });

  const profHourly = hours > 0 ? breakdown.net_hourly + ikAmount / hours : breakdown.net_hourly;
  const courseMonth = getMonthKey(course.course_date ?? course.created_at ?? new Date());

  const { data: updated } = await supabase
    .from("courses")
    .update({
      distance_km_one_way: distanceKm,
      distance_km_round_trip: distanceRoundTrip,
      distance_source: distanceSource ?? "google_routes",
      duration_minutes: durationMinutes,
      distance_fetched_at: distanceFetchedAt,
      ik_amount: ikAmount,
      ik_rate_version: IK_RATE_VERSION,
      rate_set_version: rateSet.version,
      pricing_policy_version: breakdown.pricing_policy_version,
      rounding_policy_version: breakdown.rounding_policy_version,
      prof_net: breakdown.net_hourly,
      indemn_km: ikAmount,
      prof_total: breakdown.teacher_total,
      prof_hourly: roundingV1.money(profHourly),
      distance_km: distanceKm,
      course_month: courseMonth,
      updated_at: new Date().toISOString(),
    })
    .eq("id", course.id)
    .select()
    .single();

  return updated ?? course;
}
