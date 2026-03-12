import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { handleCoursePaid } from "@/lib/billing/course-paid";
import { logAudit } from "@/lib/audit";

export async function autoPayPendingCourses() {
  void createAdminSupabaseClient;
  void handleCoursePaid;
  void logAudit;
  return { updated: 0 };
}
