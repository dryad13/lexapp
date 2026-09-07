import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogIn, Scale } from "lucide-react";

export default function Landing() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#F5F0E6" }}
      data-testid="page-landing"
    >
      {/* ── Top bar ── */}
      <nav className="flex items-center justify-between px-8 py-5" style={{ borderBottom: "1px solid rgba(27,77,62,0.12)" }}>
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "#1B4D3E" }}
          >
            <Scale className="h-4 w-4 text-white" />
          </div>
          <span
            className="font-bold tracking-wide"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1B4D3E", fontSize: "18px" }}
          >
            LexAssist
          </span>
        </div>
        <Link href="/login">
          <Button
            variant="outline"
            size="sm"
            style={{
              borderColor: "rgba(27,77,62,0.35)",
              color: "#1B4D3E",
              backgroundColor: "transparent",
            }}
            className="hover:bg-primary/5"
            data-testid="button-nav-login"
          >
            <LogIn className="h-3.5 w-3.5 mr-1.5" />
            Sign In
          </Button>
        </Link>
      </nav>

      {/* ── Hero ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24">
        {/* Logo medallion */}
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full mb-8 shadow-lg"
          style={{ background: "#1B4D3E" }}
        >
          <Scale className="h-9 w-9 text-white" />
        </div>

        {/* Client firm name */}
        <h1
          className="mb-3 font-bold tracking-widest"
          style={{
            fontFamily: "Cochin, 'Cochin LT Std', 'Times New Roman', Georgia, serif",
            fontSize: "26pt",
            color: "#1B4D3E",
            letterSpacing: "0.18em",
          }}
          data-testid="text-company-name"
        >
          LexAssist
        </h1>

        {/* Tagline */}
        <p
          className="mt-8 mb-10 max-w-md leading-relaxed"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "15px",
            color: "rgba(27,77,62,0.60)",
            letterSpacing: "0.02em",
          }}
        >
          Defined by clarity. Driven by results.
        </p>

        <Link href="/login">
          <Button
            className="px-10 py-3 text-sm font-medium tracking-wide rounded-full"
            style={{
              backgroundColor: "#1B4D3E",
              color: "#ffffff",
              border: "none",
              letterSpacing: "0.06em",
            }}
            data-testid="button-go-to-login"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Sign In
          </Button>
        </Link>
      </div>

      {/* ── Services strip ── */}
      <div
        className="py-8 px-6"
        style={{ backgroundColor: "#1A4235" }}
      >
        <p
          className="text-center text-xs tracking-widest mb-4"
          style={{ color: "rgba(245,240,230,0.55)", letterSpacing: "0.18em", textTransform: "uppercase" }}
        >
          Our Services
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {["Global Mobility", "Immigration Support", "Solicitor Support", "Conveyancing"].map((s) => (
            <span
              key={s}
              className="text-sm tracking-wider"
              style={{
                color: "rgba(245,240,230,0.75)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                letterSpacing: "0.08em",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
