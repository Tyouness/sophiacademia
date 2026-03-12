import { NextResponse } from "next/server";
import { autoPayPendingCourses } from "@/lib/billing/auto-pay";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("x-cron-secret");

  if (!secret) {
    return NextResponse.json({ error: "Missing CRON_SECRET" }, { status: 500 });
  }

  if (header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await autoPayPendingCourses();
  return NextResponse.json(result);
}
