"use client";

import { useState } from "react";
import { login } from "@/lib/api";
import { setTokens } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@demo-firm.co.uk");
  const [password, setPassword] = useState("Password123!");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("Signing in…");
    try {
      const data = await login(email, password);
      setTokens(data.access_token, data.refresh_token);
      setMsg("Welcome back.");
      location.href = "/matters";
    } catch (err: any) {
      setMsg(err.message || "Could not sign in");
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="brand-mark" style={{ margin: "0 auto 12px", width: 52, height: 52 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v18M5 8h14M7 8c0 5 2.2 8 5 8s5-3 5-8" stroke="#F5F0E6" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
        </div>
        <h1>LexAssist</h1>
        <p className="tiny" style={{ marginTop: -4 }}>UK legal onboarding</p>
        <p>Sign in to manage matters, onboarding and post-completion work.</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" />
          </div>
          <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 4 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {msg && <div className={`msg ${msg.includes("Could") || msg.includes("Failed") || msg.startsWith("4") || msg.startsWith("5") ? "error" : ""}`}>{msg}</div>}
      </div>
    </div>
  );
}
