import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { Plus, Search, Briefcase, LayoutGrid, List, Eye, CalendarCheck, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Matter, MatterType } from "@shared/schema";
import { WORKFLOW_STAGES, IMMIGRATION_WORKFLOW_STAGES, IMMIGRATION_MATTER_TYPES, CONVEYANCING_MATTER_TYPES, getImmigrationWorkflowStages } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { format, addDays } from "date-fns";

type ViewMode = "grid" | "list";

export default function Matters() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formType, setFormType] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const { toast } = useToast();
  const { department } = useAuth();

  const { data: matters, isLoading } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("POST", "/api/matters", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters"] });
      setDialogOpen(false);
      setFormType("");
      toast({ title: "Matter created", description: "New matter has been created with workflow tasks." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formType) {
      toast({ title: "Error", description: "Please select a transaction type", variant: "destructive" });
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

  const isImmigrationMatter = (type: string) => (IMMIGRATION_MATTER_TYPES as readonly string[]).includes(type);

  const getNextStage = (matter: Matter): string | null => {
    const stages = isImmigrationMatter(matter.type)
      ? IMMIGRATION_WORKFLOW_STAGES
      : WORKFLOW_STAGES[matter.type as MatterType];
    if (!stages) return null;
    const idx = (stages as readonly string[]).indexOf(matter.currentStage);
    if (idx >= 0 && idx < stages.length - 1) return stages[idx + 1];
    return null;
  };

  const filtered = matters?.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.clientName.toLowerCase().includes(search.toLowerCase()) ||
      m.propertyAddress.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || m.type === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  const sorted = [...filtered].sort((a, b) => {
    const aViewed = a.lastViewedAt ? new Date(a.lastViewedAt).getTime() : 0;
    const bViewed = b.lastViewedAt ? new Date(b.lastViewedAt).getTime() : 0;
    return bViewed - aViewed;
  });

  const typeColors: Record<string, string> = {
    sale: "bg-chart-4/10 text-chart-4",
    purchase: "bg-primary/10 text-primary",
    remortgage: "bg-chart-5/10 text-chart-5",
    visa_application: "bg-blue-500/10 text-blue-600",
    asylum: "bg-amber-500/10 text-amber-600",
    appeal: "bg-red-500/10 text-red-600",
    settlement: "bg-emerald-500/10 text-emerald-600",
    naturalisation: "bg-purple-500/10 text-purple-600",
  };

  const typeLabels: Record<string, string> = {
    sale: "Sale",
    purchase: "Purchase",
    remortgage: "Remortgage",
    visa_application: "Visa Application",
    asylum: "Asylum",
    appeal: "Appeal",
    settlement: "Settlement",
    naturalisation: "Naturalisation",
  };

  const showConveyancing = department === "conveyancing" || department === "both";
  const showImmigration = department === "immigration" || department === "both";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-matters-title">
            Matters
          </h1>
          <p className="text-muted-foreground">
            {showImmigration && !showConveyancing ? "Manage your immigration cases" : showConveyancing && !showImmigration ? "Manage your conveyancing transactions" : "Manage your legal matters"}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setFormType(""); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-matter">
              <Plus className="h-4 w-4 mr-2" />
              New Matter
            </Button>
          </DialogTrigger>
          <DialogContent className="glass sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Matter</DialogTitle>
              <DialogDescription>{showImmigration && !showConveyancing ? "Add a new immigration case" : "Add a new matter"}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Matter Title</Label>
                <Input id="title" name="title" placeholder={showImmigration && !showConveyancing ? "e.g., Skilled Worker Visa — John Smith" : "e.g., Sale of 10 High Street"} required data-testid="input-matter-title" />
              </div>
              <div className="space-y-2">
                <Label>{showImmigration && !showConveyancing ? "Case Type" : "Transaction Type"}</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger data-testid="select-matter-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {showConveyancing && (
                      <>
                        <SelectItem value="sale">Sale</SelectItem>
                        <SelectItem value="purchase">Purchase</SelectItem>
                        <SelectItem value="remortgage">Remortgage</SelectItem>
                      </>
                    )}
                    {showImmigration && (
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
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input id="clientName" name="clientName" placeholder="Full name" required data-testid="input-client-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Client Email</Label>
                <Input id="clientEmail" name="clientEmail" type="email" placeholder="email@example.com" data-testid="input-client-email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="propertyAddress">{showImmigration && !showConveyancing ? "Client Address" : "Property Address"}</Label>
                <Textarea id="propertyAddress" name="propertyAddress" placeholder={showImmigration && !showConveyancing ? "Client address" : "Full property address"} required data-testid="input-property-address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{showImmigration && !showConveyancing ? "Fee Quote" : "Price"}</Label>
                <Input id="price" name="price" placeholder={showImmigration && !showConveyancing ? "e.g., 2,500" : "e.g., 350,000"} data-testid="input-price" />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-matter">
                {createMutation.isPending ? "Creating..." : "Create Matter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search matters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-matters"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="select-filter-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {showConveyancing && (
              <>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="remortgage">Remortgage</SelectItem>
              </>
            )}
            {showImmigration && (
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
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
            data-testid="button-view-grid"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
            data-testid="button-view-list"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-2"}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={viewMode === "grid" ? "h-40 w-full rounded-md" : "h-16 w-full rounded-md"} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold mb-1">No matters found</h3>
          <p className="text-sm text-muted-foreground">
            {search || typeFilter !== "all"
              ? "Try adjusting your search or filter"
              : "Create your first matter to get started"}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((matter) => {
            const nextStage = getNextStage(matter);
            return (
              <Link href={`/matters/${matter.id}`} key={matter.id}>
                <Card className="glass-card rounded-md hover-elevate cursor-pointer h-full" data-testid={`card-matter-${matter.id}`}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold truncate flex-1">{matter.title}</h3>
                      <Badge className={`capitalize text-xs ${typeColors[matter.type] || ""}`}>
                        {typeLabels[matter.type] || matter.type}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <p className="truncate">{matter.clientName}</p>
                      <p className="truncate">{matter.propertyAddress}</p>
                      {matter.price && <p className="font-medium text-foreground">{matter.price}</p>}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Badge variant="outline" className="text-xs">
                        {matter.currentStage}
                      </Badge>
                      {matter.lastViewedAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {format(new Date(matter.lastViewedAt), "d MMM, HH:mm")}
                        </span>
                      )}
                    </div>
                    {nextStage && (
                      <div className="px-2.5 py-1.5 rounded-md glass-subtle flex items-center gap-1.5" data-testid={`nudge-matter-next-${matter.id}`}>
                        <ArrowRight className="h-3 w-3 text-primary/50 flex-shrink-0" />
                        <p className="text-xs italic text-primary/60 truncate">Next: {nextStage}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_100px_120px_140px_140px] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span>Matter</span>
            <span>Type</span>
            <span>Stage</span>
            <span>Last Viewed</span>
            <span>Review Date</span>
          </div>
          {sorted.map((matter) => {
            const reviewDate = matter.lastViewedAt
              ? addDays(new Date(matter.lastViewedAt), 7)
              : null;
            const isOverdue = reviewDate && reviewDate < new Date();
            return (
              <Link href={`/matters/${matter.id}`} key={matter.id}>
                <div
                  className="grid grid-cols-[1fr_100px_120px_140px_140px] gap-3 items-center px-4 py-3 rounded-md glass-subtle hover-elevate cursor-pointer"
                  data-testid={`row-matter-${matter.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{matter.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{matter.clientName}</p>
                  </div>
                  <Badge className={`capitalize text-xs w-fit ${typeColors[matter.type] || ""}`}>
                    {typeLabels[matter.type] || matter.type}
                  </Badge>
                  <Badge variant="outline" className="text-xs w-fit truncate">
                    {matter.currentStage}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {matter.lastViewedAt ? (
                      <>
                        <Eye className="h-3 w-3 flex-shrink-0" />
                        <span>{format(new Date(matter.lastViewedAt), "d MMM, HH:mm")}</span>
                      </>
                    ) : (
                      <span className="italic">Not viewed</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {reviewDate ? (
                      <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                        <CalendarCheck className="h-3 w-3 inline mr-1" />
                        {format(reviewDate, "d MMM yyyy")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">--</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
