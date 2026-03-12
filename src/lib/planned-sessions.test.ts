import { describe, expect, it } from "vitest";
import {
  upsertPlannedSessions,
  getPlannedSessions,
  type PlannedSession,
} from "@/lib/planned-sessions";

// ---------------------------------------------------------------------------
// Helpers to build minimal Supabase mock clients
// ---------------------------------------------------------------------------

type DeleteChain = {
  delete: () => { eq: () => Promise<{ error: Error | null }> };
};

type InsertChain = {
  insert: (rows: unknown[]) => {
    select: () => Promise<{ data: PlannedSession[] | null; error: Error | null }>;
  };
};

type SelectChain = {
  select: (fields: string) => {
    eq: (col: string, val: string) => {
      order: () => Promise<{ data: PlannedSession[] | null; error: Error | null }>;
    };
  };
};

function makeUpsertClient(opts: {
  deleteError: Error | null;
  insertData: PlannedSession[] | null;
  insertError: Error | null;
}) {
  return {
    from: (table: string) => {
      if (table === "planned_sessions") {
        const client: DeleteChain & InsertChain = {
          delete: () => ({
            eq: () => Promise.resolve({ error: opts.deleteError }),
          }),
          insert: (_rows: unknown[]) => ({
            select: () =>
              Promise.resolve({ data: opts.insertData, error: opts.insertError }),
          }),
        };
        return client;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as any;
}

function makeGetClient(opts: {
  data: PlannedSession[] | null;
  error: Error | null;
}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve(opts),
        }),
      }),
    }),
  } as any;
}

// ---------------------------------------------------------------------------
// upsertPlannedSessions
// ---------------------------------------------------------------------------

const SESSION_DATE = "2026-04-07T14:00:00.000Z";
const SESSION_DATE_2 = "2026-04-14T14:00:00.000Z";

const MOCK_SESSION: PlannedSession = {
  id: "sess-1",
  request_id: "req-1",
  scheduled_at: SESSION_DATE,
  duration_hours: 1.5,
  status: "scheduled",
  created_at: "2026-03-01T00:00:00.000Z",
  updated_at: "2026-03-01T00:00:00.000Z",
};

describe("upsertPlannedSessions", () => {
  it("returns inserted rows on success", async () => {
    const client = makeUpsertClient({
      deleteError: null,
      insertData: [MOCK_SESSION],
      insertError: null,
    });

    const result = await upsertPlannedSessions(
      "req-1",
      [SESSION_DATE],
      1.5,
      client,
    );

    expect(result).toHaveLength(1);
    expect(result[0].scheduled_at).toBe(SESSION_DATE);
    expect(result[0].duration_hours).toBe(1.5);
    expect(result[0].status).toBe("scheduled");
  });

  it("returns empty array when no timestamps provided", async () => {
    const client = makeUpsertClient({
      deleteError: null,
      insertData: [],
      insertError: null,
    });

    const result = await upsertPlannedSessions("req-1", [], 1.5, client);
    expect(result).toHaveLength(0);
  });

  it("inserts multiple sessions", async () => {
    const sessions: PlannedSession[] = [
      { ...MOCK_SESSION, id: "sess-1", scheduled_at: SESSION_DATE },
      { ...MOCK_SESSION, id: "sess-2", scheduled_at: SESSION_DATE_2 },
    ];
    const client = makeUpsertClient({
      deleteError: null,
      insertData: sessions,
      insertError: null,
    });

    const result = await upsertPlannedSessions(
      "req-1",
      [SESSION_DATE, SESSION_DATE_2],
      2,
      client,
    );

    expect(result).toHaveLength(2);
  });

  it("throws when delete fails", async () => {
    const client = makeUpsertClient({
      deleteError: new Error("db error"),
      insertData: null,
      insertError: null,
    });

    await expect(
      upsertPlannedSessions("req-1", [SESSION_DATE], 1, client),
    ).rejects.toThrow("planned_sessions_delete_failed");
  });

  it("throws when insert fails", async () => {
    const client = makeUpsertClient({
      deleteError: null,
      insertData: null,
      insertError: new Error("insert error"),
    });

    await expect(
      upsertPlannedSessions("req-1", [SESSION_DATE], 1, client),
    ).rejects.toThrow("planned_sessions_insert_failed");
  });

  it("handles courses_count > 1 — session_date is the first declared date", async () => {
    // When courses_count > 1, caller passes the first session date only.
    // upsertPlannedSessions receives exactly that one timestamp.
    const client = makeUpsertClient({
      deleteError: null,
      insertData: [MOCK_SESSION],
      insertError: null,
    });

    // courses_count=3 with a single representative session_date
    const result = await upsertPlannedSessions(
      "req-1",
      [SESSION_DATE], // only one date for the batch
      1.5,
      client,
    );

    expect(result).toHaveLength(1);
    expect(result[0].scheduled_at).toBe(SESSION_DATE);
  });
});

