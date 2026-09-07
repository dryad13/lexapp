import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PoundSterling, Plus, Pencil, Trash2, Download, Save } from "lucide-react";
import type { FinancialItem, MatterFinancials, Matter } from "@shared/schema";

const CATEGORY_LABELS: Record<string, string> = {
  legal_fee: "Legal Fee",
  disbursement: "Disbursement",
  search_fee: "Search Fee",
  land_registry: "Land Registry",
  stamp_duty: "Stamp Duty",
  bank_transfer: "Bank Transfer",
  other_cost: "Other Cost",
};

const CATEGORY_COLORS: Record<string, string> = {
  legal_fee: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  disbursement: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  search_fee: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  land_registry: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  stamp_duty: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  bank_transfer: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  other_cost: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface FinancialLedgerProps {
  matter: Matter;
  matterId: string;
}

export default function FinancialLedger({ matter, matterId }: FinancialLedgerProps) {
  const { toast } = useToast();
  const numericId = parseInt(matterId);

  const { data, isLoading } = useQuery<{ items: FinancialItem[]; summary: MatterFinancials | null }>({
    queryKey: [`/api/matters/${numericId}/financials`],
  });

  const items = data?.items || [];
  const summary = data?.summary;

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<FinancialItem | null>(null);
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("legal_fee");
  const [amount, setAmount] = useState("");
  const [vatRate, setVatRate] = useState("20");

  const [moniesOnAccount, setMoniesOnAccount] = useState("");
  const [mortgageAdvance, setMortgageAdvance] = useState("");
  const [redemptionAmount, setRedemptionAmount] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [summaryDirty, setSummaryDirty] = useState(false);

  const [summaryLoaded, setSummaryLoaded] = useState(false);

  if (!summaryLoaded && data) {
    setMoniesOnAccount(summary?.moniesOnAccount || "0");
    setMortgageAdvance(summary?.mortgageAdvance || "0");
    setRedemptionAmount(summary?.redemptionAmount || "0");
    setSalePrice(summary?.salePrice || "0");
    setPurchasePrice(summary?.purchasePrice || "0");
    setSummaryDirty(false);
    setSummaryLoaded(true);
  }

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", `/api/matters/${numericId}/financial-items`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/matters/${numericId}/financials`] });
      toast({ title: "Cost added" });
      resetForm();
      setAddOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const res = await apiRequest("PATCH", `/api/financial-items/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/matters/${numericId}/financials`] });
      toast({ title: "Cost updated" });
      setEditItem(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/financial-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/matters/${numericId}/financials`] });
      toast({ title: "Cost removed" });
    },
  });

  const saveSummaryMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("PATCH", `/api/matters/${numericId}/financials-summary`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/matters/${numericId}/financials`] });
      toast({ title: "Financial summary saved" });
      setSummaryDirty(false);
    },
  });

  function resetForm() {
    setDesc("");
    setCategory("legal_fee");
    setAmount("");
    setVatRate("20");
  }

  function openEdit(item: FinancialItem) {
    setEditItem(item);
    setDesc(item.description);
    setCategory(item.category);
    setAmount(item.amount);
    setVatRate(item.vatRate || "0");
    setAddOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const net = parseFloat(amount) || 0;
    const vr = parseFloat(vatRate) || 0;
    const vatAmt = (net * vr) / 100;
    const total = net + vatAmt;

    const body = {
      description: desc,
      category,
      amount: net.toFixed(2),
      vatRate: vr.toFixed(2),
      vatAmount: vatAmt.toFixed(2),
      totalAmount: total.toFixed(2),
      sortOrder: editItem ? editItem.sortOrder : items.length,
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  function handleExport() {
    window.open(`/api/matters/${numericId}/financials/export`, "_blank");
  }

  function handleSaveSummary() {
    saveSummaryMutation.mutate({
      moniesOnAccount,
      mortgageAdvance,
      redemptionAmount,
      salePrice,
      purchasePrice,
    });
  }

  const totalNet = items.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  const totalVat = items.reduce((s, i) => s + parseFloat(i.vatAmount || "0"), 0);
  const totalGross = items.reduce((s, i) => s + parseFloat(i.totalAmount || "0"), 0);

  const fundsInMon = parseFloat(moniesOnAccount || "0");
  const fundsInMort = parseFloat(mortgageAdvance || "0");
  const fundsInSale = parseFloat(salePrice || "0");
  const fundsIn = fundsInMon + fundsInMort + fundsInSale;
  const fundsOutRedemption = parseFloat(redemptionAmount || "0");
  const fundsOutPurchase = parseFloat(purchasePrice || "0");
  const fundsOut = totalGross + fundsOutRedemption + fundsOutPurchase;
  const balance = fundsIn - fundsOut;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading financials...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <PoundSterling className="h-5 w-5" />
          Costs & Financial Ledger
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-financials">
            <Download className="h-3.5 w-3.5 mr-1" />
            Export Excel
          </Button>
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setEditItem(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-cost">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Cost
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editItem ? "Edit Cost" : "Add Cost"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Legal fee for purchase" required data-testid="input-cost-description" />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-cost-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Net Amount (£)</Label>
                    <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required data-testid="input-cost-amount" />
                  </div>
                  <div className="space-y-1">
                    <Label>VAT Rate (%)</Label>
                    <Select value={vatRate} onValueChange={setVatRate}>
                      <SelectTrigger data-testid="select-vat-rate">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0% (No VAT)</SelectItem>
                        <SelectItem value="20">20% (Standard)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {parseFloat(amount || "0") > 0 && (
                  <div className="bg-muted/30 rounded-md p-2 text-xs space-y-0.5">
                    <div className="flex justify-between"><span>Net:</span><span>£{fmt(amount)}</span></div>
                    <div className="flex justify-between"><span>VAT ({vatRate}%):</span><span>£{fmt((parseFloat(amount || "0") * parseFloat(vatRate || "0") / 100).toFixed(2))}</span></div>
                    <div className="flex justify-between font-semibold"><span>Total:</span><span>£{fmt((parseFloat(amount || "0") * (1 + parseFloat(vatRate || "0") / 100)).toFixed(2))}</span></div>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-cost">
                  {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editItem ? "Update Cost" : "Add Cost"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass-card rounded-md lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Costs & Disbursements</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-costs">No costs added yet. Click "Add Cost" to begin.</p>
            ) : (
              <div className="space-y-0">
                <div className="grid grid-cols-[1fr_auto_80px_80px_80px_60px] gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pb-1.5 border-b px-1">
                  <span>Description</span>
                  <span>Category</span>
                  <span className="text-right">Net</span>
                  <span className="text-right">VAT</span>
                  <span className="text-right">Total</span>
                  <span></span>
                </div>
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto_80px_80px_80px_60px] gap-2 items-center py-2 border-b border-border/30 px-1 text-sm" data-testid={`financial-item-${item.id}`}>
                    <span className="truncate">{item.description}</span>
                    <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${CATEGORY_COLORS[item.category] || ""}`}>
                      {CATEGORY_LABELS[item.category] || item.category}
                    </Badge>
                    <span className="text-right font-mono text-xs">£{fmt(item.amount)}</span>
                    <span className="text-right font-mono text-xs text-muted-foreground">£{fmt(item.vatAmount)}</span>
                    <span className="text-right font-mono text-xs font-medium">£{fmt(item.totalAmount)}</span>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground" data-testid={`edit-cost-${item.id}`}>
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" data-testid={`delete-cost-${item.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_auto_80px_80px_80px_60px] gap-2 items-center py-2 px-1 font-semibold text-sm bg-muted/20 rounded-b">
                  <span>Total</span>
                  <span></span>
                  <span className="text-right font-mono text-xs">£{fmt(totalNet)}</span>
                  <span className="text-right font-mono text-xs">£{fmt(totalVat)}</span>
                  <span className="text-right font-mono text-xs">£{fmt(totalGross)}</span>
                  <span></span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="glass-card rounded-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Key Figures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Monies Paid on Account (£)</Label>
                <Input type="number" step="0.01" min="0" value={moniesOnAccount} onChange={(e) => { setMoniesOnAccount(e.target.value); setSummaryDirty(true); }} className="h-8 text-sm font-mono" data-testid="input-monies-on-account" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mortgage Advance Expected (£)</Label>
                <Input type="number" step="0.01" min="0" value={mortgageAdvance} onChange={(e) => { setMortgageAdvance(e.target.value); setSummaryDirty(true); }} className="h-8 text-sm font-mono" data-testid="input-mortgage-advance" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Redemption Amount (£)</Label>
                <Input type="number" step="0.01" min="0" value={redemptionAmount} onChange={(e) => { setRedemptionAmount(e.target.value); setSummaryDirty(true); }} className="h-8 text-sm font-mono" data-testid="input-redemption-amount" />
              </div>
              {(matter.type === "sale" || matter.type === "purchase") && (
                <>
                  {matter.type === "sale" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Sale Price (£)</Label>
                      <Input type="number" step="0.01" min="0" value={salePrice} onChange={(e) => { setSalePrice(e.target.value); setSummaryDirty(true); }} className="h-8 text-sm font-mono" data-testid="input-sale-price" />
                    </div>
                  )}
                  {matter.type === "purchase" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Purchase Price (£)</Label>
                      <Input type="number" step="0.01" min="0" value={purchasePrice} onChange={(e) => { setPurchasePrice(e.target.value); setSummaryDirty(true); }} className="h-8 text-sm font-mono" data-testid="input-purchase-price" />
                    </div>
                  )}
                </>
              )}
              {summaryDirty && (
                <Button size="sm" className="w-full" onClick={handleSaveSummary} disabled={saveSummaryMutation.isPending} data-testid="button-save-summary">
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saveSummaryMutation.isPending ? "Saving..." : "Save Figures"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card rounded-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Balance Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {fundsInMon > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monies on Account</span>
                  <span className="font-mono text-xs text-green-600 dark:text-green-400">+£{fmt(fundsInMon)}</span>
                </div>
              )}
              {fundsInMort > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mortgage Advance</span>
                  <span className="font-mono text-xs text-green-600 dark:text-green-400">+£{fmt(fundsInMort)}</span>
                </div>
              )}
              {fundsInSale > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sale Price</span>
                  <span className="font-mono text-xs text-green-600 dark:text-green-400">+£{fmt(fundsInSale)}</span>
                </div>
              )}
              {totalGross > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Costs & Disbs</span>
                  <span className="font-mono text-xs text-red-600 dark:text-red-400">-£{fmt(totalGross)}</span>
                </div>
              )}
              {fundsOutRedemption > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Redemption</span>
                  <span className="font-mono text-xs text-red-600 dark:text-red-400">-£{fmt(fundsOutRedemption)}</span>
                </div>
              )}
              {fundsOutPurchase > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purchase Price</span>
                  <span className="font-mono text-xs text-red-600 dark:text-red-400">-£{fmt(fundsOutPurchase)}</span>
                </div>
              )}
              <div className="border-t pt-1.5 flex justify-between font-semibold" data-testid="text-balance">
                <span>Balance</span>
                <span className={`font-mono text-sm ${balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {balance >= 0 ? "+" : "-"}£{fmt(Math.abs(balance))}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
