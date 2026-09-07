import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAuthToken } from "@/lib/queryClient";
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
import { Plus, Mail, Sparkles, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DraftEmail, Matter } from "@shared/schema";
import { format } from "date-fns";

export default function DraftEmails() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedBody, setGeneratedBody] = useState("");
  const [selectedMatterId, setSelectedMatterId] = useState("none");
  const [formSubject, setFormSubject] = useState("");
  const [formRecipient, setFormRecipient] = useState("");
  const { toast } = useToast();

  const { data: emails, isLoading } = useQuery<DraftEmail[]>({
    queryKey: ["/api/draft-emails"],
  });

  const { data: matters } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/draft-emails", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/draft-emails"] });
      resetForm();
      toast({ title: "Draft email saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/draft-emails/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/draft-emails"] });
      toast({ title: "Draft email deleted" });
    },
  });

  const resetForm = () => {
    setDialogOpen(false);
    setGeneratedBody("");
    setSelectedMatterId("none");
    setFormSubject("");
    setFormRecipient("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload: Record<string, any> = {
      subject: formData.get("subject") as string,
      recipient: formData.get("recipient") as string || "",
      body: generatedBody || (formData.get("body") as string),
      status: "draft",
    };
    if (selectedMatterId !== "none") {
      payload.matterId = parseInt(selectedMatterId);
    }
    createMutation.mutate(payload);
  };

  const handleGenerateEmail = async () => {
    if (!formSubject) {
      toast({ title: "Enter a subject first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const token = getAuthToken();
      const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (token) fetchHeaders["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/ai/generate-email", {
        method: "POST",
        headers: fetchHeaders,
        body: JSON.stringify({
          recipient: formRecipient,
          subject: formSubject,
          context: `Subject: ${formSubject}, Recipient: ${formRecipient}`,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              text += event.content;
              setGeneratedBody(text);
            }
          } catch {}
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate email", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-emails-title">
            Draft Emails
          </h1>
          <p className="text-muted-foreground">
            Manage email drafts for your matters
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-email">
              <Plus className="h-4 w-4 mr-2" />
              New Draft
            </Button>
          </DialogTrigger>
          <DialogContent className="glass sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Draft Email</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Link to Matter</Label>
                <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
                  <SelectTrigger data-testid="select-email-matter">
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
                <Label htmlFor="de-recipient">Recipient</Label>
                <Input
                  id="de-recipient"
                  name="recipient"
                  placeholder="email@example.com"
                  value={formRecipient}
                  onChange={(e) => setFormRecipient(e.target.value)}
                  data-testid="input-de-recipient"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="de-subject">Subject</Label>
                <Input
                  id="de-subject"
                  name="subject"
                  placeholder="Email subject"
                  required
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  data-testid="input-de-subject"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="de-body">Body</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateEmail}
                    disabled={generating}
                    data-testid="button-ai-generate"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {generating ? "Generating..." : "AI Generate"}
                  </Button>
                </div>
                <Textarea
                  id="de-body"
                  name="body"
                  placeholder="Email content..."
                  rows={8}
                  required
                  value={generatedBody}
                  onChange={(e) => setGeneratedBody(e.target.value)}
                  data-testid="input-de-body"
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-draft">
                {createMutation.isPending ? "Saving..." : "Save Draft"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-md" />
          ))}
        </div>
      ) : !emails || emails.length === 0 ? (
        <div className="text-center py-16">
          <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold mb-1">No draft emails</h3>
          <p className="text-sm text-muted-foreground">
            Create a draft email to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <Card key={email.id} className="glass-card rounded-md" data-testid={`card-email-${email.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{email.subject}</h3>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {email.status}
                      </Badge>
                    </div>
                    {email.recipient && (
                      <p className="text-xs text-muted-foreground">To: {email.recipient}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                      {email.body}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(email.createdAt), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(email.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-email-${email.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
