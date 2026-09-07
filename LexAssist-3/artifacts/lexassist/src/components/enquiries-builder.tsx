import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  X,
  Download,
  Save,
  ListChecks,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  AlertTriangle,
  CheckSquare,
  Square,
  ClipboardList,
  Scan,
  Loader2,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EnquiriesLibraryItem, EnquiryPackItem, EnquiriesBuilderPack, Matter } from "@shared/schema";
import { ENQUIRY_CATEGORIES } from "@shared/schema";

type Template = {
  id: string;
  name: string;
  itemIds: number[];
};

function getCatBadgeClass(graceParagraph: string | null | undefined): string {
  if (!graceParagraph) return "text-chart-5";
  const g = graceParagraph.toLowerCase();
  if (g.startsWith("cat a")) return "text-red-600 border-red-300 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950";
  if (g === "cat b" || g.startsWith("cat b ")) return "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950";
  if (g === "cat c" || g.startsWith("cat c ")) return "text-emerald-600 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950";
  return "text-chart-5";
}

interface EnquiriesBuilderProps {
  matter: Matter;
  matterId: string;
}

export default function EnquiriesBuilder({ matter, matterId }: EnquiriesBuilderProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedItems, setSelectedItems] = useState<EnquiryPackItem[]>([]);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [activePackId, setActivePackId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<EnquiriesLibraryItem | null>(null);
  const [showSearchAnalysis, setShowSearchAnalysis] = useState(false);
  const [searchResultText, setSearchResultText] = useState("");
  const [analysisDocIds, setAnalysisDocIds] = useState<number[]>([]);
  const [analysisResult, setAnalysisResult] = useState<{
    contentJson: Record<string, any>;
    contentMarkdown: string;
  } | null>(null);

  const { data: library = [], isLoading: libraryLoading } = useQuery<EnquiriesLibraryItem[]>({
    queryKey: ["/api/enquiries/library"],
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/enquiries/templates"],
  });

  const { data: existingPacks = [] } = useQuery<EnquiriesBuilderPack[]>({
    queryKey: ["/api/matters", matterId, "builder-packs"],
    queryFn: async () => {
      const res = await fetch(`/api/matters/${matterId}/builder-packs`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch packs");
      return res.json();
    },
  });

  const filteredLibrary = useMemo(() => {
    let items = library;
    if (categoryFilter && categoryFilter !== "all") {
      items = items.filter((i) => i.category === categoryFilter);
    }
    if (matter.type === "purchase") {
      items = items.filter((i) => i.appliesTo === "purchase" || i.appliesTo === "both");
    } else if (matter.type === "sale") {
      items = items.filter((i) => i.appliesTo === "sale" || i.appliesTo === "both");
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(s) ||
          i.enquiryText.toLowerCase().includes(s) ||
          i.category.toLowerCase().includes(s) ||
          (i.tags || []).some((t) => t.toLowerCase().includes(s))
      );
    }
    return items;
  }, [library, categoryFilter, searchTerm, matter.type]);

  const selectedIds = useMemo(() => new Set(selectedItems.map((s) => s.libraryItemId)), [selectedItems]);

  const toggleItem = (item: EnquiriesLibraryItem) => {
    if (selectedIds.has(item.id)) {
      setSelectedItems((prev) => prev.filter((s) => s.libraryItemId !== item.id));
    } else {
      setSelectedItems((prev) => [
        ...prev,
        { libraryItemId: item.id, priority: "medium" },
      ]);
    }
  };

  const updateSelectedItem = (libraryItemId: number, updates: Partial<EnquiryPackItem>) => {
    setSelectedItems((prev) =>
      prev.map((s) => (s.libraryItemId === libraryItemId ? { ...s, ...updates } : s))
    );
  };

  const removeSelectedItem = (libraryItemId: number) => {
    setSelectedItems((prev) => prev.filter((s) => s.libraryItemId !== libraryItemId));
  };

  const applyTemplate = (template: Template) => {
    const newItems: EnquiryPackItem[] = template.itemIds
      .filter((id) => !selectedIds.has(id))
      .map((id) => ({ libraryItemId: id, priority: "medium" as const }));
    setSelectedItems((prev) => [...prev, ...newItems]);
    toast({ title: `Template applied`, description: `${newItems.length} enquiries added` });
  };

  const loadExistingPack = (pack: EnquiriesBuilderPack) => {
    setSelectedItems((pack.selectedItemsJson || []) as EnquiryPackItem[]);
    setActivePackId(pack.id);
    toast({ title: "Pack loaded" });
  };

  const savePackMutation = useMutation({
    mutationFn: async () => {
      if (activePackId) {
        const res = await apiRequest("PUT", `/api/builder-packs/${activePackId}`, {
          selectedItemsJson: selectedItems,
        });
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/matters/${matterId}/builder-packs`, {
          packType: "custom",
          selectedItemsJson: selectedItems,
        });
        return res.json();
      }
    },
    onSuccess: (data) => {
      setActivePackId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId, "builder-packs"] });
      toast({ title: "Pack saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save pack", variant: "destructive" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (packId: number) => {
      const token = getAuthToken();
      const res = await fetch(`/api/builder-packs/${packId}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || "enquiries.xlsx";
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Excel exported" });
    },
    onError: () => {
      toast({ title: "Error", description: "Export failed", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (packId: number) => {
      const res = await apiRequest("POST", `/api/builder-packs/${packId}/create-task`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      toast({ title: "Task created", description: "\"Send enquiries pack\" task added" });
    },
  });

  const analyseSearchesMutation = useMutation({
    mutationFn: async ({ text, docIds }: { text: string; docIds: number[] }) => {
      const res = await apiRequest("POST", `/api/matters/${matterId}/analyse-searches`, {
        searchText: text || "",
        documentIds: docIds,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      const flagged = data.contentJson?.flagged_enquiries?.length || 0;
      const issues = data.contentJson?.document_issues?.length || 0;
      toast({ title: "Analysis complete", description: `${flagged} enquiries flagged${issues > 0 ? `, ${issues} document issues found` : ""}` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyse materials", variant: "destructive" });
    },
  });

  const addFlaggedToSelection = (flaggedItems: any[]) => {
    const seenIds = new Set(selectedIds);
    const newItems: EnquiryPackItem[] = [];
    for (const flagged of flaggedItems) {
      const libId = flagged.library_item_id;
      if (libId && !seenIds.has(libId) && libraryItemMap.has(libId)) {
        seenIds.add(libId);
        newItems.push({
          libraryItemId: libId,
          priority: flagged.priority === "high" ? "high" : flagged.priority === "low" ? "low" : "medium",
          notes: flagged.reason,
          enquiryTextOverride: flagged.suggested_wording || undefined,
        });
      }
    }
    if (newItems.length > 0) {
      setSelectedItems((prev) => [...prev, ...newItems]);
      toast({ title: `${newItems.length} enquiries added to pack` });
    }
  };

  const handleSaveAndExport = async () => {
    if (selectedItems.length === 0) {
      toast({ title: "No enquiries selected", variant: "destructive" });
      return;
    }
    try {
      let packId = activePackId;
      if (!packId) {
        const res = await apiRequest("POST", `/api/matters/${matterId}/builder-packs`, {
          packType: "custom",
          selectedItemsJson: selectedItems,
        });
        const data = await res.json();
        packId = data.id;
        setActivePackId(data.id);
        queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId, "builder-packs"] });
      } else {
        await apiRequest("PUT", `/api/builder-packs/${packId}`, {
          selectedItemsJson: selectedItems,
        });
      }
      exportMutation.mutate(packId!);
    } catch {
      toast({ title: "Error", description: "Failed to save and export", variant: "destructive" });
    }
  };

  const libraryItemMap = useMemo(() => new Map(library.map((i) => [i.id, i])), [library]);

  const categories = useMemo(() => {
    const cats = new Set(library.map((i) => i.category));
    return Array.from(cats).sort();
  }, [library]);

  if (libraryLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md p-3 glass-subtle text-xs text-muted-foreground flex items-start gap-2" data-testid="text-enquiries-disclaimer">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-chart-5" />
        <span>Standard enquiry library. Always apply professional judgement and lender/client requirements.</span>
      </div>

      <div>
        <Button
          variant={showSearchAnalysis ? "default" : "outline"}
          size="sm"
          onClick={() => setShowSearchAnalysis(!showSearchAnalysis)}
          data-testid="button-toggle-search-analysis"
        >
          <Scan className="h-3.5 w-3.5 mr-1.5" />
          Analyse Searches
          {showSearchAnalysis ? <ChevronUp className="h-3.5 w-3.5 ml-1.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-1.5" />}
        </Button>
      </div>

      {showSearchAnalysis && (
        <Card className="glass-card rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Search Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md p-2.5 bg-muted/30 border border-border/40 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>Select uploaded documents (title register, contract pack, TA forms) and/or paste search results. The AI will analyse everything, cross-reference documents for discrepancies (e.g. name mismatches between contract and title), and flag enquiries to raise.</span>
            </div>

            {(matter.documents || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Select Documents to Analyse</p>
                <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                  {(matter.documents || []).map((doc: any) => {
                    const isChecked = analysisDocIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        className={`flex items-center gap-2 py-1.5 px-2 rounded text-sm cursor-pointer transition-colors ${isChecked ? "bg-primary/10 border border-primary/30" : "hover-elevate"}`}
                        onClick={() => {
                          setAnalysisDocIds(prev =>
                            prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                          );
                        }}
                        data-testid={`analysis-doc-${doc.id}`}
                      >
                        {isChecked ? (
                          <CheckSquare className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                        )}
                        <span className="flex-1 min-w-0 truncate text-xs">{doc.originalName}</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 flex-shrink-0">{doc.documentType}</Badge>
                      </div>
                    );
                  })}
                </div>
                {analysisDocIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{analysisDocIds.length} document{analysisDocIds.length !== 1 ? "s" : ""} selected</p>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Paste Search Results (optional)</p>
              <Textarea
                placeholder={"Paste search results here (optional if documents are selected)...\n\nFor example:\n- Local authority search results\n- Environmental search results\n- Drainage / mining / chancel results"}
                value={searchResultText}
                onChange={(e) => setSearchResultText(e.target.value)}
                rows={4}
                className="text-sm"
                data-testid="input-search-results"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => analyseSearchesMutation.mutate({ text: searchResultText, docIds: analysisDocIds })}
                disabled={analyseSearchesMutation.isPending || (searchResultText.trim().length < 20 && analysisDocIds.length === 0)}
                data-testid="button-analyse-searches"
              >
                {analyseSearchesMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analysing...</>
                ) : (
                  <><Scan className="h-3.5 w-3.5 mr-1.5" />Analyse</>
                )}
              </Button>
              {searchResultText.trim().length > 0 && searchResultText.trim().length < 20 && analysisDocIds.length === 0 && (
                <span className="text-xs text-muted-foreground">Enter at least 20 characters or select documents</span>
              )}
            </div>

            {analysisResult && (
              <div className="space-y-3 pt-2 border-t">
                {analysisResult.contentJson.search_summary && (
                  <div className="rounded-md p-2.5 bg-muted/30 border border-border/40">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Summary</p>
                    <p className="text-sm" data-testid="text-search-summary">{analysisResult.contentJson.search_summary}</p>
                  </div>
                )}

                {analysisResult.contentJson.flagged_enquiries?.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        Flagged Enquiries ({analysisResult.contentJson.flagged_enquiries.length})
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => addFlaggedToSelection(analysisResult.contentJson.flagged_enquiries)}
                        data-testid="button-add-all-flagged"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add All to Pack
                      </Button>
                    </div>
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                      {analysisResult.contentJson.flagged_enquiries.map((flagged: any, idx: number) => {
                        const lib = libraryItemMap.get(flagged.library_item_id);
                        const alreadySelected = selectedIds.has(flagged.library_item_id);
                        return (
                          <div
                            key={idx}
                            className={`rounded-md p-2.5 border text-sm ${alreadySelected ? "bg-primary/5 border-primary/30" : "glass-subtle"}`}
                            data-testid={`flagged-enquiry-${idx}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-sm">{flagged.library_item_title || lib?.title || "Unknown"}</span>
                                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                                    flagged.priority === "high" ? "text-red-600 border-red-300" :
                                    flagged.priority === "low" ? "text-emerald-600 border-emerald-300" :
                                    "text-amber-600 border-amber-300"
                                  }`}>
                                    {flagged.priority}
                                  </Badge>
                                  {flagged.search_type && (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0">{flagged.search_type}</Badge>
                                  )}
                                  {alreadySelected && (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 text-primary">In pack</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{flagged.reason}</p>
                                {flagged.suggested_wording && (
                                  <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-primary/30 pl-2">{flagged.suggested_wording}</p>
                                )}
                              </div>
                              {!alreadySelected && lib && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 flex-shrink-0"
                                  onClick={() => addFlaggedToSelection([flagged])}
                                  data-testid={`button-add-flagged-${idx}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {analysisResult.contentJson.additional_enquiries_not_in_library?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                      Additional Bespoke Enquiries
                    </p>
                    <div className="space-y-1.5">
                      {analysisResult.contentJson.additional_enquiries_not_in_library.map((extra: any, idx: number) => (
                        <div key={idx} className="rounded-md p-2.5 glass-subtle border text-sm" data-testid={`bespoke-enquiry-${idx}`}>
                          <p className="font-medium text-sm">{extra.suggested_text}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                              extra.priority === "high" ? "text-red-600 border-red-300" :
                              extra.priority === "low" ? "text-emerald-600 border-emerald-300" :
                              "text-amber-600 border-amber-300"
                            }`}>{extra.priority}</Badge>
                            {extra.search_type && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0">{extra.search_type}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{extra.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysisResult.contentJson.document_issues?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      Document Issues ({analysisResult.contentJson.document_issues.length})
                    </p>
                    <div className="space-y-1.5">
                      {analysisResult.contentJson.document_issues.map((issue: any, idx: number) => (
                        <div key={idx} className={`rounded-md p-2.5 border text-sm ${
                          issue.severity === "high" ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" :
                          issue.severity === "medium" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900" :
                          "glass-subtle"
                        }`} data-testid={`document-issue-${idx}`}>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="font-medium text-sm">{issue.document}</span>
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                              issue.severity === "high" ? "text-red-600 border-red-300" :
                              issue.severity === "medium" ? "text-amber-600 border-amber-300" :
                              "text-emerald-600 border-emerald-300"
                            }`}>{issue.severity}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{issue.issue}</p>
                          <p className="text-xs mt-1"><strong>Action:</strong> {issue.recommended_action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysisResult.contentJson.no_action_items?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-1.5">No Action Required</p>
                    <div className="space-y-1">
                      {analysisResult.contentJson.no_action_items.map((item: any, idx: number) => (
                        <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <CheckSquare className="h-3 w-3 mt-0.5 text-emerald-500 flex-shrink-0" />
                          <span><strong>{item.search_type}:</strong> {item.summary}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysisResult.contentJson.matters_to_report_to_client?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-1.5">Report to Client</p>
                    <div className="space-y-1">
                      {analysisResult.contentJson.matters_to_report_to_client.map((m: string, idx: number) => (
                        <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <Info className="h-3 w-3 mt-0.5 text-blue-500 flex-shrink-0" />
                          <span>{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysisResult.contentJson.risk_flags?.length > 0 && (
                  <div className="rounded-md p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                    <p className="text-sm font-semibold mb-1.5 text-red-700 dark:text-red-400">Risk Flags</p>
                    <div className="space-y-1">
                      {analysisResult.contentJson.risk_flags.map((f: string, idx: number) => (
                        <div key={idx} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {templates.length > 0 && (
          <Select onValueChange={(val) => {
            const t = templates.find((t) => t.id === val);
            if (t) applyTemplate(t);
          }}>
            <SelectTrigger className="w-auto min-w-[200px]" data-testid="select-template">
              <SelectValue placeholder="Create from Template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id} data-testid={`template-${t.id}`}>
                  {t.name} ({t.itemIds.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {existingPacks.length > 0 && (
          <Select onValueChange={(val) => {
            const p = existingPacks.find((p) => p.id === parseInt(val));
            if (p) loadExistingPack(p);
          }}>
            <SelectTrigger className="w-auto min-w-[180px]" data-testid="select-existing-pack">
              <SelectValue placeholder="Load Saved Pack..." />
            </SelectTrigger>
            <SelectContent>
              {existingPacks.map((p) => (
                <SelectItem key={p.id} value={String(p.id)} data-testid={`pack-${p.id}`}>
                  Pack #{p.id} ({(p.selectedItemsJson || []).length} items) – {p.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <Card className="glass-card rounded-md lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Library
              <Badge variant="secondary" className="text-xs">{filteredLibrary.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-sm"
                data-testid="input-library-search"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full h-8 text-sm" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="max-h-[460px] overflow-y-auto space-y-0.5 pr-1">
              {filteredLibrary.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">No matches</p>
              )}
              {filteredLibrary.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const isPreviewing = previewItem?.id === item.id;
                return (
                  <div key={item.id}>
                    <div
                      className={`flex items-center gap-1.5 py-1.5 px-2 rounded text-sm cursor-pointer transition-colors ${
                        isPreviewing ? "bg-primary/10 border border-primary/30" :
                        isSelected ? "bg-primary/5" : "hover-elevate"
                      }`}
                      onClick={() => setPreviewItem(item)}
                      data-testid={`library-item-${item.id}`}
                    >
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleItem(item); }}
                        className="flex-shrink-0"
                        data-testid={`toggle-item-${item.id}`}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-muted-foreground/40" />
                        )}
                      </button>
                      <span className="flex-1 min-w-0 truncate text-xs">{item.title}</span>
                      {item.graceParagraph && (
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 flex-shrink-0 ${getCatBadgeClass(item.graceParagraph)}`}>
                          {item.graceParagraph.startsWith("Cat") ? item.graceParagraph.split(" ").slice(0, 2).join(" ") : ""}
                        </Badge>
                      )}
                    </div>
                    {isPreviewing && (
                      <div className="xl:hidden mt-1 ml-5 mb-1 p-2 rounded bg-muted/30 border border-border/40">
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.enquiryText}</p>
                        {item.whenToUse && (
                          <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{item.whenToUse}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-md hidden xl:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previewItem ? (
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm">{previewItem.title}</h4>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{previewItem.category}</Badge>
                    {previewItem.graceParagraph && (
                      <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getCatBadgeClass(previewItem.graceParagraph)}`}>{previewItem.graceParagraph}</Badge>
                    )}
                    {previewItem.appliesTo && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">{previewItem.appliesTo}</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Enquiry Text</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{previewItem.enquiryText}</p>
                </div>
                {previewItem.whenToUse && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">When to use</p>
                    <p className="text-xs text-muted-foreground">{previewItem.whenToUse}</p>
                  </div>
                )}
                {previewItem.tags && previewItem.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {previewItem.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0">{tag}</Badge>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant={selectedIds.has(previewItem.id) ? "outline" : "default"}
                  className="w-full text-xs"
                  onClick={() => toggleItem(previewItem)}
                  data-testid="button-preview-toggle"
                >
                  {selectedIds.has(previewItem.id) ? "Remove from pack" : "Add to pack"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-6 w-6 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Click an enquiry to preview</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Selected Pack
                <Badge variant="secondary" className="text-xs">{selectedItems.length}</Badge>
              </CardTitle>
              {activePackId && (
                <Badge variant="outline" className="text-xs">Pack #{activePackId}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No enquiries selected</p>
                <p className="text-xs mt-1">Select from the library or apply a template</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
                {selectedItems.map((sel, idx) => {
                  const lib = libraryItemMap.get(sel.libraryItemId);
                  if (!lib) return null;
                  const isExpanded = expandedItem === sel.libraryItemId;
                  return (
                    <div
                      key={sel.libraryItemId}
                      className="border rounded-md p-2.5 text-sm glass-subtle"
                      data-testid={`selected-item-${sel.libraryItemId}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground font-mono mt-0.5 flex-shrink-0">
                          E{idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{lib.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {sel.enquiryTextOverride || lib.enquiryText}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setExpandedItem(isExpanded ? null : sel.libraryItemId)}
                            className="p-1 rounded hover-elevate"
                            data-testid={`button-expand-${sel.libraryItemId}`}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSelectedItem(sel.libraryItemId)}
                            className="p-1 rounded hover-elevate text-destructive/60"
                            data-testid={`button-remove-${sel.libraryItemId}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 pl-6 space-y-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Priority</label>
                            <Select
                              value={sel.priority || "medium"}
                              onValueChange={(val) => updateSelectedItem(sel.libraryItemId, { priority: val as any })}
                            >
                              <SelectTrigger className="h-7 text-xs mt-0.5" data-testid={`select-priority-${sel.libraryItemId}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Custom wording (optional)</label>
                            <Textarea
                              value={sel.enquiryTextOverride || ""}
                              onChange={(e) => updateSelectedItem(sel.libraryItemId, { enquiryTextOverride: e.target.value || undefined })}
                              rows={2}
                              className="text-xs mt-0.5"
                              placeholder={lib.enquiryText}
                              data-testid={`input-override-${sel.libraryItemId}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Notes / Reason</label>
                            <Input
                              value={sel.notes || ""}
                              onChange={(e) => updateSelectedItem(sel.libraryItemId, { notes: e.target.value || undefined })}
                              className="h-7 text-xs mt-0.5"
                              placeholder="Why this enquiry is needed..."
                              data-testid={`input-notes-${sel.libraryItemId}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Requested Evidence</label>
                            <Input
                              value={sel.requestedEvidence || ""}
                              onChange={(e) => updateSelectedItem(sel.libraryItemId, { requestedEvidence: e.target.value || undefined })}
                              className="h-7 text-xs mt-0.5"
                              placeholder="e.g., Copy of consent, certificate..."
                              data-testid={`input-evidence-${sel.libraryItemId}`}
                            />
                          </div>
                          {lib.whenToUse && (
                            <p className="text-[10px] text-muted-foreground italic">
                              When to use: {lib.whenToUse}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedItems.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-2 border-t">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => savePackMutation.mutate()}
                  disabled={savePackMutation.isPending}
                  data-testid="button-save-pack"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savePackMutation.isPending ? "Saving..." : "Save Pack"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAndExport}
                  disabled={exportMutation.isPending}
                  data-testid="button-export-excel"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                  {exportMutation.isPending ? "Exporting..." : "Export Excel"}
                </Button>
                {activePackId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createTaskMutation.mutate(activePackId)}
                    disabled={createTaskMutation.isPending}
                    data-testid="button-create-task"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Create Task
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
