import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

type TestUser = {
  id: string;
  email: string;
  password: string;
  accessToken: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function createAuthedClient(accessToken: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function createTestUser(role: string) {
  const email = `test.${role}.${randomUUID()}@example.test`;
  const password = `Pass-${randomUUID()}`;

  const { data: created, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !created.user) {
    throw new Error(error?.message ?? "Failed to create user");
  }

  const userId = created.user.id;

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    role,
    full_name: `Test ${role}`,
    email,
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sessionData, error: signInError } =
    await authClient.auth.signInWithPassword({ email, password });

  if (signInError || !sessionData.session?.access_token) {
    throw new Error(signInError?.message ?? "Failed to sign in");
  }

  return {
    id: userId,
    email,
    password,
    accessToken: sessionData.session.access_token,
  } satisfies TestUser;
}

export async function disableUserProfile(userId: string) {
  const { error } = await adminClient
    .from("profiles")
    .update({ disabled_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function cleanupTestData(params: {
  userIds?: string[];
  requestIds?: string[];
  courseIds?: string[];
  invoiceIds?: string[];
  payslipIds?: string[];
  actorIds?: string[];
  familyIds?: string[];
  professorIds?: string[];
}) {
  const {
    userIds = [],
    requestIds = [],
    courseIds = [],
    invoiceIds = [],
    payslipIds = [],
    actorIds = [],
    familyIds = [],
    professorIds = [],
  } = params;

  if (requestIds.length > 0) {
    await adminClient.from("requests").delete().in("id", requestIds);
  }

  if (courseIds.length > 0) {
    await adminClient.from("courses").delete().in("id", courseIds);
  }

  if (familyIds.length > 0) {
    await adminClient.from("requests").delete().in("family_id", familyIds);
    await adminClient.from("courses").delete().in("family_id", familyIds);
    await adminClient.from("invoices").delete().in("family_id", familyIds);
  }

  if (professorIds.length > 0) {
    await adminClient.from("courses").delete().in("professor_id", professorIds);
    await adminClient
      .from("payslips")
      .delete()
      .in("professor_id", professorIds);
  }

  if (invoiceIds.length > 0) {
    await adminClient.from("invoices").delete().in("id", invoiceIds);
  }

  if (payslipIds.length > 0) {
    await adminClient.from("payslips").delete().in("id", payslipIds);
  }

  if (actorIds.length > 0) {
    await adminClient.from("audit_logs").delete().in("actor_id", actorIds);
  }

  for (const userId of userIds) {
    await adminClient.auth.admin.deleteUser(userId);
  }
}
