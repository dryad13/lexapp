import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Bell, CheckCircle2, Clock, ExternalLink, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Reminder, Matter } from "@shared/schema";
import { format, isPast, isToday } from "date-fns";

export default function Reminders() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState("none");
  const { toast } = useToast();

  const { data: reminders, isLoading } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
  });

  const { data: matters } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/reminders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setDialogOpen(false);
      setSelectedMatterId("none");
      toast({ title: "Reminder created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/reminders/${id}/complete`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({ title: "Reminder completed" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({ title: "Reminder deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload: Record<string, any> = {
      title: formData.get("title") as string,
      dueDate: new Date(formData.get("dueDate") as string).toISOString(),
    };
    if (selectedMatterId !== "none") {
      payload.matterId = parseInt(selectedMatterId);
    }
    createMutation.mutate(payload);
  };

  const generateReminderLink = (title: string, dueDate: string) => {
    const d = new Date(dueDate);
    const dateStr = format(d, "yyyyMMdd");
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VTODO\nSUMMARY:${title}\nDTSTART:${dateStr}T090000\nDUE:${dateStr}T170000\nSTATUS:NEEDS-ACTION\nEND:VTODO\nEND:VCALENDAR`;
    const blob = new Blob([icsContent], { type: "text/calendar" });
    return URL.createObjectURL(blob);
  };

  const pending = reminders?.filter((r) => !r.completed) || [];
  const completed = reminders?.filter((r) => r.completed) || [];

  const getDateStatus = (dueDate: string) => {
    const d = new Date(dueDate);
    if (isToday(d)) return { label: "Today", color: "bg-chart-5/10 text-chart-5" };
    if (isPast(d)) return { label: "Overdue", color: "bg-destructive/10 text-destructive" };
    return { label: format(d, "d MMM"), color: "" };
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-reminders-title">
            Reminders
          </h1>
          <p className="text-muted-foreground">
            Track deadlines and key dates
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedMatterId("none"); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-reminder">
              <Plus className="h-4 w-4 mr-2" />
              New Reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>Create Reminder</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Link to Matter</Label>
                <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
                  <SelectTrigger data-testid="select-reminder-matter">
                    <SelectValue placeholder="Select matter (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No matter</SelectItem>
                    {matters?.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-title">Title</Label>
                <Input id="r-title" name="title" placeholder="e.g., Chase search results" required data-testid="input-r-title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-date">Due Date</Label>
                <Input id="r-date" name="dueDate" type="date" required data-testid="input-r-date" />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-reminder">
                {createMutation.isPending ? "Creating..." : "Create Reminder"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : !reminders || reminders.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold mb-1">No reminders</h3>
          <p className="text-sm text-muted-foreground">
            Create a reminder to track key dates
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Pending ({pending.length})
              </h2>
              {pending.map((reminder) => {
                const dateStatus = getDateStatus(reminder.dueDate.toString());
                return (
                  <Card key={reminder.id} className="glass-card rounded-md" data-testid={`card-reminder-${reminder.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => completeMutation.mutate(reminder.id)}
                            disabled={completeMutation.isPending}
                            className="flex-shrink-0"
                            data-testid={`button-complete-reminder-${reminder.id}`}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{reminder.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <Badge className={`text-xs ${dateStatus.color}`}>
                                {dateStatus.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(reminder.dueDate), "d MMM yyyy")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <a
                            href={generateReminderLink(reminder.title, reminder.dueDate.toString())}
                            download={`${reminder.title.replace(/\s/g, "_")}.ics`}
                            data-testid={`link-ical-${reminder.id}`}
                          >
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              iCal
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(reminder.id)}
                            data-testid={`button-delete-reminder-${reminder.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Completed ({completed.length})
              </h2>
              {completed.map((reminder) => (
                <Card key={reminder.id} className="glass-card rounded-md opacity-60" data-testid={`card-reminder-completed-${reminder.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-chart-4 flex-shrink-0" />
                      <p className="text-sm line-through truncate">{reminder.title}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
