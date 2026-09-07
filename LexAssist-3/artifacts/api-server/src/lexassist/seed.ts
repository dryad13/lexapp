import { db } from "./db";
import { matters, tasks, draftEmails, reminders, WORKFLOW_STAGES, organisations, users, ruleTemplates, controlChecks } from "../shared/schema";
import type { MatterType } from "../shared/schema";
import { LIVE_MATTERS } from "./live-data";
import { eq, and, gte, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const DEFAULT_ORG_NAME = "Gardner Champion";

const DEFAULT_USERS = [
  { username: "zaid.khan", password: process.env.AUTH_PASSWORD || "HU51BAN", displayName: "Zaid Khan", role: "admin" as const },
  { username: "hasinah.ahmed", password: "Ahmed12", displayName: "Hasinah Ahmed", role: "fee_earner" as const },
  { username: "kayaam.bashir", password: "Bashir12", displayName: "Kayaam Bashir", role: "fee_earner" as const },
  { username: "faizal.lunat", password: "Lunat12", displayName: "Faizal Lunat", role: "fee_earner" as const },
  { username: "admin", password: "admin12", displayName: "Admin", role: "admin" as const, department: "both" as const },
];

const CONVEYANCING_RULES: { matterType: string; stage: string; ruleKey: string; ruleName: string; required: boolean }[] = [
  { matterType: "purchase", stage: "Onboarding", ruleKey: "PUR_OB_01", ruleName: "Client ID verified (AML check)", required: true },
  { matterType: "purchase", stage: "Onboarding", ruleKey: "PUR_OB_02", ruleName: "Retainer letter signed", required: true },
  { matterType: "purchase", stage: "Onboarding", ruleKey: "PUR_OB_03", ruleName: "Source of funds declaration obtained", required: true },
  { matterType: "purchase", stage: "Client Info", ruleKey: "PUR_CI_01", ruleName: "Client questionnaire completed", required: true },
  { matterType: "purchase", stage: "Client Info", ruleKey: "PUR_CI_02", ruleName: "Proof of address obtained", required: false },
  { matterType: "purchase", stage: "SDLT Questionnaire", ruleKey: "PUR_SQ_01", ruleName: "SDLT questionnaire completed", required: true },
  { matterType: "purchase", stage: "SDLT Questionnaire", ruleKey: "PUR_SQ_02", ruleName: "First-time buyer relief eligibility checked", required: false },
  { matterType: "purchase", stage: "Source of Funds", ruleKey: "PUR_SF_01", ruleName: "Source of funds verified", required: true },
  { matterType: "purchase", stage: "Source of Funds", ruleKey: "PUR_SF_02", ruleName: "Gift letter obtained (if applicable)", required: false },
  { matterType: "purchase", stage: "Contract Pack", ruleKey: "PUR_CP_01", ruleName: "Contract pack received from seller's solicitor", required: true },
  { matterType: "purchase", stage: "Contract Pack", ruleKey: "PUR_CP_02", ruleName: "Title reviewed for defects", required: true },
  { matterType: "purchase", stage: "Contract Pack", ruleKey: "PUR_CP_03", ruleName: "TA6/TA7/TA10 forms reviewed", required: true },
  { matterType: "purchase", stage: "Mortgage Offer", ruleKey: "PUR_MO_01", ruleName: "Mortgage offer received", required: true },
  { matterType: "purchase", stage: "Mortgage Offer", ruleKey: "PUR_MO_02", ruleName: "Special conditions noted", required: true },
  { matterType: "purchase", stage: "Searches", ruleKey: "PUR_SE_01", ruleName: "Local authority search ordered", required: true },
  { matterType: "purchase", stage: "Searches", ruleKey: "PUR_SE_02", ruleName: "Environmental search ordered", required: true },
  { matterType: "purchase", stage: "Searches", ruleKey: "PUR_SE_03", ruleName: "Drainage search ordered", required: true },
  { matterType: "purchase", stage: "Searches", ruleKey: "PUR_SE_04", ruleName: "All search results reviewed", required: true },
  { matterType: "purchase", stage: "Enquiries", ruleKey: "PUR_EN_01", ruleName: "Enquiries raised with seller's solicitor", required: true },
  { matterType: "purchase", stage: "Enquiries", ruleKey: "PUR_EN_02", ruleName: "Satisfactory replies received", required: true },
  { matterType: "purchase", stage: "COT Submission & Lender Requirements", ruleKey: "PUR_COT_01", ruleName: "Certificate of title submitted to lender", required: true },
  { matterType: "purchase", stage: "COT Submission & Lender Requirements", ruleKey: "PUR_COT_02", ruleName: "Lender requirements satisfied", required: true },
  { matterType: "purchase", stage: "Signed Documents", ruleKey: "PUR_SD_01", ruleName: "TR1 signed by buyer", required: true },
  { matterType: "purchase", stage: "Signed Documents", ruleKey: "PUR_SD_02", ruleName: "Mortgage deed signed", required: true },
  { matterType: "purchase", stage: "Exchange", ruleKey: "PUR_EX_01", ruleName: "Deposit funds received", required: true },
  { matterType: "purchase", stage: "Exchange", ruleKey: "PUR_EX_02", ruleName: "Completion date agreed", required: true },
  { matterType: "purchase", stage: "Exchange", ruleKey: "PUR_EX_03", ruleName: "Contracts exchanged", required: true },
  { matterType: "purchase", stage: "Completion", ruleKey: "PUR_CO_01", ruleName: "Completion funds sent", required: true },
  { matterType: "purchase", stage: "Completion", ruleKey: "PUR_CO_02", ruleName: "Keys released confirmed", required: true },
  { matterType: "purchase", stage: "Post Completion", ruleKey: "PUR_PO_01", ruleName: "SDLT return filed", required: true },
  { matterType: "purchase", stage: "Post Completion", ruleKey: "PUR_PO_02", ruleName: "AP1 submitted to Land Registry", required: true },
  { matterType: "purchase", stage: "Post Completion", ruleKey: "PUR_PO_03", ruleName: "Title registration confirmed", required: false },

  { matterType: "sale", stage: "Onboarding", ruleKey: "SAL_OB_01", ruleName: "Client ID verified (AML check)", required: true },
  { matterType: "sale", stage: "Onboarding", ruleKey: "SAL_OB_02", ruleName: "Retainer letter signed", required: true },
  { matterType: "sale", stage: "Client Questionnaire", ruleKey: "SAL_CQ_01", ruleName: "TA6 Property Information Form completed", required: true },
  { matterType: "sale", stage: "Client Questionnaire", ruleKey: "SAL_CQ_02", ruleName: "TA10 Fittings and Contents Form completed", required: true },
  { matterType: "sale", stage: "Sale Information Form", ruleKey: "SAL_SI_01", ruleName: "Sale Information Form completed", required: true },
  { matterType: "sale", stage: "Contract Pack", ruleKey: "SAL_CP_01", ruleName: "Contract pack prepared and sent", required: true },
  { matterType: "sale", stage: "Contract Pack", ruleKey: "SAL_CP_02", ruleName: "Official copies obtained", required: true },
  { matterType: "sale", stage: "Enquiries", ruleKey: "SAL_EN_01", ruleName: "Buyer's enquiries answered", required: true },
  { matterType: "sale", stage: "Enquiries", ruleKey: "SAL_EN_02", ruleName: "Additional enquiries resolved", required: false },
  { matterType: "sale", stage: "Signed Documents", ruleKey: "SAL_SD_01", ruleName: "Contract signed by seller", required: true },
  { matterType: "sale", stage: "Signed Documents", ruleKey: "SAL_SD_02", ruleName: "TR1 signed by seller", required: true },
  { matterType: "sale", stage: "Exchange", ruleKey: "SAL_EX_01", ruleName: "Completion date agreed", required: true },
  { matterType: "sale", stage: "Exchange", ruleKey: "SAL_EX_02", ruleName: "Contracts exchanged", required: true },
  { matterType: "sale", stage: "Completion", ruleKey: "SAL_CO_01", ruleName: "Redemption statement obtained (if mortgaged)", required: false },
  { matterType: "sale", stage: "Completion", ruleKey: "SAL_CO_02", ruleName: "Completion funds received", required: true },
  { matterType: "sale", stage: "Completion", ruleKey: "SAL_CO_03", ruleName: "Keys released", required: true },

  { matterType: "remortgage", stage: "Onboarding", ruleKey: "REM_OB_01", ruleName: "Client ID verified (AML check)", required: true },
  { matterType: "remortgage", stage: "Onboarding", ruleKey: "REM_OB_02", ruleName: "Retainer letter signed", required: true },
  { matterType: "remortgage", stage: "Questionnaire", ruleKey: "REM_QU_01", ruleName: "Remortgage questionnaire completed", required: true },
  { matterType: "remortgage", stage: "Redemption/COT Submission", ruleKey: "REM_RC_01", ruleName: "Redemption statement obtained", required: true },
  { matterType: "remortgage", stage: "Redemption/COT Submission", ruleKey: "REM_RC_02", ruleName: "Certificate of title submitted", required: true },
  { matterType: "remortgage", stage: "Pre-Complete Checks & Indemnities", ruleKey: "REM_PC_01", ruleName: "Pre-completion searches done", required: true },
  { matterType: "remortgage", stage: "Pre-Complete Checks & Indemnities", ruleKey: "REM_PC_02", ruleName: "Indemnity policies arranged (if needed)", required: false },
  { matterType: "remortgage", stage: "Signed Documents", ruleKey: "REM_SD_01", ruleName: "Mortgage deed signed", required: true },
  { matterType: "remortgage", stage: "Signed Documents", ruleKey: "REM_SD_02", ruleName: "Declaration of trust (if applicable)", required: false },
  { matterType: "remortgage", stage: "Completion", ruleKey: "REM_CO_01", ruleName: "New mortgage funds received", required: true },
  { matterType: "remortgage", stage: "Completion", ruleKey: "REM_CO_02", ruleName: "Existing mortgage redeemed", required: true },
  { matterType: "remortgage", stage: "Post Completion", ruleKey: "REM_PO_01", ruleName: "AP1 submitted to Land Registry", required: true },
  { matterType: "remortgage", stage: "Post Completion", ruleKey: "REM_PO_02", ruleName: "Title registration confirmed", required: false },
];

async function seedOrganisationAndUsers() {
  const existingOrgs = await db.select().from(organisations);
  let orgId: number;

  if (existingOrgs.length === 0) {
    const [org] = await db.insert(organisations).values({
      name: DEFAULT_ORG_NAME,
    }).returning();
    orgId = org.id;
    console.log(`Created default organisation: ${DEFAULT_ORG_NAME}`);
  } else {
    orgId = existingOrgs[0].id;
  }

  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    for (const u of DEFAULT_USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      await db.insert(users).values({
        username: u.username,
        passwordHash: hash,
        displayName: u.displayName,
        role: u.role,
        department: (u as any).department || "conveyancing",
        organisationId: orgId,
      });
    }
    console.log(`Created ${DEFAULT_USERS.length} default users`);
  }

  const mattersWithoutOrg = await db.select().from(matters).where(sql`organisation_id IS NULL`);
  if (mattersWithoutOrg.length > 0) {
    await db.update(matters).set({ organisationId: orgId }).where(sql`organisation_id IS NULL`);
    console.log(`Migrated ${mattersWithoutOrg.length} matters to organisation ${DEFAULT_ORG_NAME}`);
  }

  return orgId;
}

