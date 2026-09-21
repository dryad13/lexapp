import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building2, ClipboardList, KeyRound, Plus, Shield } from "lucide-react";

type PlatformSummary = {
  organisationCount: number;
  activeOrganisations: number;
  suspendedOrganisations: number;
  planMix: Record<string, number>;
  userCount: number;
  mfaEnabledUsers: number;
  matterCount: number;
  stripeWebhookFailures7d: number;
};

type OrgRow = {
  id: number;
  name: string;
  subscriptionPlan: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  userCount: number;
  matterCount: number;
  lastLoginAt: string | null;
  lastMatterAt: string | null;
};

type AuditRow = {
  id: number;
  organisationId: number | null;
  entityType: string;
  action: string;
  details: string | null;
  performedBy: string;
  createdAt: string;
};

function fmtWhen(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function PlatformPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminDisplay, setAdminDisplay] = useState("");
  const [plan, setPlan] = useState("basic");
  const [resetResult, setResetResult] = useState<{
    adminUsername: string;
    temporaryPassword: string;
    orgName: string;
  } | null>(null);
  const [auditAction, setAuditAction] = useState("all");

  const summaryQ = useQuery<PlatformSummary>({
    queryKey: ["/api/platform/summary"],
    queryFn: async () => {
      const res = await fetch("/api/platform/summary", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const orgsQ = useQuery<OrgRow[]>({
    queryKey: ["/api/platform/organisations"],
    queryFn: async () => {
      const res = await fetch("/api/platform/organisations", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const auditQ = useQuery<AuditRow[]>({
    queryKey: ["/api/platform/audit-logs", auditAction],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: "50" });
      if (auditAction !== "all") qs.set("action", auditAction);
      const res = await fetch(`/api/platform/audit-logs?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/platform/organisations", {
        name,
        adminUser,
        adminPass,
        adminDisplay: adminDisplay || adminUser,
        plan,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Organisation created" });
      setCreateOpen(false);
      setName("");
      setAdminUser("");
      setAdminPass("");
      setAdminDisplay("");
      setPlan("basic");
      queryClient.invalidateQueries({ queryKey: ["/api/platform/organisations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
    },
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/platform/organisations/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Organisation updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/organisations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const resetMut = useMutation({
    mutationFn: async ({ id, orgName }: { id: number; orgName: string }) => {
      const res = await apiRequest("POST", `/api/platform/organisations/${id}/reset-admin-password`);
      const data = await res.json();
      return { ...data, orgName };
    },
    onSuccess: (data) => {
      setResetResult({
        adminUsername: data.adminUsername,
        temporaryPassword: data.temporaryPassword,
        orgName: data.orgName,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] });
      toast({ title: "Admin password reset — copy it now" });
    },
    onError: (err: Error) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    },
  });

  const summary = summaryQ.data;
  const orgs = orgsQ.data || [];
  const audits = auditQ.data || [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">LexAssist</p>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Platform console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Firm onboarding, password handoff, and aggregate analytics — no matter or client data.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create firm
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create organisation</DialogTitle>
              <DialogDescription>
                Provisions a firm and its first admin. Password must be at least 12 characters with a
                letter and digit.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="org-name">Firm name</Label>
                <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-user">Admin username</Label>
                <Input
                  id="admin-user"
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-display">Admin display name</Label>
                <Input
                  id="admin-display"
                  value={adminDisplay}
                  onChange={(e) => setAdminDisplay(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-pass">Admin password</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  required
                  minLength={12}
                />
              </div>
              <div className="space-y-1">
                <Label>Plan</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">basic</SelectItem>
                    <SelectItem value="pro">pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createMut.isPending} className="w-full">
                {createMut.isPending ? "Creating…" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!resetResult} onOpenChange={(open) => !open && setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Shown once. Share out-of-band with {resetResult?.orgName} — do not paste into tickets.
              The admin must change it on next login.
            </DialogDescription>
          </DialogHeader>
          {resetResult && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Admin:</span> {resetResult.adminUsername}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border bg-muted/40 px-3 py-2 font-mono text-sm">
                  {resetResult.temporaryPassword}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(resetResult.temporaryPassword);
                    toast({ title: "Copied" });
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <Shield className="h-4 w-4" /> Overview
        </h2>
        {summaryQ.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-md" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Firms" value={summary.organisationCount} />
            <Stat label="Active" value={summary.activeOrganisations} />
            <Stat label="Suspended" value={summary.suspendedOrganisations} />
            <Stat label="Users" value={summary.userCount} />
            <Stat label="Matters (count)" value={summary.matterCount} />
            <Stat label="MFA enabled users" value={summary.mfaEnabledUsers} />
            <Stat label="Stripe failures (7d)" value={summary.stripeWebhookFailures7d} />
            <Stat
              label="Plan mix"
              value={
                Object.entries(summary.planMix || {})
                  .map(([k, v]) => `${k}:${v}`)
                  .join(" · ") || "—"
              }
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Could not load summary.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <Building2 className="h-4 w-4" /> Organisations
        </h2>
        {orgsQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Users</th>
                  <th className="px-3 py-2 font-medium">Matters</th>
                  <th className="px-3 py-2 font-medium">Last login</th>
                  <th className="px-3 py-2 font-medium">Last matter</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-t">
                    <td className="px-3 py-2">{org.name}</td>
                    <td className="px-3 py-2">{org.subscriptionPlan}</td>
                    <td className="px-3 py-2">
                      <Badge variant={org.status === "active" ? "outline" : "destructive"}>
                        {org.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{org.userCount}</td>
                    <td className="px-3 py-2">{org.matterCount}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {fmtWhen(org.lastLoginAt)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {fmtWhen(org.lastMatterAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {org.status === "active" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={statusMut.isPending}
                            onClick={() => statusMut.mutate({ id: org.id, status: "suspended" })}
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={statusMut.isPending}
                            onClick={() => statusMut.mutate({ id: org.id, status: "active" })}
                          >
                            Activate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resetMut.isPending}
                          onClick={() => resetMut.mutate({ id: org.id, orgName: org.name })}
                        >
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          Reset admin password
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No firms yet. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="h-4 w-4" /> Audit
          </h2>
          <Select value={auditAction} onValueChange={setAuditAction}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="ORG_CREATED">ORG_CREATED</SelectItem>
              <SelectItem value="ORG_SUSPENDED">ORG_SUSPENDED</SelectItem>
              <SelectItem value="ORG_ACTIVATED">ORG_ACTIVATED</SelectItem>
              <SelectItem value="ADMIN_PASSWORD_RESET">ADMIN_PASSWORD_RESET</SelectItem>
              <SelectItem value="LOGIN_SUCCESS">LOGIN_SUCCESS</SelectItem>
              <SelectItem value="LOGIN_FAILURE">LOGIN_FAILURE</SelectItem>
              <SelectItem value="PASSWORD_CHANGED">PASSWORD_CHANGED</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {auditQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Org</th>
                  <th className="px-3 py-2 font-medium">By</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtWhen(row.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.action}</td>
                    <td className="px-3 py-2">{row.organisationId ?? "—"}</td>
                    <td className="px-3 py-2">{row.performedBy}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-md truncate">
                      {row.details || "—"}
                    </td>
                  </tr>
                ))}
                {audits.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No platform/auth audit events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-background px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
