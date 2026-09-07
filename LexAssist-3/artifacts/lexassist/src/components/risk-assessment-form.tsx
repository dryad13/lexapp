import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ShieldCheck, ShieldAlert, Save, CheckCircle2, FileText, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import type { RiskAssessment } from "@shared/schema";

interface RiskAssessmentFormProps {
  matterId: number;
  matterData?: {
    clientRef?: string;
    clientName?: string;
    type?: string;
    propertyAddress?: string;
  };
}

type YesNoNa = "yes" | "no" | "not_applicable" | "";

interface RiskFormData {
  clientRef: string;
  clientNames: string;
  typeOfMatter: string;
  clientAddress: string;
  dateOfBirth: string;
  occupationSourceOfIncome: string;
  entityType: string;
  conflictOfInterestCheck: string;
  clientCareLetterCompliant: string;

  evOnboarded: YesNoNa;
  evRecommendations: YesNoNa;
  evOtherActions: YesNoNa;
  evConcerns: string;
  evLivenessChecked: YesNoNa;
  evDateChecked: string;

  facialVerification: YesNoNa;
  signatureVerification: YesNoNa;
  verificationMethod: string;
  sameDocsAsEv: YesNoNa;
  docsIfDifferent: string;
  clientObstructive: YesNoNa;
  duressDetected: YesNoNa;
  facialConcerns: string;
  facialVerificationDate: string;
  facialVerificationLawyer: string;

  clientKnownToFe: YesNoNa;
  existingClient: YesNoNa;
  thirdPartyConnection: string;
  previousClientRef: string;
  sourceOfInstruction: string;
  unusualInstruction: YesNoNa;
  clientConcernsCapacity: YesNoNa;
  thirdPartyAuthority: YesNoNa;
  identifiedAsPep: YesNoNa;
  requestedShortcut: YesNoNa;
  multipleAddresses: YesNoNa;
  highNetWorth: YesNoNa;
  domiciledOverseas: YesNoNa;
  highRiskBusiness: YesNoNa;
  overseasInterests: YesNoNa;
  designatedPerson: YesNoNa;
  sanctionListCheck: YesNoNa;
  adverseMediaSearch: YesNoNa;
  clientRiskDate: string;
  clientRiskIssues: string;

  meetClientInPerson: YesNoNa;
  clientLocation: string;
  closeProximity: YesNoNa;
  locationMakesSense: YesNoNa;
  overseasElements: YesNoNa;
  sanctionedJurisdictions: YesNoNa;
  weakAmlControls: YesNoNa;
  geographicConcerns: string;
  geographicRiskDate: string;

  transactionDescription: string;
  transactionValue: string;
  unusualWork: YesNoNa;
  understoodTransaction: YesNoNa;
  unexplainedFunds: YesNoNa;
  fundsCorrespond: YesNoNa;
  complexTransaction: YesNoNa;
  complexStructure: YesNoNa;
  fitsClientProfile: YesNoNa;
  fundsOutsideFees: YesNoNa;
  trustInvolvement: YesNoNa;
  overseasFunds: YesNoNa;
  thirdPartyFunds: YesNoNa;
  crowdfundingCrypto: YesNoNa;
  shortNotice: YesNoNa;
  transferredFromFirm: YesNoNa;
  lackOfExpertise: YesNoNa;
  otherRedFlags: YesNoNa;
  transactionConcerns: string;
  transactionRiskDate: string;

  cashIntensiveIndustry: YesNoNa;
  highRiskIndustry: YesNoNa;
  dualUseGoods: YesNoNa;
  proliferationFinancing: YesNoNa;
  acquisitiveCrimes: YesNoNa;
  industryConcerns: string;

  taxEvasionConcerns: YesNoNa;
  associatedPersons: string;
  associatedPersonsDueDiligence: string;

  generalConcerns: YesNoNa;
  suspectMoneyLaundering: YesNoNa;

  eddComplexStructure: YesNoNa;
  eddHighRiskSector: YesNoNa;
  eddHighRiskCountry: YesNoNa;
  eddNonDomesticPep: YesNoNa;
  eddFinancialSanctions: YesNoNa;
  eddSanctionedCountry: YesNoNa;
  eddUnusuallyComplex: YesNoNa;
  eddUnusualPattern: YesNoNa;
  eddNoEconomicPurpose: YesNoNa;
  eddOtherHighRisk: YesNoNa;
  eddMlroDate: string;
  eddComments: string;
  eddCompletionDate: string;

  overallClientRisk: string;
  overallMatterRisk: string;
  riskRationale: string;
  highRiskJustification: string;
  cddLevel: string;
  enhancedCddSteps: string;
  proliferationFundingCompliance: string;
  proliferationConcerns: string;
  taxEvasionCompliance: string;
  taxConcerns: string;
  riskLevel: string;

  initialAssessmentDate: string;
  initialAssessmentLawyer: string;
  updatedAssessmentDate: string;
  updatedAssessmentLawyer: string;

  ongoingDueDiligenceChanged: string;
  ongoingMonitoringActions: string;
  ongoingRiskChanged: string;
}

