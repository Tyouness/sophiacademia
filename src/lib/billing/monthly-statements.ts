import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getClientPriceForLevel } from "@/lib/pricing";
import { getMonthRange } from "@/lib/billing/period";

function formatStatementNumber(year: number, seq: number) {
  return `REL-${year}-${String(seq).padStart(4, "0")}`;
}

export async function generateFamilyMonthlyStatement(params: {
  familyId: string;
  monthKey: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { familyId, monthKey } = params;

  const { data: existing } = await supabase
    .from("monthly_statements")
    .select("id, number")
    .eq("family_id", familyId)
    .eq("period", monthKey)
    .maybeSingle();

  const { start, end } = getMonthRange(monthKey);

  const { data: courses } = await supabase
    .from("courses")
    .select("hours")
    .eq("family_id", familyId)
    .eq("status", "paid_by_urssaf")
    .gte("paid_at", start)
    .lt("paid_at", end);

  const totalHours = (courses ?? []).reduce(
    (sum, course) => sum + Number(course.hours ?? 0),
    0,
  );

  if (totalHours <= 0) {
    return null;
  }

  const { data: familyProfile } = await supabase
    .from("family_profiles")
    .select("level")
    .eq("id", familyId)
    .maybeSingle();

  const clientPrice = getClientPriceForLevel(familyProfile?.level ?? null);
  const totalAmount = Number((clientPrice * totalHours).toFixed(2));

  let statementNumber = existing?.number ?? null;
  if (!statementNumber) {
    const { data: seqData, error: seqError } = await supabase
      .rpc("nextval", { sequence_name: "public.invoice_seq" })
      .single();

    const seqValue = seqData ? Number(Object.values(seqData)[0]) : 0;
    const seq = seqError ? 0 : seqValue;
    const year = Number(monthKey.split("-")[0]);
    statementNumber = formatStatementNumber(year, seq || 1);
  }

  const { data: statement, error } = await supabase
    .from("monthly_statements")
    .upsert(
      {
        id: existing?.id ?? undefined,
        family_id: familyId,
        period: monthKey,
        total_hours: totalHours,
        total_amount: totalAmount,
        number: statementNumber,
      },
      { onConflict: "family_id,period" },
    )
    .select("id, family_id, period, total_hours, total_amount, number")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return statement;
}
