import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Circle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Mail,
  Bell,
  Clock,
  User,
  MapPin,
  ExternalLink,
  Pencil,
  FileText,
  Trash2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Matter, Task, Reminder, DraftEmail, Document as MatterDoc, EnquiryPack, MatterType } from "@shared/schema";
import { WORKFLOW_STAGES, IMMIGRATION_WORKFLOW_STAGES, IMMIGRATION_MATTER_TYPES, getRemortgageStages, getImmigrationWorkflowStages } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import EnquiriesTab from "@/components/enquiries-tab";
import EnquiriesBuilder from "@/components/enquiries-builder";
import FinancialLedger from "@/components/financial-ledger";
import ComplianceTab from "@/components/compliance-tab";
import { ShieldCheck } from "lucide-react";

type MatterWithRelations = Matter & {
  tasks: Task[];
  reminders: Reminder[];
  draftEmails: DraftEmail[];
  documents: MatterDoc[];
  enquiryPacks: EnquiryPack[];
};

export default function MatterDetail() {
  const [, params] = useRoute("/matters/:id");
  const matterId = params?.id;
  const { toast } = useToast();
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [editPropertyAddress, setEditPropertyAddress] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editIsCompanyRemortgage, setEditIsCompanyRemortgage] = useState(false);
  const [complianceBlockedModal, setComplianceBlockedModal] = useState(false);
  const [blockedMissingChecks, setBlockedMissingChecks] = useState<{ id: number; ruleKey: string | null; ruleName: string }[]>([]);
  const [blockedAttemptedStage, setBlockedAttemptedStage] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { hasPermission } = useAuth();
  const [, navigate] = useLocation();

  const { data: matter, isLoading } = useQuery<MatterWithRelations>({
    queryKey: ["/api/matters", matterId],
  });

  useEffect(() => {
    if (matterId) {
      queryClient.invalidateQueries({ queryKey: ["/api/matters"], exact: true });
    }
  }, [matterId]);

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiRequest("POST", `/api/tasks/${taskId}/complete`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      toast({ title: "Task completed" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async (payload: { stage: string; override?: boolean; overrideReason?: string }) => {
      const body: Record<string, any> = { currentStage: payload.stage };
      if (payload.override) {
        body.override = true;
        body.overrideReason = payload.overrideReason;
      }
      const res = await fetch(`/api/matters/${matterId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...((() => { const t = localStorage.getItem("auth_token"); return t ? { Authorization: `Bearer ${t}` } : {}; })()),
        },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        const data = await res.json();
        throw { status: 409, ...data };
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update stage");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
      setComplianceBlockedModal(false);
      setOverrideReason("");
    },
    onError: (err: any) => {
      if (err.status === 409 && err.error === "COMPLIANCE_BLOCKED") {
        setBlockedMissingChecks(err.missing_checks || []);
        setBlockedAttemptedStage(err.attempted_stage || "");
        setComplianceBlockedModal(true);
      } else {
        toast({ title: "Error", description: err.message || "Stage change failed", variant: "destructive" });
      }
    },
  });

  const createReminderMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/reminders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setReminderDialogOpen(false);
      toast({ title: "Reminder created" });
    },
  });

  const updateMatterMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/matters/${matterId}`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setEditDialogOpen(false);
      if (data?.deleted) {
        queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
        toast({ title: "Matter completed and removed" });
        navigate("/matters");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
      toast({ title: "Matter updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMatterMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/matters/${matterId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
      toast({ title: "Matter deleted" });
      navigate("/matters");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openEditDialog = () => {
    if (!matter) return;
    setEditTitle(matter.title);
    setEditClientName(matter.clientName);
    setEditClientEmail(matter.clientEmail || "");
    setEditPropertyAddress(matter.propertyAddress);
    setEditPrice(matter.price || "");
    setEditNotes(matter.notes || "");
    setEditStatus(matter.status);
    setEditIsCompanyRemortgage(matter.isCompanyRemortgage || false);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateMatterMutation.mutate({
      title: editTitle,
      clientName: editClientName,
      clientEmail: editClientEmail || null,
      propertyAddress: editPropertyAddress,
      price: editPrice || null,
      notes: editNotes || null,
      status: editStatus,
      isCompanyRemortgage: editIsCompanyRemortgage,
    });
  };

  const createEmailMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/draft-emails", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      queryClient.invalidateQueries({ queryKey: ["/api/draft-emails"] });
      setEmailDialogOpen(false);
      toast({ title: "Draft email saved" });
    },
  });

  const handleTaskComplete = (task: Task) => {
    completeTaskMutation.mutate(task.id);
    const tasks = matter?.tasks || [];
    const currentIdx = tasks.findIndex((t) => t.id === task.id);
    if (currentIdx < tasks.length - 1) {
      const nextStage = tasks[currentIdx + 1].stage;
      updateStageMutation.mutate({ stage: nextStage });
    }
  };

  const handleReminderSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createReminderMutation.mutate({
      matterId: parseInt(matterId!),
      title: formData.get("title"),
      dueDate: new Date(formData.get("dueDate") as string).toISOString(),
    });
  };

  const handleEmailSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createEmailMutation.mutate({
      matterId: parseInt(matterId!),
      subject: formData.get("subject"),
      recipient: formData.get("recipient"),
      body: formData.get("body"),
      status: "draft",
    });
  };

  const generateReminderLink = (title: string, dueDate: string) => {
    const d = new Date(dueDate);
    const dateStr = format(d, "yyyyMMdd");
    const icsContent = `BEGIN:VCALENDAR\nBEGIN:VTODO\nSUMMARY:${title}\nDTSTART:${dateStr}T090000\nDUE:${dateStr}T170000\nSTATUS:NEEDS-ACTION\nEND:VTODO\nEND:VCALENDAR`;
    const blob = new Blob([icsContent], { type: "text/calendar" });
    return URL.createObjectURL(blob);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!matter) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Matter not found</p>
        <Link href="/matters">
          <Button variant="ghost" className="mt-4">Back to Matters</Button>
        </Link>
      </div>
    );
  }

  const completedTasks = matter.tasks.filter((t) => t.status === "completed").length;
  const totalTasks = matter.tasks.length;
  const progressPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const typeColors: Record<string, string> = {
    sale: "bg-chart-4/10 text-chart-4",
    purchase: "bg-primary/10 text-primary",
    remortgage: "bg-chart-5/10 text-chart-5",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/matters">
          <Button variant="ghost" size="icon" data-testid="button-back-matters">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate" data-testid="text-matter-title">
              {matter.title}
            </h1>
            <Badge className={`capitalize text-xs ${typeColors[matter.type] || ""}`}>
              {matter.type}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">{matter.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={openEditDialog} data-testid="button-edit-matter">
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          {hasPermission("canDeleteMatters") && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              data-testid="button-delete-matter"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card rounded-md">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Client</span>
            </div>
            <p className="font-medium" data-testid="text-client-name">{matter.clientName}</p>
            {matter.clientEmail && (
              <p className="text-sm text-muted-foreground">{matter.clientEmail}</p>
            )}
          </CardContent>
        </Card>
        <Card className="glass-card rounded-md">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Property</span>
            </div>
            <p className="font-medium text-sm" data-testid="text-property-address">{matter.propertyAddress}</p>
            {matter.price && (
              <p className="text-sm font-semibold text-primary">{matter.price}</p>
            )}
          </CardContent>
        </Card>
        <Card className="glass-card rounded-md">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Progress</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <p className="text-sm">
              <span className="font-medium">{completedTasks}</span>
              <span className="text-muted-foreground"> of {totalTasks} tasks</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" data-testid="button-add-reminder">
              <Bell className="h-3.5 w-3.5 mr-1.5" />
              Add Reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>Create Reminder</DialogTitle>
              <DialogDescription>Set a due date to receive a reminder</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleReminderSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reminder-title">Title</Label>
                <Input id="reminder-title" name="title" placeholder="e.g., Follow up on searches" required data-testid="input-reminder-title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder-date">Due Date</Label>
                <Input id="reminder-date" name="dueDate" type="date" required data-testid="input-reminder-date" />
              </div>
              <Button type="submit" className="w-full" disabled={createReminderMutation.isPending} data-testid="button-submit-reminder">
                {createReminderMutation.isPending ? "Creating..." : "Create Reminder"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" data-testid="button-add-email">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Draft Email
            </Button>
          </DialogTrigger>
          <DialogContent className="glass sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Draft Email</DialogTitle>
              <DialogDescription>Save a draft email for this matter</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-recipient">Recipient</Label>
                <Input id="email-recipient" name="recipient" placeholder="email@example.com" data-testid="input-email-recipient" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-subject">Subject</Label>
                <Input id="email-subject" name="subject" placeholder="Email subject" required data-testid="input-email-subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-body">Body</Label>
                <Textarea id="email-body" name="body" placeholder="Email content..." rows={6} required data-testid="input-email-body" />
              </div>
              <Button type="submit" className="w-full" disabled={createEmailMutation.isPending} data-testid="button-submit-email">
                {createEmailMutation.isPending ? "Saving..." : "Save Draft"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="workflow" className="w-full">
        <TabsList className="w-full justify-start glass-subtle">
          <TabsTrigger value="workflow" data-testid="tab-workflow">Workflow</TabsTrigger>
          {matter.type !== "sale" && !(IMMIGRATION_MATTER_TYPES as readonly string[]).includes(matter.type) && (
            <TabsTrigger value="enquiries-builder" data-testid="tab-enquiries-builder" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Enquiries
            </TabsTrigger>
          )}
          <TabsTrigger value="enquiries" data-testid="tab-enquiries" className="flex items-center gap-1.5">
            Docs & AI
            {(matter.documents?.length > 0 || matter.enquiryPacks?.length > 0) && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5 ml-1">
                {(matter.documents?.length || 0) + (matter.enquiryPacks?.length || 0)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="finances" data-testid="tab-finances" className="flex items-center gap-1.5">
            Finances
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance" className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="space-y-6 mt-4">
      <Card className="glass-card rounded-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {matter.tasks.map((task, index) => {
            const isCompleted = task.status === "completed";
            const isCurrent = task.stage === matter.currentStage && !isCompleted;
            const isImmigrationMatter = (IMMIGRATION_MATTER_TYPES as readonly string[]).includes(matter.type);
            const stages = isImmigrationMatter
              ? [...getImmigrationWorkflowStages(matter.type)]
              : matter.type === "remortgage"
              ? getRemortgageStages(matter.isCompanyRemortgage || false)
              : [...(WORKFLOW_STAGES[matter.type as MatterType] || [])];
            const currentStageIdx = stages.indexOf(matter.currentStage as any);
            const nextStage = currentStageIdx >= 0 && currentStageIdx < stages.length - 1
              ? stages[currentStageIdx + 1]
              : null;

            return (
              <div key={task.id}>
                <button
                  type="button"
                  className={`flex items-center gap-3 p-3 rounded-md w-full text-left ${
                    isCurrent ? "glass-subtle" : ""
                  } ${!isCompleted ? "hover-elevate cursor-pointer" : ""}`}
                  onClick={() => !isCompleted && handleTaskComplete(task)}
                  disabled={isCompleted || completeTaskMutation.isPending}
                  data-testid={`task-${task.id}`}
                >
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-chart-4" />
                    ) : isCurrent ? (
                      <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isCompleted ? "text-muted-foreground line-through" : ""}`}>
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {format(new Date(task.dueDate), "d MMM yyyy")}
                      </p>
                    )}
                  </div>
                  {!isCompleted && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      Tap to complete
                    </span>
                  )}
                </button>
                {isCurrent && nextStage && (
                  <div className="flex items-center gap-3 px-3 py-2 ml-2 mt-0.5 rounded-md opacity-50" data-testid="nudge-next-action">
                    <ArrowRight className="h-4 w-4 text-primary/60 flex-shrink-0" />
                    <p className="text-xs text-primary/70 italic">
                      Next: {nextStage}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {matter.reminders.length > 0 && (
        <Card className="glass-card rounded-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matter.reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md glass-subtle"
                data-testid={`reminder-${reminder.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{reminder.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(reminder.dueDate), "d MMM yyyy")}
                    </p>
                  </div>
                </div>
                <a
                  href={generateReminderLink(reminder.title, reminder.dueDate.toString())}
                  download={`${reminder.title.replace(/\s/g, "_")}.ics`}
                  data-testid={`link-reminder-ical-${reminder.id}`}
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    iCal
                  </Button>
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {matter.draftEmails.length > 0 && (
        <Card className="glass-card rounded-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Draft Emails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matter.draftEmails.map((email) => (
              <div
                key={email.id}
                className="p-3 rounded-md glass-subtle space-y-1"
                data-testid={`draft-email-${email.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{email.subject}</p>
                  <Badge variant="secondary" className="text-xs capitalize">{email.status}</Badge>
                </div>
                {email.recipient && (
                  <p className="text-xs text-muted-foreground">To: {email.recipient}</p>
                )}
                <p className="text-xs text-muted-foreground line-clamp-2">{email.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

        </TabsContent>

        <TabsContent value="enquiries-builder" className="mt-4">
          <EnquiriesBuilder matter={matter} matterId={matterId!} />
        </TabsContent>

        <TabsContent value="enquiries" className="mt-4">
          <EnquiriesTab matter={matter} matterId={matterId!} />
        </TabsContent>

        <TabsContent value="finances" className="mt-4">
          <FinancialLedger matter={matter} matterId={matterId!} />
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <ComplianceTab
            matterId={matter.id}
            currentStage={matter.currentStage}
            matterData={{
              clientRef: matter.reference,
              clientName: matter.clientName,
              type: matter.type,
              propertyAddress: matter.propertyAddress,
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="glass sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Matter</DialogTitle>
            <DialogDescription>Update matter details, client info, and status</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="e-title">Matter Title</Label>
              <Input id="e-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required data-testid="input-edit-title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-clientName">Client Name</Label>
              <Input id="e-clientName" value={editClientName} onChange={(e) => setEditClientName(e.target.value)} required data-testid="input-edit-client-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-clientEmail">Client Email</Label>
              <Input id="e-clientEmail" type="email" value={editClientEmail} onChange={(e) => setEditClientEmail(e.target.value)} data-testid="input-edit-client-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-propertyAddress">Property Address</Label>
              <Textarea id="e-propertyAddress" value={editPropertyAddress} onChange={(e) => setEditPropertyAddress(e.target.value)} required data-testid="input-edit-property-address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-price">Price</Label>
              <Input id="e-price" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="e.g., 350,000" data-testid="input-edit-price" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-notes">Notes</Label>
              <Textarea id="e-notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} data-testid="input-edit-notes" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_abeyance">In Abeyance</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {matter?.type === "remortgage" && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="company-remortgage" className="text-sm font-medium">Company Remortgage</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Adds Personal Guarantees / ILA stage before Signed Documents</p>
                </div>
                <Switch
                  id="company-remortgage"
                  checked={editIsCompanyRemortgage}
                  onCheckedChange={setEditIsCompanyRemortgage}
                  data-testid="switch-company-remortgage"
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={updateMatterMutation.isPending} data-testid="button-submit-edit">
              {updateMatterMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={complianceBlockedModal} onOpenChange={(open) => { setComplianceBlockedModal(open); if (!open) setOverrideReason(""); }}>
        <DialogContent className="glass sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Stage Progression Blocked
            </DialogTitle>
            <DialogDescription>
              Required compliance checks must be completed before progressing to "{blockedAttemptedStage}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[40vh] overflow-y-auto">
            <p className="text-sm font-medium">Missing required checks:</p>
            {blockedMissingChecks.map((check, i) => (
              <div key={check.id || i} className="flex items-center gap-2 p-2 rounded-md glass-subtle" data-testid={`text-missing-check-${i}`}>
                <ShieldCheck className="h-4 w-4 text-destructive flex-shrink-0" />
                <div className="min-w-0">
                  {check.ruleKey && <span className="text-xs text-muted-foreground mr-2">{check.ruleKey}</span>}
                  <span className="text-sm">{check.ruleName}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => { setComplianceBlockedModal(false); }}
              data-testid="button-go-compliance"
            >
              Go to Compliance Tab
            </Button>
            {hasPermission("canOverrideGating") && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium">Override (Admin / Fee Earner only)</p>
                <Textarea
                  placeholder="Enter reason for override (min 10 characters)..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  data-testid="input-override-reason"
                />
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={overrideReason.trim().length < 10 || updateStageMutation.isPending}
                  onClick={() => {
                    updateStageMutation.mutate({
                      stage: blockedAttemptedStage,
                      override: true,
                      overrideReason: overrideReason.trim(),
                    });
                  }}
                  data-testid="button-override-stage"
                >
                  {updateStageMutation.isPending ? "Overriding..." : "Override & Progress"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="glass sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Matter
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete "{matter?.title}"? This will remove all associated tasks, emails, reminders, documents, and compliance data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMatterMutation.mutate();
                setDeleteDialogOpen(false);
              }}
              disabled={deleteMatterMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMatterMutation.isPending ? "Deleting..." : "Delete Matter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
