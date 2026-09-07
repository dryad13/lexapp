import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BookOpen, Plus, Trash2, ChevronDown, ChevronUp, Download, FileDown } from "lucide-react";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { JournalEntry } from "@shared/schema";
import { format, startOfISOWeek, endOfISOWeek, getISOWeek, getISOWeekYear } from "date-fns";

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "conveyancing", label: "Conveyancing" },
  { value: "compliance", label: "Compliance" },
  { value: "client-care", label: "Client Care" },
  { value: "land-registry", label: "Land Registry" },
  { value: "searches", label: "Searches" },
  { value: "sdlt", label: "SDLT" },
  { value: "anti-money-laundering", label: "AML" },
  { value: "professional-development", label: "CPD / SQE" },
  { value: "immigration", label: "Immigration" },
  { value: "family", label: "Family" },
  { value: "other", label: "Other" },
];

const categoryColors: Record<string, string> = {
  general: "bg-muted text-muted-foreground",
  conveyancing: "bg-primary/10 text-primary",
  compliance: "bg-chart-5/10 text-chart-5",
  "client-care": "bg-chart-4/10 text-chart-4",
  "land-registry": "bg-chart-2/10 text-chart-2",
  searches: "bg-chart-3/10 text-chart-3",
  sdlt: "bg-chart-1/10 text-chart-1",
  "anti-money-laundering": "bg-destructive/10 text-destructive",
  "professional-development": "bg-primary/10 text-primary",
  immigration: "bg-chart-2/10 text-chart-2",
  family: "bg-chart-4/10 text-chart-4",
  other: "bg-muted text-muted-foreground",
};

function toLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function downloadPdf(url: string, filename: string) {
  const token = getAuthToken();
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export default function Journal() {
  const { toast } = useToast();
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [formCategory, setFormCategory] = useState("general");
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [exportScope, setExportScope] = useState<"week" | "range">("week");
  const [rangeFrom, setRangeFrom] = useState(format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd"));
  const [rangeTo, setRangeTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: entries, isLoading } = useQuery<JournalEntry[]>({ queryKey: ["/api/journal-entries"] });

  const createEntryMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/journal-entries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      setEntryDialogOpen(false);
      setFormCategory("general");
      toast({ title: "Journal entry saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/journal-entries/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      setExpandedEntry(null);
      toast({ title: "Entry deleted" });
    },
  });

  const handleEntrySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const entryDateStr = fd.get("entryDate") as string;
    createEntryMutation.mutate({
      title: fd.get("title"),
      activity: fd.get("activity") || null,
      learning: fd.get("learning") || null,
      reflection: fd.get("reflection") || null,
      category: formCategory,
      entryDate: entryDateStr ? new Date(entryDateStr).toISOString() : new Date().toISOString(),
    });
  };

  const grouped = useMemo(() => {
    if (!entries) return [];
    const map = new Map<string, { weekStart: Date; weekEnd: Date; label: string; items: JournalEntry[] }>();
    for (const e of entries) {
      const d = new Date(e.entryDate || e.createdAt);
      const ws = startOfISOWeek(d);
      const we = endOfISOWeek(d);
      const key = `${getISOWeekYear(d)}-W${getISOWeek(d)}`;
      if (!map.has(key)) {
        map.set(key, { weekStart: ws, weekEnd: we, label: `Week ${getISOWeek(d)}, ${getISOWeekYear(d)}  ·  ${format(ws, "d MMM")} – ${format(we, "d MMM")}`, items: [] });
      }
      map.get(key)!.items.push(e);
    }
    return Array.from(map.values()).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  }, [entries]);

  const handleExport = async () => {
    try {
      if (exportScope === "week") {
        const ws = startOfISOWeek(new Date());
        await downloadPdf(`/api/journal-entries/export?scope=week&from=${ws.toISOString()}`, `journal-this-week.pdf`);
      } else {
        await downloadPdf(`/api/journal-entries/export?scope=range&from=${rangeFrom}&to=${rangeTo}`, `journal-${rangeFrom}-to-${rangeTo}.pdf`);
      }
      setExportDialogOpen(false);
      toast({ title: "PDF downloaded" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  const handleExportSingle = async (id: number) => {
    try {
      await downloadPdf(`/api/journal-entries/export?scope=single&id=${id}`, `journal-entry-${id}.pdf`);
      toast({ title: "PDF downloaded" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Reflective Journal</h1>
          <p className="text-muted-foreground">Activity, learning, reflection — grouped by week</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild><Button variant="outline"><FileDown className="h-4 w-4 mr-2" />Export PDF</Button></DialogTrigger>
            <DialogContent className="glass">
              <DialogHeader><DialogTitle>Export to PDF</DialogTitle><DialogDescription>Choose the scope</DialogDescription></DialogHeader>
              <div className="space-y-4">
                <Select value={exportScope} onValueChange={(v) => setExportScope(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This week (current ISO week)</SelectItem>
                    <SelectItem value="range">Date range</SelectItem>
                  </SelectContent>
                </Select>
                {exportScope === "range" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>From</Label><Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>To</Label><Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} /></div>
                  </div>
                )}
                <Button onClick={handleExport} className="w-full"><Download className="h-4 w-4 mr-2" />Download PDF</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={entryDialogOpen} onOpenChange={(open) => { setEntryDialogOpen(open); if (!open) setFormCategory("general"); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Entry</Button></DialogTrigger>
            <DialogContent className="glass sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New Journal Entry</DialogTitle><DialogDescription>Activity / Learning / Reflection</DialogDescription></DialogHeader>
              <form onSubmit={handleEntrySubmit} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="j-title">Title</Label><Input id="j-title" name="title" placeholder="e.g. Reviewed TA6 enquiries on 14 High St" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="j-date">Date / time</Label><Input id="j-date" name="entryDate" type="datetime-local" defaultValue={toLocalDatetimeInput(new Date())} /></div>
                  <div className="space-y-2"><Label>Category</Label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label htmlFor="j-activity">Activity — what did you do?</Label><Textarea id="j-activity" name="activity" rows={3} placeholder="The work, task, study session, or event..." /></div>
                <div className="space-y-2"><Label htmlFor="j-learning">Learning — what did you learn?</Label><Textarea id="j-learning" name="learning" rows={3} placeholder="New knowledge, procedures, references..." /></div>
                <div className="space-y-2"><Label htmlFor="j-reflection">Reflection — what would you do differently?</Label><Textarea id="j-reflection" name="reflection" rows={3} placeholder="What went well, what you'd improve, next steps..." /></div>
                <Button type="submit" className="w-full" disabled={createEntryMutation.isPending}>{createEntryMutation.isPending ? "Saving..." : "Save Entry"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card rounded-md"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total Entries</p><p className="text-2xl font-bold font-serif">{isLoading ? "..." : entries?.length || 0}</p></CardContent></Card>
        <Card className="glass-card rounded-md"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Weeks Logged</p><p className="text-2xl font-bold font-serif">{isLoading ? "..." : grouped.length}</p></CardContent></Card>
        <Card className="glass-card rounded-md"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Categories</p><p className="text-2xl font-bold font-serif">{isLoading ? "..." : new Set(entries?.map((e) => e.category)).size}</p></CardContent></Card>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : !entries || entries.length === 0 ? (
          <Card className="glass-card rounded-md"><CardContent className="p-8 text-center"><BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No entries yet. Start logging your learning.</p></CardContent></Card>
        ) : (
          grouped.map((week) => (
            <div key={week.label} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{week.label}</h2>
                <Badge variant="outline" className="text-xs">{week.items.length}</Badge>
              </div>
              <div className="space-y-2">
                {week.items.map((entry) => {
                  const isExpanded = expandedEntry === entry.id;
                  const date = new Date(entry.entryDate || entry.createdAt);
                  return (
                    <Card key={entry.id} className="glass-card rounded-md">
                      <div className="flex items-center gap-3 p-4 cursor-pointer hover-elevate rounded-md" onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}>
                        <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{entry.title}</p>
                            <Badge className={`text-xs capitalize ${categoryColors[entry.category] || ""}`}>{CATEGORIES.find((c) => c.value === entry.category)?.label || entry.category}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{format(date, "EEE d MMM yyyy, HH:mm")}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      {isExpanded && (
                        <CardContent className="pt-0 pb-4 px-4 space-y-3">
                          {entry.activity && (<div className="glass-subtle rounded-md p-3"><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Activity</p><p className="text-sm whitespace-pre-wrap">{entry.activity}</p></div>)}
                          {entry.learning && (<div className="glass-subtle rounded-md p-3"><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Learning</p><p className="text-sm whitespace-pre-wrap">{entry.learning}</p></div>)}
                          {entry.reflection && (<div className="glass-subtle rounded-md p-3"><p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Reflection</p><p className="text-sm whitespace-pre-wrap">{entry.reflection}</p></div>)}
                          {!entry.activity && !entry.learning && !entry.reflection && entry.content && (<div className="glass-subtle rounded-md p-3"><p className="text-sm whitespace-pre-wrap">{entry.content}</p></div>)}
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleExportSingle(entry.id); }}><Download className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteEntryMutation.mutate(entry.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
