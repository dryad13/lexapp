import { Queue, Worker, QueueEvents, type Job } from "bullmq";
import crypto from "crypto";
import { redis, redisReady, bullmqConnection } from "./redis";
import { withRlsBypass } from "./db";
import { storage } from "./storage";
import { buildJournalPdf, buildMatterPdf } from "./pdf-render";

const testEager = () => process.env.APP_ENV === "test";
const attempts = 3;
const backoff = { type: "exponential" as const, delay: testEager() ? 50 : 2000 };

export type PdfJobData = {
  kind: "journal" | "matter";
  userId: number;
  organisationId: number;
  username: string;
  scope?: string;
  entryId?: number;
  from?: string;
  to?: string;
  matterId?: number;
};

type MemoryJob = {
  id: string;
  queueName: "pdf" | "billing";
  data: any;
  state: "waiting" | "active" | "completed" | "failed";
  failedReason?: string;
};

const memoryJobs = new Map<string, MemoryJob>();
const memoryPdf = new Map<string, { buffer: string; filename: string }>();

let billingQueue: Queue | null = null;
let pdfQueueImpl: Queue | null = null;
let billingEvents: QueueEvents | null = null;
let pdfEvents: QueueEvents | null = null;
let billingWorker: Worker | null = null;
let pdfWorker: Worker | null = null;

function pdfResultKey(jobId: string) {
  return `pdf:result:${jobId}`;
}

function fakeJob(row: MemoryJob): Job {
  return {
    id: row.id,
    data: row.data,
    queueName: row.queueName,
    failedReason: row.failedReason,
    getState: async () => row.state,
  } as unknown as Job;
}

export const pdfQueue = {
  async getJob(id: string): Promise<Job | undefined> {
    if (redisReady && pdfQueueImpl) {
      const job = await pdfQueueImpl.getJob(id);
      return job || undefined;
    }
    const row = memoryJobs.get(id);
    return row ? fakeJob(row) : undefined;
  },
};

export async function enqueueBillingEvent(eventId: string, event?: import("stripe").Stripe.Event) {
  if (redisReady && billingQueue) {
    return billingQueue.add("process-stripe-event", { eventId, event }, { jobId: eventId });
  }
  const { processStripeEvent } = await import("./stripe-billing");
  const row: MemoryJob = { id: eventId, queueName: "billing", data: { eventId }, state: "active" };
  memoryJobs.set(eventId, row);
  try {
    await processStripeEvent(eventId, attempts - 1, attempts, event);
    row.state = "completed";
  } catch (err: any) {
    row.state = "failed";
    row.failedReason = err?.message || String(err);
  }
  return fakeJob(row);
}

export async function enqueuePdfJob(data: PdfJobData) {
  if (redisReady && pdfQueueImpl) {
    return pdfQueueImpl.add("render-pdf", data);
  }
  const id = crypto.randomBytes(16).toString("hex");
  const row: MemoryJob = { id, queueName: "pdf", data, state: "active" };
  memoryJobs.set(id, row);
  try {
    await withRlsBypass(async () => {
      await processPdfJob({ id, data } as Job<PdfJobData>);
    });
    row.state = "completed";
  } catch (err: any) {
    row.state = "failed";
    row.failedReason = err?.message || String(err);
  }
  return fakeJob(row);
}

export async function waitForTestJob(job: Job | undefined | null) {
  if (!job || !testEager()) return;
  if (!redisReady) return;
  const events = job.queueName === "pdf" ? pdfEvents : billingEvents;
  if (!events) return;
  try {
    await job.waitUntilFinished(events, 20_000);
  } catch {
    /* job may fail after retries; tests assert DB/HTTP status */
  }
}

