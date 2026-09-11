import { db } from "./db";
import { matters, tasks, draftEmails, reminders, journalEntries, timeEntries, documents, enquiryPacks, auditLogs, knowledgeResources, enquiriesLibrary, enquiriesBuilderPacks, financialItems, matterFinancials, WORKFLOW_STAGES, getImmigrationWorkflowStages, isImmigrationMatterType, organisations, users, controlChecks, ruleTemplates, riskAssessments } from "../shared/schema";
import type { Matter, InsertMatter, Task, InsertTask, DraftEmail, InsertDraftEmail, Reminder, InsertReminder, JournalEntry, InsertJournalEntry, TimeEntry, InsertTimeEntry, MatterType, Document, InsertDocument, EnquiryPack, InsertEnquiryPack, AuditLog, InsertAuditLog, KnowledgeResource, InsertKnowledgeResource, EnquiriesLibraryItem, InsertEnquiriesLibraryItem, EnquiriesBuilderPack, InsertEnquiriesBuilderPack, FinancialItem, InsertFinancialItem, MatterFinancials, InsertMatterFinancials, Organisation, InsertOrganisation, User, InsertUser, ControlCheck, InsertControlCheck, RuleTemplate, RiskAssessment } from "../shared/schema";
import { eq, desc, and, sql, isNull, gte, lte } from "drizzle-orm";
import { encrypt, decrypt, isEncrypted } from "./encryption";

const SENSITIVE_MATTER_FIELDS = ["clientName", "clientEmail", "propertyAddress"] as const;

function encryptMatter<T extends Partial<InsertMatter>>(data: T): T {
  const encrypted = { ...data };
  for (const field of SENSITIVE_MATTER_FIELDS) {
    if (field in encrypted && encrypted[field as keyof T]) {
      const val = encrypted[field as keyof T] as string;
      if (!isEncrypted(val)) {
        (encrypted as any)[field] = encrypt(val);
      }
    }
  }
  return encrypted;
}

function decryptMatter(matter: Matter): Matter {
  const decrypted = { ...matter };
  for (const field of SENSITIVE_MATTER_FIELDS) {
    if (decrypted[field]) {
      decrypted[field] = decrypt(decrypted[field] as string);
    }
  }
  return decrypted;
}

function decryptEmail(email: DraftEmail): DraftEmail {
  const decrypted = { ...email };
  if (decrypted.recipient) decrypted.recipient = decrypt(decrypted.recipient);
  return decrypted;
}

function encryptEmail<T extends Partial<InsertDraftEmail>>(data: T): T {
  const encrypted = { ...data };
  if ((encrypted as any).recipient && !isEncrypted((encrypted as any).recipient)) {
    (encrypted as any).recipient = encrypt((encrypted as any).recipient);
  }
  return encrypted;
}

export interface IStorage {
  getOrganisation(id: number): Promise<Organisation | undefined>;
  createOrganisation(data: InsertOrganisation): Promise<Organisation>;
  getOrganisations(): Promise<Organisation[]>;

  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUsers(organisationId: number): Promise<User[]>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  getMatters(organisationId?: number): Promise<Matter[]>;
  getMatter(id: number): Promise<Matter | undefined>;
  createMatter(data: InsertMatter): Promise<Matter>;
  updateMatter(id: number, data: Partial<InsertMatter> & { lastViewedAt?: Date }): Promise<Matter | undefined>;
  deleteMatter(id: number): Promise<void>;

