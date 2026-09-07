import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMatterSchema, insertDraftEmailSchema, insertReminderSchema, insertJournalEntrySchema, insertTimeEntrySchema, WORKFLOW_STAGES, IMMIGRATION_WORKFLOW_STAGES, IMMIGRATION_MATTER_TYPES, DOCUMENT_TYPES, ROLE_PERMISSIONS } from "../shared/schema";
import type { MatterType, EnquiryPackItem, UserRole } from "../shared/schema";
import { registerChatRoutes } from "./replit_integrations/chat";
import { requireRole, requirePermission } from "./index";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { generatePurchaseEnquiriesPack, generateSaleRepliesPack, analyseSearchResults, jsonToMarkdown, redactSensitiveData } from "./enquiries-ai";
import { seedEnquiriesLibrary } from "./enquiries-seed-runner";
import ExcelJS from "exceljs";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

const AI_MODEL = process.env.AI_MODEL || (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? "gpt-5.1" : "gpt-4o");

const docUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), "uploads", "documents");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const knowledgeUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), "uploads", "knowledge");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function getUsername(req: any): string {
  return req.username || "system";
}

function getOrgId(req: any): number {
  return req.organisationId;
}

function getUserId(req: any): number {
  return req.userId;
}

function getUserRole(req: any): UserRole {
  return req.role;
}

async function verifyMatterAccess(req: any, matterId: number) {
  const matter = await storage.getMatter(matterId);
  if (!matter) return null;
  if (matter.organisationId && matter.organisationId !== getOrgId(req)) return null;
  return matter;
}

function renderHeader(doc: any, username: string, label: string) {
  doc.fontSize(18).fillColor("#111").text("Reflective Learning Journal", { align: "left" });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#666").text(`${username}  ·  ${label}  ·  Generated ${new Date().toLocaleString("en-GB")}`);
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.8);
}