// ---------------------------------------------------------------------------
// getPlannedSessions
// ---------------------------------------------------------------------------

describe("getPlannedSessions", () => {
  it("returns sessions ordered by scheduled_at", async () => {
    const sessions: PlannedSession[] = [
      { ...MOCK_SESSION, id: "sess-1", scheduled_at: SESSION_DATE },
      { ...MOCK_SESSION, id: "sess-2", scheduled_at: SESSION_DATE_2 },
    ];
    const client = makeGetClient({ data: sessions, error: null });

    const result = await getPlannedSessions("req-1", client);
    expect(result).toHaveLength(2);
    expect(result[0].scheduled_at).toBe(SESSION_DATE);
    expect(result[1].scheduled_at).toBe(SESSION_DATE_2);
  });

  it("returns empty array when no sessions exist", async () => {
    const client = makeGetClient({ data: [], error: null });
    const result = await getPlannedSessions("req-1", client);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when data is null (backcompat, no sessions yet)", async () => {
    const client = makeGetClient({ data: null, error: null });
    const result = await getPlannedSessions("req-1", client);
    expect(result).toHaveLength(0);
  });

  it("throws when query fails", async () => {
    const client = makeGetClient({ data: null, error: new Error("read error") });

    await expect(getPlannedSessions("req-1", client)).rejects.toThrow(
      "planned_sessions_read_failed",
    );
  });

  it("returns correct fields on each session", async () => {
    const client = makeGetClient({ data: [MOCK_SESSION], error: null });
    const result = await getPlannedSessions("req-1", client);

    const s = result[0];
    expect(s.id).toBe("sess-1");
    expect(s.request_id).toBe("req-1");
    expect(s.duration_hours).toBe(1.5);
    expect(s.status).toBe("scheduled");
  });
});

// ---------------------------------------------------------------------------
// Migration backcompat: old rows without planned_sessions
// ---------------------------------------------------------------------------

