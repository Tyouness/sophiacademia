import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/security/rate-limit";
import { rateLimitMemory } from "@/lib/security/memory-rate-limit";
import { getDistanceProvider } from "@/lib/distance/DistanceProvider";
import { levelRank } from "@/lib/education/catalog";
import { calculateTransport } from "@/lib/pricing/transport";
import { calculateProfPay } from "@/lib/pricing/prof";
import { toProfessorSafeOffer } from "@/app/api/professor/offers/sanitize";

type ProfileRole = "admin" | "staff" | "family" | "professor";

type ProfessorSkill = {
  subject: string;
  max_level: string;
};

type FamilyOffer = {
  familyId: string;
  repFirst: string | null;
  repLast: string | null;
  level: string | null;
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
  postcode: string | null;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
};

type RequestRow = {
  professor_id: string;
  family_id: string;
  subject: string | null;
  status: string;
};

function obfuscateCenter(params: { lat: number; lng: number; seed: string }) {
  const hash = crypto.createHash("sha256").update(params.seed).digest();
  const angle = (hash[0] / 255) * Math.PI * 2;
  const radiusMeters = 300;
  const maxOffsetMeters = radiusMeters * 0.7;
  const offsetMeters = (hash[1] / 255) * maxOffsetMeters;
  const distanceKm = offsetMeters / 1000;
  const earthRadiusKm = 6371;
  const latRad = (params.lat * Math.PI) / 180;
  const delta = distanceKm / earthRadiusKm;
  const deltaLat = (delta * Math.cos(angle)) * (180 / Math.PI);
  const deltaLng =
    (delta * Math.sin(angle)) * (180 / Math.PI) / Math.cos(latRad || 0.000001);

  return {
    centerLat: params.lat + deltaLat,
    centerLng: params.lng + deltaLng,
    radiusMeters,
  };
}