const DEFAULT_FORM: RiskFormData = {
  clientRef: "", clientNames: "", typeOfMatter: "", clientAddress: "",
  dateOfBirth: "", occupationSourceOfIncome: "", entityType: "",
  conflictOfInterestCheck: "", clientCareLetterCompliant: "",
  evOnboarded: "", evRecommendations: "", evOtherActions: "",
  evConcerns: "", evLivenessChecked: "", evDateChecked: "",
  facialVerification: "", signatureVerification: "", verificationMethod: "",
  sameDocsAsEv: "", docsIfDifferent: "", clientObstructive: "",
  duressDetected: "", facialConcerns: "", facialVerificationDate: "",
  facialVerificationLawyer: "",
  clientKnownToFe: "", existingClient: "", thirdPartyConnection: "",
  previousClientRef: "", sourceOfInstruction: "", unusualInstruction: "",
  clientConcernsCapacity: "", thirdPartyAuthority: "", identifiedAsPep: "",
  requestedShortcut: "", multipleAddresses: "", highNetWorth: "",
  domiciledOverseas: "", highRiskBusiness: "", overseasInterests: "",
  designatedPerson: "", sanctionListCheck: "", adverseMediaSearch: "",
  clientRiskDate: "", clientRiskIssues: "",
  meetClientInPerson: "", clientLocation: "", closeProximity: "",
  locationMakesSense: "", overseasElements: "", sanctionedJurisdictions: "",
  weakAmlControls: "", geographicConcerns: "", geographicRiskDate: "",
  transactionDescription: "", transactionValue: "", unusualWork: "",
  understoodTransaction: "", unexplainedFunds: "", fundsCorrespond: "",
  complexTransaction: "", complexStructure: "", fitsClientProfile: "",
  fundsOutsideFees: "", trustInvolvement: "", overseasFunds: "",
  thirdPartyFunds: "", crowdfundingCrypto: "", shortNotice: "",
  transferredFromFirm: "", lackOfExpertise: "", otherRedFlags: "",
  transactionConcerns: "", transactionRiskDate: "",
  cashIntensiveIndustry: "", highRiskIndustry: "", dualUseGoods: "",
  proliferationFinancing: "", acquisitiveCrimes: "", industryConcerns: "",
  taxEvasionConcerns: "", associatedPersons: "", associatedPersonsDueDiligence: "",
  generalConcerns: "", suspectMoneyLaundering: "",
  eddComplexStructure: "", eddHighRiskSector: "", eddHighRiskCountry: "",
  eddNonDomesticPep: "", eddFinancialSanctions: "", eddSanctionedCountry: "",
  eddUnusuallyComplex: "", eddUnusualPattern: "", eddNoEconomicPurpose: "",
  eddOtherHighRisk: "", eddMlroDate: "", eddComments: "", eddCompletionDate: "",
  overallClientRisk: "", overallMatterRisk: "", riskRationale: "",
  highRiskJustification: "", cddLevel: "", enhancedCddSteps: "",
  proliferationFundingCompliance: "", proliferationConcerns: "",
  taxEvasionCompliance: "", taxConcerns: "", riskLevel: "",
  initialAssessmentDate: "", initialAssessmentLawyer: "",
  updatedAssessmentDate: "", updatedAssessmentLawyer: "",
  ongoingDueDiligenceChanged: "", ongoingMonitoringActions: "", ongoingRiskChanged: "",
};

