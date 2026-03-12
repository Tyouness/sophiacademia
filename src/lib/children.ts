import type { SupabaseClient } from "@supabase/supabase-js";

export type ChildRecord = {
  id: string;
  family_id: string;
  first_name: string | null;
  last_name: string | null;
  level: string | null;
  subjects: string[];
  created_at: string;
};

/**
 * Asserts that a child record exists and belongs to the given family.
 * Uses the provided Supabase client (admin or anon depending on context).
 * Throws a typed error string if the check fails.
 */
export async function assertChildBelongsToFamily(
  childId: string,
  familyId: string,
  client: SupabaseClient,
): Promise<void> {
  const { data, error } = await client
    .from("family_children")
    .select("id, family_id")
    .eq("id", childId)
    .single();

  if (error || !data) {
    throw new Error("child_not_found");
  }

  if (data.family_id !== familyId) {
    throw new Error("child_family_mismatch");
  }
}

/**
 * Returns a display label for a child (first + last name, with fallback).
 */
export function childDisplayName(child: {
  first_name: string | null;
  last_name: string | null;
} | null | undefined): string {
  if (!child) {
    return "-";
  }
  const parts = [child.first_name, child.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Enfant";
}