export async function getPdfResult(jobId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  if (redisReady) {
    const raw = await redis.get(pdfResultKey(jobId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { buffer: string; filename: string };
    return { buffer: Buffer.from(parsed.buffer, "base64"), filename: parsed.filename };
  }
  const parsed = memoryPdf.get(jobId);
  if (!parsed) return null;
  return { buffer: Buffer.from(parsed.buffer, "base64"), filename: parsed.filename };
}

async function storePdfResult(jobId: string, result: { buffer: Buffer; filename: string }) {
  const payload = JSON.stringify({ buffer: result.buffer.toString("base64"), filename: result.filename });
  if (redisReady) {
    await redis.set(pdfResultKey(jobId), payload, "EX", 600);
    return;
  }
  memoryPdf.set(jobId, { buffer: result.buffer.toString("base64"), filename: result.filename });
}

async function processPdfJob(job: Job<PdfJobData>) {
  const data = job.data;
  let result: { buffer: Buffer; filename: string };

  if (data.kind === "matter") {
    if (!data.matterId) throw new Error("matterId required");
    const matter = await storage.getMatter(data.matterId);
    if (!matter || matter.organisationId !== data.organisationId) {
      throw new Error("Matter not found");
    }
    result = await buildMatterPdf({
      title: matter.title,
      clientName: matter.clientName,
      propertyAddress: matter.propertyAddress,
      type: matter.type,
    });
  } else {
    const scope = data.scope || "range";
    if (scope === "single") {
      const id = data.entryId!;
      const entry = await storage.getJournalEntry(id, data.userId);
      if (!entry) throw new Error("Not found");
      result = await buildJournalPdf({
        username: data.username,
        label: "Single Entry",
        entries: [entry],
        filename: `journal-entry-${id}.pdf`,
      });
    } else {
      const fmtUK = (d: Date) =>
        `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
      let from: Date;
      let to: Date;
      let label: string;
      let filename: string;
      if (scope === "week") {
        const weekStart = new Date(String(data.from));
        from = weekStart;
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        to = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        label = `${fmtUK(from)} to ${fmtUK(weekEnd)}`;
        filename = `Journal Entry - ${label}.pdf`;
      } else {
        from = new Date(String(data.from));
        to = new Date(String(data.to));
        to.setHours(23, 59, 59, 999);
        label = `${fmtUK(from)} to ${fmtUK(to)}`;
        filename = `Journal Entry - ${label}.pdf`;
      }
      const entries = await storage.getJournalEntriesInRange(data.userId, from, to);
      result = await buildJournalPdf({
        username: data.username,
        label,
        entries,
        filename,
      });
    }
  }

  await storePdfResult(String(job.id), result);
}

export async function startQueueWorkers(role?: string) {
  if (!redisReady) return;
  const connection = bullmqConnection();
  const runBilling = !role || role === "billing";
  const runPdf = !role || role === "pdf";

  if (!billingQueue) {
    billingQueue = new Queue("billing", {
      connection,
      defaultJobOptions: { attempts, backoff, removeOnComplete: 1000, removeOnFail: 1000 },
    });
    billingEvents = new QueueEvents("billing", { connection });
  }
  if (!pdfQueueImpl) {
    pdfQueueImpl = new Queue("pdf", {
      connection,
      defaultJobOptions: { attempts, backoff, removeOnComplete: 1000, removeOnFail: 1000 },
    });
    pdfEvents = new QueueEvents("pdf", { connection });
  }

  if (runBilling && !billingWorker) {
    const { processStripeEvent } = await import("./stripe-billing");
    billingWorker = new Worker(
      "billing",
      async (job) => {
        await withRlsBypass(async () => {
          await processStripeEvent(
            job.data.eventId,
            job.attemptsMade,
            job.opts.attempts || attempts,
            job.data.event,
          );
        });
      },
      { connection },
    );
    billingWorker.on("failed", (job, err) => {
      console.error("Billing job failed:", job?.id, err?.message);
    });
  }

  if (runPdf && !pdfWorker) {
    pdfWorker = new Worker(
      "pdf",
      async (job) => {
        await withRlsBypass(async () => {
          await processPdfJob(job as Job<PdfJobData>);
        });
      },
      { connection },
    );
    pdfWorker.on("failed", (job, err) => {
      console.error("PDF job failed:", job?.id, err?.message);
    });
  }
}

export async function stopQueueWorkers() {
  await Promise.all([
    billingWorker?.close(),
    pdfWorker?.close(),
    billingQueue?.close(),
    pdfQueueImpl?.close(),
    billingEvents?.close(),
    pdfEvents?.close(),
  ]);
  billingWorker = null;
  pdfWorker = null;
}