function YesNoSelect({ value, onChange, id, disabled }: { value: YesNoNa; onChange: (v: YesNoNa) => void; id: string; disabled?: boolean }) {
  return (
    <Select value={value || "placeholder"} onValueChange={(v) => onChange(v === "placeholder" ? "" : v as YesNoNa)} disabled={disabled}>
      <SelectTrigger className="w-[140px]" data-testid={`select-${id}`}>
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="placeholder" disabled>Select...</SelectItem>
        <SelectItem value="yes">Yes</SelectItem>
        <SelectItem value="no">No</SelectItem>
        <SelectItem value="not_applicable">N/A</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/30 last:border-b-0">
      <Label className="text-sm text-muted-foreground pt-2 flex-1 min-w-0">{label}</Label>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SectionStatus({ fields, form }: { fields: string[]; form: RiskFormData }) {
  const filled = fields.filter(f => (form as any)[f] && (form as any)[f] !== "").length;
  const total = fields.length;
  if (filled === total) return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">{filled}/{total}</Badge>;
  if (filled > 0) return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">{filled}/{total}</Badge>;
  return <Badge variant="outline" className="text-xs">{filled}/{total}</Badge>;
}

export default function RiskAssessmentForm({ matterId, matterData }: RiskAssessmentFormProps) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("canCompleteChecks");

  const [form, setForm] = useState<RiskFormData>({ ...DEFAULT_FORM });
  const [isDirty, setIsDirty] = useState(false);

  const { data: existing, isLoading } = useQuery<RiskAssessment | null>({
    queryKey: ["/api/matters", matterId, "risk-assessment"],
  });

  useEffect(() => {
    if (existing?.formData) {
      setForm({ ...DEFAULT_FORM, ...(existing.formData as any) });
      setIsDirty(false);
    } else if (matterData) {
      setForm(prev => ({
        ...prev,
        clientRef: matterData.clientRef || "",
        clientNames: matterData.clientName || "",
        typeOfMatter: matterData.type || "",
        clientAddress: matterData.propertyAddress || "",
      }));
    }
  }, [existing, matterData]);

  const update = (field: keyof RiskFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (status: "draft" | "completed") => {
      const res = await apiRequest("POST", `/api/matters/${matterId}/risk-assessment`, {
        formData: form,
        overallClientRisk: form.overallClientRisk || undefined,
        overallMatterRisk: form.overallMatterRisk || undefined,
        status,
      });
      return res.json();
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId, "risk-assessment"] });
      setIsDirty(false);
      toast({
        title: status === "completed" ? "Risk Assessment Completed" : "Draft Saved",
        description: status === "completed" ? "The risk assessment has been finalised." : "Your progress has been saved.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  const isCompleted = existing?.status === "completed";
  const disabled = !canEdit || isCompleted;

  const evFields = ["evOnboarded", "evRecommendations", "evOtherActions", "evLivenessChecked", "evDateChecked"];
  const facialFields = ["facialVerification", "signatureVerification", "verificationMethod", "sameDocsAsEv", "clientObstructive", "duressDetected", "facialVerificationDate", "facialVerificationLawyer"];
  const clientRiskFields = ["clientKnownToFe", "existingClient", "sourceOfInstruction", "unusualInstruction", "clientConcernsCapacity", "thirdPartyAuthority", "identifiedAsPep", "requestedShortcut", "multipleAddresses", "highNetWorth", "domiciledOverseas", "highRiskBusiness", "overseasInterests", "designatedPerson", "sanctionListCheck", "adverseMediaSearch", "clientRiskDate"];
  const geoFields = ["meetClientInPerson", "clientLocation", "closeProximity", "locationMakesSense", "overseasElements", "sanctionedJurisdictions", "weakAmlControls", "geographicRiskDate"];
  const transactionFields = ["transactionDescription", "transactionValue", "unusualWork", "understoodTransaction", "unexplainedFunds", "fundsCorrespond", "complexTransaction", "complexStructure", "fitsClientProfile", "fundsOutsideFees", "trustInvolvement", "overseasFunds", "thirdPartyFunds", "crowdfundingCrypto", "shortNotice", "transferredFromFirm", "lackOfExpertise", "otherRedFlags", "transactionRiskDate"];
  const industryFields = ["cashIntensiveIndustry", "highRiskIndustry", "dualUseGoods", "proliferationFinancing", "acquisitiveCrimes"];
  const taxFields = ["taxEvasionConcerns"];
  const generalFields = ["generalConcerns", "suspectMoneyLaundering"];
  const eddFields = ["eddComplexStructure", "eddHighRiskSector", "eddHighRiskCountry", "eddNonDomesticPep", "eddFinancialSanctions", "eddSanctionedCountry", "eddUnusuallyComplex", "eddUnusualPattern", "eddNoEconomicPurpose", "eddOtherHighRisk"];
  const outcomeFields = ["overallClientRisk", "overallMatterRisk", "cddLevel", "riskLevel"];

  return (
    <div className="space-y-4" data-testid="risk-assessment-form">
      <Card className="glass-card rounded-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium text-sm" data-testid="text-risk-assessment-title">Risk Assessment Form</p>
                <p className="text-xs text-muted-foreground">
                  AML / KYC / CDD Compliance — {isCompleted ? "Completed" : existing ? "Draft" : "Not started"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isCompleted ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20" data-testid="badge-ra-completed">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
                </Badge>
              ) : existing ? (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20" data-testid="badge-ra-draft">Draft</Badge>
              ) : (
                <Badge variant="outline" data-testid="badge-ra-not-started">Not Started</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={["client-info"]} className="space-y-2">
        <AccordionItem value="client-info" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-client-info">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Client Information</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Client Ref">
                <Input className="w-[260px]" value={form.clientRef} onChange={e => update("clientRef", e.target.value)} disabled={disabled} data-testid="input-ra-client-ref" />
              </FormRow>
              <FormRow label="Client Names">
                <Input className="w-[260px]" value={form.clientNames} onChange={e => update("clientNames", e.target.value)} disabled={disabled} data-testid="input-ra-client-names" />
              </FormRow>
              <FormRow label="Type of Matter">
                <Input className="w-[260px]" value={form.typeOfMatter} onChange={e => update("typeOfMatter", e.target.value)} disabled={disabled} data-testid="input-ra-type-of-matter" />
              </FormRow>
              <FormRow label="Client Address">
                <Input className="w-[260px]" value={form.clientAddress} onChange={e => update("clientAddress", e.target.value)} disabled={disabled} data-testid="input-ra-client-address" />
              </FormRow>
              <FormRow label="Date of Birth">
                <Input type="date" className="w-[260px]" value={form.dateOfBirth} onChange={e => update("dateOfBirth", e.target.value)} disabled={disabled} data-testid="input-ra-dob" />
              </FormRow>
              <FormRow label="Occupation / Source of Income">
                <Input className="w-[260px]" value={form.occupationSourceOfIncome} onChange={e => update("occupationSourceOfIncome", e.target.value)} disabled={disabled} data-testid="input-ra-occupation" />
              </FormRow>
              <FormRow label="Entity Type (if applicable)">
                <Input className="w-[260px]" value={form.entityType} onChange={e => update("entityType", e.target.value)} disabled={disabled} data-testid="input-ra-entity-type" />
              </FormRow>
              <FormRow label="Conflict of Interest Check Undertaken">
                <Input className="w-[260px]" value={form.conflictOfInterestCheck} onChange={e => update("conflictOfInterestCheck", e.target.value)} disabled={disabled} data-testid="input-ra-conflict" />
              </FormRow>
              <FormRow label="Client Care Letter Compliant?">
                <Input className="w-[260px]" placeholder="Advice, instructions, next steps, costs..." value={form.clientCareLetterCompliant} onChange={e => update("clientCareLetterCompliant", e.target.value)} disabled={disabled} data-testid="input-ra-care-letter" />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ev-verification" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-ev">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Onboarding Electronic Verification (EV) & Third-Party Verification</span>
              <SectionStatus fields={evFields} form={form} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Client onboarded via EV?">
                <YesNoSelect value={form.evOnboarded} onChange={v => update("evOnboarded", v)} id="ra-ev-onboarded" disabled={disabled} />
              </FormRow>
              <FormRow label="EV made further recommendations / highlighted concerns?">
                <YesNoSelect value={form.evRecommendations} onChange={v => update("evRecommendations", v)} id="ra-ev-recommendations" disabled={disabled} />
              </FormRow>
              <FormRow label="Other actions to be taken from EV / 3P?">
                <YesNoSelect value={form.evOtherActions} onChange={v => update("evOtherActions", v)} id="ra-ev-other-actions" disabled={disabled} />
              </FormRow>
              <FormRow label="Liveness checked?">
                <YesNoSelect value={form.evLivenessChecked} onChange={v => update("evLivenessChecked", v)} id="ra-ev-liveness" disabled={disabled} />
              </FormRow>
              <FormRow label="Any other concerns / comments">
                <Textarea className="w-[260px]" rows={2} value={form.evConcerns} onChange={e => update("evConcerns", e.target.value)} disabled={disabled} data-testid="input-ra-ev-concerns" />
              </FormRow>
              <FormRow label="Date checked the EV report">
                <Input type="date" className="w-[260px]" value={form.evDateChecked} onChange={e => update("evDateChecked", e.target.value)} disabled={disabled} data-testid="input-ra-ev-date" />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="facial-sig" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-facial">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Facial & Signature Verification</span>
              <SectionStatus fields={facialFields} form={form} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Facial verification taken place?">
                <YesNoSelect value={form.facialVerification} onChange={v => update("facialVerification", v)} id="ra-facial" disabled={disabled} />
              </FormRow>
              <FormRow label="Signature verification taken place?">
                <YesNoSelect value={form.signatureVerification} onChange={v => update("signatureVerification", v)} id="ra-signature" disabled={disabled} />
              </FormRow>
              <FormRow label="How was verification carried out? (e.g., digital/Zoom or in office)">
                <Input className="w-[260px]" value={form.verificationMethod} onChange={e => update("verificationMethod", e.target.value)} disabled={disabled} data-testid="input-ra-verification-method" />
              </FormRow>
              <FormRow label="Same documents presented as used in EV?">
                <YesNoSelect value={form.sameDocsAsEv} onChange={v => update("sameDocsAsEv", v)} id="ra-same-docs" disabled={disabled} />
              </FormRow>
              <FormRow label="If no, list documents presented by client">
                <Textarea className="w-[260px]" rows={2} value={form.docsIfDifferent} onChange={e => update("docsIfDifferent", e.target.value)} disabled={disabled} data-testid="input-ra-docs-different" />
              </FormRow>
              <FormRow label="Was client obstructive, secretive, or unwilling to meet?">
                <YesNoSelect value={form.clientObstructive} onChange={v => update("clientObstructive", v)} id="ra-obstructive" disabled={disabled} />
              </FormRow>
              <FormRow label="Signs of duress detected?">
                <YesNoSelect value={form.duressDetected} onChange={v => update("duressDetected", v)} id="ra-duress" disabled={disabled} />
              </FormRow>
              <FormRow label="Any other concerns / comments">
                <Textarea className="w-[260px]" rows={2} value={form.facialConcerns} onChange={e => update("facialConcerns", e.target.value)} disabled={disabled} data-testid="input-ra-facial-concerns" />
              </FormRow>
              <FormRow label="Date of facial & signature verification">
                <Input type="date" className="w-[260px]" value={form.facialVerificationDate} onChange={e => update("facialVerificationDate", e.target.value)} disabled={disabled} data-testid="input-ra-facial-date" />
              </FormRow>
              <FormRow label="Name of Lawyer who carried out verification">
                <Input className="w-[260px]" value={form.facialVerificationLawyer} onChange={e => update("facialVerificationLawyer", e.target.value)} disabled={disabled} data-testid="input-ra-facial-lawyer" />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="client-risk" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-client-risk">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Client Risk</span>
              <SectionStatus fields={clientRiskFields} form={form} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Is client known to Fee Earner personally?">
                <YesNoSelect value={form.clientKnownToFe} onChange={v => update("clientKnownToFe", v)} id="ra-known-fe" disabled={disabled} />
              </FormRow>
              <FormRow label="Is client an existing client?">
                <YesNoSelect value={form.existingClient} onChange={v => update("existingClient", v)} id="ra-existing" disabled={disabled} />
              </FormRow>
              <FormRow label="If client introduced by 3rd party, state connection">
                <Input className="w-[260px]" value={form.thirdPartyConnection} onChange={e => update("thirdPartyConnection", e.target.value)} disabled={disabled} data-testid="input-ra-3p-connection" />
              </FormRow>
              <FormRow label="If previous/existing client, confirm last file reference">
                <Input className="w-[260px]" value={form.previousClientRef} onChange={e => update("previousClientRef", e.target.value)} disabled={disabled} data-testid="input-ra-prev-ref" />
              </FormRow>
              <FormRow label="Source of instruction (referral, website, enquiry, etc.)">
                <Input className="w-[260px]" value={form.sourceOfInstruction} onChange={e => update("sourceOfInstruction", e.target.value)} disabled={disabled} data-testid="input-ra-source" />
              </FormRow>
              <FormRow label="Is it unusual for this type of client to instruct us?">
                <YesNoSelect value={form.unusualInstruction} onChange={v => update("unusualInstruction", v)} id="ra-unusual" disabled={disabled} />
              </FormRow>
              <FormRow label="Do you have any concerns about the client or their capacity?">
                <YesNoSelect value={form.clientConcernsCapacity} onChange={v => update("clientConcernsCapacity", v)} id="ra-capacity" disabled={disabled} />
              </FormRow>
              <FormRow label="If a third party is instructing, do you have evidence of authority?">
                <YesNoSelect value={form.thirdPartyAuthority} onChange={v => update("thirdPartyAuthority", v)} id="ra-3p-authority" disabled={disabled} />
              </FormRow>
              <FormRow label="Has client been identified as a PEP?">
                <YesNoSelect value={form.identifiedAsPep} onChange={v => update("identifiedAsPep", v)} id="ra-pep" disabled={disabled} />
              </FormRow>
              <FormRow label="Has client requested short-cut or unexplained speed?">
                <YesNoSelect value={form.requestedShortcut} onChange={v => update("requestedShortcut", v)} id="ra-shortcut" disabled={disabled} />
              </FormRow>
              <FormRow label="Does client appear to have multiple addresses without legitimate reasons?">
                <YesNoSelect value={form.multipleAddresses} onChange={v => update("multipleAddresses", v)} id="ra-addresses" disabled={disabled} />
              </FormRow>
              <FormRow label="Is client a high-net-worth individual (assets of £1m or more)?">
                <YesNoSelect value={form.highNetWorth} onChange={v => update("highNetWorth", v)} id="ra-hnw" disabled={disabled} />
              </FormRow>
              <FormRow label="Is client domiciled overseas?">
                <YesNoSelect value={form.domiciledOverseas} onChange={v => update("domiciledOverseas", v)} id="ra-overseas" disabled={disabled} />
              </FormRow>
              <FormRow label="Is client involved in / run high risk or cash turnover business?">
                <YesNoSelect value={form.highRiskBusiness} onChange={v => update("highRiskBusiness", v)} id="ra-high-risk-biz" disabled={disabled} />
              </FormRow>
              <FormRow label="Does client have significant overseas interests or operations?">
                <YesNoSelect value={form.overseasInterests} onChange={v => update("overseasInterests", v)} id="ra-overseas-interests" disabled={disabled} />
              </FormRow>
              <FormRow label="Is the client a designated person/entity?">
                <YesNoSelect value={form.designatedPerson} onChange={v => update("designatedPerson", v)} id="ra-designated" disabled={disabled} />
              </FormRow>
              <FormRow label="Does a further check need to be considered under the consolidated sanction list?">
                <YesNoSelect value={form.sanctionListCheck} onChange={v => update("sanctionListCheck", v)} id="ra-sanction-list" disabled={disabled} />
              </FormRow>
              <FormRow label="Open source / Google search for adverse media on the client — none found?">
                <YesNoSelect value={form.adverseMediaSearch} onChange={v => update("adverseMediaSearch", v)} id="ra-adverse-media" disabled={disabled} />
              </FormRow>
              <FormRow label="Date of Client Risk Completed">
                <Input type="date" className="w-[260px]" value={form.clientRiskDate} onChange={e => update("clientRiskDate", e.target.value)} disabled={disabled} data-testid="input-ra-client-risk-date" />
              </FormRow>
              <FormRow label="Provide details of any issues identified">
                <Textarea className="w-[260px]" rows={2} value={form.clientRiskIssues} onChange={e => update("clientRiskIssues", e.target.value)} disabled={disabled} data-testid="input-ra-client-risk-issues" />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="geographic-risk" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-geographic">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Geographic & Delivery Channel Risk</span>
              <SectionStatus fields={geoFields} form={form} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Will you meet the client in person?">
                <YesNoSelect value={form.meetClientInPerson} onChange={v => update("meetClientInPerson", v)} id="ra-meet-person" disabled={disabled} />
              </FormRow>
              <FormRow label="Where is the client based? (Locally / UK / EU / International)">
                <Input className="w-[260px]" value={form.clientLocation} onChange={e => update("clientLocation", e.target.value)} disabled={disabled} data-testid="input-ra-client-location" />
              </FormRow>
              <FormRow label="Is client based within close proximity to the office (within 30 miles)?">
                <YesNoSelect value={form.closeProximity} onChange={v => update("closeProximity", v)} id="ra-proximity" disabled={disabled} />
              </FormRow>
              <FormRow label="Does it make sense for the client to instruct us from this location?">
                <YesNoSelect value={form.locationMakesSense} onChange={v => update("locationMakesSense", v)} id="ra-location-sense" disabled={disabled} />
              </FormRow>
              <FormRow label="Are there overseas elements?">
                <YesNoSelect value={form.overseasElements} onChange={v => update("overseasElements", v)} id="ra-overseas-elements" disabled={disabled} />
              </FormRow>
              <FormRow label="Does client appear to have association with sanctioned jurisdictions?">
                <YesNoSelect value={form.sanctionedJurisdictions} onChange={v => update("sanctionedJurisdictions", v)} id="ra-sanctioned" disabled={disabled} />
              </FormRow>
              <FormRow label="Does client appear to have association with areas with weak AML/TF controls?">
                <YesNoSelect value={form.weakAmlControls} onChange={v => update("weakAmlControls", v)} id="ra-weak-aml" disabled={disabled} />
              </FormRow>
              <FormRow label="Any other concerns / comments">
                <Textarea className="w-[260px]" rows={2} value={form.geographicConcerns} onChange={e => update("geographicConcerns", e.target.value)} disabled={disabled} data-testid="input-ra-geo-concerns" />
              </FormRow>
              <FormRow label="Date of Geographic Risk Completed">
                <Input type="date" className="w-[260px]" value={form.geographicRiskDate} onChange={e => update("geographicRiskDate", e.target.value)} disabled={disabled} data-testid="input-ra-geo-date" />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="transaction-risk" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-transaction">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Transaction / Matter Risk</span>
              <SectionStatus fields={transactionFields} form={form} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Description of work and transaction value">
                <Input className="w-[260px]" value={form.transactionDescription} onChange={e => update("transactionDescription", e.target.value)} disabled={disabled} data-testid="input-ra-tx-desc" />
              </FormRow>
              <FormRow label="Transaction value (£)">
                <Input className="w-[260px]" value={form.transactionValue} onChange={e => update("transactionValue", e.target.value)} disabled={disabled} data-testid="input-ra-tx-value" />
              </FormRow>
              <FormRow label="Is it unusual for us to carry out this type of work?">
                <YesNoSelect value={form.unusualWork} onChange={v => update("unusualWork", v)} id="ra-unusual-work" disabled={disabled} />
              </FormRow>
              <FormRow label="Are you satisfied that you have fully understood the nature of the transaction?">
                <YesNoSelect value={form.understoodTransaction} onChange={v => update("understoodTransaction", v)} id="ra-understood" disabled={disabled} />
              </FormRow>
              <FormRow label="At this stage, are any elements of source & wealth of funds unexplained?">
                <YesNoSelect value={form.unexplainedFunds} onChange={v => update("unexplainedFunds", v)} id="ra-unexplained" disabled={disabled} />
              </FormRow>
              <FormRow label="Does stated source of wealth correspond with what you know about the client?">
                <YesNoSelect value={form.fundsCorrespond} onChange={v => update("fundsCorrespond", v)} id="ra-correspond" disabled={disabled} />
              </FormRow>
              <FormRow label="Does transaction appear to be complex, large, or unusual?">
                <YesNoSelect value={form.complexTransaction} onChange={v => update("complexTransaction", v)} id="ra-complex-tx" disabled={disabled} />
              </FormRow>
              <FormRow label="Does the matter involve creating a complex structure?">
                <YesNoSelect value={form.complexStructure} onChange={v => update("complexStructure", v)} id="ra-complex-structure" disabled={disabled} />
              </FormRow>
              <FormRow label="Does nature of transaction appear to fit profile of client?">
                <YesNoSelect value={form.fitsClientProfile} onChange={v => update("fitsClientProfile", v)} id="ra-fits-profile" disabled={disabled} />
              </FormRow>
              <FormRow label="Will transaction require client to send funds outside legal fees & disbursements?">
                <YesNoSelect value={form.fundsOutsideFees} onChange={v => update("fundsOutsideFees", v)} id="ra-funds-outside" disabled={disabled} />
              </FormRow>
              <FormRow label="Will there be involvement of trust or other legal entity?">
                <YesNoSelect value={form.trustInvolvement} onChange={v => update("trustInvolvement", v)} id="ra-trust" disabled={disabled} />
              </FormRow>
              <FormRow label="Will transaction involve sending or receiving funds from overseas?">
                <YesNoSelect value={form.overseasFunds} onChange={v => update("overseasFunds", v)} id="ra-overseas-funds" disabled={disabled} />
              </FormRow>
              <FormRow label="Will transaction involve sending or receiving funds from third parties?">
                <YesNoSelect value={form.thirdPartyFunds} onChange={v => update("thirdPartyFunds", v)} id="ra-3p-funds" disabled={disabled} />
              </FormRow>
              <FormRow label="Will transaction involve crowdfunding or cryptocurrency?">
                <YesNoSelect value={form.crowdfundingCrypto} onChange={v => update("crowdfundingCrypto", v)} id="ra-crypto" disabled={disabled} />
              </FormRow>
              <FormRow label="Is matter undertaken at short notice or involving high volumes?">
                <YesNoSelect value={form.shortNotice} onChange={v => update("shortNotice", v)} id="ra-short-notice" disabled={disabled} />
              </FormRow>
              <FormRow label="Has matter transferred from another firm?">
                <YesNoSelect value={form.transferredFromFirm} onChange={v => update("transferredFromFirm", v)} id="ra-transferred" disabled={disabled} />
              </FormRow>
              <FormRow label="Will lack of experience or expertise in matter add to risk?">
                <YesNoSelect value={form.lackOfExpertise} onChange={v => update("lackOfExpertise", v)} id="ra-expertise" disabled={disabled} />
              </FormRow>
              <FormRow label="Any other red flags identified?">
                <YesNoSelect value={form.otherRedFlags} onChange={v => update("otherRedFlags", v)} id="ra-red-flags" disabled={disabled} />
              </FormRow>
              <FormRow label="Any other concerns / comments">
                <Textarea className="w-[260px]" rows={2} value={form.transactionConcerns} onChange={e => update("transactionConcerns", e.target.value)} disabled={disabled} data-testid="input-ra-tx-concerns" />
              </FormRow>
              <FormRow label="Date of Transaction / Matter Risk Completed">
                <Input type="date" className="w-[260px]" value={form.transactionRiskDate} onChange={e => update("transactionRiskDate", e.target.value)} disabled={disabled} data-testid="input-ra-tx-date" />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="industry-risk" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-industry">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Industry Risk Including Proliferation Financing</span>
              <SectionStatus fields={industryFields} form={form} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Does the transaction involve a cash-intensive industry (e.g., nail bars, takeaways)?">
                <YesNoSelect value={form.cashIntensiveIndustry} onChange={v => update("cashIntensiveIndustry", v)} id="ra-cash-intensive" disabled={disabled} />
              </FormRow>
              <FormRow label="Does it involve a high-risk industry (e.g., arms trade, casinos, precious metals)?">
                <YesNoSelect value={form.highRiskIndustry} onChange={v => update("highRiskIndustry", v)} id="ra-high-risk-ind" disabled={disabled} />
              </FormRow>
              <FormRow label="Does/will transaction involve dual-use goods, commodities, shipping, military, or aviation?">
                <YesNoSelect value={form.dualUseGoods} onChange={v => update("dualUseGoods", v)} id="ra-dual-use" disabled={disabled} />
              </FormRow>
              <FormRow label="Any reason to believe client might be involved in proliferation financing?">
                <YesNoSelect value={form.proliferationFinancing} onChange={v => update("proliferationFinancing", v)} id="ra-prolif" disabled={disabled} />
              </FormRow>
              <FormRow label="Has client had any convictions or been involved in acquisitive crimes?">
                <YesNoSelect value={form.acquisitiveCrimes} onChange={v => update("acquisitiveCrimes", v)} id="ra-crimes" disabled={disabled} />
              </FormRow>
              <FormRow label="Any other concerns / comments">
                <Textarea className="w-[260px]" rows={2} value={form.industryConcerns} onChange={e => update("industryConcerns", e.target.value)} disabled={disabled} data-testid="input-ra-industry-concerns" />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tax-evasion" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-tax">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Tax Evasion</span>
              <SectionStatus fields={taxFields} form={form} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Do you have any concerns that the client may be seeking to avoid incurring a tax liability (IHT, income tax, VAT, CGT, SDLT)?">
                <YesNoSelect value={form.taxEvasionConcerns} onChange={v => update("taxEvasionConcerns", v)} id="ra-tax" disabled={disabled} />
              </FormRow>
              <FormRow label="Are associated persons/third parties to be instructed by the firm?">
                <Input className="w-[260px]" value={form.associatedPersons} onChange={e => update("associatedPersons", e.target.value)} disabled={disabled} data-testid="input-ra-associated" />
              </FormRow>
              <FormRow label="If not used before, is there a need to undertake due diligence on the third party?">
                <Input className="w-[260px]" value={form.associatedPersonsDueDiligence} onChange={e => update("associatedPersonsDueDiligence", e.target.value)} disabled={disabled} data-testid="input-ra-associated-dd" />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="general-observation" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-general">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">General Observation</span>
              <SectionStatus fields={generalFields} form={form} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Anything else about client/transaction making you feel concerned, uncomfortable, or suspicious?">
                <YesNoSelect value={form.generalConcerns} onChange={v => update("generalConcerns", v)} id="ra-general" disabled={disabled} />
              </FormRow>
              <FormRow label="Do you have any reason to suspect money laundering / other criminal act?">
                <YesNoSelect value={form.suspectMoneyLaundering} onChange={v => update("suspectMoneyLaundering", v)} id="ra-ml" disabled={disabled} />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="enhanced-dd" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-edd">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Enhanced Due Diligence</span>
              <SectionStatus fields={eddFields} form={form} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="p-3 rounded-md bg-amber-500/5 border border-amber-500/10 mb-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  If "Yes" applies to any of the following, you must contact the MLRO/MLCO before continuing to act for the client and clearly document any discussions on file.
                </p>
              </div>
            </div>
            <div className="space-y-0.5">
              <FormRow label="If client is not an individual, is the structure complex or unusual?">
                <YesNoSelect value={form.eddComplexStructure} onChange={v => update("eddComplexStructure", v)} id="ra-edd-complex" disabled={disabled} />
              </FormRow>
              <FormRow label="Does client own, manage or direct a business in a higher risk sector?">
                <YesNoSelect value={form.eddHighRiskSector} onChange={v => update("eddHighRiskSector", v)} id="ra-edd-sector" disabled={disabled} />
              </FormRow>
              <FormRow label="Does the matter involve a party established in a high-risk third country?">
                <YesNoSelect value={form.eddHighRiskCountry} onChange={v => update("eddHighRiskCountry", v)} id="ra-edd-country" disabled={disabled} />
              </FormRow>
              <FormRow label="Is a beneficial owner or party a non-domestic PEP, family member or close associate?">
                <YesNoSelect value={form.eddNonDomesticPep} onChange={v => update("eddNonDomesticPep", v)} id="ra-edd-pep" disabled={disabled} />
              </FormRow>
              <FormRow label="Any concerns that a party is subject to financial sanctions or has links to sanctioned countries?">
                <YesNoSelect value={form.eddFinancialSanctions} onChange={v => update("eddFinancialSanctions", v)} id="ra-edd-sanctions" disabled={disabled} />
              </FormRow>
              <FormRow label="Will this matter involve a country subject to sanctions?">
                <YesNoSelect value={form.eddSanctionedCountry} onChange={v => update("eddSanctionedCountry", v)} id="ra-edd-sanc-country" disabled={disabled} />
              </FormRow>
              <FormRow label="Is the matter unusually complex or large?">
                <YesNoSelect value={form.eddUnusuallyComplex} onChange={v => update("eddUnusuallyComplex", v)} id="ra-edd-unusual" disabled={disabled} />
              </FormRow>
              <FormRow label="Does this transaction form part of an unusual pattern of transactions?">
                <YesNoSelect value={form.eddUnusualPattern} onChange={v => update("eddUnusualPattern", v)} id="ra-edd-pattern" disabled={disabled} />
              </FormRow>
              <FormRow label="Does the transaction lack an apparent economic or legal purpose?">
                <YesNoSelect value={form.eddNoEconomicPurpose} onChange={v => update("eddNoEconomicPurpose", v)} id="ra-edd-purpose" disabled={disabled} />
              </FormRow>
              <FormRow label="Are there any other factors indicating higher risk of ML or TF?">
                <YesNoSelect value={form.eddOtherHighRisk} onChange={v => update("eddOtherHighRisk", v)} id="ra-edd-other" disabled={disabled} />
              </FormRow>
              <FormRow label="If risks identified, date escalated to MLRO/MLCO">
                <Input type="date" className="w-[260px]" value={form.eddMlroDate} onChange={e => update("eddMlroDate", e.target.value)} disabled={disabled} data-testid="input-ra-edd-mlro-date" />
              </FormRow>
              <FormRow label="Any other comments">
                <Textarea className="w-[260px]" rows={2} value={form.eddComments} onChange={e => update("eddComments", e.target.value)} disabled={disabled} data-testid="input-ra-edd-comments" />
              </FormRow>
              <FormRow label="Date of Enhanced Due Diligence Completed">
                <Input type="date" className="w-[260px]" value={form.eddCompletionDate} onChange={e => update("eddCompletionDate", e.target.value)} disabled={disabled} data-testid="input-ra-edd-date" />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="outcomes" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-outcomes">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Risk Assessment Outcomes</span>
              <SectionStatus fields={outcomeFields} form={form} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Overall Client Risk">
                <Select value={form.overallClientRisk || "placeholder"} onValueChange={v => update("overallClientRisk", v === "placeholder" ? "" : v)} disabled={disabled}>
                  <SelectTrigger className="w-[260px]" data-testid="select-ra-client-risk">
                    <SelectValue placeholder="Select risk level..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder" disabled>Select risk level...</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Overall Matter Risk">
                <Select value={form.overallMatterRisk || "placeholder"} onValueChange={v => update("overallMatterRisk", v === "placeholder" ? "" : v)} disabled={disabled}>
                  <SelectTrigger className="w-[260px]" data-testid="select-ra-matter-risk">
                    <SelectValue placeholder="Select risk level..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder" disabled>Select risk level...</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="I have given these ratings because">
                <Textarea className="w-[260px]" rows={3} value={form.riskRationale} onChange={e => update("riskRationale", e.target.value)} disabled={disabled} data-testid="input-ra-rationale" />
              </FormRow>
              <FormRow label="If High Risk, explain why you are happy to proceed">
                <Textarea className="w-[260px]" rows={2} value={form.highRiskJustification} onChange={e => update("highRiskJustification", e.target.value)} disabled={disabled} data-testid="input-ra-high-risk-justify" />
              </FormRow>
              <FormRow label="Client Due Diligence Level">
                <Select value={form.cddLevel || "placeholder"} onValueChange={v => update("cddLevel", v === "placeholder" ? "" : v)} disabled={disabled}>
                  <SelectTrigger className="w-[260px]" data-testid="select-ra-cdd">
                    <SelectValue placeholder="Select CDD level..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder" disabled>Select CDD level...</SelectItem>
                    <SelectItem value="simplified">Simplified</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="enhanced">Enhanced</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="If Enhanced CDD, specify additional steps">
                <Textarea className="w-[260px]" rows={2} value={form.enhancedCddSteps} onChange={e => update("enhancedCddSteps", e.target.value)} disabled={disabled} data-testid="input-ra-enhanced-steps" />
              </FormRow>
              <FormRow label="Proliferation Funding — If concern, have compliance been informed?">
                <Input className="w-[260px]" value={form.proliferationFundingCompliance} onChange={e => update("proliferationFundingCompliance", e.target.value)} disabled={disabled} data-testid="input-ra-prolif-compliance" />
              </FormRow>
              <FormRow label="Any proliferation concerns / comments">
                <Textarea className="w-[260px]" rows={2} value={form.proliferationConcerns} onChange={e => update("proliferationConcerns", e.target.value)} disabled={disabled} data-testid="input-ra-prolif-concerns" />
              </FormRow>
              <FormRow label="Tax Evasion — If concern, have compliance been informed?">
                <Input className="w-[260px]" value={form.taxEvasionCompliance} onChange={e => update("taxEvasionCompliance", e.target.value)} disabled={disabled} data-testid="input-ra-tax-compliance" />
              </FormRow>
              <FormRow label="Any tax evasion concerns / comments">
                <Textarea className="w-[260px]" rows={2} value={form.taxConcerns} onChange={e => update("taxConcerns", e.target.value)} disabled={disabled} data-testid="input-ra-tax-concerns" />
              </FormRow>
              <FormRow label="Overall Risk Level">
                <Select value={form.riskLevel || "placeholder"} onValueChange={v => update("riskLevel", v === "placeholder" ? "" : v)} disabled={disabled}>
                  <SelectTrigger className="w-[260px]" data-testid="select-ra-risk-level">
                    <SelectValue placeholder="Select risk level..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder" disabled>Select risk level...</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="completion" className="glass-card rounded-md border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline" data-testid="accordion-completion">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Completion & Ongoing Monitoring</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-4">
            <div className="space-y-0.5">
              <FormRow label="Date of completion of initial risk assessment">
                <Input type="date" className="w-[260px]" value={form.initialAssessmentDate} onChange={e => update("initialAssessmentDate", e.target.value)} disabled={disabled} data-testid="input-ra-initial-date" />
              </FormRow>
              <FormRow label="Name of Lawyer who carried out assessment">
                <Input className="w-[260px]" value={form.initialAssessmentLawyer} onChange={e => update("initialAssessmentLawyer", e.target.value)} disabled={disabled} data-testid="input-ra-initial-lawyer" />
              </FormRow>
              <FormRow label="Date of completion of updated risk assessment">
                <Input type="date" className="w-[260px]" value={form.updatedAssessmentDate} onChange={e => update("updatedAssessmentDate", e.target.value)} disabled={disabled} data-testid="input-ra-updated-date" />
              </FormRow>
              <FormRow label="Name of Lawyer who carried out updated assessment">
                <Input className="w-[260px]" value={form.updatedAssessmentLawyer} onChange={e => update("updatedAssessmentLawyer", e.target.value)} disabled={disabled} data-testid="input-ra-updated-lawyer" />
              </FormRow>

              <div className="border-t border-border/30 my-3 pt-3">
                <p className="text-sm font-medium mb-2">Ongoing Monitoring</p>
              </div>

              <FormRow label="Has your due diligence changed the level of risk?">
                <Textarea className="w-[260px]" rows={2} value={form.ongoingDueDiligenceChanged} onChange={e => update("ongoingDueDiligenceChanged", e.target.value)} disabled={disabled} data-testid="input-ra-ongoing-dd" />
              </FormRow>
              <FormRow label="What have you done to monitor any risks since your last review?">
                <Textarea className="w-[260px]" rows={2} value={form.ongoingMonitoringActions} onChange={e => update("ongoingMonitoringActions", e.target.value)} disabled={disabled} data-testid="input-ra-ongoing-actions" />
              </FormRow>
              <FormRow label="Has your assessment of the level of risk changed?">
                <Textarea className="w-[260px]" rows={2} value={form.ongoingRiskChanged} onChange={e => update("ongoingRiskChanged", e.target.value)} disabled={disabled} data-testid="input-ra-ongoing-changed" />
              </FormRow>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {canEdit && !isCompleted && (
        <Card className="glass-card rounded-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {isDirty && (
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20" data-testid="badge-ra-unsaved">
                    Unsaved changes
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate("draft")}
                  data-testid="button-ra-save-draft"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saveMutation.isPending ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  size="sm"
                  disabled={saveMutation.isPending || !form.overallClientRisk || !form.overallMatterRisk}
                  onClick={() => saveMutation.mutate("completed")}
                  data-testid="button-ra-complete"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {saveMutation.isPending ? "Saving..." : "Complete Assessment"}
                </Button>
              </div>
            </div>
            {(!form.overallClientRisk || !form.overallMatterRisk) && (
              <p className="text-xs text-muted-foreground mt-2" data-testid="text-ra-complete-hint">
                Set both Overall Client Risk and Overall Matter Risk in the Outcomes section to enable completion.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isCompleted && existing && (
        <Card className="glass-card rounded-md border-green-500/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-600" data-testid="text-ra-completed-message">Risk Assessment Completed</p>
                <p className="text-xs text-muted-foreground">
                  Completed on {new Date(existing.completedAt!).toLocaleDateString("en-GB")}
                  {existing.overallClientRisk && ` — Client Risk: ${existing.overallClientRisk.charAt(0).toUpperCase() + existing.overallClientRisk.slice(1)}`}
                  {existing.overallMatterRisk && `, Matter Risk: ${existing.overallMatterRisk.charAt(0).toUpperCase() + existing.overallMatterRisk.slice(1)}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
