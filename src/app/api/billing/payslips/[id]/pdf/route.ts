import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProfileRole = "admin" | "staff" | "family" | "professor";

async function getUserAndRole() {
  const supabase = await createServerSupabaseClient({ canSetCookies: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, role: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return { supabase, user, role: (profile?.role ?? null) as ProfileRole | null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, role } = await getUserAndRole();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: payslip, error } = await supabase
    .from("payslips")
    .select("id, professor_id, number, period, period_start, period_end, gross_salary_total, net_salary_total, reimbursements_total, total_net, total_indemn_km, status")
    .eq("id", id)
    .single();

  if (error || !payslip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (role !== "staff" && role !== "admin" && payslip.professor_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const content = `%PDF-1.1\n% Local payslip\nPayslip: ${payslip.number ?? payslip.id}\nPeriod: ${payslip.period ?? "-"}\nGross: ${payslip.gross_salary_total ?? "-"}\nNet: ${payslip.net_salary_total ?? payslip.total_net ?? "-"}\nReimbursements: ${payslip.reimbursements_total ?? payslip.total_indemn_km ?? "-"}\nStatus: ${payslip.status}\n%%EOF`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${payslip.number ?? `payslip-${payslip.id}`}.pdf"`,
    },
  });
}