  getTasksByMatter(matterId: number): Promise<Task[]>;
  getTasksByMatterId(matterId: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined>;
  completeTask(id: number): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;

  getDraftEmails(matterId?: number): Promise<DraftEmail[]>;
  getDraftEmail(id: number): Promise<DraftEmail | undefined>;
  createDraftEmail(data: InsertDraftEmail): Promise<DraftEmail>;
  updateDraftEmail(id: number, data: Partial<InsertDraftEmail>): Promise<DraftEmail | undefined>;
  deleteDraftEmail(id: number): Promise<void>;

  getReminders(matterId?: number): Promise<Reminder[]>;
  getReminder(id: number): Promise<Reminder | undefined>;
  createReminder(data: InsertReminder): Promise<Reminder>;
  updateReminder(id: number, data: Partial<InsertReminder>): Promise<Reminder | undefined>;
  completeReminder(id: number): Promise<Reminder | undefined>;
  deleteReminder(id: number): Promise<void>;

  createDefaultTasks(matterId: number, matterType: MatterType): Promise<Task[]>;
  createImmigrationTasks(matterId: number, matterType: string): Promise<Task[]>;

  getJournalEntries(userId: number): Promise<JournalEntry[]>;
  getJournalEntry(id: number, userId: number): Promise<JournalEntry | undefined>;
  getJournalEntriesInRange(userId: number, from: Date, to: Date): Promise<JournalEntry[]>;
  createJournalEntry(data: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: number, userId: number, data: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined>;
  deleteJournalEntry(id: number, userId: number): Promise<void>;

  getTimeEntries(journalEntryId: number): Promise<TimeEntry[]>;
  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  deleteTimeEntry(id: number): Promise<void>;

  getDocumentsByMatter(matterId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(data: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<void>;

  getEnquiryPacksByMatter(matterId: number): Promise<EnquiryPack[]>;
  getEnquiryPack(id: number): Promise<EnquiryPack | undefined>;
  createEnquiryPack(data: InsertEnquiryPack): Promise<EnquiryPack>;
  updateEnquiryPack(id: number, data: Partial<EnquiryPack>): Promise<EnquiryPack | undefined>;

  getAuditLogs(matterId?: number): Promise<AuditLog[]>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;

  getKnowledgeResources(): Promise<KnowledgeResource[]>;
  getKnowledgeResource(id: number): Promise<KnowledgeResource | undefined>;
  createKnowledgeResource(data: InsertKnowledgeResource): Promise<KnowledgeResource>;
  deleteKnowledgeResource(id: number): Promise<void>;

  getEnquiriesLibrary(): Promise<EnquiriesLibraryItem[]>;
  getEnquiriesLibraryItem(id: number): Promise<EnquiriesLibraryItem | undefined>;
  createEnquiriesLibraryItem(data: InsertEnquiriesLibraryItem): Promise<EnquiriesLibraryItem>;
  getEnquiriesLibraryCount(): Promise<number>;

  getBuilderPacksByMatter(matterId: number): Promise<EnquiriesBuilderPack[]>;
  getBuilderPack(id: number): Promise<EnquiriesBuilderPack | undefined>;
  createBuilderPack(data: InsertEnquiriesBuilderPack): Promise<EnquiriesBuilderPack>;
  updateBuilderPack(id: number, data: Partial<EnquiriesBuilderPack>): Promise<EnquiriesBuilderPack | undefined>;
  deleteBuilderPack(id: number): Promise<void>;

  getFinancialItems(matterId: number): Promise<FinancialItem[]>;
  getFinancialItem(id: number): Promise<FinancialItem | undefined>;
  createFinancialItem(data: InsertFinancialItem): Promise<FinancialItem>;
  updateFinancialItem(id: number, data: Partial<InsertFinancialItem>): Promise<FinancialItem | undefined>;
  deleteFinancialItem(id: number): Promise<void>;

  getMatterFinancials(matterId: number): Promise<MatterFinancials | undefined>;
  upsertMatterFinancials(matterId: number, data: Partial<InsertMatterFinancials>): Promise<MatterFinancials>;

  getControlChecks(matterId: number): Promise<ControlCheck[]>;
  getControlCheck(id: number): Promise<ControlCheck | undefined>;
  completeControlCheck(id: number, userId: number): Promise<ControlCheck | undefined>;
  uncompleteControlCheck(id: number): Promise<ControlCheck | undefined>;
  seedControlChecksForMatter(matterId: number, organisationId: number, matterType: string): Promise<ControlCheck[]>;
  validateStageProgression(matterId: number, currentStage: string): Promise<{
    canProgress: boolean;
    missingChecks: { id: number; ruleKey: string | null; ruleName: string }[];
  }>;
  /** Immigration Onboarding / Induction: block progression until AML check is complete. */
  validateImmigrationInductionAmlGate(matterId: number): Promise<{ canProgress: boolean; missingChecks: { id: number; ruleKey: string | null; ruleName: string }[] }>;
  getComplianceSummary(organisationId: number): Promise<{ matterId: number; matterTitle: string; stage: string; requiredIncomplete: number }[]>;

  getRuleTemplates(matterType?: string): Promise<RuleTemplate[]>;

  getRiskAssessment(matterId: number, organisationId?: number): Promise<RiskAssessment | undefined>;
  upsertRiskAssessment(matterId: number, organisationId: number, data: { formData: any; overallClientRisk?: string; overallMatterRisk?: string; status?: string; updatedBy?: number; completedBy?: number }): Promise<RiskAssessment>;

  migrateEncryption(): Promise<void>;
}

class DatabaseStorage implements IStorage {
  async getOrganisation(id: number): Promise<Organisation | undefined> {
    const [org] = await db.select().from(organisations).where(eq(organisations.id, id));
    return org;
  }

  async createOrganisation(data: InsertOrganisation): Promise<Organisation> {
    const [org] = await db.insert(organisations).values(data).returning();
    return org;
  }

  async getOrganisations(): Promise<Organisation[]> {
    return db.select().from(organisations);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUsers(organisationId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.organisationId, organisationId)).orderBy(users.displayName);
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getMatters(organisationId?: number): Promise<Matter[]> {
    if (organisationId) {
      const rows = await db.select().from(matters).where(eq(matters.organisationId, organisationId)).orderBy(desc(matters.createdAt));
      return rows.map(decryptMatter);
    }
    const rows = await db.select().from(matters).orderBy(desc(matters.createdAt));
    return rows.map(decryptMatter);
  }

  async getMatter(id: number): Promise<Matter | undefined> {
    const [matter] = await db.select().from(matters).where(eq(matters.id, id));
    return matter ? decryptMatter(matter) : undefined;
  }

  async createMatter(data: InsertMatter): Promise<Matter> {
    const encrypted = encryptMatter(data);
    const [matter] = await db.insert(matters).values(encrypted).returning();
    return decryptMatter(matter);
  }

  async updateMatter(id: number, data: Partial<InsertMatter> & { lastViewedAt?: Date }): Promise<Matter | undefined> {
    const encrypted = encryptMatter(data as any);
    const cleaned = Object.fromEntries(
      Object.entries(encrypted).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(cleaned).length === 0) {
      return this.getMatter(id);
    }
    const [matter] = await db.update(matters).set(cleaned as any).where(eq(matters.id, id)).returning();
    return matter ? decryptMatter(matter) : undefined;
  }

  async deleteMatter(id: number): Promise<void> {
    await db.delete(controlChecks).where(eq(controlChecks.matterId, id));
    await db.delete(tasks).where(eq(tasks.matterId, id));
    await db.delete(draftEmails).where(eq(draftEmails.matterId, id));
    await db.delete(reminders).where(eq(reminders.matterId, id));
    await db.delete(matters).where(eq(matters.id, id));
  }

  async getTasksByMatter(matterId: number): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.matterId, matterId)).orderBy(tasks.sortOrder);
  }

  async getTasksByMatterId(matterId: number): Promise<Task[]> {
    return this.getTasksByMatter(matterId);
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return task;
  }

  async completeTask(id: number): Promise<Task | undefined> {
    const [task] = await db.update(tasks)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getDraftEmails(matterId?: number): Promise<DraftEmail[]> {
    let rows: DraftEmail[];
    if (matterId) {
      rows = await db.select().from(draftEmails).where(eq(draftEmails.matterId, matterId)).orderBy(desc(draftEmails.createdAt));
    } else {
      rows = await db.select().from(draftEmails).orderBy(desc(draftEmails.createdAt));
    }
    return rows.map(decryptEmail);
  }

  async getDraftEmail(id: number): Promise<DraftEmail | undefined> {
    const [email] = await db.select().from(draftEmails).where(eq(draftEmails.id, id));
    return email ? decryptEmail(email) : undefined;
  }

  async createDraftEmail(data: InsertDraftEmail): Promise<DraftEmail> {
    const encrypted = encryptEmail(data);
    const [email] = await db.insert(draftEmails).values(encrypted).returning();
    return decryptEmail(email);
  }

  async updateDraftEmail(id: number, data: Partial<InsertDraftEmail>): Promise<DraftEmail | undefined> {
    const encrypted = encryptEmail(data);
    const [email] = await db.update(draftEmails).set(encrypted).where(eq(draftEmails.id, id)).returning();
    return email ? decryptEmail(email) : undefined;
  }

  async deleteDraftEmail(id: number): Promise<void> {
    await db.delete(draftEmails).where(eq(draftEmails.id, id));
  }

  async getReminders(matterId?: number): Promise<Reminder[]> {
    if (matterId) {
      return db.select().from(reminders).where(eq(reminders.matterId, matterId)).orderBy(reminders.dueDate);
    }
    return db.select().from(reminders).orderBy(reminders.dueDate);
  }

  async getReminder(id: number): Promise<Reminder | undefined> {
    const [reminder] = await db.select().from(reminders).where(eq(reminders.id, id));
    return reminder;
  }

  async createReminder(data: InsertReminder): Promise<Reminder> {
    const [reminder] = await db.insert(reminders).values(data).returning();
    return reminder;
  }

  async updateReminder(id: number, data: Partial<InsertReminder>): Promise<Reminder | undefined> {
    const [reminder] = await db.update(reminders).set(data).where(eq(reminders.id, id)).returning();
    return reminder;
  }

  async completeReminder(id: number): Promise<Reminder | undefined> {
    const [reminder] = await db.update(reminders)
      .set({ completed: true })
      .where(eq(reminders.id, id))
      .returning();
    return reminder;
  }

  async deleteReminder(id: number): Promise<void> {
    await db.delete(reminders).where(eq(reminders.id, id));
  }

  async createDefaultTasks(matterId: number, matterType: MatterType): Promise<Task[]> {
    const stages = WORKFLOW_STAGES as readonly string[];
    const createdTasks: Task[] = [];
    for (let i = 0; i < stages.length; i++) {
      const [task] = await db.insert(tasks).values({
        matterId,
        title: stages[i],
        stage: stages[i],
        status: "pending",
        sortOrder: i,
      }).returning();
      createdTasks.push(task);
    }
    return createdTasks;
  }

  async createImmigrationTasks(matterId: number, matterType: string): Promise<Task[]> {
    const stages = getImmigrationWorkflowStages(matterType);
    const createdTasks: Task[] = [];
    for (let i = 0; i < stages.length; i++) {
      const [task] = await db.insert(tasks).values({
        matterId,
        title: stages[i],
        stage: stages[i],
        status: "pending",
        sortOrder: i,
      }).returning();
      createdTasks.push(task);
    }
    return createdTasks;
  }

  async getJournalEntries(userId: number): Promise<JournalEntry[]> {
    return db.select().from(journalEntries).where(eq(journalEntries.userId, userId)).orderBy(desc(journalEntries.entryDate));
  }

  async getJournalEntry(id: number, userId: number): Promise<JournalEntry | undefined> {
    const [entry] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
    return entry;
  }

  async getJournalEntriesInRange(userId: number, from: Date, to: Date): Promise<JournalEntry[]> {
    return db.select().from(journalEntries).where(
      and(eq(journalEntries.userId, userId), gte(journalEntries.entryDate, from), lte(journalEntries.entryDate, to))
    ).orderBy(desc(journalEntries.entryDate));
  }

  async createJournalEntry(data: InsertJournalEntry): Promise<JournalEntry> {
    const [entry] = await db.insert(journalEntries).values(data).returning();
    return entry;
  }

  async updateJournalEntry(id: number, userId: number, data: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined> {
    const [entry] = await db.update(journalEntries).set(data).where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId))).returning();
    return entry;
  }

