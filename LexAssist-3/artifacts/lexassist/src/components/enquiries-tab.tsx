import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  Send,
  Pencil,
  AlertTriangle,
  Trash2,
  Eye,
  FileUp,
  Loader2,
  Shield,
  Clock,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Matter, Document as MatterDoc, EnquiryPack } from "@shared/schema";
import { DOCUMENT_TYPES } from "@shared/schema";
import { format } from "date-fns";

interface EnquiriesTabProps {
  matter: Matter & { documents: MatterDoc[]; enquiryPacks: EnquiryPack[] };
  matterId: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  review_required: "bg-chart-4/10 text-chart-4",
  approved: "bg-green-500/10 text-green-600",
  sent: "bg-primary/10 text-primary",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  review_required: "Review Required",
  approved: "Approved",
  sent: "Sent",
};

export default function EnquiriesTab({ matter, matterId }: EnquiriesTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("");
  const [viewPackId, setViewPackId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendPackId, setSendPackId] = useState<number | null>(null);
  const [sendRecipient, setSendRecipient] = useState("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [enquiryDocId, setEnquiryDocId] = useState<number | null>(null);
  const { toast } = useToast();

  const documents = matter.documents || [];
  const enquiryPacks = matter.enquiryPacks || [];

  const { data: viewPack } = useQuery<EnquiryPack>({
    queryKey: ["/api/enquiry-packs", viewPackId],
    enabled: !!viewPackId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/matters/${matterId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      setUploadDialogOpen(false);
      setUploadDocType("");
      const count = Array.isArray(data) ? data.length : 1;
      toast({ title: count > 1 ? `${count} documents uploaded` : "Document uploaded" });
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      toast({ title: "Document deleted" });
    },
  });

  const generatePurchaseMutation = useMutation({
    mutationFn: async (documentIds: number[]) => {
      const res = await apiRequest("POST", `/api/matters/${matterId}/generate-purchase-enquiries`, { documentIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      setGenerateDialogOpen(false);
      setSelectedDocIds([]);
      toast({ title: "Enquiries pack generated", description: "Review required before sending." });
    },
    onError: (err: Error) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  const generateSaleMutation = useMutation({
    mutationFn: async ({ enquiryDocId, supportingDocIds }: { enquiryDocId: number; supportingDocIds: number[] }) => {
      const res = await apiRequest("POST", `/api/matters/${matterId}/generate-sale-replies`, { enquiryDocId, supportingDocIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      setGenerateDialogOpen(false);
      setSelectedDocIds([]);
      setEnquiryDocId(null);
      toast({ title: "Replies pack generated", description: "Review required before sending." });
    },
    onError: (err: Error) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, contentMarkdown }: { id: number; contentMarkdown: string }) => {
      const res = await apiRequest("PATCH", `/api/enquiry-packs/${id}`, { contentMarkdown });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiry-packs", viewPackId] });
      setEditMode(false);
      toast({ title: "Pack updated" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/enquiry-packs/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiry-packs", viewPackId] });
      toast({ title: "Pack approved" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({ id, recipient }: { id: number; recipient: string }) => {
      const res = await apiRequest("POST", `/api/enquiry-packs/${id}/send`, { recipient });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiry-packs", viewPackId] });
      setSendDialogOpen(false);
      setSendRecipient("");
      toast({ title: "Pack sent", description: "A draft email has been created." });
    },
  });

  const handleUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const files = fileInput?.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    formData.append("documentType", uploadDocType || "Other");
    uploadMutation.mutate(formData);
  };

  const purchaseDocs = documents.filter(d =>
    ["Contract Pack", "TA6", "TA7", "TA10", "Title Register", "Title Plan", "Searches"].includes(d.documentType)
  );
  const buyerEnquiryDocs = documents.filter(d => d.documentType === "Buyer Enquiries");
  const showPurchaseBanner = matter.type === "purchase" && purchaseDocs.length > 0;
  const showSaleBanner = matter.type === "sale" && buyerEnquiryDocs.length > 0;

  const toggleDocId = (id: number) => {
    setSelectedDocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      {showPurchaseBanner && (
        <Card className="border-chart-4/30 bg-chart-4/5">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-chart-4" />
              <div>
                <p className="font-medium text-sm">Contract Pack received</p>
                <p className="text-xs text-muted-foreground">{purchaseDocs.length} relevant document(s) uploaded</p>
              </div>
            </div>
            <Button size="sm" onClick={() => { setSelectedDocIds(purchaseDocs.map(d => d.id)); setGenerateDialogOpen(true); }} data-testid="button-generate-purchase-enquiries">
              <Sparkles className="h-4 w-4 mr-1" />
              Generate Enquiries Pack
            </Button>
          </CardContent>
        </Card>
      )}

      {showSaleBanner && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Buyer enquiries received</p>
                <p className="text-xs text-muted-foreground">{buyerEnquiryDocs.length} enquiry document(s) uploaded</p>
              </div>
            </div>
            <Button size="sm" onClick={() => { setEnquiryDocId(buyerEnquiryDocs[0]?.id || null); setSelectedDocIds(documents.filter(d => d.documentType !== "Buyer Enquiries").map(d => d.id)); setGenerateDialogOpen(true); }} data-testid="button-generate-sale-replies">
              <Sparkles className="h-4 w-4 mr-1" />
              Draft Replies
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card rounded-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileUp className="h-4 w-4" />
                Documents
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-document">
                <Upload className="h-3.5 w-3.5 mr-1" />
                Upload
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4 text-center">No documents uploaded yet</p>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md glass-subtle" data-testid={`doc-${doc.id}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{doc.originalName}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{doc.documentType}</Badge>
                        <span className="text-xs text-muted-foreground">{format(new Date(doc.createdAt), "d MMM HH:mm")}</span>
                      </div>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => deleteDocMutation.mutate(doc.id)} data-testid={`button-delete-doc-${doc.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Enquiry Packs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {enquiryPacks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4 text-center">No packs generated yet</p>
            ) : (
              enquiryPacks.map(pack => (
                <div key={pack.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md glass-subtle cursor-pointer" onClick={() => { setViewPackId(pack.id); setEditMode(false); }} data-testid={`pack-${pack.id}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {pack.packType === "purchase_enquiries" ? "Purchase Enquiries Pack" : "Sale Replies Pack"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs ${statusColors[pack.status]}`}>{statusLabels[pack.status]}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(pack.createdAt), "d MMM HH:mm")}
                      </span>
                    </div>
                    {(pack.riskFlags as string[])?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                        <span className="text-xs text-destructive">{(pack.riskFlags as string[]).length} risk flag(s)</span>
                      </div>
                    )}
                  </div>
                  <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="glass sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>Upload one or more documents to this matter</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger data-testid="select-doc-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-file">Files</Label>
              <Input id="doc-file" name="files" type="file" multiple required data-testid="input-doc-file" />
            </div>
            <Button type="submit" className="w-full" disabled={uploadMutation.isPending} data-testid="button-submit-upload">
              {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={generateDialogOpen} onOpenChange={(open) => { setGenerateDialogOpen(open); if (!open) { setSelectedDocIds([]); setEnquiryDocId(null); } }}>
        <DialogContent className="glass sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {matter.type === "purchase" ? "Generate Enquiries Pack" : "Generate Sale Replies"}
            </DialogTitle>
            <DialogDescription>
              Select documents to include in AI analysis. Sensitive data will be redacted before processing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {matter.type === "sale" && buyerEnquiryDocs.length > 0 && (
              <div className="space-y-2">
                <Label>Buyer Enquiries Document</Label>
                <Select value={enquiryDocId?.toString() || ""} onValueChange={v => setEnquiryDocId(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select enquiry document" />
                  </SelectTrigger>
                  <SelectContent>
                    {buyerEnquiryDocs.map(d => (
                      <SelectItem key={d.id} value={d.id.toString()}>{d.originalName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>{matter.type === "sale" ? "Supporting Documents" : "Documents to Analyse"}</Label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {documents.filter(d => matter.type === "sale" ? d.documentType !== "Buyer Enquiries" : true).map(doc => (
                  <label key={doc.id} className="flex items-center gap-2 p-2 rounded glass-subtle cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDocIds.includes(doc.id)}
                      onChange={() => toggleDocId(doc.id)}
                      className="rounded"
                    />
                    <span className="text-sm truncate">{doc.originalName}</span>
                    <Badge variant="outline" className="text-xs ml-auto flex-shrink-0">{doc.documentType}</Badge>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
              <p className="font-medium mb-1 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Data Protection
              </p>
              <p>NI numbers, passport numbers, dates of birth, and bank details will be automatically redacted before AI processing. Generated output is a draft for solicitor review only.</p>
            </div>
            <Button
              className="w-full"
              disabled={
                (matter.type === "purchase" ? generatePurchaseMutation.isPending : generateSaleMutation.isPending) ||
                (matter.type === "purchase" ? selectedDocIds.length === 0 : !enquiryDocId)
              }
              onClick={() => {
                if (matter.type === "purchase") {
                  generatePurchaseMutation.mutate(selectedDocIds);
                } else if (enquiryDocId) {
                  generateSaleMutation.mutate({ enquiryDocId, supportingDocIds: selectedDocIds });
                }
              }}
              data-testid="button-confirm-generate"
            >
              {(generatePurchaseMutation.isPending || generateSaleMutation.isPending) ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Generate</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewPackId} onOpenChange={(open) => { if (!open) { setViewPackId(null); setEditMode(false); } }}>
        <DialogContent className="glass sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewPack?.packType === "purchase_enquiries" ? "Purchase Enquiries Pack" : "Sale Replies Pack"}
            </DialogTitle>
            <DialogDescription>
              {viewPack && (
                <span className="flex items-center gap-2 mt-1">
                  <Badge className={`text-xs ${statusColors[viewPack.status]}`}>{statusLabels[viewPack.status]}</Badge>
                  {viewPack.approvedBy && <span className="text-xs">Approved by {viewPack.approvedBy}</span>}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {viewPack && (
            <div className="space-y-4">
              {(viewPack.riskFlags as string[])?.length > 0 && (
                <div className="p-3 rounded-md border border-destructive/30 bg-destructive/5">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1 mb-1">
                    <AlertTriangle className="h-4 w-4" /> Risk Flags
                  </p>
                  <ul className="text-xs text-destructive/80 space-y-1">
                    {(viewPack.riskFlags as string[]).map((flag, i) => (
                      <li key={i}>• {flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {editMode ? (
                <div className="space-y-3">
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="min-h-[400px] font-mono text-xs"
                    data-testid="textarea-edit-pack"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                    <Button size="sm" onClick={() => editMutation.mutate({ id: viewPack.id, contentMarkdown: editContent })} disabled={editMutation.isPending} data-testid="button-save-edit">
                      {editMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm" data-testid="text-pack-content">
                  <ReactMarkdown>{viewPack.contentMarkdown}</ReactMarkdown>
                </div>
              )}

              <div className="flex items-center gap-2 justify-end pt-2 border-t flex-wrap">
                {viewPack.status !== "sent" && !editMode && (
                  <Button variant="outline" size="sm" onClick={() => { setEditContent(viewPack.contentMarkdown); setEditMode(true); }} data-testid="button-edit-pack">
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
                {viewPack.status !== "approved" && viewPack.status !== "sent" && (
                  <Button variant="outline" size="sm" onClick={() => approveMutation.mutate(viewPack.id)} disabled={approveMutation.isPending} data-testid="button-approve-pack">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {approveMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                )}
                {viewPack.status === "approved" && (
                  <Button size="sm" onClick={() => { setSendPackId(viewPack.id); setSendDialogOpen(true); }} data-testid="button-send-pack">
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Send
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="glass sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Pack</DialogTitle>
            <DialogDescription>This will create a draft email with the pack content</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="send-recipient">Recipient</Label>
              <Input
                id="send-recipient"
                value={sendRecipient}
                onChange={e => setSendRecipient(e.target.value)}
                placeholder="Recipient email or name"
                data-testid="input-send-recipient"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => sendPackId && sendMutation.mutate({ id: sendPackId, recipient: sendRecipient })}
              disabled={sendMutation.isPending}
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending ? "Sending..." : "Create Draft Email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
