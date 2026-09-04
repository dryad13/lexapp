"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth";

function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v18M5 8h14M7 8c0 5 2.2 8 5 8s5-3 5-8" stroke="#F5F0E6" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/login") return <>{children}</>;

  return (
    <>
      <header className="topbar">
        <Link href="/matters" className="brand">
          <span className="brand-mark"><Mark /></span>
          <span>
            <div className="brand-name">LexAssist</div>
            <div className="brand-sub">Firm portal</div>
          </span>
        </Link>
        <nav className="nav">
          <Link className={path.startsWith("/matters") ? "active" : ""} href="/matters">Matters</Link>
          <button className="linkish" onClick={() => { logout(); location.href = "/login"; }}>Sign out</button>
        </nav>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