function renderEntry(doc: any, entry: any) {
  if (doc.y > 720) doc.addPage();
  const date = entry.entryDate ? new Date(entry.entryDate) : new Date(entry.createdAt);
  doc.fontSize(13).fillColor("#111").text(entry.title || "(untitled)", { continued: false });
  doc.fontSize(9).fillColor("#888").text(`${date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}  ·  ${entry.category || "general"}`);
  doc.moveDown(0.4);
  const section = (label: string, body: string | null) => {
    if (!body) return;
    doc.fontSize(10).fillColor("#444").text(label, { continued: false });
    doc.fontSize(10).fillColor("#222").text(body, { paragraphGap: 4 });
    doc.moveDown(0.3);
  };
  section("Activity", entry.activity);
  section("Learning", entry.learning);
  section("Reflection", entry.reflection);
  if (!entry.activity && !entry.learning && !entry.reflection && entry.content) {
    section("Notes", entry.content);
  }
  doc.moveDown(0.4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#eee").stroke();
  doc.moveDown(0.6);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerChatRoutes(app);

  app.get("/api/matters", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const allMatters = await storage.getMatters(orgId);
      res.json(allMatters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch matters" });
    }
  });

  app.get("/api/matters/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      let matter = await verifyMatterAccess(req, id);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const updated = await storage.updateMatter(id, { lastViewedAt: new Date() } as any);
      if (updated) matter = updated;
      const matterTasks = await storage.getTasksByMatter(matter.id);
      const matterReminders = await storage.getReminders(matter.id);
      const matterEmails = await storage.getDraftEmails(matter.id);
      const matterDocs = await storage.getDocumentsByMatter(matter.id);
      const matterPacks = await storage.getEnquiryPacksByMatter(matter.id);
      res.json({ ...matter, tasks: matterTasks, reminders: matterReminders, draftEmails: matterEmails, documents: matterDocs, enquiryPacks: matterPacks });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch matter" });
    }
  });

  app.post("/api/matters", requirePermission("canCreateMatters"), async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const data = insertMatterSchema.parse({ ...req.body, organisationId: orgId });
      const matterType = data.type as MatterType;
      const validTypes: string[] = ["purchase", "sale", "remortgage", "visa_application", "asylum", "appeal", "settlement", "naturalisation"];
      if (!validTypes.includes(matterType)) {
        return res.status(400).json({ error: "Invalid matter type" });
      }
      const isImmigration = (IMMIGRATION_MATTER_TYPES as readonly string[]).includes(matterType);
      const userDept = (req as any).department || "conveyancing";
      if (userDept !== "both") {
        if (isImmigration && userDept !== "immigration") {
          return res.status(403).json({ error: "Your department does not allow immigration matter types" });
        }
        if (!isImmigration && userDept !== "conveyancing") {
          return res.status(403).json({ error: "Your department does not allow conveyancing matter types" });
        }
      }
      const matter = await storage.createMatter(data);
      if (isImmigration) {
        await storage.createImmigrationTasks(matter.id, matterType);
      } else {
        await storage.createDefaultTasks(matter.id, matterType);
        await storage.seedControlChecksForMatter(matter.id, orgId, matterType);
      }
      const matterTasks = await storage.getTasksByMatter(matter.id);
      res.status(201).json({ ...matter, tasks: matterTasks });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create matter" });
    }
  });

  app.patch("/api/matters/:id", requirePermission("canEditMatters"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingMatter = await verifyMatterAccess(req, id);
      if (!existingMatter) return res.status(404).json({ error: "Matter not found" });

      if (req.body.currentStage && req.body.currentStage !== existingMatter.currentStage) {
        const validation = await storage.validateStageProgression(id, existingMatter.currentStage);
        if (!validation.canProgress) {
          const override = req.body.override === true;
          const overrideReason = req.body.overrideReason;

          if (!override) {
            return res.status(409).json({
              error: "COMPLIANCE_BLOCKED",
              current_stage: existingMatter.currentStage,
              attempted_stage: req.body.currentStage,
              missing_checks: validation.missingChecks,
            });
          }

          const role = getUserRole(req);
          if (!ROLE_PERMISSIONS[role]?.canOverrideGating) {
            return res.status(403).json({ error: "Only admin or fee_earner can override stage gating" });
          }
          if (!overrideReason || typeof overrideReason !== "string" || overrideReason.trim().length < 10) {
            return res.status(400).json({ error: "Override reason must be at least 10 characters" });
          }

          await storage.createAuditLog({
            matterId: id,
            entityType: "matter",
            entityId: id,
            action: "STAGE_OVERRIDE",
            details: `Stage override from "${existingMatter.currentStage}" to "${req.body.currentStage}". Reason: ${overrideReason.trim()}. Missing checks: ${validation.missingChecks.map(c => c.ruleName).join(", ")}`,
            performedBy: getUsername(req),
          });
        }
      }

      const updateData = { ...req.body };
      delete updateData.override;
      delete updateData.overrideReason;
      if (updateData.status === "completed" && existingMatter.status !== "completed") {
        updateData.completionDate = new Date();
      }
      const matter = await storage.updateMatter(id, updateData);
      if (!matter) return res.status(404).json({ error: "Matter not found" });

      if (matter.type === "remortgage" && req.body.isCompanyRemortgage !== undefined) {
        const wasCompany = existingMatter.isCompanyRemortgage;
        const isNowCompany = req.body.isCompanyRemortgage;
        if (!wasCompany && isNowCompany) {
          const existingTasks = await storage.getTasksByMatterId(id);
          const signedTask = existingTasks.find(t => t.stage === "Signed Documents");
          if (signedTask) {
            const tasksToShift = existingTasks.filter(t => t.sortOrder >= signedTask.sortOrder);
            for (const t of tasksToShift) {
              await storage.updateTask(t.id, { sortOrder: t.sortOrder + 1 });
            }
            await storage.createTask({
              matterId: id,
              title: "Personal Guarantees / ILA",
              stage: "Personal Guarantees / ILA",
              status: "pending",
              sortOrder: signedTask.sortOrder,
            });
          }
        } else if (wasCompany && !isNowCompany) {
          const existingTasks = await storage.getTasksByMatterId(id);
          const pgTask = existingTasks.find(t => t.stage === "Personal Guarantees / ILA");
          if (pgTask) {
            const removedOrder = pgTask.sortOrder;
            await storage.deleteTask(pgTask.id);
            const tasksToShift = existingTasks.filter(t => t.sortOrder > removedOrder && t.id !== pgTask.id);
            for (const t of tasksToShift) {
              await storage.updateTask(t.id, { sortOrder: t.sortOrder - 1 });
            }
          }
        }
      }

      if (updateData.status === "completed" && existingMatter.status !== "completed") {
        const role = getUserRole(req);
        if (ROLE_PERMISSIONS[role]?.canDeleteMatters) {
          await storage.deleteMatter(id);
          return res.json({ deleted: true, message: "Matter completed and auto-deleted" });
        }
      }

      const updatedMatter = await storage.getMatter(id);
      res.json(updatedMatter);
    } catch (error) {
      res.status(500).json({ error: "Failed to update matter" });
    }
  });

  app.delete("/api/matters/:id", requirePermission("canDeleteMatters"), async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      await storage.deleteMatter(matter.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete matter" });
    }
  });

  app.get("/api/matters/:id/tasks", async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const matterTasks = await storage.getTasksByMatter(matter.id);
      res.json(matterTasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.patch("/api/tasks/:id", requirePermission("canEditMatters"), async (req, res) => {
    try {
      const task = await storage.getTask(parseInt(req.params.id));
      if (!task) return res.status(404).json({ error: "Task not found" });
      const matter = await verifyMatterAccess(req, task.matterId);
      if (!matter) return res.status(404).json({ error: "Task not found" });
      const body = { ...req.body };
      if (body.dueDate && typeof body.dueDate === "string") body.dueDate = new Date(body.dueDate);
      if (body.completedAt && typeof body.completedAt === "string") body.completedAt = new Date(body.completedAt);
      const updated = await storage.updateTask(task.id, body);
      if (!updated) return res.status(404).json({ error: "Task not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.post("/api/tasks/:id/complete", requirePermission("canProgressStages"), async (req, res) => {
    try {
      const task = await storage.getTask(parseInt(req.params.id));
      if (!task) return res.status(404).json({ error: "Task not found" });
      const matter = await verifyMatterAccess(req, task.matterId);
      if (!matter) return res.status(404).json({ error: "Task not found" });
      const completed = await storage.completeTask(task.id);
      if (!completed) return res.status(404).json({ error: "Task not found" });
      res.json(completed);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete task" });
    }
  });

  app.get("/api/draft-emails", async (req, res) => {
    try {
      const matterId = req.query.matterId ? parseInt(req.query.matterId as string) : undefined;
      if (matterId) {
        const matter = await verifyMatterAccess(req, matterId);
        if (!matter) return res.status(404).json({ error: "Matter not found" });
      }
      const emails = await storage.getDraftEmails(matterId);
      res.json(emails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch draft emails" });
    }
  });

  app.post("/api/draft-emails", async (req, res) => {
    try {
      const data = insertDraftEmailSchema.parse(req.body);
      if (data.matterId) {
        const matter = await verifyMatterAccess(req, data.matterId);
        if (!matter) return res.status(404).json({ error: "Matter not found" });
      }
      const email = await storage.createDraftEmail(data);
      res.status(201).json(email);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create draft email" });
    }
  });

  app.patch("/api/draft-emails/:id", async (req, res) => {
    try {
      const email = await storage.getDraftEmail(parseInt(req.params.id));
      if (!email) return res.status(404).json({ error: "Draft email not found" });
      if (email.matterId) {
        const matter = await verifyMatterAccess(req, email.matterId);
        if (!matter) return res.status(404).json({ error: "Draft email not found" });
      }
      const updated = await storage.updateDraftEmail(email.id, req.body);
      if (!updated) return res.status(404).json({ error: "Draft email not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update draft email" });
    }
  });

  app.delete("/api/draft-emails/:id", async (req, res) => {
    try {
      const email = await storage.getDraftEmail(parseInt(req.params.id));
      if (!email) return res.status(404).json({ error: "Draft email not found" });
      if (email.matterId) {
        const matter = await verifyMatterAccess(req, email.matterId);
        if (!matter) return res.status(404).json({ error: "Draft email not found" });
      }
      await storage.deleteDraftEmail(email.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete draft email" });
    }
  });

  app.get("/api/reminders", async (req, res) => {
    try {
      const matterId = req.query.matterId ? parseInt(req.query.matterId as string) : undefined;
      if (matterId) {
        const matter = await verifyMatterAccess(req, matterId);
        if (!matter) return res.status(404).json({ error: "Matter not found" });
      }
      const allReminders = await storage.getReminders(matterId);
      res.json(allReminders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  app.post("/api/reminders", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.dueDate && typeof body.dueDate === "string") body.dueDate = new Date(body.dueDate);
      const data = insertReminderSchema.parse(body);
      if (data.matterId) {
        const matter = await verifyMatterAccess(req, data.matterId);
        if (!matter) return res.status(404).json({ error: "Matter not found" });
      }
      const reminder = await storage.createReminder(data);
      res.status(201).json(reminder);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create reminder" });
    }
  });

  app.patch("/api/reminders/:id", async (req, res) => {
    try {
      const reminder = await storage.getReminder(parseInt(req.params.id));
      if (!reminder) return res.status(404).json({ error: "Reminder not found" });
      if (reminder.matterId) {
        const matter = await verifyMatterAccess(req, reminder.matterId);
        if (!matter) return res.status(404).json({ error: "Reminder not found" });
      }
      const body = { ...req.body };
      if (body.dueDate && typeof body.dueDate === "string") body.dueDate = new Date(body.dueDate);
      const updated = await storage.updateReminder(reminder.id, body);
      if (!updated) return res.status(404).json({ error: "Reminder not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reminder" });
    }
  });

  app.post("/api/reminders/:id/complete", async (req, res) => {
    try {
      const reminder = await storage.getReminder(parseInt(req.params.id));
      if (!reminder) return res.status(404).json({ error: "Reminder not found" });
      if (reminder.matterId) {
        const matter = await verifyMatterAccess(req, reminder.matterId);
        if (!matter) return res.status(404).json({ error: "Reminder not found" });
      }
      const reminder2 = await storage.completeReminder(parseInt(req.params.id));
      if (!reminder) return res.status(404).json({ error: "Reminder not found" });
      res.json(reminder);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete reminder" });
    }
  });

  app.delete("/api/reminders/:id", async (req, res) => {
    try {
      await storage.deleteReminder(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reminder" });
    }
  });

  app.post("/api/ai/generate-email", async (req, res) => {
    try {
      const { context, recipient, subject } = req.body;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a professional conveyancing solicitor's assistant. Generate formal, professional email drafts for property transactions. Be precise with legal terminology and maintain a courteous tone. Format the email body only (no subject line or greeting - those will be added separately).`,
          },
          {
            role: "user",
            content: `Generate a professional email draft for the following context:\n\nRecipient: ${recipient || "Not specified"}\nSubject: ${subject || "Not specified"}\nContext: ${context}`,
          },
        ],
        stream: true,
        max_completion_tokens: 8192,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true, fullContent: fullResponse })}\n\n`);
      res.end();
    } catch (error) {
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate email" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to generate email" });
      }
    }
  });

  app.get("/api/journal-entries/export", async (req, res) => {
    try {
      const userId = getUserId(req);
      const username = getUsername(req);
      const scope = String(req.query.scope || "range");
      let from: Date, to: Date, label: string;

      if (scope === "single") {
        const id = parseInt(String(req.query.id));
        const entry = await storage.getJournalEntry(id, userId);
        if (!entry) return res.status(404).json({ error: "Not found" });
        const pdfMod: any = await import("pdfkit");
        const PDFDocument = pdfMod.default || pdfMod;
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="journal-entry-${id}.pdf"`);
        doc.pipe(res);
        renderHeader(doc, username, "Single Entry");
        renderEntry(doc, entry);
        doc.end();
        return;
      }

      const fmtUK = (d: Date) => `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
      let filename: string;
      if (scope === "week") {
        const weekStart = new Date(String(req.query.from));
        from = weekStart;
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        to = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        label = `${fmtUK(from)} to ${fmtUK(weekEnd)}`;
        filename = `Journal Entry - ${label}.pdf`;
      } else {
        from = new Date(String(req.query.from));
        to = new Date(String(req.query.to));
        to.setHours(23, 59, 59, 999);
        label = `${fmtUK(from)} to ${fmtUK(to)}`;
        filename = `Journal Entry - ${label}.pdf`;
      }

      const entries = await storage.getJournalEntriesInRange(userId, from, to);
      const pdfMod: any = await import("pdfkit");
      const PDFDocument = pdfMod.default || pdfMod;
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      doc.pipe(res);
      renderHeader(doc, username, label);
      if (entries.length === 0) {
        doc.fontSize(11).fillColor("#666").text("No entries in this period.");
      } else {
        for (const e of entries) {
          renderEntry(doc, e);
        }
      }
      doc.end();
    } catch (error: any) {
      console.error("PDF export error:", error);
      if (!res.headersSent) res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/journal-entries", async (req, res) => {
    try {
      const entries = await storage.getJournalEntries(getUserId(req));
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch journal entries" });
    }
  });

  app.get("/api/journal-entries/:id", async (req, res) => {
    try {
      const entry = await storage.getJournalEntry(parseInt(req.params.id), getUserId(req));
      if (!entry) return res.status(404).json({ error: "Journal entry not found" });
      const entryTimeEntries = await storage.getTimeEntries(entry.id);
      res.json({ ...entry, timeEntries: entryTimeEntries });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch journal entry" });
    }
  });

  app.post("/api/journal-entries", async (req, res) => {
    try {
      const body = { ...req.body, userId: getUserId(req) };
      if (body.entryDate && typeof body.entryDate === "string") {
        body.entryDate = new Date(body.entryDate);
      }
      const data = insertJournalEntrySchema.parse(body);
      const entry = await storage.createJournalEntry(data);
      res.status(201).json(entry);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create journal entry" });
    }
  });

  app.patch("/api/journal-entries/:id", async (req, res) => {
    try {
      const { title, activity, learning, reflection, category, entryDate } = req.body;
      const entry = await storage.updateJournalEntry(parseInt(req.params.id), getUserId(req), {
        title, activity, learning, reflection, category,
        ...(entryDate ? { entryDate: new Date(entryDate) } : {}),
      });
      if (!entry) return res.status(404).json({ error: "Journal entry not found" });
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to update journal entry" });
    }
  });

  app.delete("/api/journal-entries/:id", async (req, res) => {
    try {
      await storage.deleteJournalEntry(parseInt(req.params.id), getUserId(req));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete journal entry" });
    }
  });

  app.post("/api/time-entries", async (req, res) => {
    try {
      const data = insertTimeEntrySchema.parse(req.body);
      const entry = await storage.createTimeEntry(data);
      res.status(201).json(entry);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create time entry" });
    }
  });

  app.delete("/api/time-entries/:id", async (req, res) => {
    try {
      await storage.deleteTimeEntry(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete time entry" });
    }
  });

  app.get("/api/matters/:id/documents", async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const docs = await storage.getDocumentsByMatter(matter.id);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.post("/api/matters/:id/documents", requirePermission("canUploadDocuments"), docUpload.array("files", 20), async (req, res) => {
    try {
      const matterId = parseInt(req.params.id);
      const matter = await verifyMatterAccess(req, matterId);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ error: "No files provided" });
      const documentType = req.body.documentType || "Other";
      const username = getUsername(req);
      const docs = [];
      for (const file of files) {
        const doc = await storage.createDocument({
          matterId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          documentType,
          filePath: file.path,
        });
        await storage.createAuditLog({
          matterId,
          entityType: "document",
          entityId: doc.id,
          action: "uploaded",
          details: `Document "${file.originalname}" (${documentType}) uploaded`,
          performedBy: username,
        });
        docs.push(doc);
      }
      res.status(201).json(docs.length === 1 ? docs[0] : docs);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const doc = await storage.getDocument(parseInt(req.params.id));
      if (!doc) return res.status(404).json({ error: "Document not found" });
      const matter = await verifyMatterAccess(req, doc.matterId);
      if (!matter) return res.status(404).json({ error: "Document not found" });
      try { fs.unlinkSync(doc.filePath); } catch {}
      await storage.deleteDocument(doc.id);
      await storage.createAuditLog({
        matterId: doc.matterId, entityType: "document", entityId: doc.id,
        action: "deleted", details: `Document "${doc.originalName}" deleted`,
        performedBy: getUsername(req),
      });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  app.get("/api/matters/:id/enquiry-packs", async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const packs = await storage.getEnquiryPacksByMatter(matter.id);
      res.json(packs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch enquiry packs" });
    }
  });

  app.get("/api/enquiry-packs/:id", async (req, res) => {
    try {
      const pack = await storage.getEnquiryPack(parseInt(req.params.id));
      if (!pack) return res.status(404).json({ error: "Pack not found" });
      res.json(pack);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch enquiry pack" });
    }
  });

  app.post("/api/matters/:id/generate-purchase-enquiries", async (req, res) => {
    try {
      const matterId = parseInt(req.params.id);
      const matter = await verifyMatterAccess(req, matterId);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      if (matter.type !== "purchase") return res.status(400).json({ error: "Not a purchase matter" });
      const { documentIds } = req.body;
      if (!documentIds?.length) return res.status(400).json({ error: "No documents selected" });
      const matterDocs = await storage.getDocumentsByMatter(matterId);
      const matterDocIds = new Set(matterDocs.map(d => d.id));
      const invalidIds = documentIds.filter((id: number) => !matterDocIds.has(id));
      if (invalidIds.length > 0) return res.status(400).json({ error: "Some documents do not belong to this matter" });
      const username = getUsername(req);

      await storage.createAuditLog({
        matterId, entityType: "enquiry_pack", action: "generation_requested",
        details: `Purchase enquiries pack generation requested with ${documentIds.length} documents`,
        performedBy: username,
      });

      const result = await generatePurchaseEnquiriesPack(matter, documentIds);
      const pack = await storage.createEnquiryPack({
        matterId, packType: "purchase_enquiries", status: "review_required",
        createdBy: username, sourceDocumentIds: documentIds,
        contentJson: result.contentJson, contentMarkdown: result.contentMarkdown,
        riskFlags: result.riskFlags,
      });

      await storage.createTask({
        matterId, title: "Review enquiries pack", stage: "Enquiries",
        status: "pending", sortOrder: 100,
      });

      await storage.createAuditLog({
        matterId, entityType: "enquiry_pack", entityId: pack.id,
        action: "generation_completed", details: `Pack generated with ${result.riskFlags.length} risk flags`,
        performedBy: "system",
      });

      res.status(201).json(pack);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate enquiries pack" });
    }
  });

  app.post("/api/matters/:id/generate-sale-replies", async (req, res) => {
    try {
      const matterId = parseInt(req.params.id);
      const matter = await verifyMatterAccess(req, matterId);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      if (matter.type !== "sale") return res.status(400).json({ error: "Not a sale matter" });
      const { enquiryDocId, supportingDocIds } = req.body;
      if (!enquiryDocId) return res.status(400).json({ error: "No enquiry document selected" });
      const matterDocs = await storage.getDocumentsByMatter(matterId);
      const matterDocIds = new Set(matterDocs.map(d => d.id));
      const allDocIds = [enquiryDocId, ...(supportingDocIds || [])];
      if (allDocIds.some((id: number) => !matterDocIds.has(id))) {
        return res.status(400).json({ error: "Some documents do not belong to this matter" });
      }
      const username = getUsername(req);

      await storage.createAuditLog({
        matterId, entityType: "enquiry_pack", action: "generation_requested",
        details: `Sale replies pack generation requested`,
        performedBy: username,
      });

      const result = await generateSaleRepliesPack(matter, enquiryDocId, supportingDocIds || []);
      const pack = await storage.createEnquiryPack({
        matterId, packType: "sale_replies", status: "review_required",
        createdBy: username, sourceDocumentIds: [enquiryDocId, ...(supportingDocIds || [])],
        contentJson: result.contentJson, contentMarkdown: result.contentMarkdown,
        riskFlags: result.riskFlags,
      });

      await storage.createTask({
        matterId, title: "Review replies pack", stage: "Enquiries",
        status: "pending", sortOrder: 100,
      });

      await storage.createAuditLog({
        matterId, entityType: "enquiry_pack", entityId: pack.id,
        action: "generation_completed", details: `Pack generated with ${result.riskFlags.length} risk flags`,
        performedBy: "system",
      });

      res.status(201).json(pack);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate sale replies" });
    }
  });

  app.post("/api/matters/:id/analyse-searches", async (req, res) => {
    try {
      const matterId = parseInt(req.params.id);
      const matter = await verifyMatterAccess(req, matterId);
      if (!matter) return res.status(404).json({ error: "Matter not found" });

      const { searchText, documentIds } = req.body;
      const hasText = searchText && typeof searchText === "string" && searchText.trim().length >= 20;
      const hasDocIds = Array.isArray(documentIds) && documentIds.length > 0;

      if (!hasText && !hasDocIds) {
        return res.status(400).json({ error: "Please provide search result text (at least 20 characters) and/or select documents to analyse" });
      }

      let documentContent = "";
      if (hasDocIds) {
        const docParts: string[] = [];
        for (const docId of documentIds) {
          const doc = await storage.getDocument(docId);
          if (!doc || doc.matterId !== matterId) continue;
          let content = `[Document: ${doc.originalName} (Type: ${doc.documentType})]`;
          try {
            const rawText = fs.readFileSync(doc.filePath, "utf-8");
            const redacted = redactSensitiveData(rawText.slice(0, 5000));
            content += `\n${redacted}`;
          } catch {
            content += "\n[Binary file - content not extractable as text]";
          }
          docParts.push(content);
        }
        documentContent = docParts.join("\n\n---\n\n");
        if (docParts.length === 0) {
          if (!hasText) {
            return res.status(400).json({ error: "None of the selected documents could be found or accessed" });
          }
        }
      }

      const username = getUsername(req);
      await storage.createAuditLog({
        matterId, entityType: "search_analysis", action: "analysis_requested",
        details: `Search analysis requested (${hasText ? searchText.length + ' chars text' : 'no text'}${hasDocIds ? ', ' + documentIds.length + ' documents' : ''})`,
        performedBy: username,
      });

      const libraryItems = await storage.getEnquiriesLibrary();
      const matterType = matter.type as string;
      const relevantItems = libraryItems.filter(i =>
        i.appliesTo === matterType || i.appliesTo === "both"
      );

      const result = await analyseSearchResults(hasText ? searchText : "", relevantItems, documentContent || undefined);

      if (result.contentJson.error) {
        return res.status(502).json({ error: "AI response could not be parsed. Please try again." });
      }

      await storage.createAuditLog({
        matterId, entityType: "search_analysis", action: "analysis_completed",
        details: `Search analysis completed: ${result.contentJson.flagged_enquiries?.length || 0} enquiries flagged, ${result.contentJson.document_issues?.length || 0} document issues`,
        performedBy: username,
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to analyse search results" });
    }
  });

  app.patch("/api/enquiry-packs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pack = await storage.getEnquiryPack(id);
      if (!pack) return res.status(404).json({ error: "Pack not found" });
      const { contentMarkdown, contentJson } = req.body;
      const updated = await storage.updateEnquiryPack(id, { contentMarkdown, contentJson });
      await storage.createAuditLog({
        matterId: pack.matterId, entityType: "enquiry_pack", entityId: id,
        action: "edited", details: "Pack content edited",
        performedBy: getUsername(req),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update enquiry pack" });
    }
  });

  app.post("/api/enquiry-packs/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pack = await storage.getEnquiryPack(id);
      if (!pack) return res.status(404).json({ error: "Pack not found" });
      if (pack.status === "sent") return res.status(400).json({ error: "Pack already sent" });
      const username = getUsername(req);
      const updated = await storage.updateEnquiryPack(id, {
        status: "approved", approvedAt: new Date(), approvedBy: username,
      });
      await storage.createAuditLog({
        matterId: pack.matterId, entityType: "enquiry_pack", entityId: id,
        action: "approved", details: `Pack approved by ${username}`,
        performedBy: username,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve pack" });
    }
  });

  app.post("/api/enquiry-packs/:id/send", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pack = await storage.getEnquiryPack(id);
      if (!pack) return res.status(404).json({ error: "Pack not found" });
      if (pack.status !== "approved") return res.status(400).json({ error: "Pack must be approved before sending" });
      const username = getUsername(req);
      const { recipient } = req.body;

      const subject = pack.packType === "purchase_enquiries"
        ? "Suggested Enquiries Pack" : "Draft Replies to Buyer Enquiries";
      const disclaimer = "\n\n---\nThis communication is generated as a draft for review. It does not constitute legal advice.";
      await storage.createDraftEmail({
        matterId: pack.matterId,
        subject,
        recipient: recipient || "",
        body: pack.contentMarkdown + disclaimer,
        status: "draft",
      });

      const updated = await storage.updateEnquiryPack(id, { status: "sent", sentAt: new Date() });
      await storage.createAuditLog({
        matterId: pack.matterId, entityType: "enquiry_pack", entityId: id,
        action: "sent", details: `Pack sent to ${recipient || "draft email created"}`,
        performedBy: username,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to send pack" });
    }
  });

  app.get("/api/matters/:id/audit-logs", async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const logs = await storage.getAuditLogs(matter.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/knowledge-resources", async (_req, res) => {
    try {
      const resources = await storage.getKnowledgeResources();
      res.json(resources);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch knowledge resources" });
    }
  });

  app.post("/api/knowledge-resources", knowledgeUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file provided" });
      const name = req.body.name || file.originalname;
      const description = req.body.description || "";
      let extractedText = "";
      try {
        extractedText = fs.readFileSync(file.path, "utf-8").slice(0, 50000);
      } catch {}
      const resource = await storage.createKnowledgeResource({
        name, description, filename: file.filename,
        originalName: file.originalname, mimeType: file.mimetype,
        filePath: file.path, extractedText,
      });
      res.status(201).json(resource);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload knowledge resource" });
    }
  });

  app.delete("/api/knowledge-resources/:id", async (req, res) => {
    try {
      const resource = await storage.getKnowledgeResource(parseInt(req.params.id));
      if (!resource) return res.status(404).json({ error: "Resource not found" });
      try { fs.unlinkSync(resource.filePath); } catch {}
      await storage.deleteKnowledgeResource(resource.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete knowledge resource" });
    }
  });

  app.get("/api/document-types", (_req, res) => {
    res.json(DOCUMENT_TYPES);
  });

  await seedEnquiriesLibrary();

  app.get("/api/enquiries/library", async (req, res) => {
    try {
      const items = await storage.getEnquiriesLibrary();
      const { category, appliesTo, search } = req.query;
      let filtered = items;
      if (category) filtered = filtered.filter(i => i.category === category);
      if (appliesTo && appliesTo !== "all") filtered = filtered.filter(i => i.appliesTo === appliesTo || i.appliesTo === "both");
      if (search) {
        const s = (search as string).toLowerCase();
        filtered = filtered.filter(i =>
          i.title.toLowerCase().includes(s) ||
          i.enquiryText.toLowerCase().includes(s) ||
          i.category.toLowerCase().includes(s) ||
          (i.tags || []).some(t => t.toLowerCase().includes(s))
        );
      }
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch enquiries library" });
    }
  });

  app.get("/api/enquiries/templates", async (_req, res) => {
    try {
      const allItems = await storage.getEnquiriesLibrary();
      const titleMap = new Map(allItems.map(i => [i.title, i.id]));
      const { PURCHASE_INITIAL_TEMPLATE_TITLES, PURCHASE_TITLE_DOCS_TEMPLATE_TITLES, PURCHASE_SEARCHES_PLANNING_TEMPLATE_TITLES, PURCHASE_STANDARD_TEMPLATE_TITLES } = await import("./enquiries-seed");
      const resolveIds = (titles: string[]) => titles.map(t => titleMap.get(t)).filter((id): id is number => id !== undefined);
      res.json([
        { id: "purchase_standard", name: "Purchase – Standard Enquiries (Protocol)", itemIds: resolveIds(PURCHASE_STANDARD_TEMPLATE_TITLES) },
        { id: "purchase_initial", name: "Purchase – Initial Enquiries", itemIds: resolveIds(PURCHASE_INITIAL_TEMPLATE_TITLES) },
        { id: "purchase_title_docs", name: "Purchase – Title & Documents", itemIds: resolveIds(PURCHASE_TITLE_DOCS_TEMPLATE_TITLES) },
        { id: "purchase_searches_planning", name: "Purchase – Searches & Planning", itemIds: resolveIds(PURCHASE_SEARCHES_PLANNING_TEMPLATE_TITLES) },
      ]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/matters/:id/builder-packs", async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const packs = await storage.getBuilderPacksByMatter(matter.id);
      res.json(packs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch builder packs" });
    }
  });

  app.post("/api/matters/:id/builder-packs", async (req, res) => {
    try {
      const matterId = parseInt(req.params.id);
      const matter = await verifyMatterAccess(req, matterId);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const username = getUsername(req);
      const { packType, selectedItemsJson } = req.body;
      const pack = await storage.createBuilderPack({
        matterId,
        packType: packType || "custom",
        status: "draft",
        createdBy: username,
        selectedItemsJson: selectedItemsJson || [],
        exportCount: 0,
      });
      await storage.createAuditLog({
        matterId,
        entityType: "enquiries_builder_pack",
        entityId: pack.id,
        action: "created",
        details: `Enquiries pack created (${packType || "custom"}) with ${(selectedItemsJson || []).length} items`,
        performedBy: username,
      });
      res.status(201).json(pack);
    } catch (error) {
      res.status(500).json({ error: "Failed to create builder pack" });
    }
  });

  app.put("/api/builder-packs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pack = await storage.getBuilderPack(id);
      if (!pack) return res.status(404).json({ error: "Pack not found" });
      const { selectedItemsJson, status } = req.body;
      const updates: Record<string, any> = {};
      if (selectedItemsJson !== undefined) updates.selectedItemsJson = selectedItemsJson;
      if (status !== undefined) updates.status = status;
      const updated = await storage.updateBuilderPack(id, updates);
      const username = getUsername(req);
      await storage.createAuditLog({
        matterId: pack.matterId,
        entityType: "enquiries_builder_pack",
        entityId: id,
        action: "updated",
        details: `Pack updated${status ? ` (status: ${status})` : ""}`,
        performedBy: username,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update builder pack" });
    }
  });

  app.delete("/api/builder-packs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pack = await storage.getBuilderPack(id);
      if (!pack) return res.status(404).json({ error: "Pack not found" });
      await storage.deleteBuilderPack(id);
      await storage.createAuditLog({
        matterId: pack.matterId,
        entityType: "enquiries_builder_pack",
        entityId: id,
        action: "deleted",
        details: "Pack deleted",
        performedBy: getUsername(req),
      });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete builder pack" });
    }
  });

  app.post("/api/builder-packs/:id/export", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pack = await storage.getBuilderPack(id);
      if (!pack) return res.status(404).json({ error: "Pack not found" });

      const matter = await storage.getMatter(pack.matterId);
      if (!matter) return res.status(404).json({ error: "Matter not found" });

      const allItems = await storage.getEnquiriesLibrary();
      const itemMap = new Map(allItems.map(i => [i.id, i]));
      const selectedItems = (pack.selectedItemsJson || []) as EnquiryPackItem[];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "ConveyFlow – LexAssist";
      const sheet = workbook.addWorksheet("Enquiries");

      sheet.columns = [
        { header: "Ref", key: "ref", width: 8 },
        { header: "Category", key: "category", width: 24 },
        { header: "Enquiry", key: "enquiry", width: 75 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, size: 11 };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E0E8" } };
      headerRow.alignment = { vertical: "middle" };

      selectedItems.forEach((sel, idx) => {
        const lib = itemMap.get(sel.libraryItemId);
        sheet.addRow({
          ref: `E${idx + 1}`,
          category: lib?.category || "",
          enquiry: sel.enquiryTextOverride || lib?.enquiryText || "",
        });
      });

      sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.getCell("enquiry").alignment = { wrapText: true, vertical: "top" };
        }
      });

      const matterRef = matter.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `${matterRef}_Enquiries_${dateStr}.xlsx`;

      await storage.updateBuilderPack(id, {
        exportCount: (pack.exportCount || 0) + 1,
        lastExportedAt: new Date(),
      });
      await storage.createAuditLog({
        matterId: pack.matterId,
        entityType: "enquiries_builder_pack",
        entityId: id,
        action: "exported",
        details: `Pack exported as Excel (${selectedItems.length} enquiries)`,
        performedBy: getUsername(req),
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export pack" });
    }
  });

  app.post("/api/builder-packs/:id/create-task", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pack = await storage.getBuilderPack(id);
      if (!pack) return res.status(404).json({ error: "Pack not found" });
      const task = await storage.createTask({
        matterId: pack.matterId,
        title: "Send enquiries pack",
        stage: "Enquiries",
        status: "pending",
        sortOrder: 100,
        notes: `Enquiries pack #${pack.id} with ${(pack.selectedItemsJson || []).length} enquiries`,
      });
      await storage.createAuditLog({
        matterId: pack.matterId,
        entityType: "enquiries_builder_pack",
        entityId: id,
        action: "task_created",
        details: `Task "Send enquiries pack" created`,
        performedBy: getUsername(req),
      });
      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.get("/api/matters/:matterId/financials", async (req, res) => {
    try {
      const matterId = parseInt(req.params.matterId);
      const matter = await verifyMatterAccess(req, matterId);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const [items, summary] = await Promise.all([
        storage.getFinancialItems(matterId),
        storage.getMatterFinancials(matterId),
      ]);
      res.json({ items, summary: summary || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch financials" });
    }
  });

  app.post("/api/matters/:matterId/financial-items", async (req, res) => {
    try {
      const matterId = parseInt(req.params.matterId);
      const matter = await verifyMatterAccess(req, matterId);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const { description, category, amount, vatRate, vatAmount, totalAmount, sortOrder } = req.body;
      const item = await storage.createFinancialItem({
        matterId, description, category,
        amount: String(amount || "0"),
        vatRate: String(vatRate || "0"),
        vatAmount: String(vatAmount || "0"),
        totalAmount: String(totalAmount || "0"),
        sortOrder: sortOrder || 0,
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Create financial item error:", error);
      res.status(500).json({ error: "Failed to create financial item" });
    }
  });

  app.patch("/api/financial-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { description, category, amount, vatRate, vatAmount, totalAmount, sortOrder } = req.body;
      const updates: Record<string, any> = {};
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (amount !== undefined) updates.amount = String(amount);
      if (vatRate !== undefined) updates.vatRate = String(vatRate);
      if (vatAmount !== undefined) updates.vatAmount = String(vatAmount);
      if (totalAmount !== undefined) updates.totalAmount = String(totalAmount);
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      const item = await storage.updateFinancialItem(id, updates);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update financial item" });
    }
  });

  app.delete("/api/financial-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFinancialItem(id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete financial item" });
    }
  });

  app.patch("/api/matters/:matterId/financials-summary", async (req, res) => {
    try {
      const matterId = parseInt(req.params.matterId);
      const matter = await verifyMatterAccess(req, matterId);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const { moniesOnAccount, mortgageAdvance, redemptionAmount, salePrice, purchasePrice } = req.body;
      const updates: Record<string, string> = {};
      if (moniesOnAccount !== undefined) updates.moniesOnAccount = String(moniesOnAccount);
      if (mortgageAdvance !== undefined) updates.mortgageAdvance = String(mortgageAdvance);
      if (redemptionAmount !== undefined) updates.redemptionAmount = String(redemptionAmount);
      if (salePrice !== undefined) updates.salePrice = String(salePrice);
      if (purchasePrice !== undefined) updates.purchasePrice = String(purchasePrice);
      const summary = await storage.upsertMatterFinancials(matterId, updates);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to update financials summary" });
    }
  });

  app.get("/api/matters/:matterId/financials/export", async (req, res) => {
    try {
      const matterId = parseInt(req.params.matterId);
      const matter = await verifyMatterAccess(req, matterId);
      if (!matter) return res.status(404).json({ error: "Matter not found" });

      const [items, summary] = await Promise.all([
        storage.getFinancialItems(matterId),
        storage.getMatterFinancials(matterId),
      ]);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Financial Statement");

      sheet.columns = [
        { header: "Matter", key: "matter", width: 40 },
        { header: "", key: "blank1", width: 5 },
        { header: "", key: "blank2", width: 15 },
        { header: "", key: "blank3", width: 15 },
      ];

      const titleRow = sheet.addRow(["Financial Statement"]);
      titleRow.font = { bold: true, size: 14 };
      sheet.addRow([matter.title]);
      sheet.addRow([matter.propertyAddress || ""]);
      sheet.addRow([]);

      const summaryHeader = sheet.addRow(["Key Figures"]);
      summaryHeader.font = { bold: true, size: 11 };
      summaryHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E0E8" } };

      const monies = parseFloat(summary?.moniesOnAccount || "0");
      const mortgage = parseFloat(summary?.mortgageAdvance || "0");
      const redemption = parseFloat(summary?.redemptionAmount || "0");
      const salePriceVal = parseFloat(summary?.salePrice || "0");
      const purchasePriceVal = parseFloat(summary?.purchasePrice || "0");

      if (monies > 0) sheet.addRow(["Monies Paid on Account", "", "", `£${monies.toFixed(2)}`]);
      if (mortgage > 0) sheet.addRow(["Mortgage Advance Expected", "", "", `£${mortgage.toFixed(2)}`]);
      if (redemption > 0) sheet.addRow(["Redemption Amount", "", "", `£${redemption.toFixed(2)}`]);
      if (salePriceVal > 0) sheet.addRow(["Sale Price", "", "", `£${salePriceVal.toFixed(2)}`]);
      if (purchasePriceVal > 0) sheet.addRow(["Purchase Price", "", "", `£${purchasePriceVal.toFixed(2)}`]);

      sheet.addRow([]);

      const costsHeader = sheet.addRow(["Description", "Category", "Net (£)", "VAT (£)", "Total (£)"]);
      costsHeader.font = { bold: true, size: 11 };
      costsHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E0E8" } };

      sheet.getColumn(1).width = 40;
      sheet.getColumn(2).width = 20;
      sheet.getColumn(3).width = 15;
      sheet.getColumn(4).width = 15;
      sheet.getColumn(5).width = 15;

      const categoryLabels: Record<string, string> = {
        legal_fee: "Legal Fee",
        disbursement: "Disbursement",
        search_fee: "Search Fee",
        land_registry: "Land Registry",
        stamp_duty: "Stamp Duty",
        bank_transfer: "Bank Transfer",
        other_cost: "Other Cost",
      };

      let totalNet = 0;
      let totalVat = 0;
      let totalGross = 0;

      items.forEach((item) => {
        const net = parseFloat(item.amount || "0");
        const vat = parseFloat(item.vatAmount || "0");
        const total = parseFloat(item.totalAmount || "0");
        totalNet += net;
        totalVat += vat;
        totalGross += total;
        sheet.addRow([
          item.description,
          categoryLabels[item.category] || item.category,
          `£${net.toFixed(2)}`,
          `£${vat.toFixed(2)}`,
          `£${total.toFixed(2)}`,
        ]);
      });

      const totalRow = sheet.addRow(["TOTAL", "", `£${totalNet.toFixed(2)}`, `£${totalVat.toFixed(2)}`, `£${totalGross.toFixed(2)}`]);
      totalRow.font = { bold: true };
      totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDEDEDE" } };

      sheet.addRow([]);

      const balanceHeader = sheet.addRow(["Balance Summary"]);
      balanceHeader.font = { bold: true, size: 11 };
      balanceHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E0E8" } };

      const fundsIn = monies + mortgage + salePriceVal;
      const fundsOut = totalGross + redemption + purchasePriceVal;
      const balance = fundsIn - fundsOut;

      if (fundsIn > 0) sheet.addRow(["Total Funds In", "", "", "", `£${fundsIn.toFixed(2)}`]);
      if (fundsOut > 0) sheet.addRow(["Total Funds Out", "", "", "", `£${fundsOut.toFixed(2)}`]);
      const balanceRow = sheet.addRow(["Balance", "", "", "", `£${balance.toFixed(2)}`]);
      balanceRow.font = { bold: true };

      const matterRef = matter.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `${matterRef}_Financials_${dateStr}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Financial export error:", error);
      res.status(500).json({ error: "Failed to export financials" });
    }
  });

  app.post("/api/ai/suggest", async (req, res) => {
    try {
      const { question, matterContext } = req.body;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: `You are an expert conveyancing assistant helping UK property solicitors. You have deep knowledge of:
- Residential property transactions (sales, purchases, remortgages)
- Land Registry procedures
- SDLT (Stamp Duty Land Tax)
- Property searches (local authority, environmental, drainage, etc.)
- Mortgage requirements and lender conditions
- Exchange and completion procedures
- Anti-money laundering requirements
- Source of funds checks

Provide clear, actionable advice. Reference relevant regulations when appropriate. Be concise but thorough.`,
          },
          {
            role: "user",
            content: matterContext
              ? `Matter context: ${matterContext}\n\nQuestion: ${question}`
              : question,
          },
        ],
        stream: true,
        max_completion_tokens: 8192,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get AI suggestion" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to get AI suggestion" });
      }
    }
  });

  app.get("/api/users", requirePermission("canManageUsers"), async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const allUsers = await storage.getUsers(orgId);
      const safeUsers = allUsers.map(({ passwordHash, ...rest }) => rest);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requirePermission("canManageUsers"), async (req, res) => {
    try {
      const { username, password, displayName, role } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ error: "Username, password, and display name are required" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ error: "Username already exists" });
      }
      const hash = await bcrypt.hash(password, 10);
      const department = req.body.department || "conveyancing";
      const user = await storage.createUser({
        username,
        passwordHash: hash,
        displayName,
        role: role || "assistant",
        department,
        organisationId: getOrgId(req),
      });
      const { passwordHash, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requirePermission("canManageUsers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUserById(id);
      if (!user || user.organisationId !== getOrgId(req)) {
        return res.status(404).json({ error: "User not found" });
      }
      const updates: any = {};
      if (req.body.displayName) updates.displayName = req.body.displayName;
      if (req.body.role) updates.role = req.body.role;
      if (req.body.department) updates.department = req.body.department;
      if (req.body.password) updates.passwordHash = await bcrypt.hash(req.body.password, 10);
      const updated = await storage.updateUser(id, updates);
      if (!updated) return res.status(404).json({ error: "User not found" });
      const { passwordHash, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requirePermission("canManageUsers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUserById(id);
      if (!user || user.organisationId !== getOrgId(req)) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.id === getUserId(req)) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      await storage.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.get("/api/matters/:id/compliance", async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const checks = await storage.getControlChecks(matter.id);
      res.json(checks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch compliance checks" });
    }
  });

  app.post("/api/matters/:id/compliance/:checkId/complete", requirePermission("canCompleteChecks"), async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const checkId = parseInt(req.params.checkId);
      const check = await storage.getControlCheck(checkId);
      if (!check || check.matterId !== matter.id) {
        return res.status(404).json({ error: "Check not found" });
      }
      const updated = await storage.completeControlCheck(checkId, getUserId(req));
      await storage.createAuditLog({
        matterId: matter.id,
        entityType: "compliance",
        entityId: checkId,
        action: "check_completed",
        details: `Compliance check completed: ${check.ruleName}`,
        performedBy: getUsername(req),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete check" });
    }
  });

  app.post("/api/matters/:id/compliance/:checkId/uncomplete", requirePermission("canCompleteChecks"), async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const checkId = parseInt(req.params.checkId);
      const check = await storage.getControlCheck(checkId);
      if (!check || check.matterId !== matter.id) {
        return res.status(404).json({ error: "Check not found" });
      }
      const updated = await storage.uncompleteControlCheck(checkId);
      await storage.createAuditLog({
        matterId: matter.id,
        entityType: "compliance",
        entityId: checkId,
        action: "check_uncompleted",
        details: `Compliance check uncompleted: ${check.ruleName}`,
        performedBy: getUsername(req),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to uncomplete check" });
    }
  });

  app.get("/api/matters/:id/compliance/validate-stage", async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      const result = await storage.validateStageProgression(matter.id, matter.currentStage);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to validate stage" });
    }
  });

  app.get("/api/compliance/summary", async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const summary = await storage.getComplianceSummary(orgId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch compliance summary" });
    }
  });

  app.get("/api/dashboard/compliance-summary", requirePermission("canViewReports"), async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const dashboard = await storage.getComplianceDashboard(orgId);
      res.json(dashboard);
    } catch (error) {
      console.error("Compliance dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch compliance dashboard" });
    }
  });

  app.get("/api/matters/:id/risk-assessment", async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found or access denied" });
      const orgId = getOrgId(req);
      const ra = await storage.getRiskAssessment(matter.id, orgId);
      res.json(ra || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch risk assessment" });
    }
  });

  app.post("/api/matters/:id/risk-assessment", requirePermission("canCompleteChecks"), async (req, res) => {
    try {
      const matter = await verifyMatterAccess(req, parseInt(req.params.id));
      if (!matter) return res.status(404).json({ error: "Matter not found or access denied" });
      const orgId = getOrgId(req);
      const userId = getUserId(req);
      const { formData, overallClientRisk, overallMatterRisk, status } = req.body;
      if (!formData || typeof formData !== "object") return res.status(400).json({ error: "formData must be a valid object" });
      const validStatuses = ["draft", "completed"];
      if (status && !validStatuses.includes(status)) return res.status(400).json({ error: "status must be 'draft' or 'completed'" });
      const validRiskLevels = ["low", "medium", "high"];
      if (overallClientRisk && !validRiskLevels.includes(overallClientRisk)) return res.status(400).json({ error: "overallClientRisk must be 'low', 'medium', or 'high'" });
      if (overallMatterRisk && !validRiskLevels.includes(overallMatterRisk)) return res.status(400).json({ error: "overallMatterRisk must be 'low', 'medium', or 'high'" });
      const ra = await storage.upsertRiskAssessment(matter.id, orgId, {
        formData,
        overallClientRisk,
        overallMatterRisk,
        status,
        updatedBy: userId,
        completedBy: status === "completed" ? userId : undefined,
      });
      await storage.createAuditLog({
        matterId: matter.id,
        action: status === "completed" ? "risk_assessment_completed" : "risk_assessment_updated",
        entityType: "risk_assessment",
        entityId: ra.id,
        details: `Risk assessment ${status === "completed" ? "completed" : "saved as draft"} - Client: ${overallClientRisk || "N/A"}, Matter: ${overallMatterRisk || "N/A"}`,
        performedBy: getUsername(req),
      });
      res.json(ra);
    } catch (error) {
      console.error("Risk assessment save error:", error);
      res.status(500).json({ error: "Failed to save risk assessment" });
    }
  });


  app.get("/api/me/permissions", (req, res) => {
    const role = getUserRole(req);
    res.json({
      role,
      permissions: ROLE_PERMISSIONS[role],
    });
  });

  return httpServer;
}
