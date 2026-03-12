import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ensureCoursePricingSnapshot } from "@/lib/payroll/course-approval";

export async function autoApprovePendingCourses() {
  const supabaseAdmin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: courses, error } = await supabaseAdmin
    .from("courses")
    .select("id")
    .eq("approval_status", "family_pending")
    .lte("family_response_deadline", now)
    .is("staff_canceled_at", null);

  if (error || !courses || courses.length === 0) {
    return { updated: 0 };
  }

  const ids: string[] = [];
  for (const course of courses) {
    try {
      await ensureCoursePricingSnapshot({ courseId: course.id });
      ids.push(course.id);
    } catch (error) {
      console.warn("[course] auto-approve pricing snapshot failed", error);
    }
  }

  if (ids.length === 0) {
    return { updated: 0 };
  }

  const { error: updateError } = await supabaseAdmin
    .from("courses")
    .update({
      approval_status: "family_confirmed",
      family_confirmed_at: now,
      updated_at: now,
    })
    .in("id", ids);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { updated: ids.length };
}
