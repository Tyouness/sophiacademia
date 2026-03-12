import CourseActions from "@/components/CourseActions";
import DataTable from "@/components/DataTable";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { autoApprovePendingCourses } from "@/lib/courses/auto-approve";

export default async function StaffCoursesPage() {
  await autoApprovePendingCourses();
  const supabase = await createServerSupabaseClient();
  const { data: courses } = await supabase
    .from("courses")
    .select(`
      id, professor_id, family_id, subject, hours, courses_count, status, approval_status, created_at,
      professor:profiles!courses_professor_id_fkey(full_name),
      family:profiles!courses_family_id_fkey(full_name),
      child:family_children(first_name, last_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (courses ?? []).map((course) => {
    const prof = Array.isArray(course.professor) ? course.professor[0] : course.professor;
    const fam = Array.isArray(course.family) ? course.family[0] : course.family;
    const child = Array.isArray(course.child) ? course.child[0] : course.child;
    return ({
    professor: prof?.full_name ?? "-",
    family: fam?.full_name ?? "-",
    child: child ? `${child.first_name ?? ""} ${child.last_name ?? ""}`.trim() : "-",
    subject: course.subject ?? "-",
    hours: course.hours,
    courses: course.courses_count,
    status: course.status,
    approval: course.approval_status ?? "-",
    createdAt: course.created_at,
    actions: (
      <CourseActions
        courseId={course.id}
        status={course.status}
        approvalStatus={course.approval_status ?? "family_pending"}
        hours={Number(course.hours)}
        coursesCount={Number(course.courses_count)}
        familyId={course.family_id}
        subject={course.subject}
      />
    ),
  });});

  return (
    <main className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">Heures declarees</h2>
        <p className="mt-1 text-sm text-gray-500">
          Marquer les heures comme payees.
        </p>
      </div>

      <DataTable
        columns={[
          { key: "professor", label: "Professeur" },
          { key: "family", label: "Famille" },
          { key: "child", label: "Enfant" },
          { key: "subject", label: "Matiere" },
          { key: "hours", label: "Heures" },
          { key: "courses", label: "Cours" },
          { key: "status", label: "Statut" },
          { key: "approval", label: "Validation" },
          { key: "createdAt", label: "Date" },
          { key: "actions", label: "Actions" },
        ]}
        rows={rows}
        emptyLabel="Aucune heure declaree."
      />
    </main>
  );
}
