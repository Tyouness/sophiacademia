import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import {
  adminClient,
  cleanupTestData,
  createTestUser,
  disableUserProfile,
} from "./testAuth";

const baseUrl = process.env.TEST_BASE_URL as string;

type ApiResult<T> = { response: Response; data: T | null };

async function jsonPost<T>(
  url: string,
  token: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  return { response, data: data as T | null };
}

async function jsonGet<T>(url: string, token: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => null);
  return { response, data: data as T | null };
}

async function createRequest(params: {
  professorToken: string;
  familyId: string;
  subject: string;
}) {
  return jsonPost<{ data: { id: string; status: string } }>(
    `${baseUrl}/api/professor/requests`,
    params.professorToken,
    { familyId: params.familyId, subject: params.subject },
  );
}

async function approveRequest(params: { staffToken: string; requestId: string }) {
  return jsonPost<{ data: { id: string; status: string } }>(
    `${baseUrl}/api/staff/requests`,
    params.staffToken,
    { action: "approve", requestId: params.requestId },
  );
}

async function declareCourse(params: {
  professorToken: string;
  familyId: string;
  subject: string;
}) {
  return jsonPost<{ data?: { id: string; status: string }; error?: string }>(
    `${baseUrl}/api/professor/courses`,
    params.professorToken,
    {
      familyId: params.familyId,
      hours: 2,
      coursesCount: 1,
      subject: params.subject,
    },
  );
}

async function markPaid(params: { staffToken: string; courseId: string }) {
  return jsonPost<{ data: { id: string; status: string } }>(
    `${baseUrl}/api/staff/courses`,
    params.staffToken,
    { courseId: params.courseId },
  );
}

