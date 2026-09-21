import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

interface LoginProps {
  onLogin: (data: {
    username: string;
    role: string;
    organisationId: number;
    displayName: string;
    department?: string;
  }) => void;
}

type Step = "credentials" | "mfa" | "mfa-setup" | "change-password";

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const finishLogin = (data: any) => {
    onLogin({
      username: data.username,
      role: data.role || "read_only",
      organisationId: data.organisationId || 0,
      displayName: data.displayName || data.username,
      department: data.department,
    });
  };

  const maybeMustChange = (data: any) => {
    if (data.mustChangePasswordRequired) {
      setCurrentPassword(password || currentPassword);
      setStep("change-password");
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (step === "change-password") {
        if (newPassword !== confirmPassword) {
          setError("New passwords do not match");
          return;
        }
        const res = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            currentPassword: currentPassword || password,
            newPassword,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to change password");
          return;
        }
        finishLogin(data);
        return;
      }

      if (step === "mfa") {
        const res = await fetch("/api/auth/mfa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ mfaToken, code: mfaCode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Invalid MFA code");
          return;
        }
        if (maybeMustChange(data)) return;
        finishLogin(data);
        return;
      }

      if (step === "mfa-setup") {
        const res = await fetch("/api/auth/mfa/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code: mfaCode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Invalid MFA code");
          return;
        }
        if (maybeMustChange(data)) return;
        finishLogin(data);
        return;
      }

      const payload: Record<string, string> = { username, password };
      if (organisation.trim()) payload.organisation = organisation.trim();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Invalid username or password");
        return;
      }
      if (data.mfaRequired && data.mfaToken) {
        setMfaToken(data.mfaToken);
        setStep("mfa");
        return;
      }
      if (data.mfaSetupRequired) {
        const setup = await fetch("/api/auth/mfa/setup", {
          method: "POST",
          credentials: "include",
        });
        const setupData = await setup.json().catch(() => ({}));
        if (!setup.ok) {
          setError(setupData.error || "MFA setup failed");
          return;
        }
        setOtpauthUrl(setupData.otpauthUrl || "");
        setBackupCodes(setupData.backupCodes || []);
        setStep("mfa-setup");
        return;
      }
      if (maybeMustChange(data)) return;
      finishLogin(data);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const subtitle =
    step === "credentials"
      ? "Sign in to manage your matters"
      : step === "mfa"
        ? "Enter your authenticator code"
        : step === "mfa-setup"
          ? "Set up authenticator MFA"
          : "Choose a new password to continue";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#F5F0E6" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 60%, rgba(27,77,62,0.07) 0%, transparent 70%)",
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
          <BrandLogo reveal size={128} className="mx-auto mb-1" data-testid="text-login-title" />
          <p className="text-sm brand-copy-reveal" style={{ color: "rgba(27,77,62,0.55)" }}>
            {subtitle}
          </p>
        </CardHeader>

        <CardContent className="pb-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === "credentials" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="login-org" style={{ color: "#1B4D3E" }}>
                    Organisation (optional)
                  </Label>
                  <Input
                    id="login-org"
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                    placeholder="Firm name if usernames collide"
                    style={{ borderColor: "rgba(27,77,62,0.20)" }}
                    autoComplete="organization"
                    data-testid="input-login-organisation"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-user" style={{ color: "#1B4D3E" }}>
                    Username
                  </Label>
                  <div className="relative">
                    <User
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                      style={{ color: "rgba(27,77,62,0.45)" }}
                    />
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
                  <Label htmlFor="login-pass" style={{ color: "#1B4D3E" }}>
                    Password
                  </Label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                      style={{ color: "rgba(27,77,62,0.45)" }}
                    />
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
              </>
            )}

            {(step === "mfa" || step === "mfa-setup") && (
              <div className="space-y-2">
                {step === "mfa-setup" && (
                  <div className="text-xs space-y-2 mb-3" style={{ color: "rgba(27,77,62,0.7)" }}>
                    <p>Add this account in your authenticator app, then enter a code to confirm.</p>
                    {otpauthUrl && (
                      <p className="break-all font-mono text-[10px]" data-testid="text-mfa-otpauth">
                        {otpauthUrl}
                      </p>
                    )}
                    {backupCodes.length > 0 && (
                      <p data-testid="text-mfa-backup">Backup codes: {backupCodes.join(", ")}</p>
                    )}
                  </div>
                )}
                <Label htmlFor="login-mfa" style={{ color: "#1B4D3E" }}>
                  Authenticator code
                </Label>
                <Input
                  id="login-mfa"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="6-digit code"
                  style={{ borderColor: "rgba(27,77,62,0.20)" }}
                  required
                  autoComplete="one-time-code"
                  data-testid="input-login-mfa"
                />
              </div>
            )}

            {step === "change-password" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="login-current-pass" style={{ color: "#1B4D3E" }}>
                    Temporary / current password
                  </Label>
                  <Input
                    id="login-current-pass"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    data-testid="input-login-current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-new-pass" style={{ color: "#1B4D3E" }}>
                    New password
                  </Label>
                  <Input
                    id="login-new-pass"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                    data-testid="input-login-new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-confirm-pass" style={{ color: "#1B4D3E" }}>
                    Confirm new password
                  </Label>
                  <Input
                    id="login-confirm-pass"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                    data-testid="input-login-confirm-password"
                  />
                </div>
                <p className="text-xs" style={{ color: "rgba(27,77,62,0.55)" }}>
                  At least 12 characters with a letter and a digit.
                </p>
              </>
            )}

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
              {loading
                ? "Please wait…"
                : step === "credentials"
                  ? "Sign In"
                  : step === "change-password"
                    ? "Update password"
                    : "Verify"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
