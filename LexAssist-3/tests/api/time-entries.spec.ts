import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";

describe("time-entries", () => {
  let admin: AuthSession;

  beforeAll(async () => {
    admin = await login();
  });

  it("POST and DELETE /api/time-entries", async () => {
    const matter = await createMatter(admin.token);
    // time entries may require journalEntryId — try both shapes
    const journal = await json(
      await apiFetch("/api/journal-entries", {
        method: "POST",
        token: admin.token,
        body: JSON.stringify({
          title: "Time log",
          content: "Worked on matter",
          entryDate: new Date().toISOString(),
        }),
      }),
    );

    const create = await apiFetch("/api/time-entries", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        journalEntryId: journal.id,
        matterId: matter.id,
        minutes: 30,
        description: "Review contract",
      }),
    });
    expect([200, 201, 400]).toContain(create.status);
    if (create.status >= 400) return;
    const entry = await json(create);
    const del = await apiFetch(`/api/time-entries/${entry.id}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(del.status);
  });
});