async function seedRuleTemplates() {
  const existing = await db.select().from(ruleTemplates);
  if (existing.length > 0) return;

  for (const rule of CONVEYANCING_RULES) {
    await db.insert(ruleTemplates).values({
      moduleType: "conveyancing",
      matterType: rule.matterType,
      stage: rule.stage,
      ruleKey: rule.ruleKey,
      ruleName: rule.ruleName,
      required: rule.required,
    });
  }
  console.log(`Seeded ${CONVEYANCING_RULES.length} conveyancing rule templates`);
}

async function migrateSignedDocuments() {
  const allMatters = await db.select().from(matters);
  let migrated = 0;

  for (const matter of allMatters) {
    const matterType = matter.type as MatterType;
    const stages = WORKFLOW_STAGES[matterType];
    if (!stages) continue;

    const existingTasks = await db.select().from(tasks).where(eq(tasks.matterId, matter.id));
    const hasSignedDocs = existingTasks.some(t => t.stage === "Signed Documents");
    if (hasSignedDocs) continue;

    const signedDocsIdx = stages.indexOf("Signed Documents");
    if (signedDocsIdx === -1) continue;

    const currentStageIdx = stages.indexOf(matter.currentStage as any);
    const isCompleted = currentStageIdx >= 0 && currentStageIdx > signedDocsIdx;

    await db.update(tasks)
      .set({ sortOrder: sql`${tasks.sortOrder} + 1` })
      .where(and(eq(tasks.matterId, matter.id), gte(tasks.sortOrder, signedDocsIdx)));

    await db.insert(tasks).values({
      matterId: matter.id,
      title: "Signed Documents",
      stage: "Signed Documents",
      status: isCompleted ? "completed" : "pending",
      sortOrder: signedDocsIdx,
      completedAt: isCompleted ? new Date() : null,
    });

    migrated++;
  }

  if (migrated > 0) {
    console.log(`Migrated ${migrated} matters: added Signed Documents stage`);
  }
}

