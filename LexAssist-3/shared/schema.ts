import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const WORKFLOW_STAGES = [
  "Onboarding",
  "Client Info",
  "Client Questionnaire",
  "SDLT Questionnaire",
  "Searches",
  "Enquiries",
  "Report on Title",
  "Exchange",
  "Completion",
  "Post Completion",
  "Redemption/COT Submission",
  "Closed",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const DOCUMENT_TYPES = [
  "id_passport",
  "id_driving_licence",
  "id_other",
  "proof_of_address",
  "mortgage_offer",
  "search_result",
  "contract",
  "transfer",
  "completion_statement",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const ROLE_PERMISSIONS = {
  admin: {
    canManageUsers: true,
    canViewAllMatters: true,
    canDeleteMatters: true,
    canManageSettings: true,
    canExportData: true,
    canViewReports: true,
    canManageCompliance: true,
    canViewFinancials: true,
    canEditFinancials: true,
  },
  fee_earner: {
    canManageUsers: false,
    canViewAllMatters: true,
    canDeleteMatters: false,
    canManageSettings: false,
    canExportData: true,
    canViewReports: true,
    canManageCompliance: false,
    canViewFinancials: true,
    canEditFinancials: true,
  },
  assistant: {
    canManageUsers: false,
    canViewAllMatters: true,
    canDeleteMatters: false,
    canManageSettings: false,
    canExportData: false,
    canViewReports: false,
    canManageCompliance: false,
    canViewFinancials: false,
    canEditFinancials: false,
  },
  read_only: {
    canManageUsers: false,
    canViewAllMatters: true,
    canDeleteMatters: false,
    canManageSettings: false,
    canExportData: false,
    canViewReports: false,
    canManageCompliance: false,
    canViewFinancials: false,
    canEditFinancials: false,
  },
} as const;

export type UserRole = keyof typeof ROLE_PERMISSIONS;

export type MatterType = "purchase" | "sale" | "remortgage";

export type EnquiryPackItem = {
  id: string;
  category: string;
  question: string;
  answer?: string;
  status: "pending" | "answered" | "flagged";
};

// Tables

export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subscriptionPlan: text("subscription_plan").notNull().default("basic"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("assistant"),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matters = pgTable("matters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  propertyAddress: text("property_address").notNull(),
  price: text("price"),
  status: text("status").notNull().default("active"),
  currentStage: text("current_stage").notNull(),
  notes: text("notes"),
  organisationId: integer("organisation_id").references(() => organisations.id),
  lastViewedAt: timestamp("last_viewed_at"),
  isCompanyRemortgage: boolean("is_company_remortgage").default(false),
  completionDate: timestamp("completion_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull().references(() => matters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  stage: text("stage").notNull(),
  status: text("status").notNull().default("pending"),
  dueDate: timestamp("due_date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: timestamp("completed_at"),
});

export const draftEmails = pgTable("draft_emails", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").references(() => matters.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  recipient: text("recipient"),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").references(() => matters.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: timestamp("due_date").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  category: text("category").notNull().default("general"),
  activity: text("activity"),
  learning: text("learning"),
  reflection: text("reflection"),
  entryDate: timestamp("entry_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id").notNull().references(() => journalEntries.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  minutes: integer("minutes").notNull(),
  date: timestamp("date").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull().references(() => matters.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  documentType: text("document_type").notNull().default("other"),
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const enquiryPacks = pgTable("enquiry_packs", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull().references(() => matters.id, { onDelete: "cascade" }),
  packType: text("pack_type").notNull(),
  status: text("status").notNull().default("review_required"),
  createdBy: text("created_by").notNull().default("system"),
  sourceDocumentIds: jsonb("source_document_ids").default([]),
  contentJson: jsonb("content_json").default({}),
  contentMarkdown: text("content_markdown").notNull().default(""),
  riskFlags: jsonb("risk_flags").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  sentAt: timestamp("sent_at"),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").references(() => matters.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  action: text("action").notNull(),
  details: text("details"),
  performedBy: text("performed_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const knowledgeResources = pgTable("knowledge_resources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  filePath: text("file_path").notNull(),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const enquiriesLibrary = pgTable("enquiries_library", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  title: text("title").notNull(),
  enquiryText: text("enquiry_text").notNull(),
  appliesTo: text("applies_to").notNull().default("both"),
  tags: text("tags").array().default([]),
  whenToUse: text("when_to_use"),
  graceParagraph: text("grace_paragraph"),
  isDefault: boolean("is_default").notNull().default(true),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const enquiriesBuilderPacks = pgTable("enquiries_builder_packs", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull().references(() => matters.id, { onDelete: "cascade" }),
  packType: text("pack_type").notNull().default("custom"),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by").notNull(),
  selectedItemsJson: jsonb("selected_items_json").default([]),
  exportCount: integer("export_count").notNull().default(0),
  lastExportedAt: timestamp("last_exported_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const financialItems = pgTable("financial_items", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull().references(() => matters.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  category: text("category").notNull(),
  amount: text("amount").notNull().default("0"),
  vatRate: text("vat_rate").default("0"),
  vatAmount: text("vat_amount").default("0"),
  totalAmount: text("total_amount").default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matterFinancials = pgTable("matter_financials", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull().references(() => matters.id, { onDelete: "cascade" }),
  moniesOnAccount: text("monies_on_account").default("0"),
  mortgageAdvance: text("mortgage_advance").default("0"),
  redemptionAmount: text("redemption_amount").default("0"),
  salePrice: text("sale_price").default("0"),
  purchasePrice: text("purchase_price").default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const controlChecks = pgTable("control_checks", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  matterId: integer("matter_id").notNull().references(() => matters.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  ruleName: text("rule_name").notNull(),
  ruleKey: text("rule_key"),
  required: boolean("required").notNull().default(true),
  completed: boolean("completed").notNull().default(false),
  completedBy: integer("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
});

export const ruleTemplates = pgTable("rule_templates", {
  id: serial("id").primaryKey(),
  moduleType: text("module_type").notNull().default("conveyancing"),
  matterType: text("matter_type").notNull().default("purchase"),
  stage: text("stage").notNull(),
  ruleName: text("rule_name").notNull(),
  ruleKey: text("rule_key"),
  required: boolean("required").notNull().default(true),
});

export const riskAssessments = pgTable("risk_assessments", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull().references(() => matters.id, { onDelete: "cascade" }),
  organisationId: integer("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("draft"),
  formData: jsonb("form_data").notNull().default({}),
  overallClientRisk: text("overall_client_risk"),
  overallMatterRisk: text("overall_matter_risk"),
  completedBy: integer("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertMatterSchema = createInsertSchema(matters).omit({ id: true, createdAt: true });
export const insertDraftEmailSchema = createInsertSchema(draftEmails).omit({ id: true, createdAt: true });
export const insertReminderSchema = createInsertSchema(reminders).omit({ id: true, createdAt: true });
export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true });
export const insertOrganisationSchema = createInsertSchema(organisations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertEnquiryPackSchema = createInsertSchema(enquiryPacks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertKnowledgeResourceSchema = createInsertSchema(knowledgeResources).omit({ id: true, createdAt: true });
export const insertEnquiriesLibraryItemSchema = createInsertSchema(enquiriesLibrary).omit({ id: true, createdAt: true });
export const insertEnquiriesBuilderPackSchema = createInsertSchema(enquiriesBuilderPacks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFinancialItemSchema = createInsertSchema(financialItems).omit({ id: true, createdAt: true });
export const insertMatterFinancialsSchema = createInsertSchema(matterFinancials).omit({ id: true });
export const insertControlCheckSchema = createInsertSchema(controlChecks).omit({ id: true });
export const insertRuleTemplateSchema = createInsertSchema(ruleTemplates).omit({ id: true });
export const insertRiskAssessmentSchema = createInsertSchema(riskAssessments).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type Organisation = typeof organisations.$inferSelect;
export type InsertOrganisation = z.infer<typeof insertOrganisationSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Matter = typeof matters.$inferSelect;
export type InsertMatter = z.infer<typeof insertMatterSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export type DraftEmail = typeof draftEmails.$inferSelect;
export type InsertDraftEmail = z.infer<typeof insertDraftEmailSchema>;

export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = z.infer<typeof insertReminderSchema>;

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type EnquiryPack = typeof enquiryPacks.$inferSelect;
export type InsertEnquiryPack = z.infer<typeof insertEnquiryPackSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type KnowledgeResource = typeof knowledgeResources.$inferSelect;
export type InsertKnowledgeResource = z.infer<typeof insertKnowledgeResourceSchema>;

export type EnquiriesLibraryItem = typeof enquiriesLibrary.$inferSelect;
export type InsertEnquiriesLibraryItem = z.infer<typeof insertEnquiriesLibraryItemSchema>;

export type EnquiriesBuilderPack = typeof enquiriesBuilderPacks.$inferSelect;
export type InsertEnquiriesBuilderPack = z.infer<typeof insertEnquiriesBuilderPackSchema>;

export type FinancialItem = typeof financialItems.$inferSelect;
export type InsertFinancialItem = z.infer<typeof insertFinancialItemSchema>;

export type MatterFinancials = typeof matterFinancials.$inferSelect;
export type InsertMatterFinancials = z.infer<typeof insertMatterFinancialsSchema>;

export type ControlCheck = typeof controlChecks.$inferSelect;
export type InsertControlCheck = z.infer<typeof insertControlCheckSchema>;

export type RuleTemplate = typeof ruleTemplates.$inferSelect;

export type RiskAssessment = typeof riskAssessments.$inferSelect;
