import { useEffect } from "react";
import { Switch, Route, useLocation, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Matters from "@/pages/matters";
import MatterDetail from "@/pages/matter-detail";
import DraftEmails from "@/pages/draft-emails";
import Reminders from "@/pages/reminders";
import AIAssistant from "@/pages/ai-assistant";
import Journal from "@/pages/journal";
import Resources from "@/pages/resources";
import Login from "@/pages/login";
import Landing from "@/pages/landing";
import UsersPage from "@/pages/users";
import ComplianceDashboard from "@/pages/compliance-dashboard";
import ImmigrationAssessment from "@/pages/immigration-assessment";
import PlatformPage from "@/pages/platform";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Scale } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

function RedirectToHome() {
  const { role } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(role === "platform_admin" ? "/platform" : "/dashboard");
  }, [role, setLocation]);
  return null;
}

function AuthenticatedRouter() {
  const { role } = useAuth();
  if (role === "platform_admin") {
    return (
      <Switch>
        <Route path="/" component={RedirectToHome} />
        <Route path="/login" component={RedirectToHome} />
        <Route path="/platform" component={PlatformPage} />
        <Route component={PlatformPage} />
      </Switch>
    );
  }
  return (
    <Switch>
      <Route path="/"            component={RedirectToHome} />
      <Route path="/login"       component={RedirectToHome} />
      <Route path="/dashboard"   component={Dashboard} />
      <Route path="/matters"     component={Matters} />
      <Route path="/matters/:id" component={MatterDetail} />
      <Route path="/emails"      component={DraftEmails} />
      <Route path="/reminders"   component={Reminders} />
      <Route path="/journal"     component={Journal} />
      <Route path="/resources"   component={Resources} />
      <Route path="/assistant"   component={AIAssistant} />
      <Route path="/users"       component={UsersPage} />
      <Route path="/compliance"  component={ComplianceDashboard} />
      <Route path="/immigration" component={ImmigrationAssessment} />
      <Route component={NotFound} />
    </Switch>
  );
}

const roleLabelMap: Record<string, string> = {
  admin:      "Admin",
  fee_earner: "Fee Earner",
  assistant:  "Assistant",
  read_only:  "Read Only",
  platform_admin: "Platform Admin",
};

function AppContent() {
  const { authenticated, login, logout, role, displayName } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = (data: {
    username: string;
    role: string;
    organisationId: number;
    displayName: string;
    department?: string;
  }) => {
    login({
      username:       data.username,
      role:           data.role,
      organisationId: data.organisationId,
      displayName:    data.displayName,
      department:     data.department,
    });
    setLocation(data.role === "platform_admin" ? "/platform" : "/dashboard");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    logout();
    queryClient.clear();
    setLocation("/");
  };

  const style = {
    "--sidebar-width":      "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E6" }}>
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full animate-pulse"
            style={{ backgroundColor: "#1B4D3E" }}
          >
            <Scale className="h-4 w-4 text-white" />
          </div>
          <span style={{ color: "#1B4D3E", fontFamily: "'Playfair Display', Georgia, serif", fontSize: "15px" }}>
            Loading…
          </span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Switch>
        <Route path="/login">
          <Login onLogin={handleLogin} />
        </Route>
        <Route path="/" component={Landing} />
        <Route>
          <Landing />
        </Route>
      </Switch>
    );
  }

  return (
    <TooltipProvider>
      {role === "platform_admin" ? (
        <div className="flex h-screen w-full flex-col">
          <header
            className="flex items-center justify-between gap-2 px-4 py-2.5 sticky top-0 z-50"
            style={{
              backgroundColor: "rgba(245,240,230,0.88)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(27,77,62,0.12)",
            }}
          >
            <div className="flex items-center gap-2">
              <BrandLogo size={40} />
              <span className="text-sm font-medium" style={{ color: "#1B4D3E" }}>
                Platform
              </span>
            </div>
            <div className="flex items-center gap-2">
              {displayName && (
                <span className="text-sm hidden sm:inline" style={{ color: "rgba(27,77,62,0.60)" }}>
                  {displayName}
                </span>
              )}
              {role &&
                displayName?.toLowerCase() !== (roleLabelMap[role] || role).toLowerCase() && (
                  <Badge
                    variant="outline"
                    className="text-xs capitalize"
                    style={{
                      borderColor: "rgba(27,77,62,0.25)",
                      color: "#1B4D3E",
                      backgroundColor: "rgba(27,77,62,0.06)",
                    }}
                  >
                    {roleLabelMap[role] || role}
                  </Badge>
                )}
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
                style={{ color: "#1B4D3E" }}
                className="hover:bg-primary/10"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <AuthenticatedRouter />
          </main>
        </div>
      ) : (
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <header
              className="flex items-center justify-between gap-2 px-4 py-2.5 sticky top-0 z-50"
              style={{
                backgroundColor: "rgba(245,240,230,0.88)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderBottom: "1px solid rgba(27,77,62,0.12)",
              }}
            >
              <div className="flex items-center gap-2">
                <SidebarTrigger
                  style={{ color: "#1B4D3E" }}
                />
                <BrandLogo size={40} />
              </div>

              <div className="flex items-center gap-2">
                {displayName && (
                  <span
                    className="text-sm hidden sm:inline"
                    style={{ color: "rgba(27,77,62,0.60)" }}
                  >
                    {displayName}
                  </span>
                )}
                {role &&
                  displayName?.toLowerCase() !== (roleLabelMap[role] || role).toLowerCase() && (
                    <Badge
                      variant="outline"
                      className="text-xs capitalize"
                      style={{
                        borderColor: "rgba(27,77,62,0.25)",
                        color: "#1B4D3E",
                        backgroundColor: "rgba(27,77,62,0.06)",
                      }}
                    >
                      {roleLabelMap[role] || role}
                    </Badge>
                  )}
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  title="Sign out"
                  style={{ color: "#1B4D3E" }}
                  className="hover:bg-primary/10"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </header>

            <main className="flex-1 overflow-auto">
              <AuthenticatedRouter />
            </main>
          </div>
        </div>
      </SidebarProvider>
      )}
    </TooltipProvider>
  );
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <Router base={base}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
