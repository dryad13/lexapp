"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Matter } from "@/lib/types";

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [reference, setReference] = useState("");
  const [type, setType] = useState("PURCHASE");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [clientFirst, setClientFirst] = useState("");
  const [clientLast, setClientLast] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  async function load() {
    try {
      const data = await apiFetch("/api/v1/matters");
      setMatters(data);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function createMatter() {
    setErr("");
    if (!reference.trim() || !clientFirst.trim() || !clientLast.trim()) {
      setErr("Reference, first name and last name are required.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/v1/matters", {
        method: "POST",
        body: JSON.stringify({
          reference: reference.trim(),
          type,
          property_address: propertyAddress.trim() || null,
          client: {
            first_name: clientFirst.trim(),
            last_name: clientLast.trim(),
            email: clientEmail.trim() || null,
          }
        })
      });
      setReference("");
      setPropertyAddress("");
      setClientFirst("");
      setClientLast("");
      setClientEmail("");
      setType("PURCHASE");
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <h2>Matters</h2>
          <p style={{ margin: 0 }}>Open files, onboarding status and post-completion work.</p>
        </div>
        <button className="btn" onClick={() => setShowCreate(v => !v)}>
          {showCreate ? "Cancel" : "New matter"}
        </button>
      </div>

      {showCreate && (
        <div className="card">
          <h3>New matter</h3>
          <div className="row cols-3" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Reference</label>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. DEM-0002" />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option>PURCHASE</option>
                <option>SALE</option>
                <option>REMORTGAGE</option>
                <option>TRANSFER</option>
              </select>
            </div>
            <div className="field">
              <label>Property address</label>
              <input value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} placeholder="Optional" />
            </div>
            <div className="field">
              <label>Client email</label>
              <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Optional" />
            </div>
            <div className="field">
              <label>First name</label>
              <input value={clientFirst} onChange={e => setClientFirst(e.target.value)} />
            </div>
            <div className="field">
              <label>Last name</label>
              <input value={clientLast} onChange={e => setClientLast(e.target.value)} />
            </div>
          </div>
          <div className="actions" style={{ marginTop: 14 }}>
            <button className="btn" onClick={createMatter} disabled={busy}>{busy ? "Creating…" : "Create matter"}</button>
          </div>
        </div>
      )}

      {err && <div className="msg error">{err}</div>}

      <div className="card table-wrap" style={{ padding: 8 }}>
        {matters.length === 0 ? (
          <div className="empty">No matters yet. Create one to get started.</div>
        ) : (
          <table className="matters">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Type</th>
                <th>Status</th>
                <th>Property</th>
              </tr>
            </thead>
            <tbody>
              {matters.map(m => (
                <tr key={m.id}>
                  <td><Link className="ref" href={`/matters/${m.id}`}>{m.reference}</Link></td>
                  <td><span className="pill gold">{m.type}</span></td>
                  <td><span className="pill">{m.status}</span></td>
                  <td className="muted">{m.property_address || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