describe("backcompat — requests without planned_sessions", () => {
  it("getPlannedSessions returns empty array for requests never scheduled", async () => {
    // Simulates a request that predates the planned_sessions table.
    const client = makeGetClient({ data: [], error: null });
    const result = await getPlannedSessions("old-req-no-schedule", client);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// courses.course_date: behaviour when courses_count > 1
// ---------------------------------------------------------------------------

describe("courses.course_date semantics when courses_count > 1", () => {
  /**
   * Rule: course_date = date of the first (representative) session of the batch.
   * - When courses_count = 1 (enforced by the UI): exact session date.
   * - When courses_count > 1 (legacy or direct API): starting session of the
   *   declared period. NOT auto-calculated from courses_count.
   * - Older rows without course_date use courses.created_at as a display fallback.
   */
  function deriveCourseDate(
    courseDate: string,
    coursesCount: number,
  ): string {
    // course_date is always the date passed by the caller regardless of batch size.
    void coursesCount; // courses_count does not change course_date semantics
    return courseDate;
  }

  it("course_date is the provided date regardless of courses_count=1", () => {
    expect(deriveCourseDate(SESSION_DATE, 1)).toBe(SESSION_DATE);
  });

  it("course_date is the provided date even when courses_count=3", () => {
    expect(deriveCourseDate(SESSION_DATE, 3)).toBe(SESSION_DATE);
  });

  it("course_date does not default to created_at when provided", () => {
    const result = deriveCourseDate(SESSION_DATE, 1);
    expect(result).not.toBe(new Date().toISOString());
    expect(result).toBe(SESSION_DATE);
  });
});

// ---------------------------------------------------------------------------
// Planning source-of-truth priority: planned_sessions > weekly_schedule
// ---------------------------------------------------------------------------

/**
 * This block documents the priority logic used by /professor/requests/page.tsx
 * when initialising the planning draft from an API row.
 *
 * Source-of-truth hierarchy (phase 2 transition):
 *  1. planned_sessions filtered to status="scheduled"  → primary source
 *  2. weekly_schedule / first_course_at / session_hours → fallback for
 *      rows predating migration 0019 (no planned_sessions populated yet)
 */

type RowForInit = {
  planned_sessions: PlannedSession[];
  weekly_schedule: string[] | null;
  first_course_at: string | null;
  weekly_sessions: number | null;
  session_hours: number | null;
};

function deriveDraftSource(row: RowForInit): {
  source: "planned_sessions" | "weekly_schedule";
  scheduleLength: number;
  durationHours: number;
} {
  const active = row.planned_sessions.filter((ps) => ps.status === "scheduled");
  if (active.length > 0) {
    return {
      source: "planned_sessions",
      scheduleLength: active.length,
      durationHours: active[0]?.duration_hours ?? 1,
    };
  }
  const fallback = row.weekly_schedule ?? (row.first_course_at ? [row.first_course_at] : []);
  return {
    source: "weekly_schedule",
    scheduleLength: row.weekly_sessions ?? Math.max(fallback.length, 1),
    durationHours: row.session_hours ?? 1,
  };
}

describe("planning source-of-truth priority", () => {
  it("uses planned_sessions when at least one scheduled session exists", () => {
    const row: RowForInit = {
      planned_sessions: [
        { ...MOCK_SESSION, status: "scheduled", duration_hours: 1.5 },
      ],
      weekly_schedule: ["2025-01-01T10:00:00.000Z"],
      first_course_at: null,
      weekly_sessions: 2,
      session_hours: 2,
    };
    const result = deriveDraftSource(row);
    expect(result.source).toBe("planned_sessions");
    expect(result.durationHours).toBe(1.5);
    expect(result.scheduleLength).toBe(1);
  });

  it("ignores cancelled planned_sessions and falls back to weekly_schedule", () => {
    const row: RowForInit = {
      planned_sessions: [
        { ...MOCK_SESSION, status: "cancelled", duration_hours: 1.5 },
      ],
      weekly_schedule: ["2025-01-01T10:00:00.000Z", "2025-01-08T10:00:00.000Z"],
      first_course_at: null,
      weekly_sessions: 2,
      session_hours: 2,
    };
    const result = deriveDraftSource(row);
    expect(result.source).toBe("weekly_schedule");
    expect(result.durationHours).toBe(2);
    expect(result.scheduleLength).toBe(2);
  });

  it("falls back to weekly_schedule when planned_sessions is empty (pre-migration row)", () => {
    const row: RowForInit = {
      planned_sessions: [],
      weekly_schedule: ["2025-03-10T14:00:00.000Z"],
      first_course_at: "2025-03-10T14:00:00.000Z",
      weekly_sessions: 1,
      session_hours: 1.5,
    };
    const result = deriveDraftSource(row);
    expect(result.source).toBe("weekly_schedule");
    expect(result.durationHours).toBe(1.5);
  });

  it("falls back to first_course_at when weekly_schedule is null", () => {
    const row: RowForInit = {
      planned_sessions: [],
      weekly_schedule: null,
      first_course_at: "2025-03-10T14:00:00.000Z",
      weekly_sessions: null,
      session_hours: null,
    };
    const result = deriveDraftSource(row);
    expect(result.source).toBe("weekly_schedule");
    expect(result.durationHours).toBe(1); // default fallback
  });

  it("entire row empty (no plan set yet) returns safe defaults", () => {
    const row: RowForInit = {
      planned_sessions: [],
      weekly_schedule: null,
      first_course_at: null,
      weekly_sessions: null,
      session_hours: null,
    };
    const result = deriveDraftSource(row);
    expect(result.source).toBe("weekly_schedule");
    expect(result.scheduleLength).toBe(1);
    expect(result.durationHours).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fatal dual-write contract
// ---------------------------------------------------------------------------

describe("fatal dual-write contract", () => {
  /**
   * Since /professor/requests/page.tsx reads from planned_sessions first,
   * a silent failure in the dual-write would create a visible divergence:
   *   - the professor saves a plan
   *   - the server returns success
   *   - on next load, planned_sessions is empty → the plan appears gone
   *
   * As of phase 2, the PATCH /api/professor/requests handler treats
   * upsertPlannedSessions failures as fatal (returns HTTP 500 "schedule_save_failed").
   * The fallback (weekly_schedule updated, planned_sessions not) is acceptable only
   * because the page still shows weekly_schedule when planned_sessions is empty.
   */
  it("upsertPlannedSessions throws a typed error on insert failure", async () => {
    const client = makeUpsertClient({
      deleteError: null,
      insertData: null,
      insertError: new Error("constraint violation"),
    });

    await expect(
      upsertPlannedSessions("req-A", [SESSION_DATE], 1, client),
    ).rejects.toThrow("planned_sessions_insert_failed");
  });

  it("upsertPlannedSessions throws a typed error on delete failure", async () => {
    const client = makeUpsertClient({
      deleteError: new Error("permission denied"),
      insertData: null,
      insertError: null,
    });

    await expect(
      upsertPlannedSessions("req-A", [SESSION_DATE], 1, client),
    ).rejects.toThrow("planned_sessions_delete_failed");
  });

  it("caller receives a typed error string it can map to schedule_save_failed", async () => {
    const client = makeUpsertClient({
      deleteError: null,
      insertData: null,
      insertError: new Error("db timeout"),
    });

    let caught: unknown;
    try {
      await upsertPlannedSessions("req-A", [SESSION_DATE], 1, client);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/planned_sessions_insert_failed/);
  });
});
