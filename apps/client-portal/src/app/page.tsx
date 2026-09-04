"use client";

import { useState } from "react";

export default function Home() {
  const [token, setToken] = useState("");

  return (
    <div className="card" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h2>Open your onboarding pack</h2>
      <p>
        Your solicitor sent a secure link. If you only have the code, paste it here.
      </p>
      <div className="field">
        <label htmlFor="token">Onboarding token</label>
        <input
          id="token"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Paste token"
          autoComplete="off"
        />
      </div>
      <button
        className="btn"
        style={{ marginTop: 14 }}
        disabled={!token.trim()}
        onClick={() => { location.href = `/o/${encodeURIComponent(token.trim())}`; }}
      >
        Continue
      </button>
    </div>
  );
}