async function migrateTitleFormat() {
  const allMatters = await db.select().from(matters);
  let migrated = 0;

  for (const matter of allMatters) {
    const title = matter.title;
    const dashIdx = title.indexOf(" - ");
    if (dashIdx === -1) continue;

    const afterDash = title.substring(dashIdx + 3);
    if (/^[A-Z]{1,2}\d[0-9A-Z]?\s?\d[A-Z]{2}$/.test(afterDash.trim())) continue;
    if (!afterDash.startsWith("Sale") && !afterDash.startsWith("Purchase") && !afterDash.startsWith("Remortgage")) continue;

    const pcMatch = title.match(/([A-Z]{1,2}\d[0-9A-Z]?\s?\d[A-Z]{2})$/);
    if (!pcMatch) continue;

    const ref = title.substring(0, dashIdx);
    const newTitle = `${ref} - ${pcMatch[1]}`;
    await db.update(matters).set({ title: newTitle }).where(eq(matters.id, matter.id));
    migrated++;
  }

  if (migrated > 0) {
    console.log(`Migrated ${migrated} matter titles to ref + postcode format`);
  }
}

async function seedComplianceChecksForExistingMatters(orgId: number) {
  const existingChecks = await db.select().from(controlChecks).limit(1);
  if (existingChecks.length > 0) return;

  const allMatters = await db.select().from(matters).where(eq(matters.organisationId, orgId));
  const templates = await db.select().from(ruleTemplates);

  let seeded = 0;
  for (const matter of allMatters) {
    const matterTemplates = templates.filter(t => t.matterType === matter.type && t.moduleType === "conveyancing");
    for (const template of matterTemplates) {
      await db.insert(controlChecks).values({
        organisationId: orgId,
        matterId: matter.id,
        stage: template.stage,
        ruleName: template.ruleName,
        required: template.required,
        completed: false,
      });
      seeded++;
    }
  }
  if (seeded > 0) {
    console.log(`Seeded ${seeded} compliance checks for ${allMatters.length} existing matters`);
  }
}

export async function seedDatabase() {
  const orgId = await seedOrganisationAndUsers();
  await seedRuleTemplates();

  const existingMatters = await db.select().from(matters);

  if (existingMatters.length > 0) {
    await migrateSignedDocuments();
    await migrateTitleFormat();
    await seedComplianceChecksForExistingMatters(orgId);
  }

  console.log("Seed complete – matters start from a clean slate");
}
