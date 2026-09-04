"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { MatterDashboard } from "@/lib/types";

export default function MatterDetail({ params }: { params: { id: string } }) {
  const id = params.id;
  const [dash, setDash] = useState<MatterDashboard | null>(null);
  const [err, setErr] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [emailQueued, setEmailQueued] = useState(false);

  async function load() {
    setErr("");
    try {
      const d = await apiFetch(`/api/v1/matters/${id}`);
      setDash(d);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function createOnboarding() {
    setErr("");
    setEmailQueued(false);
    try {
      const r = await apiFetch(`/api/v1/onboarding/matters/${id}/request`, { method: "POST" });
      setLink(r.link);
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function sendEmail() {
    setErr("");
    try {
      await apiFetch(`/api/v1/onboarding/matters/${id}/send-email`, { method: "POST" });
      setEmailQueued(true);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function copyLink() {
    if (!link.startsWith("http")) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Could not copy — select the link and copy manually.");
    }
  }

  async function updateTask(taskId: string, patch: any) {
    setErr("");
    try {
      await apiFetch(`/api/v1/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  const pdfUrl = useMemo(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
    return `${API_BASE}/api/v1/reports/matters/${id}/post-completion.pdf`;
  }, [id]);

  const nextAction = useMemo(() => {
    if (!dash) return null;
    if (!link) {
      return {
        title: "Next",
        body: "Create a client link so they can complete onboarding.",
      };
    }
    if (!dash.onboarding.is_complete) {
      const waiting = dash.onboarding.missing.length
        ? `Waiting on: ${dash.onboarding.missing.join(" · ")}`
        : "Waiting for the client to finish the pack.";
      return {
        title: "Next",
        body: `Send this link to the client. ${waiting}`,
      };
    }
    return {
      title: "Next",
      body: "Pack complete. Update post-completion tasks below.",
    };
  }, [dash, link]);

  useEffect(() => { load(); }, []);

  if (!dash) {
    return (
      <div>
        <p className="muted">Loading matter…</p>
        {err && <div className="msg error">{err}</div>}
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        <Link className="tiny" href="/matters">← All matters</Link>
        <div className="toolbar" style={{ marginTop: 8, marginBottom: 8 }}>
          <div>
            <h2>{dash.matter.reference}</h2>
            <p style={{ margin: 0 }}>{dash.matter.property_address || "No property address"}</p>
          </div>
          <div className="actions">
            <span className="pill gold">{dash.matter.type}</span>
            <span className="pill">{dash.matter.status}</span>
          </div>
        </div>
        <div className="muted" style={{ marginBottom: 8 }}>Onboarding {dash.onboarding.percent}%</div>
        <div className="progress"><span style={{ width: `${dash.onboarding.percent}%` }} /></div>
        {dash.onboarding.missing.length > 0 && (
          <p className="tiny" style={{ marginTop: 10 }}>Still needed: {dash.onboarding.missing.join(" · ")}</p>
        )}
      </div>

      {nextAction && (
        <div className="next-banner">
          <div>
            <strong>{nextAction.title}</strong>
            <p>{nextAction.body}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="section-head">
          <h3>Onboarding link</h3>
        </div>
        {!link ? (
          <div className="actions">
            <button className="btn" onClick={createOnboarding}>Create link</button>
            <button className="btn secondary" onClick={sendEmail} disabled title="Create a link first">
              Send email
            </button>
          </div>
        ) : (
          <>
            <div className="copy-row">
              <input readOnly value={link} aria-label="Client onboarding link" />
              <button className="btn" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn secondary" onClick={createOnboarding}>Create new link</button>
              <button className="btn secondary" onClick={sendEmail}>Send email</button>
            </div>
            <p className="tiny" style={{ marginTop: 10 }}>
              Email prints to API worker logs in this MVP — prefer Copy link for demos.
              {emailQueued ? " Email queued." : ""}
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h3>Documents</h3>
        {dash.documents.length === 0 ? (
          <div className="empty">No documents uploaded yet.</div>
        ) : (
          <ul>
            {dash.documents.map(d => (
              <li key={d.id}>
                <span className="pill">{d.category}</span>{" "}
                <a href={(process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000") + d.download_url} target="_blank" rel="noreferrer">
                  {d.original_filename}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Payments</h3>
        {dash.payments.length === 0 ? (
          <div className="empty">No payments yet.</div>
        ) : (
          <ul>
            {dash.payments.map(p => (
              <li key={p.id}>
                £{(p.amount_pence / 100).toFixed(2)} {p.currency.toUpperCase()} — {p.status}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Post-completion tasks</h3>
        <div className="stack" style={{ marginTop: 12 }}>
          {dash.tasks.map(t => (
            <div className="task" key={t.id}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <strong>{t.title}</strong>
                <span className={`pill ${t.status === "COMPLETED" ? "" : "gold"}`}>{t.status}</span>
              </div>
              <div className="tiny">Due: {t.due_date ? new Date(t.due_date).toLocaleDateString("en-GB") : "n/a"}{t.notes ? ` · ${t.notes}` : ""}</div>
              <div className="actions">
                {t.status === "PENDING" && (
                  <button className="btn secondary" onClick={() => updateTask(t.id, { status: "IN_PROGRESS" })}>In progress</button>
                )}
                {t.status !== "COMPLETED" && (
                  <button className="btn" onClick={() => updateTask(t.id, { status: "COMPLETED" })}>Complete</button>
                )}
                <button className="btn ghost" onClick={() => {
                  const notes = prompt("Notes", t.notes || "") ?? t.notes;
                  updateTask(t.id, { notes });
                }}>Notes</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Reports</h3>
        <a className="btn secondary" href={pdfUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
          Download post-completion PDF
        </a>
      </div>

      {err && <div className="msg error">{err}</div>}
    </div>
  );
}