  async deleteJournalEntry(id: number, userId: number): Promise<void> {
    const [owned] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
    if (!owned) return;
    await db.delete(timeEntries).where(eq(timeEntries.journalEntryId, id));
    await db.delete(journalEntries).where(eq(journalEntries.id, id));
  }

  async getTimeEntries(journalEntryId: number): Promise<TimeEntry[]> {
    return db.select().from(timeEntries).where(eq(timeEntries.journalEntryId, journalEntryId)).orderBy(desc(timeEntries.date));
  }

  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    const [entry] = await db.insert(timeEntries).values(data).returning();
    return entry;
  }

  async deleteTimeEntry(id: number): Promise<void> {
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
  }

  async getDocumentsByMatter(matterId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.matterId, matterId)).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(data).returning();
    return doc;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getEnquiryPacksByMatter(matterId: number): Promise<EnquiryPack[]> {
    return db.select().from(enquiryPacks).where(eq(enquiryPacks.matterId, matterId)).orderBy(desc(enquiryPacks.createdAt));
  }

  async getEnquiryPack(id: number): Promise<EnquiryPack | undefined> {
    const [pack] = await db.select().from(enquiryPacks).where(eq(enquiryPacks.id, id));
    return pack;
  }

  async createEnquiryPack(data: InsertEnquiryPack): Promise<EnquiryPack> {
    const [pack] = await db.insert(enquiryPacks).values(data).returning();
    return pack;
  }

  async updateEnquiryPack(id: number, data: Partial<EnquiryPack>): Promise<EnquiryPack | undefined> {
    const [pack] = await db.update(enquiryPacks).set({ ...data, updatedAt: new Date() }).where(eq(enquiryPacks.id, id)).returning();
    return pack;
  }

  async getAuditLogs(matterId?: number): Promise<AuditLog[]> {
    if (matterId) {
      return db.select().from(auditLogs).where(eq(auditLogs.matterId, matterId)).orderBy(desc(auditLogs.createdAt));
    }
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  async getKnowledgeResources(): Promise<KnowledgeResource[]> {
    return db.select().from(knowledgeResources).orderBy(desc(knowledgeResources.createdAt));
  }

  async getKnowledgeResource(id: number): Promise<KnowledgeResource | undefined> {
    const [resource] = await db.select().from(knowledgeResources).where(eq(knowledgeResources.id, id));
    return resource;
  }

  async createKnowledgeResource(data: InsertKnowledgeResource): Promise<KnowledgeResource> {
    const [resource] = await db.insert(knowledgeResources).values(data).returning();
    return resource;
  }

  async deleteKnowledgeResource(id: number): Promise<void> {
    await db.delete(knowledgeResources).where(eq(knowledgeResources.id, id));
  }

  async getEnquiriesLibrary(): Promise<EnquiriesLibraryItem[]> {
    return db.select().from(enquiriesLibrary).orderBy(enquiriesLibrary.category, enquiriesLibrary.title);
  }

  async getEnquiriesLibraryItem(id: number): Promise<EnquiriesLibraryItem | undefined> {
    const [item] = await db.select().from(enquiriesLibrary).where(eq(enquiriesLibrary.id, id));
    return item;
  }

  async createEnquiriesLibraryItem(data: InsertEnquiriesLibraryItem): Promise<EnquiriesLibraryItem> {
    const [item] = await db.insert(enquiriesLibrary).values(data).returning();
    return item;
  }

  async getEnquiriesLibraryCount(): Promise<number> {
    const rows = await db.select().from(enquiriesLibrary);
    return rows.length;
  }

  async getBuilderPacksByMatter(matterId: number): Promise<EnquiriesBuilderPack[]> {
    return db.select().from(enquiriesBuilderPacks).where(eq(enquiriesBuilderPacks.matterId, matterId)).orderBy(desc(enquiriesBuilderPacks.createdAt));
  }

  async getBuilderPack(id: number): Promise<EnquiriesBuilderPack | undefined> {
    const [pack] = await db.select().from(enquiriesBuilderPacks).where(eq(enquiriesBuilderPacks.id, id));
    return pack;
  }

  async createBuilderPack(data: InsertEnquiriesBuilderPack): Promise<EnquiriesBuilderPack> {
    const [pack] = await db.insert(enquiriesBuilderPacks).values(data).returning();
    return pack;
  }

  async updateBuilderPack(id: number, data: Partial<EnquiriesBuilderPack>): Promise<EnquiriesBuilderPack | undefined> {
    const [pack] = await db.update(enquiriesBuilderPacks).set({ ...data, updatedAt: new Date() }).where(eq(enquiriesBuilderPacks.id, id)).returning();
    return pack;
  }

  async deleteBuilderPack(id: number): Promise<void> {
    await db.delete(enquiriesBuilderPacks).where(eq(enquiriesBuilderPacks.id, id));
  }

  async migrateEncryption(): Promise<void> {
    const allMatters = await db.select().from(matters);
    for (const matter of allMatters) {
      const updates: Record<string, string> = {};
      for (const field of SENSITIVE_MATTER_FIELDS) {
        const val = matter[field];
        if (val && !isEncrypted(val)) {
          updates[field] = encrypt(val);
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.update(matters).set(updates).where(eq(matters.id, matter.id));
      }
    }

    const allEmails = await db.select().from(draftEmails);
    for (const email of allEmails) {
      if (email.recipient && !isEncrypted(email.recipient)) {
        await db.update(draftEmails)
          .set({ recipient: encrypt(email.recipient) })
          .where(eq(draftEmails.id, email.id));
      }
    }
    console.log("Encryption migration complete");
  }

  async getFinancialItems(matterId: number): Promise<FinancialItem[]> {
    return db.select().from(financialItems).where(eq(financialItems.matterId, matterId)).orderBy(financialItems.sortOrder);
  }

  async getFinancialItem(id: number): Promise<FinancialItem | undefined> {
    const [item] = await db.select().from(financialItems).where(eq(financialItems.id, id));
    return item;
  }

  async createFinancialItem(data: InsertFinancialItem): Promise<FinancialItem> {
    const [item] = await db.insert(financialItems).values(data).returning();
    return item;
  }

  async updateFinancialItem(id: number, data: Partial<InsertFinancialItem>): Promise<FinancialItem | undefined> {
    const [item] = await db.update(financialItems).set(data).where(eq(financialItems.id, id)).returning();
    return item;
  }

  async deleteFinancialItem(id: number): Promise<void> {
    await db.delete(financialItems).where(eq(financialItems.id, id));
  }

  async getMatterFinancials(matterId: number): Promise<MatterFinancials | undefined> {
    const [row] = await db.select().from(matterFinancials).where(eq(matterFinancials.matterId, matterId));
    return row;
  }

  async upsertMatterFinancials(matterId: number, data: Partial<InsertMatterFinancials>): Promise<MatterFinancials> {
    const existing = await this.getMatterFinancials(matterId);
    if (existing) {
      const [updated] = await db.update(matterFinancials).set({ ...data, updatedAt: new Date() }).where(eq(matterFinancials.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(matterFinancials).values({ matterId, ...data }).returning();
    return created;
  }

  async getControlChecks(matterId: number): Promise<ControlCheck[]> {
    return db.select().from(controlChecks).where(eq(controlChecks.matterId, matterId)).orderBy(controlChecks.stage, controlChecks.id);
  }

  async getControlCheck(id: number): Promise<ControlCheck | undefined> {
    const [check] = await db.select().from(controlChecks).where(eq(controlChecks.id, id));
    return check;
  }

  async completeControlCheck(id: number, userId: number): Promise<ControlCheck | undefined> {
    const [check] = await db.update(controlChecks)
      .set({ completed: true, completedBy: userId, completedAt: new Date() })
      .where(eq(controlChecks.id, id))
      .returning();
    return check;
  }

  async uncompleteControlCheck(id: number): Promise<ControlCheck | undefined> {
    const [check] = await db.update(controlChecks)
      .set({ completed: false, completedBy: null, completedAt: null })
      .where(eq(controlChecks.id, id))
      .returning();
    return check;
  }

  async seedControlChecksForMatter(matterId: number, organisationId: number, matterType: string): Promise<ControlCheck[]> {
    const moduleType = isImmigrationMatterType(matterType) ? "immigration" : "conveyancing";
    const templates = await db.select().from(ruleTemplates)
      .where(and(eq(ruleTemplates.moduleType, moduleType), eq(ruleTemplates.matterType, matterType)));

    const created: ControlCheck[] = [];
    for (const template of templates) {
      const [check] = await db.insert(controlChecks).values({
        organisationId,
        matterId,
        stage: template.stage,
        ruleKey: template.ruleKey,
        ruleName: template.ruleName,
        required: template.required,
        completed: false,
      }).returning();
      created.push(check);
    }
    return created;
  }

  async validateStageProgression(matterId: number, currentStage: string): Promise<{
    canProgress: boolean;
    missingChecks: { id: number; ruleKey: string | null; ruleName: string }[];
  }> {
    const checks = await db.select().from(controlChecks)
      .where(and(
        eq(controlChecks.matterId, matterId),
        eq(controlChecks.stage, currentStage),
        eq(controlChecks.required, true),
        eq(controlChecks.completed, false),
      ));

    return {
      canProgress: checks.length === 0,
      missingChecks: checks.map(c => ({ id: c.id, ruleKey: c.ruleKey, ruleName: c.ruleName })),
    };
  }

  /** Gate leaving Onboarding / Induction until Client ID / AML check is complete. */
  async validateImmigrationInductionAmlGate(matterId: number): Promise<{
    canProgress: boolean;
    missingChecks: { id: number; ruleKey: string | null; ruleName: string }[];
  }> {
    const checks = await db.select().from(controlChecks)
      .where(and(
        eq(controlChecks.matterId, matterId),
        eq(controlChecks.stage, "Onboarding / Induction"),
        eq(controlChecks.completed, false),
      ));

    const amlMissing = checks.filter((c) =>
      (c.ruleKey && c.ruleKey.startsWith("IMM_OB_02")) ||
      /AML/i.test(c.ruleName || ""),
    );

    return {
      canProgress: amlMissing.length === 0,
      missingChecks: amlMissing.map(c => ({ id: c.id, ruleKey: c.ruleKey, ruleName: c.ruleName })),
    };
  }

  async getComplianceSummary(organisationId: number): Promise<{ matterId: number; matterTitle: string; stage: string; requiredIncomplete: number }[]> {
    const allMatters = await db.select().from(matters).where(
      and(eq(matters.organisationId, organisationId), eq(matters.status, "active"))
    );

    const blocked: { matterId: number; matterTitle: string; stage: string; requiredIncomplete: number }[] = [];

    for (const matter of allMatters) {
      const decrypted = decryptMatter(matter);
      const incompleteChecks = await db.select().from(controlChecks)
        .where(and(
          eq(controlChecks.matterId, matter.id),
          eq(controlChecks.stage, matter.currentStage),
          eq(controlChecks.required, true),
          eq(controlChecks.completed, false),
        ));

      if (incompleteChecks.length > 0) {
        blocked.push({
          matterId: matter.id,
          matterTitle: decrypted.title,
          stage: matter.currentStage,
          requiredIncomplete: incompleteChecks.length,
        });
      }
    }

    return blocked;
  }

  async getComplianceDashboard(organisationId: number): Promise<{
    totals: { active: number; blocked: number; inAbeyance: number; completedThisMonth: number };
    blockedByStage: { stage: string; count: number }[];
    overduePostCompletion: { matterId: number; clientName: string; address: string; daysOverdue: number; missing: { ruleKey: string | null; ruleName: string }[] }[];
    redMatters: { matterId: number; clientName: string; stage: string; missingRequired: { ruleKey: string | null; ruleName: string }[] }[];
  }> {
    const allMatters = await db.select().from(matters).where(eq(matters.organisationId, organisationId));

    const active = allMatters.filter(m => m.status === "active");
    const inAbeyance = allMatters.filter(m => m.status === "in_abeyance");
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedThisMonth = allMatters.filter(m => m.status === "completed" && m.completionDate && new Date(m.completionDate) >= monthStart).length;

    const blockedStageMap: Record<string, number> = {};
    const redMatters: { matterId: number; clientName: string; stage: string; missingRequired: { ruleKey: string | null; ruleName: string }[] }[] = [];
    const overduePostCompletion: { matterId: number; clientName: string; address: string; daysOverdue: number; missing: { ruleKey: string | null; ruleName: string }[] }[] = [];

    let blockedCount = 0;
    for (const matter of active) {
      const decrypted = decryptMatter(matter);
      const incompleteRequired = await db.select().from(controlChecks).where(and(
        eq(controlChecks.matterId, matter.id),
        eq(controlChecks.stage, matter.currentStage),
        eq(controlChecks.required, true),
        eq(controlChecks.completed, false),
      ));

      if (incompleteRequired.length > 0) {
        blockedCount++;
        blockedStageMap[matter.currentStage] = (blockedStageMap[matter.currentStage] || 0) + 1;
        redMatters.push({
          matterId: matter.id,
          clientName: decrypted.clientName,
          stage: matter.currentStage,
          missingRequired: incompleteRequired.map(c => ({ ruleKey: c.ruleKey, ruleName: c.ruleName })),
        });
      }

      if (matter.currentStage === "Post Completion") {
        const ap1Check = await db.select().from(controlChecks).where(and(
          eq(controlChecks.matterId, matter.id),
          eq(controlChecks.ruleName, "AP1 submitted to Land Registry"),
          eq(controlChecks.required, true),
          eq(controlChecks.completed, false),
        ));
        if (ap1Check.length > 0) {
          const completionDate = matter.completionDate || matter.createdAt;
          const daysSince = Math.floor((now.getTime() - new Date(completionDate).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince > 10) {
            const allMissing = await db.select().from(controlChecks).where(and(
              eq(controlChecks.matterId, matter.id),
              eq(controlChecks.stage, "Post Completion"),
              eq(controlChecks.required, true),
              eq(controlChecks.completed, false),
            ));
            overduePostCompletion.push({
              matterId: matter.id,
              clientName: decrypted.clientName,
              address: decrypted.propertyAddress,
              daysOverdue: daysSince,
              missing: allMissing.map(c => ({ ruleKey: c.ruleKey, ruleName: c.ruleName })),
            });
          }
        }
      }
    }

    const blockedByStage = Object.entries(blockedStageMap).map(([stage, count]) => ({ stage, count }));

    return {
      totals: {
        active: active.length,
        blocked: blockedCount,
        inAbeyance: inAbeyance.length,
        completedThisMonth,
      },
      blockedByStage,
      overduePostCompletion,
      redMatters,
    };
  }

  async getRuleTemplates(matterType?: string): Promise<RuleTemplate[]> {
    if (matterType) {
      return db.select().from(ruleTemplates).where(eq(ruleTemplates.matterType, matterType));
    }
    return db.select().from(ruleTemplates);
  }

  async getRiskAssessment(matterId: number, organisationId?: number): Promise<RiskAssessment | undefined> {
    const conditions = [eq(riskAssessments.matterId, matterId)];
    if (organisationId) conditions.push(eq(riskAssessments.organisationId, organisationId));
    const [ra] = await db.select().from(riskAssessments).where(and(...conditions));
    return ra;
  }

  async upsertRiskAssessment(matterId: number, organisationId: number, data: { formData: any; overallClientRisk?: string; overallMatterRisk?: string; status?: string; updatedBy?: number; completedBy?: number }): Promise<RiskAssessment> {
    const existing = await this.getRiskAssessment(matterId, organisationId);
    if (existing) {
      const updateData: any = {
        formData: data.formData,
        updatedAt: sql`CURRENT_TIMESTAMP`,
        updatedBy: data.updatedBy || null,
      };
      if (data.overallClientRisk !== undefined) updateData.overallClientRisk = data.overallClientRisk;
      if (data.overallMatterRisk !== undefined) updateData.overallMatterRisk = data.overallMatterRisk;
      if (data.status) updateData.status = data.status;
      if (data.status === "completed") {
        updateData.completedBy = data.completedBy || data.updatedBy;
        updateData.completedAt = sql`CURRENT_TIMESTAMP`;
      }
      const [updated] = await db.update(riskAssessments).set(updateData).where(eq(riskAssessments.id, existing.id)).returning();
      return updated;
    }
    const insertData: any = {
      matterId,
      organisationId,
      formData: data.formData,
      status: data.status || "draft",
      updatedBy: data.updatedBy || null,
    };
    if (data.overallClientRisk) insertData.overallClientRisk = data.overallClientRisk;
    if (data.overallMatterRisk) insertData.overallMatterRisk = data.overallMatterRisk;
    if (data.status === "completed") {
      insertData.completedBy = data.completedBy || data.updatedBy;
      insertData.completedAt = sql`CURRENT_TIMESTAMP`;
    }
    const [created] = await db.insert(riskAssessments).values(insertData).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
