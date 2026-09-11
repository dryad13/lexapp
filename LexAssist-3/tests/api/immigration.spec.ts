import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";
import { randomSuffix } from "../helpers/env.js";

const IMMIGRATION_TYPES = [
  "visa_application",
  "asylum",
  "appeal",
  "settlement",
  "naturalisation",
] as const;

const EXPECTED_STAGES = [
  "Onboarding / Induction",
  "Eligibility and Assessment",
  "Advice on Viable Routes",
  "Form Filling / Application",
  "Fee Payment / IHS",
  "Biometric Booking",
  "Application Outcome",
  "Appeal / JR / AR (if applicable)",
];

describe("immigration workflow", () => {
  let admin: AuthSession;

  beforeAll(async () => {
    admin = await login();
  });

  for (const type of IMMIGRATION_TYPES) {
    it(`creates ${type} with shared spine tasks + compliance checks`, async () => {
      const matter = await createMatter(admin.token, {
        type,
        title: `${type} ${randomSuffix()}`,
        propertyAddress: "10 Immigration Road",
      });
      expect(matter.tasks.map((t: any) => t.stage)).toEqual(EXPECTED_STAGES);
      const compliance = await json(
        await apiFetch(`/api/matters/${matter.id}/compliance`, { token: admin.token }),
      );
      expect(compliance.length).toBeGreaterThan(0);
      expect(compliance.some((c: any) => c.stage === "Onboarding / Induction")).toBe(true);
    });
  }

  it("blocks leaving induction without AML; allows override", async () => {
    const matter = await createMatter(admin.token, {
      type: "asylum",
      title: `Asylum gate ${randomSuffix()}`,
    });
    const blocked = await apiFetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ currentStage: "Eligibility and Assessment" }),
    });
    expect(blocked.status).toBe(409);

    const overridden = await apiFetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({
        currentStage: "Eligibility and Assessment",
        override: true,
        overrideReason: "Urgent client deadline — AML evidence pending from client",
      }),
    });
    expect(overridden.status).toBe(200);
  });
});
