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

export const REMORTGAGE_STAGES = [
  "Onboarding",
  "Client Info",
  "Client Questionnaire",
  "Searches",
  "Report on Title",
  "Exchange",
  "Completion",
  "Post Completion",
  "Redemption/COT Submission",
  "Closed",
] as const;

export function getRemortgageStages(isCompanyRemortgage: boolean): readonly string[] {
  return REMORTGAGE_STAGES;
}

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

const FIRM_PERMISSIONS_FALSE = {
  canManageUsers: false,
  canViewAllMatters: false,
  canCreateMatters: false,
  canEditMatters: false,
  canDeleteMatters: false,
  canProgressStages: false,
  canUploadDocuments: false,
  canCompleteChecks: false,
  canOverrideGating: false,
  canManageSettings: false,
  canExportData: false,
  canViewReports: false,
  canManageCompliance: false,
  canViewFinancials: false,
  canEditFinancials: false,
  canAccessPlatform: false,
} as const;

export const ROLE_PERMISSIONS = {
  admin: {
    canManageUsers: true,
    canViewAllMatters: true,
    canCreateMatters: true,
    canEditMatters: true,
    canDeleteMatters: true,
    canProgressStages: true,
    canUploadDocuments: true,
    canCompleteChecks: true,
    canOverrideGating: true,
    canManageSettings: true,
    canExportData: true,
    canViewReports: true,
    canManageCompliance: true,
    canViewFinancials: true,
    canEditFinancials: true,
    canAccessPlatform: false,
  },
  fee_earner: {
    canManageUsers: false,
    canViewAllMatters: true,
    canCreateMatters: true,
    canEditMatters: true,
    canDeleteMatters: false,
    canProgressStages: true,
    canUploadDocuments: true,
    canCompleteChecks: true,
    canOverrideGating: true,
    canManageSettings: false,
    canExportData: true,
    canViewReports: true,
    canManageCompliance: false,
    canViewFinancials: true,
    canEditFinancials: true,
    canAccessPlatform: false,
  },
  assistant: {
    canManageUsers: false,
    canViewAllMatters: true,
    canCreateMatters: true,
    canEditMatters: true,
    canDeleteMatters: false,
    canProgressStages: true,
    canUploadDocuments: true,
    canCompleteChecks: true,
    canOverrideGating: false,
    canManageSettings: false,
    canExportData: false,
    canViewReports: false,
    canManageCompliance: false,
    canViewFinancials: false,
    canEditFinancials: false,
    canAccessPlatform: false,
  },
  read_only: {
    canManageUsers: false,
    canViewAllMatters: true,
    canCreateMatters: false,
    canEditMatters: false,
    canDeleteMatters: false,
    canProgressStages: false,
    canUploadDocuments: false,
    canCompleteChecks: false,
    canOverrideGating: false,
    canManageSettings: false,
    canExportData: false,
    canViewReports: false,
    canManageCompliance: false,
    canViewFinancials: false,
    canEditFinancials: false,
    canAccessPlatform: false,
  },
  platform_admin: {
    ...FIRM_PERMISSIONS_FALSE,
    canAccessPlatform: true,
  },
} as const;

export type UserRole = keyof typeof ROLE_PERMISSIONS;

/** Firm-assignable roles shown in Users UI (excludes platform_admin). */
export const USER_ROLES: UserRole[] = ["admin", "fee_earner", "assistant", "read_only"];
export const FIRM_USER_ROLES = USER_ROLES;