describe("integration hardening", () => {
  it("rejects family creating a request", async () => {
    const family = await createTestUser("family");
    const subject = `maths-${randomUUID()}`;

    try {
      const response = await createRequest({
        professorToken: family.accessToken,
        familyId: family.id,
        subject,
      });

      expect(response.response.status).toBe(403);
    } finally {
      await cleanupTestData({
        userIds: [family.id],
        familyIds: [family.id],
      });
    }
  });

  it("rejects professor approving a request", async () => {
    const professor = await createTestUser("professor");
    const family = await createTestUser("family");
    const subject = `maths-${randomUUID()}`;

    try {
      const created = await createRequest({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });

      expect(created.response.status).toBe(200);

      const requestId = created.data?.data?.id as string;
      const approve = await approveRequest({
        staffToken: professor.accessToken,
        requestId,
      });

      expect(approve.response.status).toBe(403);
    } finally {
      await cleanupTestData({
        userIds: [professor.id, family.id],
        familyIds: [family.id],
        professorIds: [professor.id],
        actorIds: [professor.id],
      });
    }
  });

  it("rejects professor marking a course paid", async () => {
    const professor = await createTestUser("professor");
    const staff = await createTestUser("staff");
    const family = await createTestUser("family");
    const subject = `maths-${randomUUID()}`;

    try {
      const created = await createRequest({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(created.response.status).toBe(200);
      const requestId = created.data?.data?.id as string;

      await approveRequest({ staffToken: staff.accessToken, requestId });

      const declared = await declareCourse({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(declared.response.status).toBe(200);

      const courseId = declared.data?.data?.id as string;
      const paid = await markPaid({
        staffToken: professor.accessToken,
        courseId,
      });

      expect(paid.response.status).toBe(403);
    } finally {
      await cleanupTestData({
        userIds: [professor.id, staff.id, family.id],
        familyIds: [family.id],
        professorIds: [professor.id],
        actorIds: [professor.id, staff.id],
      });
    }
  });

  it("rejects course creation without approved request", async () => {
    const professor = await createTestUser("professor");
    const family = await createTestUser("family");
    const subject = `maths-${randomUUID()}`;

    try {
      const declared = await declareCourse({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });

      expect(declared.response.status).toBe(409);
      expect(declared.data?.error).toBe("approved_request_required");
    } finally {
      await cleanupTestData({
        userIds: [professor.id, family.id],
        familyIds: [family.id],
        professorIds: [professor.id],
        actorIds: [professor.id],
      });
    }
  });

  it("rejects approving the same request twice", async () => {
    const professor = await createTestUser("professor");
    const staff = await createTestUser("staff");
    const family = await createTestUser("family");
    const subject = `maths-${randomUUID()}`;

    try {
      const created = await createRequest({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(created.response.status).toBe(200);
      const requestId = created.data?.data?.id as string;

      const first = await approveRequest({
        staffToken: staff.accessToken,
        requestId,
      });
      expect(first.response.status).toBe(200);

      const second = await approveRequest({
        staffToken: staff.accessToken,
        requestId,
      });
      expect(second.response.status).toBe(409);
    } finally {
      await cleanupTestData({
        userIds: [professor.id, staff.id, family.id],
        familyIds: [family.id],
        professorIds: [professor.id],
        actorIds: [professor.id, staff.id],
      });
    }
  });

  it("rejects paying the same course twice", async () => {
    const professor = await createTestUser("professor");
    const staff = await createTestUser("staff");
    const family = await createTestUser("family");
    const subject = `maths-${randomUUID()}`;

    try {
      const created = await createRequest({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(created.response.status).toBe(200);
      const requestId = created.data?.data?.id as string;
      const approved = await approveRequest({
        staffToken: staff.accessToken,
        requestId,
      });
      expect(approved.response.status).toBe(200);

      const declared = await declareCourse({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(declared.response.status).toBe(200);
      const courseId = declared.data?.data?.id as string;

      const first = await markPaid({ staffToken: staff.accessToken, courseId });
      expect(first.response.status).toBe(200);

      const second = await markPaid({ staffToken: staff.accessToken, courseId });
      expect(second.response.status).toBe(409);

      const { data: invoices } = await adminClient
        .from("invoices")
        .select("id")
        .eq("family_id", family.id);

      const { data: payslips } = await adminClient
        .from("payslips")
        .select("id")
        .eq("professor_id", professor.id)
        .eq("family_id", family.id);

      expect((invoices ?? []).length).toBeGreaterThan(0);
      expect((payslips ?? []).length).toBeGreaterThan(0);
    } finally {
      await cleanupTestData({
        userIds: [professor.id, staff.id, family.id],
        familyIds: [family.id],
        professorIds: [professor.id],
        actorIds: [professor.id, staff.id],
      });
    }
  });

  it("blocks disabled users on all business routes", async () => {
    const professor = await createTestUser("professor");
    const staff = await createTestUser("staff");
    const family = await createTestUser("family");
    const subject = `maths-${randomUUID()}`;

    try {
      await disableUserProfile(professor.id);
      await disableUserProfile(staff.id);

      const reqRes = await createRequest({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(reqRes.response.status).toBe(403);

      const courseRes = await declareCourse({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(courseRes.response.status).toBe(403);

      const approveRes = await jsonPost(
        `${baseUrl}/api/staff/requests`,
        staff.accessToken,
        { action: "approve", requestId: randomUUID() },
      );
      expect(approveRes.response.status).toBe(403);

      const paidRes = await jsonPost(
        `${baseUrl}/api/staff/courses`,
        staff.accessToken,
        { courseId: randomUUID() },
      );
      expect(paidRes.response.status).toBe(403);
    } finally {
      await cleanupTestData({
        userIds: [professor.id, staff.id, family.id],
        familyIds: [family.id],
        professorIds: [professor.id],
        actorIds: [professor.id, staff.id],
      });
    }
  });

  it("records audit logs for critical actions", async () => {
    const professor = await createTestUser("professor");
    const staff = await createTestUser("staff");
    const family = await createTestUser("family");
    const subject = `maths-${randomUUID()}`;

    try {
      const created = await createRequest({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(created.response.status).toBe(200);
      const requestId = created.data?.data?.id as string;
      const approved = await approveRequest({
        staffToken: staff.accessToken,
        requestId,
      });
      expect(approved.response.status).toBe(200);

      const declared = await declareCourse({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(declared.response.status).toBe(200);
      const courseId = declared.data?.data?.id as string;
      const paid = await markPaid({ staffToken: staff.accessToken, courseId });
      expect(paid.response.status).toBe(200);

      const { data: professorLogs } = await adminClient
        .from("audit_logs")
        .select("action")
        .eq("actor_id", professor.id);

      const { data: staffLogs } = await adminClient
        .from("audit_logs")
        .select("action")
        .eq("actor_id", staff.id);

      const professorActions = (professorLogs ?? []).map((log) => log.action);
      const staffActions = (staffLogs ?? []).map((log) => log.action);

      expect(professorActions).toEqual(
        expect.arrayContaining(["request_created", "course_declared"]),
      );
      expect(staffActions).toEqual(
        expect.arrayContaining([
          "request_approved",
          "course_paid",
          "invoice_generated",
          "payslip_generated",
        ]),
      );
    } finally {
      await cleanupTestData({
        userIds: [professor.id, staff.id, family.id],
        familyIds: [family.id],
        professorIds: [professor.id],
        actorIds: [professor.id, staff.id],
      });
    }
  });

  it("auto-pays pending courses after 48 hours", async () => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      throw new Error("CRON_SECRET must be set for auto-pay tests");
    }

    const professor = await createTestUser("professor");
    const family = await createTestUser("family");

    try {
      const pastDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
      const { data: course } = await adminClient
        .from("courses")
        .insert({
          professor_id: professor.id,
          family_id: family.id,
          hours: 2,
          courses_count: 1,
          subject: `maths-${randomUUID()}`,
          status: "pending",
          created_at: pastDate,
          updated_at: pastDate,
        })
        .select("id")
        .single();

      const courseId = course?.id as string;

      const response = await fetch(`${baseUrl}/api/internal/auto-pay`, {
        method: "POST",
        headers: {
          "x-cron-secret": cronSecret,
        },
      });

      expect(response.status).toBe(200);

      const { data: paidCourse } = await adminClient
        .from("courses")
        .select("status")
        .eq("id", courseId)
        .single();

      expect(paidCourse?.status).toBe("paid");

      const { data: invoices } = await adminClient
        .from("invoices")
        .select("id")
        .eq("family_id", family.id);

      const { data: payslips } = await adminClient
        .from("payslips")
        .select("id")
        .eq("professor_id", professor.id)
        .eq("family_id", family.id);

      expect((invoices ?? []).length).toBeGreaterThan(0);
      expect((payslips ?? []).length).toBeGreaterThan(0);

      const { data: logs } = await adminClient
        .from("audit_logs")
        .select("action")
        .eq("actor_id", professor.id);

      const actions = (logs ?? []).map((log) => log.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          "auto_paid",
          "invoice_generated",
          "payslip_generated",
        ]),
      );
    } finally {
      await cleanupTestData({
        userIds: [professor.id, family.id],
        familyIds: [family.id],
        professorIds: [professor.id],
        actorIds: [professor.id],
      });
    }
  });

  it("family can list its courses", async () => {
    const professor = await createTestUser("professor");
    const staff = await createTestUser("staff");
    const family = await createTestUser("family");
    const subject = `maths-${randomUUID()}`;

    try {
      const created = await createRequest({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(created.response.status).toBe(200);
      const requestId = created.data?.data?.id as string;

      const approved = await approveRequest({
        staffToken: staff.accessToken,
        requestId,
      });
      expect(approved.response.status).toBe(200);

      const declared = await declareCourse({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(declared.response.status).toBe(200);

      const listed = await jsonGet<{ data: Array<{ id: string }> }>(
        `${baseUrl}/api/family/courses`,
        family.accessToken,
      );

      expect(listed.response.status).toBe(200);
      expect(listed.data?.data?.length).toBeGreaterThan(0);
    } finally {
      await cleanupTestData({
        userIds: [professor.id, staff.id, family.id],
        familyIds: [family.id],
        professorIds: [professor.id],
        actorIds: [professor.id, staff.id],
      });
    }
  });

  it("professor can list its courses", async () => {
    const professor = await createTestUser("professor");
    const staff = await createTestUser("staff");
    const family = await createTestUser("family");
    const subject = `maths-${randomUUID()}`;

    try {
      const created = await createRequest({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(created.response.status).toBe(200);
      const requestId = created.data?.data?.id as string;

      const approved = await approveRequest({
        staffToken: staff.accessToken,
        requestId,
      });
      expect(approved.response.status).toBe(200);

      const declared = await declareCourse({
        professorToken: professor.accessToken,
        familyId: family.id,
        subject,
      });
      expect(declared.response.status).toBe(200);

      const listed = await jsonGet<{ data: Array<{ id: string }> }>(
        `${baseUrl}/api/professor/courses`,
        professor.accessToken,
      );

      expect(listed.response.status).toBe(200);
      expect(listed.data?.data?.length).toBeGreaterThan(0);
    } finally {
      await cleanupTestData({
        userIds: [professor.id, staff.id, family.id],
        familyIds: [family.id],
        professorIds: [professor.id],
        actorIds: [professor.id, staff.id],
      });
    }
  });

});
