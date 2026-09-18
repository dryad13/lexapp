import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
interface LoginProps {
  onLogin: (data: { username: string; role: string; organisationId: number; displayName: string; department?: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        onLogin({
          username: data.username,
          role: data.role || "read_only",
          organisationId: data.organisationId || 0,
          displayName: data.displayName || data.username,
          department: data.department,
        });
      } else {
        setError("Invalid username or password");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#F5F0E6" }}
    >
      {/* Decorative background panel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 60%, rgba(27,77,62,0.07) 0%, transparent 70%)",
        }}
      />

      <Card
        className="w-full max-w-sm relative"
        style={{
          background: "rgba(252,249,242,0.92)",
          border: "1px solid rgba(27,77,62,0.15)",
          borderRadius: "12px",
          boxShadow: "0 8px 40px rgba(27,77,62,0.10)",
        }}
        data-testid="card-login"
      >
        <CardHeader className="text-center space-y-3 pb-4 pt-7">
          <BrandLogo reveal size={88} className="mx-auto mb-1" />

          {/* Firm name */}
          <div className="brand-copy-reveal">
            <CardTitle
              className="text-xl"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                color: "#1B4D3E",
                letterSpacing: "-0.01em",
              }}
              data-testid="text-login-title"
            >
              LexAssist
            </CardTitle>
          </div>

          <p
            className="text-sm brand-copy-reveal-late"
            style={{ color: "rgba(27,77,62,0.55)" }}
          >
            Sign in to manage your matters
          </p>
        </CardHeader>

        <CardContent className="pb-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-user" style={{ color: "#1B4D3E" }}>Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(27,77,62,0.45)" }} />
                <Input
                  id="login-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="pl-9"
                  style={{ borderColor: "rgba(27,77,62,0.20)" }}
                  required
                  autoComplete="username"
                  data-testid="input-login-username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-pass" style={{ color: "#1B4D3E" }}>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(27,77,62,0.45)" }} />
                <Input
                  id="login-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="pl-9"
                  style={{ borderColor: "rgba(27,77,62,0.20)" }}
                  required
                  autoComplete="current-password"
                  data-testid="input-login-password"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center" data-testid="text-login-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full font-medium tracking-wide"
              style={{ backgroundColor: "#1B4D3E", color: "#ffffff", border: "none" }}
              disabled={loading}
              data-testid="button-login-submit"
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