export const DEPARTMENTS = ["conveyancing", "immigration", "both"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export type MatterType = "purchase" | "sale" | "remortgage" | "visa_application" | "asylum" | "appeal" | "settlement" | "naturalisation";

export const IMMIGRATION_MATTER_TYPES = ["visa_application", "asylum", "appeal", "settlement", "naturalisation"] as const;
export const CONVEYANCING_MATTER_TYPES = ["purchase", "sale", "remortgage"] as const;

/** Demo-active immigration types (all five today). Future types can stay in IMMIGRATION_MATTER_TYPES but off this list. */
export const ACTIVE_IMMIGRATION_MATTER_TYPES = [
  "visa_application",
  "asylum",
  "appeal",
  "settlement",
  "naturalisation",
] as const;

export const PRACTICE_AREAS = ["conveyancing", "immigration"] as const;
export type PracticeArea = (typeof PRACTICE_AREAS)[number];

/** Shared immigration stage spine for all immigration matter types (v1). */
export const IMMIGRATION_WORKFLOW_STAGES = [
  "Onboarding / Induction",
  "Eligibility and Assessment",
  "Advice on Viable Routes",
  "Form Filling / Application",
  "Fee Payment / IHS",
  "Biometric Booking",
  "Application Outcome",
  "Appeal / JR / AR (if applicable)",
] as const;

/** Per-type map kept for future divergence; all types use the shared spine today. */
export const IMMIGRATION_WORKFLOWS = {
  visa_application: IMMIGRATION_WORKFLOW_STAGES,
  asylum: IMMIGRATION_WORKFLOW_STAGES,
  appeal: IMMIGRATION_WORKFLOW_STAGES,
  settlement: IMMIGRATION_WORKFLOW_STAGES,
  naturalisation: IMMIGRATION_WORKFLOW_STAGES,
} as const;

export function isImmigrationMatterType(matterType: string): boolean {
  return (IMMIGRATION_MATTER_TYPES as readonly string[]).includes(matterType);
}

export function isActiveImmigrationType(matterType: string): boolean {
  return (ACTIVE_IMMIGRATION_MATTER_TYPES as readonly string[]).includes(matterType);
}

export function isConveyancingMatterType(matterType: string): boolean {
  return (CONVEYANCING_MATTER_TYPES as readonly string[]).includes(matterType);
}

export function getPracticeArea(matterType: string): PracticeArea | null {
  if (isImmigrationMatterType(matterType)) return "immigration";
  if (isConveyancingMatterType(matterType)) return "conveyancing";
  return null;
}

export function getImmigrationWorkflowStages(matterType: string): readonly string[] {
  return (IMMIGRATION_WORKFLOWS as Record<string, readonly string[]>)[matterType] || IMMIGRATION_WORKFLOW_STAGES;
}

export type EnquiryPackItem = {
  id: string;
  category: string;
  question: string;
  answer?: string;
  status: "pending" | "answered" | "flagged";
};

export const ENQUIRY_CATEGORIES = [
  "Title",
  "Boundaries",
  "Access",
  "Planning",
  "Building Regulations",
  "Services",
  "Disputes",
  "Notices",
  "Environmental",
  "General",
] as const;

export type EnquiryCategory = (typeof ENQUIRY_CATEGORIES)[number];

export type Matter = {
  id: number;
  title: string;
  type: MatterType;
  clientName: string;
  clientEmail?: string | null;
  propertyAddress: string;
  price?: string | null;
  status: string;
  currentStage: string;
  notes?: string | null;
  organisationId?: number | null;
  lastViewedAt?: string | Date | null;
  isCompanyRemortgage?: boolean | null;
  completionDate?: string | Date | null;
  createdAt: string | Date;
};

export type Task = {
  id: number;
  matterId: number;
  title: string;
  stage: string;
  status: string;
  dueDate?: string | Date | null;
  notes?: string | null;
  sortOrder: number;
  completedAt?: string | Date | null;
};

export type DraftEmail = {
  id: number;
  matterId?: number | null;
  subject: string;
  recipient?: string | null;
  body: string;
  status: string;
  createdAt: string | Date;
};

export type Reminder = {
  id: number;
  matterId?: number | null;
  taskId?: number | null;
  title: string;
  dueDate: string | Date;
  completed: boolean;
  createdAt: string | Date;
};

export type JournalEntry = {
  id: number;
  organisationId?: number;
  userId?: number | null;
  title: string;
  content?: string | null;
  category: string;
  activity?: string | null;
  learning?: string | null;
  reflection?: string | null;
  entryDate: string | Date;
  createdAt: string | Date;
};

export type TimeEntry = {
  id: number;
  organisationId?: number;
  journalEntryId: number;
  description: string;
  minutes: number;
  date: string | Date;
};

export type Document = {
  id: number;
  matterId: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  documentType: string;
  filePath: string;
  createdAt: string | Date;
};

export type EnquiryPack = {
  id: number;
  matterId: number;
  packType: string;
  status: string;
  createdBy: string;
  sourceDocumentIds?: any;
  contentJson?: any;
  contentMarkdown: string;
  riskFlags?: any;
  createdAt: string | Date;
  updatedAt: string | Date;
  approvedAt?: string | Date | null;
  approvedBy?: string | null;
  sentAt?: string | Date | null;
};

export type EnquiriesLibraryItem = {
  id: number;
  category: string;
  subcategory?: string | null;
  title: string;
  enquiryText: string;
  appliesTo: string;
  tags?: string[] | null;
  whenToUse?: string | null;
  graceParagraph?: string | null;
  isDefault: boolean;
  version: number;
  createdAt: string | Date;
};

export type EnquiriesBuilderPack = {
  id: number;
  matterId: number;
  packType: string;
  status: string;
  createdBy: string;
  selectedItemsJson?: any;
  exportCount: number;
  lastExportedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type FinancialItem = {
  id: number;
  matterId: number;
  description: string;
  category: string;
  amount: string;
  vatRate?: string | null;
  vatAmount?: string | null;
  totalAmount?: string | null;
  sortOrder: number;
  createdAt: string | Date;
};

export type MatterFinancials = {
  id: number;
  matterId: number;
  moniesOnAccount?: string | null;
  mortgageAdvance?: string | null;
  redemptionAmount?: string | null;
  salePrice?: string | null;
  purchasePrice?: string | null;
  updatedAt: string | Date;
};

export type ControlCheck = {
  id: number;
  organisationId: number;
  matterId: number;
  stage: string;
  ruleName: string;
  ruleKey?: string | null;
  required: boolean;
  completed: boolean;
  completedBy?: number | null;
  completedAt?: string | Date | null;
};

export type RiskAssessment = {
  id: number;
  matterId: number;
  organisationId: number;
  status: string;
  formData: any;
  overallClientRisk?: string | null;
  overallMatterRisk?: string | null;
  completedBy?: number | null;
  completedAt?: string | Date | null;
  updatedBy?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type User = {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  organisationId: number;
  createdAt: string | Date;
};
