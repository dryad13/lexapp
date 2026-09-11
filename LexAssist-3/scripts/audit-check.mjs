#!/usr/bin/env node
/**
 * G8 supply-chain gate: fail on high/critical unless allowlisted by id or package name.
 * Writes pnpm audit JSON to a temp file to avoid truncated stdout / dual streams.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowPath = path.join(root, "audit-allowlist.json");
const allow = fs.existsSync(allowPath)
  ? JSON.parse(fs.readFileSync(allowPath, "utf8"))
  : { advisories: [], packages: [] };
const allowedIds = new Set((allow.advisories || []).map(String));
const allowedPkgs = new Set((allow.packages || []).map(String));

const outFile = path.join(os.tmpdir(), `lexassist-audit-${process.pid}.json`);
const result = spawnSync(
  "pnpm",
  ["audit", "--json", "--audit-level", "high"],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024,
    env: { ...process.env, npm_config_json: "true" },
  },
);

const raw = `${result.stdout || ""}`;
fs.writeFileSync(outFile, raw);

function extractJson(text) {
  // Prefer last complete top-level object
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const report = extractJson(raw);
if (!report) {
  console.error("Could not parse pnpm audit JSON. See", outFile);
  process.exit(1);
}

/** @type {{ id: string, name: string, severity: string }[]} */
const findings = [];

if (report.advisories && typeof report.advisories === "object") {
  for (const a of Object.values(report.advisories)) {
    findings.push({
      id: String(a.github_advisory_id || a.id || ""),
      name: String(a.module_name || a.name || ""),
      severity: String(a.severity || "").toLowerCase(),
    });
  }
}

if (report.vulnerabilities && typeof report.vulnerabilities === "object") {
  for (const [name, v] of Object.entries(report.vulnerabilities)) {
    const sev = String(v.severity || "").toLowerCase();
    const via = Array.isArray(v.via) ? v.via : [];
    for (const item of via) {
      if (typeof item === "object" && item) {
        findings.push({
          id: String(item.source ?? item.url ?? name),
          name: String(item.name || name),
          severity: String(item.severity || sev).toLowerCase(),
        });
      }
    }
    if (!via.length) findings.push({ id: name, name, severity: sev });
  }
}

const blocking = findings.filter((a) => {
  if (a.severity !== "high" && a.severity !== "critical") return false;
  if (allowedIds.has(a.id) || allowedPkgs.has(a.name)) return false;
  // GHSA urls sometimes appear as ids
  for (const id of allowedIds) {
    if (a.id.includes(id)) return false;
  }
  return true;
});

if (blocking.length) {
  const unique = new Map();
  for (const a of blocking) unique.set(`${a.name}:${a.severity}:${a.id}`, a);
  console.error(`G8 audit: ${unique.size} high/critical not allowlisted:`);
  for (const a of unique.values()) {
    console.error(` - ${a.name} [${a.severity}] id=${a.id}`);
  }
  console.error(`Reviewed allowlist: ${allowPath}`);
  try {
    fs.unlinkSync(outFile);
  } catch {
    /* ignore */
  }
  process.exit(1);
}

console.log("G8 audit: no blocking high/critical vulnerabilities");
try {
  fs.unlinkSync(outFile);
} catch {
  /* ignore */
}
process.exit(0);
