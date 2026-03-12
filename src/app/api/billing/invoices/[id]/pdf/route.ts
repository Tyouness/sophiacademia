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

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, family_id, number, issue_date, total_ttc, status")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (role !== "staff" && role !== "admin" && invoice.family_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const content = `%PDF-1.1\n% Local invoice\nInvoice: ${invoice.number ?? invoice.id}\nDate: ${invoice.issue_date ?? "-"}\nTotal: ${invoice.total_ttc ?? "-"}\nStatus: ${invoice.status}\n%%EOF`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number ?? `invoice-${invoice.id}`}.pdf"`,
    },
  });
}
