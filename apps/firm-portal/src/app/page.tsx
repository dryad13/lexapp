"use client";

import { useEffect } from "react";
import { getAccessToken } from "@/lib/auth";

export default function Home() {
  useEffect(() => {
    location.href = getAccessToken() ? "/matters" : "/login";
  }, []);
  return <p className="muted">Opening your workspace…</p>;
}
