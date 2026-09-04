"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function ApiTest() {
  const [out, setOut] = useState("");

  async function run() {
    try {
      const h = await apiFetch("/health");
      setOut(JSON.stringify(h, null, 2));
    } catch (e: any) {
      setOut(e.message);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h2>API health</h2>
      <p>Checks that the backend is reachable from this portal.</p>
      <button className="btn" onClick={run}>Call /health</button>
      {out && <pre className="msg">{out}</pre>}
    </div>
  );
}
