import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Link } from "wouter";
import {
  Briefcase,
  Mail,
  Bell,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import type { Matter, DraftEmail, Reminder, MatterType } from "@shared/schema";
import { WORKFLOW_STAGES, IMMIGRATION_MATTER_TYPES, getImmigrationWorkflowStages, getPracticeArea } from "@shared/schema";
import { format } from "date-fns";

interface ComplianceItem {
  matterId: number;
  matterTitle: string;
  stage: string;
  requiredIncomplete: number;
}

export default function Dashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [practiceArea, setPracticeArea] = useState<"conveyancing" | "immigration" | "">("");
  const [formType, setFormType] = useState("");
  const { toast } = useToast();
  const { hasPermission, department } = useAuth();
  const showConveyancing = department === "conveyancing" || department === "both";
  const showImmigration = department === "immigration" || department === "both";
  const isImmigrationForm = practiceArea === "immigration";

  const { data: matters, isLoading: mattersLoading } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });
  const { data: emails, isLoading: emailsLoading } = useQuery<DraftEmail[]>({
    queryKey: ["/api/draft-emails"],
  });
  const { data: reminders, isLoading: remindersLoading } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
  });
  const { data: complianceBlocked } = useQuery<ComplianceItem[]>({
    queryKey: ["/api/compliance/summary"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("POST", "/api/matters", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
      setDialogOpen(false);
      setPracticeArea("");
      setFormType("");
      toast({ title: "Matter created", description: "New matter has been created with workflow tasks." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!practiceArea) {
      toast({ title: "Error", description: "Please select a practice area", variant: "destructive" });
      return;
    }
    if (!formType) {
      toast({ title: "Error", description: "Please select a matter type", variant: "destructive" });
      return;
    }
    const formData = new FormData(e.currentTarget);
    const isImmigration = (IMMIGRATION_MATTER_TYPES as readonly string[]).includes(formType);
    const initialStage = isImmigration ? getImmigrationWorkflowStages(formType)[0] : "Onboarding";
    createMutation.mutate({
      title: formData.get("title") as string,
      type: formType,
      clientName: formData.get("clientName") as string,
      clientEmail: (formData.get("clientEmail") as string) || "",
      propertyAddress: formData.get("propertyAddress") as string,
      price: (formData.get("price") as string) || "",
      currentStage: initialStage,
      status: "active",
    });
  };

  const getNextStage = (matter: Matter): string | null => {
    if ((IMMIGRATION_MATTER_TYPES as readonly string[]).includes(matter.type)) {
      const stages = getImmigrationWorkflowStages(matter.type);
      const idx = stages.indexOf(matter.currentStage as any);
      if (idx >= 0 && idx < stages.length - 1) return stages[idx + 1];
      return null;
    }
    const stages = WORKFLOW_STAGES[matter.type as MatterType];
    if (!stages) return null;
    const idx = stages.indexOf(matter.currentStage as any);
    if (idx >= 0 && idx < stages.length - 1) return stages[idx + 1];
    return null;
  };

  const resetCreateDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setPracticeArea("");
      setFormType("");
    } else if (showImmigration && !showConveyancing) {
      setPracticeArea("immigration");
    } else if (showConveyancing && !showImmigration) {
      setPracticeArea("conveyancing");
    }
  };

  const activeMatters = matters?.filter((m) => m.status === "active") || [];
  const pendingReminders = reminders?.filter((r) => !r.completed) || [];
  const draftCount = emails?.filter((e) => e.status === "draft").length || 0;

  const stats = [
    {
      label: "Active Matters",
      value: activeMatters.length,
      icon: Briefcase,
      color: "text-primary",
      bg: "bg-primary/10",
      href: "/matters",
    },
    {
      label: "Draft Emails",
      value: draftCount,
      icon: Mail,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
      href: "/emails",
    },
    {
      label: "Pending Reminders",
      value: pendingReminders.length,
      icon: Bell,
      color: "text-chart-5",
      bg: "bg-chart-5/10",
      href: "/reminders",
    },
    {
      label: "Completed",
      value: matters?.filter((m) => m.status === "completed").length || 0,
      icon: CheckCircle2,
      color: "text-chart-4",
      bg: "bg-chart-4/10",
      href: "/matters",
    },
  ];

  const isLoading = mattersLoading || emailsLoading || remindersLoading;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Your legal matters at a glance
          </p>
        </div>

        {hasPermission("canCreateMatters") && (
        <Dialog open={dialogOpen} onOpenChange={resetCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-dashboard-new-matter">
              <Plus className="h-4 w-4 mr-2" />
              New Matter
            </Button>
          </DialogTrigger>
          <DialogContent className="glass sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Matter</DialogTitle>
              <DialogDescription>Choose a practice area, then the matter type</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Practice Area</Label>
                <Select
                  value={practiceArea}
                  onValueChange={(v) => {
                    setPracticeArea(v as "conveyancing" | "immigration");
                    setFormType("");
                  }}
                >
                  <SelectTrigger data-testid="select-dashboard-practice-area">
                    <SelectValue placeholder="Select practice area" />
                  </SelectTrigger>
                  <SelectContent>
                    {showConveyancing && <SelectItem value="conveyancing">Conveyancing</SelectItem>}
                    {showImmigration && <SelectItem value="immigration">Immigration</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {practiceArea && (
                <div className="space-y-2">
                  <Label>{isImmigrationForm ? "Case Type" : "Transaction Type"}</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger data-testid="select-dashboard-matter-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {practiceArea === "conveyancing" && (
                        <>
                          <SelectItem value="sale">Sale</SelectItem>
                          <SelectItem value="purchase">Purchase</SelectItem>
                          <SelectItem value="remortgage">Remortgage</SelectItem>
                        </>
                      )}
                      {practiceArea === "immigration" && (
                        <>
                          <SelectItem value="visa_application">Visa Application</SelectItem>
                          <SelectItem value="asylum">Asylum</SelectItem>
                          <SelectItem value="appeal">Appeal</SelectItem>
                          <SelectItem value="settlement">Settlement</SelectItem>
                          <SelectItem value="naturalisation">Naturalisation</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="d-title">Matter Title</Label>
                <Input id="d-title" name="title" placeholder={isImmigrationForm ? "e.g., Skilled Worker Visa — John Smith" : "e.g., Sale of 10 High Street"} required data-testid="input-dashboard-matter-title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-clientName">Client Name</Label>
                <Input id="d-clientName" name="clientName" placeholder="Full name" required data-testid="input-dashboard-client-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-clientEmail">Client Email</Label>
                <Input id="d-clientEmail" name="clientEmail" type="email" placeholder="email@example.com" data-testid="input-dashboard-client-email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-propertyAddress">{isImmigrationForm ? "Client Address" : "Property Address"}</Label>
                <Textarea id="d-propertyAddress" name="propertyAddress" placeholder={isImmigrationForm ? "Client address" : "Full property address"} required data-testid="input-dashboard-property-address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-price">{isImmigrationForm ? "Fee Quote" : "Price"}</Label>
                <Input id="d-price" name="price" placeholder={isImmigrationForm ? "e.g., 2,500" : "e.g., 350,000"} data-testid="input-dashboard-price" />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || !practiceArea || !formType} data-testid="button-dashboard-submit-matter">
                {createMutation.isPending ? "Creating..." : "Create Matter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link href={stat.href} key={stat.label} aria-label={stat.label}>
            <Card className="glass-card rounded-md hover-elevate cursor-pointer">
              <CardContent className="p-5">
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold font-serif" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                        {stat.value}
                      </p>
                    </div>
                    <div className={`p-2.5 rounded-md ${stat.bg}`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} aria-hidden="true" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card rounded-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-lg">Recent Matters</CardTitle>
            <Link href="/matters">
              <Button variant="ghost" size="sm" data-testid="button-view-all-matters">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : activeMatters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No active matters yet</p>
              </div>
            ) : (
              activeMatters.slice(0, 5).map((matter) => {
                const nextStage = getNextStage(matter);
                return (
                  <Link href={`/matters/${matter.id}`} key={matter.id}>
                    <div
                      className="p-3 rounded-md glass-subtle hover-elevate cursor-pointer"
                      data-testid={`card-dashboard-matter-${matter.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{matter.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {matter.clientName} - {matter.propertyAddress}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {getPracticeArea(matter.type) === "immigration" ? "Immigration" : "Conveyancing"}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {matter.type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                      {nextStage && (
                        <div
                          className="mt-2 px-2.5 py-1.5 rounded-md glass-subtle flex items-center gap-1.5"
                          data-testid={`nudge-dashboard-next-${matter.id}`}
                        >
                          <ArrowRight className="h-3 w-3 text-primary/50 flex-shrink-0" />
                          <p className="text-xs italic text-primary/60 truncate">
                            Next: {nextStage}
                          </p>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-lg">Upcoming Reminders</CardTitle>
            <Link href="/reminders">
              <Button variant="ghost" size="sm" data-testid="button-view-all-reminders">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))
            ) : pendingReminders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No pending reminders</p>
              </div>
            ) : (
              pendingReminders.slice(0, 5).map((reminder) => (
                <Link href="/reminders" key={reminder.id}>
                  <div
                    className="flex items-center justify-between gap-3 p-3 rounded-md glass-subtle hover-elevate cursor-pointer"
                    data-testid={`card-dashboard-reminder-${reminder.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{reminder.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {reminder.dueDate
                            ? format(new Date(reminder.dueDate), "d MMM yyyy")
                            : "No date set"}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {complianceBlocked && complianceBlocked.length > 0 && (
        <Card className="glass-card rounded-md" data-testid="card-compliance-widget">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Compliance Blocked ({complianceBlocked.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {complianceBlocked.slice(0, 5).map((item) => (
              <Link href={`/matters/${item.matterId}`} key={item.matterId}>
                <div
                  className="flex items-center justify-between gap-3 p-3 rounded-md glass-subtle hover-elevate cursor-pointer"
                  data-testid={`card-compliance-blocked-${item.matterId}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{item.matterTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      Stage: {item.stage}
                    </p>
                  </div>
                  <Badge variant="destructive" className="text-xs flex-shrink-0" data-testid={`badge-blocked-count-${item.matterId}`}>
                    {item.requiredIncomplete} required
                  </Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
