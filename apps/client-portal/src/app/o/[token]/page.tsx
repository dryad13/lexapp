"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { apiFetch, getProgress, saveProgress, uploadDoc } from "@/lib/api";
import type { OnboardingProgress } from "@/lib/types";

const PACK_STEPS = [
  { key: "personal", label: "Personal details", missing: "Personal details" },
  { key: "addresses", label: "Address history", missing: "Address history" },
  { key: "id", label: "Photo ID", missing: "Document: ID" },
  { key: "selfie", label: "Selfie", missing: "Document: SELFIE" },
  { key: "poa", label: "Proof of address", missing: "Document: POA" },
  { key: "sof", label: "Source of funds", missing: "Source of funds" },
  { key: "consents", label: "Consents", missing: "Consents" },
] as const;

function StatusPill({ done }: { done: boolean }) {
  return <span className={`pill ${done ? "done" : "todo"}`}>{done ? "Done" : "To do"}</span>;
}

export default function Onboarding({ params }: { params: { token: string } }) {
  const token = params.token;
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [msg, setMsg] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");

  const [addresses, setAddresses] = useState<any[]>([{ line1: "", city: "", from: "", to: "" }]);

  const [sof, setSof] = useState({ source: "savings", details: "" });
  const [consents, setConsents] = useState({ agree: false, typed_name: "" });

  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [poaFile, setPoaFile] = useState<File | null>(null);

  const [amountPounds, setAmountPounds] = useState(500);

  const doneCount = useMemo(() => {
    if (!progress) return 0;
    if (progress.is_complete) return PACK_STEPS.length;
    const missing = new Set(progress.missing);
    return PACK_STEPS.filter(s => !missing.has(s.missing)).length;
  }, [progress]);

  function isDone(missingLabel: string) {
    if (!progress) return false;
    if (progress.is_complete) return true;
    return !progress.missing.includes(missingLabel);
  }

  async function load() {
    setMsg("Loading…");
    try {
      const p = await getProgress(token);
      setProgress(p);
      setFirstName(p.personal_details?.first_name || "");
      setLastName(p.personal_details?.last_name || "");
      setDob(p.personal_details?.dob || "");
      setAddresses(p.address_history?.length ? p.address_history : [{ line1: "", city: "", from: "", to: "" }]);
      setSof(p.sof || { source: "savings", details: "" });
      setConsents(p.consents || { agree: false, typed_name: "" });
      setMsg("");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function save(step: string) {
    setMsg(`Saving ${step}…`);
    try {
      const payload: any = {};
      if (step === "personal") payload.personal_details = { first_name: firstName, last_name: lastName, dob };
      if (step === "addresses") payload.address_history = addresses;
      if (step === "sof") payload.sof = sof;
      if (step === "consents") payload.consents = consents;
      const p = await saveProgress(token, payload);
      setProgress(p);
      setMsg("Saved.");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function uploadAll() {
    setMsg("Uploading…");
    try {
      if (idFile) await uploadDoc(token, "ID", idFile);
      if (selfieFile) await uploadDoc(token, "SELFIE", selfieFile);
      if (poaFile) await uploadDoc(token, "POA", poaFile);
      await load();
      setMsg("Uploaded.");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function pay() {
    setMsg("Creating payment…");
    try {
      const amount_pence = Math.round(Number(amountPounds) * 100);
      if (!Number.isFinite(amount_pence) || amount_pence <= 0) {
        throw new Error("Enter a valid amount in pounds");
      }
      const pi = await apiFetch(`/api/v1/stripe/client/${token}/payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_pence, currency: "gbp" })
      });

      const stripe = await loadStripe(pi.publishable_key);
      if (!stripe) throw new Error("Stripe failed to load");

      const res = await stripe.confirmPayment({
        clientSecret: pi.client_secret,
        confirmParams: {
          return_url: `${location.origin}/o/${token}`
        }
      });

      if (res.error) throw new Error(res.error.message || "Payment failed");
      setMsg("Payment processing.");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (!progress) {
    return (
      <div className="card">
        <h2>Your onboarding</h2>
        <p>{msg || "Loading your pack…"}</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="progress-sticky">
        <div className="progress-meta">
          <strong>Your onboarding</strong>
          <span className="muted">{doneCount} of {PACK_STEPS.length} done · {progress.percent}%</span>
        </div>
        <div className="progress"><span style={{ width: `${progress.percent}%` }} /></div>
        {progress.is_complete ? (
          <p className="msg ok" style={{ marginTop: 10, marginBottom: 0 }}>This pack is complete.</p>
        ) : (
          <ul className="checklist">
            {PACK_STEPS.map(s => (
              <li key={s.key}>
                <span>{s.label}</span>
                <StatusPill done={isDone(s.missing)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="step">
          <h3>1. Personal details</h3>
          <StatusPill done={isDone("Personal details")} />
        </div>
        <div className="row cols-2" style={{ marginTop: 12 }}>
          <div className="field">
            <label>First name</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div className="field">
            <label>Last name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
          <div className="field">
            <label>Date of birth</label>
            <input value={dob} onChange={e => setDob(e.target.value)} placeholder="YYYY-MM-DD" />
          </div>
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={() => save("personal")}>Save</button>
      </div>

      <div className="card">
        <div className="step">
          <h3>2. Address history (3 years)</h3>
          <StatusPill done={isDone("Address history")} />
        </div>
        {addresses.map((a, idx) => (
          <div className="row cols-2" key={idx} style={{ margin: "12px 0" }}>
            <div className="field">
              <label>Address line 1</label>
              <input value={a.line1} onChange={e => {
                const copy = [...addresses]; copy[idx].line1 = e.target.value; setAddresses(copy);
              }} />
            </div>
            <div className="field">
              <label>City</label>
              <input value={a.city} onChange={e => {
                const copy = [...addresses]; copy[idx].city = e.target.value; setAddresses(copy);
              }} />
            </div>
            <div className="field">
              <label>From</label>
              <input value={a.from} onChange={e => {
                const copy = [...addresses]; copy[idx].from = e.target.value; setAddresses(copy);
              }} placeholder="YYYY-MM" />
            </div>
            <div className="field">
              <label>To</label>
              <input value={a.to} onChange={e => {
                const copy = [...addresses]; copy[idx].to = e.target.value; setAddresses(copy);
              }} placeholder="YYYY-MM or present" />
            </div>
          </div>
        ))}
        <div className="actions">
          <button className="btn secondary" onClick={() => setAddresses([...addresses, { line1: "", city: "", from: "", to: "" }])}>Add address</button>
          <button className="btn" onClick={() => save("addresses")}>Save</button>
        </div>
      </div>

      <div className="card">
        <div className="step">
          <h3>3. Identity documents</h3>
          <div className="actions">
            <StatusPill done={isDone("Document: ID")} />
            <StatusPill done={isDone("Document: SELFIE")} />
            <StatusPill done={isDone("Document: POA")} />
          </div>
        </div>
        <p className="tiny" style={{ marginTop: 4 }}>Needed: photo ID, selfie, proof of address</p>
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="file-row">Photo ID (passport or driving licence)
            <input type="file" accept="image/*,application/pdf" onChange={e => setIdFile(e.target.files?.[0] || null)} />
          </label>
          <label className="file-row">Selfie
            <input type="file" accept="image/*" onChange={e => setSelfieFile(e.target.files?.[0] || null)} />
          </label>
          <label className="file-row">Proof of address
            <input type="file" accept="image/*,application/pdf" onChange={e => setPoaFile(e.target.files?.[0] || null)} />
          </label>
          <button className="btn" onClick={uploadAll}>Upload</button>
        </div>
      </div>

      <div className="card">
        <div className="step">
          <h3>4. Source of funds</h3>
          <StatusPill done={isDone("Source of funds")} />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Source</label>
          <select value={sof.source} onChange={e => setSof({ ...sof, source: e.target.value })}>
            <option value="savings">Savings</option>
            <option value="gift">Gift</option>
            <option value="sale_proceeds">Sale proceeds</option>
            <option value="inheritance">Inheritance</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Details</label>
          <textarea value={sof.details} onChange={e => setSof({ ...sof, details: e.target.value })} placeholder="Brief explanation" />
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={() => save("sof")}>Save</button>
      </div>

      <div className="card">
        <div className="step">
          <h3>5. Consents</h3>
          <StatusPill done={isDone("Consents")} />
        </div>
        <label className="file-row" style={{ marginTop: 12 }}>
          <span>
            <input type="checkbox" checked={consents.agree} onChange={e => setConsents({ ...consents, agree: e.target.checked })} />
            {" "}I confirm the information is true and I consent to identity and source-of-funds checks.
          </span>
        </label>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Type your full name</label>
          <input value={consents.typed_name} onChange={e => setConsents({ ...consents, typed_name: e.target.value })} />
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={() => save("consents")}>Save</button>
      </div>

      <div className="card">
        <div className="step">
          <h3>6. Money on account</h3>
          <span className="pill todo">Optional</span>
        </div>
        <p className="tiny" style={{ marginTop: 4 }}>
          Not required to complete the pack. Default £{Number(amountPounds || 0).toFixed(2)} on account.
        </p>
        <div className="field" style={{ marginTop: 12, maxWidth: 240 }}>
          <label>Amount (£)</label>
          <input
            type="number"
            min={1}
            step={1}
            value={amountPounds}
            onChange={e => setAmountPounds(parseFloat(e.target.value || "0"))}
          />
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={pay}>Pay with Stripe</button>
      </div>

      {msg && <div className={`msg ${/fail|error|invalid|401|404|410|415|413/i.test(msg) ? "error" : ""}`}>{msg}</div>}
    </div>
  );
}