async function getUserAndRole(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const supabase = await createServerSupabaseClient({
    canSetCookies: true,
    accessToken,
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, role: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, disabled_at, deleted_at")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.disabled_at || profile.deleted_at) {
    return { supabase, user, role: null };
  }

  return { supabase, user, role: profile.role as ProfileRole };
}

export async function GET(request: Request) {
  const { user, role } = await getUserAndRole(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rate = rateLimitMemory(`offers:${ip}:${user.id}`, 30, 10 * 60 * 1000);
  if (!rate.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabaseAdmin = createAdminSupabaseClient();

  const { data: profProfile, error: profError } = await supabaseAdmin
    .from("professor_profiles")
    .select("car_hp, addr1, addr2, postcode, city, country, lat, lng, skills")
    .eq("id", user.id)
    .single();

  if (profError || !profProfile) {
    return NextResponse.json({ error: "missing_profile" }, { status: 400 });
  }

  if (!profProfile.lat || !profProfile.lng) {
    return NextResponse.json({ error: "missing_professor_location" }, { status: 409 });
  }

  const origin = { lat: Number(profProfile.lat), lng: Number(profProfile.lng) };

  const skills = (Array.isArray(profProfile.skills) ? profProfile.skills : []) as ProfessorSkill[];
  if (skills.length === 0) {
    return NextResponse.json({ data: [], meta: { origin } });
  }

  const { data: families, error: familyError } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, disabled_at, deleted_at, family:family_profiles(rep_first, rep_last, level, subjects, freq, periods, duration, start_date, addr1, addr2, postcode, city, country, lat, lng), children:family_children(first_name, last_name, level, subjects)",
    )
    .eq("role", "family")
    .is("disabled_at", null)
    .is("deleted_at", null);

  if (familyError) {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }

  const offers: FamilyOffer[] = (families ?? [])
    .map((row) => {
      const family = Array.isArray(row.family) ? row.family[0] : row.family;
      if (!family) {
        return null;
      }
      if (!family.lat || !family.lng) {
        return null;
      }
      const childrenRaw = Array.isArray(row.children) ? row.children : [];
      const children = childrenRaw.map((child) => ({
        firstName: child.first_name ?? null,
        lastName: child.last_name ?? null,
        level: child.level ?? null,
        subjects: Array.isArray(child.subjects) ? child.subjects : [],
      }));

      return {
        familyId: row.id,
        repFirst: family.rep_first ?? null,
        repLast: family.rep_last ?? null,
        level: family.level ?? null,
        subjects: Array.isArray(family.subjects) ? family.subjects : null,
        children,
        freq: family.freq ?? null,
        periods: Array.isArray(family.periods) ? family.periods : null,
        duration: family.duration ?? null,
        startDate: family.start_date ?? null,
        postcode: family.postcode ?? null,
        city: family.city ?? null,
        country: family.country ?? null,
        lat: Number(family.lat),
        lng: Number(family.lng),
      };
    })
    .filter(Boolean) as FamilyOffer[];

  const provider = getDistanceProvider();
  const distanceResults = await Promise.all(
    offers.map(async (offer) => {
      try {
        const result = await provider.getDrivingDistanceKm(origin, {
          lat: offer.lat,
          lng: offer.lng,
        });
        return result.distanceKm;
      } catch {
        return null;
      }
    }),
  );

  function matchOffer(offer: FamilyOffer) {
    const children = offer.children.length
      ? offer.children
      : [
          {
            firstName: null,
            lastName: null,
            level: offer.level,
            subjects: offer.subjects ?? [],
          },
        ];

    const matches: Array<{
      matchedSubject: string;
      matchedLevel: string | null;
      matchedChild: (typeof children)[number];
    }> = [];

    for (const child of children) {
      for (const subject of child.subjects) {
        const skill = skills.find(
          (item) => item.subject?.toLowerCase() === subject?.toLowerCase(),
        );
        if (!skill) {
          continue;
        }
        if (levelRank(child.level) <= levelRank(skill.max_level)) {
          matches.push({
            matchedSubject: subject,
            matchedLevel: child.level,
            matchedChild: child,
          });
        }
      }
    }

    return matches;
  }

  const provisional = offers.flatMap((offer, index) => {
    const distanceKm = distanceResults[index] ?? null;
    const matches = matchOffer(offer);
    if (!matches || matches.length === 0) {
      return [];
    }

    const approx = obfuscateCenter({
      lat: offer.lat,
      lng: offer.lng,
      seed: `${offer.familyId}:${offer.lat}:${offer.lng}`,
    });

    return matches.map((matched, matchIndex) => {
      const hours = offer.duration && offer.duration > 0 ? offer.duration : 1;
      const pricing =
        distanceKm != null
          ? (() => {
              const transport = calculateTransport(distanceKm, profProfile.car_hp);
              const prof = calculateProfPay(distanceKm, profProfile.car_hp, hours);

              return {
                netProfTotalEst: prof.netProfTotalEst,
                netSalarialEst: prof.netSalarialEst,
                ikFinal: transport.ikFinal,
                forfaitFraisProPerSession: transport.forfaitFraisProPerSession,
              };
            })()
          : null;

      return {
        offerKey: `${offer.familyId}:${matched.matchedSubject}:${matchIndex}`,
        familyId: offer.familyId,
        repFirst: offer.repFirst,
        repLast: offer.repLast,
        level: matched.matchedLevel ?? offer.level,
        subject: matched.matchedSubject ?? null,
        subjects: offer.subjects,
        children: offer.children,
        freq: offer.freq,
        periods: offer.periods,
        duration: offer.duration,
        startDate: offer.startDate,
        address: {
          postcode: offer.postcode,
          city: offer.city,
          country: offer.country,
        },
        distance_km_oneway: distanceKm,
        pricing,
        approx: {
          center: { lat: approx.centerLat, lng: approx.centerLng },
          radius_m: approx.radiusMeters,
        },
        request_status: null as string | null,
      };
    });
  });

  const familyIds = Array.from(new Set(provisional.map((offer) => offer.familyId)));
  const subjects = Array.from(
    new Set(provisional.map((offer) => offer.subject).filter(Boolean) as string[]),
  );

  let requestRows: RequestRow[] = [];
  if (familyIds.length > 0 && subjects.length > 0) {
    const { data: reqs } = await supabaseAdmin
      .from("requests")
      .select("professor_id, family_id, subject, status")
      .in("family_id", familyIds)
      .in("subject", subjects)
      .in("status", ["pending", "coords_sent", "approved"]);
    requestRows = (reqs ?? []) as RequestRow[];
  }

  const approvedByFamilySubject = new Set(
    requestRows
      .filter((row) => row.status === "approved")
      .map((row) => `${row.family_id}:${row.subject ?? ""}`),
  );

  const statusByFamilySubject = new Map(
    requestRows
      .filter((row) => row.professor_id === user.id)
      .map((row) => [`${row.family_id}:${row.subject ?? ""}`, row.status] as const),
  );

  const data = provisional
    .filter((offer) =>
      !approvedByFamilySubject.has(`${offer.familyId}:${offer.subject ?? ""}`),
    )
    .map((offer) => ({
      ...offer,
      request_status:
        statusByFamilySubject.get(`${offer.familyId}:${offer.subject ?? ""}`) ??
        null,
    }))
    .map(toProfessorSafeOffer);

  return NextResponse.json({ data, meta: { origin } });
}
