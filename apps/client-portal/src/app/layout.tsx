import "./globals.css";

export const metadata = {
  title: "LexAssist — Client onboarding",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v18M5 8h14M7 8c0 5 2.2 8 5 8s5-3 5-8" stroke="#F5F0E6" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            </span>
            <span>
              <div className="brand-name">LexAssist</div>
              <div className="brand-sub">Client onboarding</div>
            </span>
          </div>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
