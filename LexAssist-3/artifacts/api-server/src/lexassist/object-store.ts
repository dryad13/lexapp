import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";

export type StoredObject = {
  /** Relative key used in DB (e.g. org-1/documents/...) */
  key: string;
  /** Absolute local path when using disk; empty when S3 */
  localPath: string;
};

function uploadsRoot(): string {
  return path.resolve(process.cwd(), "uploads");
}

export function orgPrefix(organisationId: number): string {
  return `org-${organisationId}`;
}

export function buildObjectKey(organisationId: number, category: "documents" | "knowledge", filename: string): string {
  return `${orgPrefix(organisationId)}/${category}/${filename}`;
}

function useS3(): boolean {
  return !!(process.env.S3_BUCKET && process.env.S3_BUCKET.trim());
}

/** Ensure local org directory exists; returns absolute destination path for multer. */
export function ensureLocalOrgDir(organisationId: number, category: "documents" | "knowledge"): string {
  const dir = path.join(uploadsRoot(), orgPrefix(organisationId), category);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function putObject(
  organisationId: number,
  category: "documents" | "knowledge",
  filename: string,
  body: Buffer,
  contentType?: string,
): Promise<StoredObject> {
  const key = buildObjectKey(organisationId, category, filename);
  if (useS3()) {
    await s3Put(key, body, contentType || "application/octet-stream");
    return { key, localPath: "" };
  }
  const abs = path.join(uploadsRoot(), key);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return { key, localPath: abs };
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  assertSafeKey(key);
  if (useS3()) {
    return s3Get(key);
  }
  const abs = path.join(uploadsRoot(), key);
  return fs.readFileSync(abs);
}

export function resolveLocalPath(keyOrPath: string): string {
  if (keyOrPath.startsWith("/") || keyOrPath.includes("uploads")) {
    return keyOrPath;
  }
  return path.join(uploadsRoot(), keyOrPath);
}

export function assertKeyBelongsToOrg(key: string, organisationId: number): boolean {
  return key.startsWith(`${orgPrefix(organisationId)}/`);
}

function assertSafeKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new Error("Invalid object key");
  }
}

/* Minimal S3 Put/Get with SigV4 (no AWS SDK dependency). */
async function s3Put(key: string, body: Buffer, contentType: string): Promise<void> {
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.S3_REGION || "us-east-1";
  const endpoint = process.env.S3_ENDPOINT; // optional custom endpoint
  const host = endpoint
    ? new URL(endpoint).host
    : `${bucket}.s3.${region}.amazonaws.com`;
  const urlPath = endpoint ? `/${bucket}/${key}` : `/${key}`;
  const url = endpoint
    ? `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`
    : `https://${host}/${key}`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
  const headers: Record<string, string> = {
    host,
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const authorization = signAwsV4({
    method: "PUT",
    path: urlPath,
    headers,
    payloadHash,
    region,
    service: "s3",
    amzDate,
    dateStamp,
  });
  headers.authorization = authorization;

  const res = await fetch(url, { method: "PUT", headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`S3 put failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

async function s3Get(key: string): Promise<Buffer> {
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.S3_REGION || "us-east-1";
  const endpoint = process.env.S3_ENDPOINT;
  const host = endpoint
    ? new URL(endpoint).host
    : `${bucket}.s3.${region}.amazonaws.com`;
  const urlPath = endpoint ? `/${bucket}/${key}` : `/${key}`;
  const url = endpoint
    ? `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`
    : `https://${host}/${key}`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash("sha256").update("").digest("hex");
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  headers.authorization = signAwsV4({
    method: "GET",
    path: urlPath,
    headers,
    payloadHash,
    region,
    service: "s3",
    amzDate,
    dateStamp,
  });

  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`S3 get failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function signAwsV4(opts: {
  method: string;
  path: string;
  headers: Record<string, string>;
  payloadHash: string;
  region: string;
  service: string;
  amzDate: string;
  dateStamp: string;
}): string {
  const accessKey = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) {
    throw new Error("S3_BUCKET is set but AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are missing");
  }

  const signedHeaderKeys = Object.keys(opts.headers)
    .map((k) => k.toLowerCase())
    .sort();
  const canonicalHeaders = signedHeaderKeys
    .map((k) => `${k}:${opts.headers[Object.keys(opts.headers).find((h) => h.toLowerCase() === k)!].trim()}\n`)
    .join("");
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalRequest = [
    opts.method,
    opts.path,
    "",
    canonicalHeaders,
    signedHeaders,
    opts.payloadHash,
  ].join("\n");

  const credentialScope = `${opts.dateStamp}/${opts.region}/${opts.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    opts.amzDate,
    credentialScope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const kDate = crypto.createHmac("sha256", `AWS4${secretKey}`).update(opts.dateStamp).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(opts.region).digest();
  const kService = crypto.createHmac("sha256", kRegion).update(opts.service).digest();
  const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
