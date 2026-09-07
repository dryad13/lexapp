import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, BookOpen, AlertTriangle, CheckCircle2, XCircle,
  ArrowRight, Clock, Shield, ExternalLink, ChevronDown, ChevronUp,
  Scale, Building2, FileText, Landmark, ShieldAlert, Receipt,
  Home, ClipboardList, Waves, HardHat, Ban, Plane,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type ResourceSection = {
  id: string;
  title: string;
  content: string[];
};

type Resource = {
  id: string;
  title: string;
  tier: 1 | 2 | 3;
  dept?: "conveyancing" | "immigration";
  summary: string[];
  whyItMatters: string[];
  useInConveyFlow: string[];
  sources: { label: string; url: string }[];
  tags: string[];
  sections?: ResourceSection[];
  sectionIcons?: Record<string, typeof BookOpen>;
};

const GRACE_SECTIONS: ResourceSection[] = [
  {
    id: "what-grace-is",
    title: "What GRACE is for",
    content: [
      "GRACE is best-practice guidance for conveyancers aimed at reducing unnecessary enquiries that delay transactions.",
      "It supports use of the Law Society Conveyancing Protocol and the Conveyancing Association Technical Protocol.",
      "Core principle: raise enquiries only when necessary, legally relevant, and property-specific.",
      "Avoid duplicating information already covered by TA forms, standard contract conditions, standard searches, or publicly available sources.",
      "Avoid enquiries that seek opinions or relate to property condition (caveat emptor).",
    ],
  },
  {
    id: "category-a",
    title: "Category A – do not raise",
    content: [
      "Seller identity / ID check confirmations – covered by Protocol Step 3 and TA13.",
      "Undertakings relating to charges already covered by TA13.",
      "Property condition questions (damp, subsidence, defects, etc.) – rebuts caveat emptor.",
      "Retrospective planning / building regs requests outside enforcement periods.",
      "Duplicate certificate requests where searches confirm existence (e.g., FENSA, Gas Safe).",
      "Requests for public / standard-search information (e.g., smoke control orders, mining/fracking awareness).",
      "Non-acceptable CQS enquiries: boundary proof requests, duplicate TA10 points, bank details by email (use TA13 / secure methods).",
    ],
  },
  {
    id: "category-b",
    title: "Category B – generally avoid",
    content: [
      "Non-legal questions duplicating protocol forms (e.g., non-structural guarantees, alarm servicing details, fitted items confirmations).",
      "Overly general title / covenant queries – raise specific legal issues only.",
      "Broad \"works done\" questions without a defined trigger.",
      "Public information requests (EPC, listings, many Article 4 / TPO documents).",
      "Flood prevention works or similar condition-based follow-ups – report to client, don't enquire of the seller's solicitor.",
    ],
  },
  {
    id: "decision-flow",
    title: "Decision flow",
    content: [
      "1. Is it property/transaction specific (not generic)?",
      "2. Does it clarify an issue arising from title, missing documents, or searches?",
      "3. Is it required by express client/lender instruction?",
      "4. Is it already covered by TA forms, standard searches, or publicly available information?",
      "If it is generic, condition/opinion-based, duplicative, or public/standard-search information — avoid raising it.",
    ],
  },
  {
    id: "enforcement-limits",
    title: "Planning / building regs enforcement time limits",
    content: [
      "Standard planning (e.g., extensions) – 4 years for works completed before 25 Apr 2024; 10 years for works after 25 Apr 2024.",
      "Planning change of use – 10 years.",
      "Building regulations – 1 year for works completed before Oct 2023; 10 years after Oct 2023 (unless risk to life).",
      "Breach of covenant – commonly referenced at 20 years.",
    ],
  },
  {
    id: "practical",
    title: "Practical do / don't",
    content: [
      "DO raise fewer, better enquiries: legal, specific, evidence-led.",
      "DO report client-facing risks rather than asking the seller's solicitor to opine.",
      "DO use Statements of Truth where possible instead of Statutory Declarations to reduce delay and cost.",
      "DON'T raise generic enquiries covered by TA6, TA7, TA10, TA13, or standard contract conditions.",
      "DON'T ask about property condition – that is the buyer's survey responsibility.",
      "DON'T request information freely available from public registers or standard searches.",
    ],
  },
  {
    id: "conveyflow-usage",
    title: "How to use this in ConveyFlow",
    content: [
      "Open any Purchase matter and go to the \"Enquiries\" tab.",
      "Choose \"Create from Template\" or \"Build from Library\" to select enquiries.",
      "The library items are GRACE-compliant — they target specific legal issues, not generic or condition-based questions.",
      "Use the priority and notes fields to justify each enquiry when sending to the other side.",
      "Export to Excel for a clean, numbered pack ready to attach to correspondence.",
      "Always apply your professional judgement and consider lender-specific requirements.",
    ],
  },
];

const GRACE_SECTION_ICONS: Record<string, typeof BookOpen> = {
  "what-grace-is": BookOpen,
  "category-a": XCircle,
  "category-b": AlertTriangle,
  "decision-flow": ArrowRight,
  "enforcement-limits": Clock,
  "practical": CheckCircle2,
  "conveyflow-usage": Shield,
};

const RESOURCES: Resource[] = [
  {
    id: "conveyancing-protocol",
    title: "Conveyancing Protocol (Law Society)",
    tier: 1,
    summary: [
      "Best-practice workflow for residential sale/purchase (owner-occupier).",
      "Encourages consistency, clear communication, and risk controls.",
    ],
    whyItMatters: [
      "Helps reduce negligence risk and supports CQS-aligned practice.",
    ],
    useInConveyFlow: [
      "Map to workflow stages, checklists, and matter timelines.",
    ],
    sources: [
      { label: "Law Society – Conveyancing Protocol", url: "https://www.lawsociety.org.uk/en/topics/property/conveyancing-protocol" },
    ],
    tags: ["conveyancing", "protocol", "cqs", "workflow"],
  },
  {
    id: "grace-2025",
    title: "GRACE (2025) – Guidance for raising appropriate conveyancing enquiries",
    tier: 1,
    summary: [
      "Best-practice guidance for conveyancers to reduce unnecessary enquiries and avoid delays.",
      "Supports use of the Law Society Conveyancing Protocol and Conveyancing Association Technical Protocol.",
      "Core principle: raise enquiries only when necessary, legally relevant, and property-specific.",
    ],
    whyItMatters: [
      "Reduces transaction delays caused by unnecessary or duplicative enquiries.",
      "Supports CQS compliance and professional best practice.",
    ],
    useInConveyFlow: [
      "Open any Purchase matter and go to the \"Enquiries\" tab to build GRACE-compliant packs.",
      "The Enquiries Library items are tagged with Cat A / Cat B / Cat C categories.",
      "Export to Excel for a clean, numbered pack ready to attach to correspondence.",
    ],
    sources: [
      { label: "GRACE – Bold Legal Group (2025) PDF", url: "https://www.boldlegal.co.uk/grace" },
    ],
    tags: ["conveyancing", "cqs", "enquiries"],
    sections: GRACE_SECTIONS,
    sectionIcons: GRACE_SECTION_ICONS,
  },
  {
    id: "uk-finance-handbook",
    title: "UK Finance Mortgage Lenders' Handbook (England & Wales)",
    tier: 1,
    summary: [
      "Lender instructions for conveyancers: Part 1 general + Part 2 lender-specific.",
      "Must be followed where lender instructs under the Handbook.",
    ],
    whyItMatters: [
      "Panel compliance; breaches can cause claims/complaints and removal risk.",
    ],
    useInConveyFlow: [
      "Lender-specific checklist links per lender; add quick \"Part 2\" lookup.",
    ],
    sources: [
      { label: "Lenders' Handbook – England & Wales", url: "https://lendershandbook.ukfinance.org.uk/lenders-handbook/englandandwales/" },
      { label: "Lenders' Handbook – Home", url: "https://lendershandbook.ukfinance.org.uk/home/" },
      { label: "Lenders' Handbook – FAQs", url: "https://lendershandbook.ukfinance.org.uk/lenders-handbook/faqs/" },
    ],
    tags: ["lender", "handbook", "uk-finance", "mortgage", "compliance"],
  },
  {
    id: "hmlr-practice-guides",
    title: "HM Land Registry Practice Guides (GOV.UK collection)",
    tier: 1,
    summary: [
      "Official guidance for Land Registry applications, restrictions, notices, plans, requisitions.",
    ],
    whyItMatters: [
      "Reduces avoidable requisitions and application errors.",
    ],
    useInConveyFlow: [
      "Link common guides in post-completion workflow and title issue screens.",
    ],
    sources: [
      { label: "GOV.UK – Land Registration Practice Guides", url: "https://www.gov.uk/government/collections/land-registration-practice-guides" },
    ],
    tags: ["hmlr", "land-registry", "post-completion", "applications"],
  },
  {
    id: "lsag-aml",
    title: "LSAG AML Guidance for the Legal Sector (2025)",
    tier: 1,
    summary: [
      "Legal sector AML guidance (CDD/EDD, risk-based approach, SOF/SOW, PEPs, sanctions touchpoints).",
    ],
    whyItMatters: [
      "Supports compliance with the Money Laundering Regulations and SRA expectations.",
    ],
    useInConveyFlow: [
      "AML checklists, risk scoring guidance, file audit prompts.",
    ],
    sources: [
      { label: "SRA – AML guidance & support", url: "https://www.sra.org.uk/solicitors/resources/money-laundering/guidance-support/" },
      { label: "LSAG AML Guidance (PDF)", url: "https://www.sra.org.uk/globalassets/documents/solicitors/firm-based-authorisation/lsag-aml-guidance.pdf" },
    ],
    tags: ["aml", "lsag", "sra", "compliance", "cdd", "edd"],
  },
  {
    id: "sdlt-guidance",
    title: "SDLT guidance (GOV.UK + HMRC SDLT Manual)",
    tier: 2,
    summary: [
      "SDLT overview rules and detailed HMRC internal manual for edge cases.",
    ],
    whyItMatters: [
      "Reduces SDLT errors and late filing risk.",
    ],
    useInConveyFlow: [
      "SDLT checklist links; common reliefs prompt list (FTB, higher rates, mixed-use).",
    ],
    sources: [
      { label: "GOV.UK – Stamp Duty Land Tax", url: "https://www.gov.uk/stamp-duty-land-tax" },
      { label: "HMRC – SDLT Manual", url: "https://www.gov.uk/hmrc-internal-manuals/stamp-duty-land-tax-manual" },
    ],
    tags: ["sdlt", "hmrc", "tax", "post-completion"],
  },
  {
    id: "leasehold-lpe1",
    title: "Leasehold & LPE1 guidance (Law Society)",
    tier: 2,
    summary: [
      "LPE1 is the standard leasehold information pack request; covers ground rent, insurance, service charges, disputes, major works.",
    ],
    whyItMatters: [
      "Leasehold transactions often stall without management information.",
    ],
    useInConveyFlow: [
      "Leasehold workflow stage; management pack chasing templates; LPE1 request checklist.",
    ],
    sources: [
      { label: "Law Society – Leasehold forms", url: "https://www.lawsociety.org.uk/en/topics/property/leasehold-forms" },
    ],
    tags: ["leasehold", "lpe1", "management-pack", "service-charge"],
  },
  {
    id: "ta-forms",
    title: "TA forms disclosure guidance (Law Society)",
    tier: 2,
    summary: [
      "Transaction forms hub and explanatory notes; supports accurate seller disclosures and risk management.",
    ],
    whyItMatters: [
      "Misstatements can lead to misrepresentation disputes.",
    ],
    useInConveyFlow: [
      "Seller onboarding tips; TA6/TA10 completion guidance links.",
    ],
    sources: [
      { label: "Law Society – Transaction forms", url: "https://www.lawsociety.org.uk/topics/property/transaction-forms" },
      { label: "Law Society – TA6 (6th edition) explanatory notes", url: "https://www.lawsociety.org.uk/topics/property/ta6-6th-edition-explanatory-notes" },
    ],
    tags: ["ta6", "ta10", "ta13", "disclosures", "forms"],
  },
  {
    id: "flood-risk",
    title: "Search interpretation: Flood risk (Law Society)",
    tier: 3,
    summary: [
      "Practical note on flood searches, client reporting, and insurance considerations.",
    ],
    whyItMatters: [
      "Flood risk is frequently misunderstood; impacts insurability and lender appetite.",
    ],
    useInConveyFlow: [
      "Search result \"explain\" links; client report prompts.",
    ],
    sources: [
      { label: "Law Society – Flood risk", url: "https://www.lawsociety.org.uk/en/topics/property/flood-risk" },
    ],
    tags: ["searches", "flood", "reporting"],
  },
  {
    id: "building-safety-act",
    title: "Building Safety Act 2022: guide for conveyancers (Law Society)",
    tier: 3,
    summary: [
      "High-level guide on BSA 2022 impacts for conveyancing and leaseholder protections.",
    ],
    whyItMatters: [
      "Affects leasehold sales, certificates, lender requirements, delays.",
    ],
    useInConveyFlow: [
      "Leasehold/BSA checklist and resource link.",
    ],
    sources: [
      { label: "Law Society – Building Safety Act 2022 guide", url: "https://www.lawsociety.org.uk/topics/property/building-safety-act-2022-guide-for-conveyancers" },
    ],
    tags: ["building-safety", "bsa2022", "leasehold"],
  },
  {
    id: "sanctions-guidance",
    title: "Sanctions guidance (UK Sanctions List + OFSI + SRA)",
    tier: 3,
    summary: [
      "UK Sanctions List is the single source for designations; OFSI provides general guidance; SRA sets expectations for law firms.",
    ],
    whyItMatters: [
      "Breaches are strict liability in many cases and high regulatory risk.",
    ],
    useInConveyFlow: [
      "AML/sanctions checklist link-outs and staff reminders.",
    ],
    sources: [
      { label: "GOV.UK – UK Sanctions List", url: "https://www.gov.uk/government/publications/the-uk-sanctions-list" },
      { label: "OFSI – Financial Sanctions General Guidance", url: "https://www.gov.uk/government/publications/financial-sanctions-general-guidance/uk-financial-sanctions-general-guidance" },
      { label: "SRA – Financial sanctions regime", url: "https://www.sra.org.uk/solicitors/guidance/financial-sanctions-regime/" },
    ],
    tags: ["sanctions", "ofsi", "uk-sanctions-list", "aml", "compliance"],
  },
  {
    id: "immigration-manual",
    dept: "immigration",
    title: "Immigration Manual – UK Immigration Routes & Requirements",
    tier: 1,
    summary: [
      "Comprehensive reference covering UK immigration routes including work visas, family visas, asylum, and settlement.",
      "Detailed guidance on eligibility criteria, application processes, and documentation requirements.",
    ],
    whyItMatters: [
      "Essential for firms handling immigration matters alongside property transactions.",
      "Supports advisors in understanding client immigration status and its impact on property eligibility.",
    ],
    useInConveyFlow: [
      "Reference when assessing client eligibility for property purchase based on immigration status.",
      "Use alongside the Immigration Eligibility Assessment tool for comprehensive client advice.",
    ],
    sources: [
      { label: "Immigration Manual (built-in)", url: `${import.meta.env.BASE_URL || "/"}immigration-manual.html` },
    ],
    tags: ["immigration", "visa", "settlement", "asylum", "work-permit"],
  },
];

const RESOURCE_ICONS: Record<string, typeof BookOpen> = {
  "conveyancing-protocol": Scale,
  "grace-2025": BookOpen,
  "uk-finance-handbook": Building2,
  "hmlr-practice-guides": Landmark,
  "lsag-aml": ShieldAlert,
  "sdlt-guidance": Receipt,
  "leasehold-lpe1": Home,
  "ta-forms": FileText,
  "flood-risk": Waves,
  "building-safety-act": HardHat,
  "sanctions-guidance": Ban,
  "immigration-manual": Plane,
};

const TIER_CONFIG = {
  1: { label: "Tier 1 – Must include", color: "text-emerald-600 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" },
  2: { label: "Tier 2 – Strong value", color: "text-blue-600 border-blue-300 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950" },
  3: { label: "Tier 3 – Nice to have", color: "text-slate-500 border-slate-300 bg-slate-50 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-900" },
} as const;

export default function Resources() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set(["grace-2025"]));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [tierFilter, setTierFilter] = useState<"all" | 1 | 2 | 3>("all");
  const { department } = useAuth();

  const toggleResource = (id: string) => {
    setExpandedResources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let items = RESOURCES.filter((r) => {
      if (!r.dept) return true;
      if (department === "both") return true;
      return r.dept === department;
    });
    if (tierFilter !== "all") {
      items = items.filter((r) => r.tier === tierFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.summary.some((s) => s.toLowerCase().includes(q)) ||
          r.whyItMatters.some((w) => w.toLowerCase().includes(q)) ||
          r.useInConveyFlow.some((u) => u.toLowerCase().includes(q)) ||
          (r.sections && r.sections.some((s) =>
            s.title.toLowerCase().includes(q) ||
            s.content.some((c) => c.toLowerCase().includes(q))
          ))
      );
    }
    return items;
  }, [tierFilter, searchTerm, department]);

  const grouped = useMemo(() => {
    const tiers: Record<number, Resource[]> = { 1: [], 2: [], 3: [] };
    filtered.forEach((r) => tiers[r.tier].push(r));
    return tiers;
  }, [filtered]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-resources-title">Resources</h1>
        <p className="text-sm text-muted-foreground mt-1">Reference materials and guidance for conveyancing practice</p>
      </div>

      <div className="rounded-md p-3 glass-subtle text-xs text-muted-foreground flex items-start gap-2" data-testid="text-disclaimer">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-chart-5" />
        <span>Resources are general guidance and not legal advice. Always apply professional judgement and lender requirements.</span>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-resources-search"
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            variant={tierFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTierFilter("all")}
            className="text-xs h-8"
            data-testid="button-tier-all"
          >
            All
          </Button>
          {([1, 2, 3] as const).map((t) => (
            <Button
              key={t}
              variant={tierFilter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setTierFilter(t)}
              className="text-xs h-8"
              data-testid={`button-tier-${t}`}
            >
              Tier {t}
            </Button>
          ))}
        </div>
      </div>

      {([1, 2, 3] as const).map((tier) => {
        const items = grouped[tier];
        if (items.length === 0) return null;
        const config = TIER_CONFIG[tier];
        return (
          <div key={tier} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${config.color}`} data-testid={`badge-tier-${tier}`}>
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{items.length} resource{items.length !== 1 ? "s" : ""}</span>
            </div>

            {items.map((resource) => {
              const isExpanded = expandedResources.has(resource.id);
              const Icon = RESOURCE_ICONS[resource.id] || BookOpen;
              return (
                <Card key={resource.id} className="glass-card rounded-md" data-testid={`card-resource-${resource.id}`}>
                  <CardHeader className="pb-2">
                    <button
                      type="button"
                      onClick={() => toggleResource(resource.id)}
                      className="flex items-start gap-3 w-full text-left hover-elevate rounded-md p-1 -m-1"
                      data-testid={`button-toggle-resource-${resource.id}`}
                    >
                      <Icon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base leading-snug">{resource.title}</CardTitle>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                    <div className="flex gap-1.5 mt-2 flex-wrap pl-8">
                      {resource.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 space-y-4">
                      <div className="pl-8 space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Summary</p>
                          <ul className="space-y-1">
                            {resource.summary.map((s, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-primary mt-1.5 flex-shrink-0">•</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Why it matters</p>
                          <ul className="space-y-1">
                            {resource.whyItMatters.map((w, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-chart-5 mt-1.5 flex-shrink-0">•</span>
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Use in ConveyFlow</p>
                          <ul className="space-y-1">
                            {resource.useInConveyFlow.map((u, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-emerald-500 mt-1.5 flex-shrink-0">•</span>
                                <span>{u}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Sources</p>
                          <div className="space-y-1">
                            {resource.sources.map((src, i) => (
                              <a
                                key={i}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary underline flex items-center gap-1.5 hover:opacity-80"
                                data-testid={`link-source-${resource.id}-${i}`}
                              >
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                {src.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>

                      {resource.sections && resource.sections.length > 0 && (
                        <div className="border-t border-border/40 pt-3 mt-3">
                          {resource.sections.map((section) => {
                            const isSectionExpanded = expandedSections.has(section.id);
                            const SIcon = resource.sectionIcons?.[section.id] || BookOpen;
                            return (
                              <div key={section.id} className="border-b last:border-0 border-border/40">
                                <button
                                  type="button"
                                  onClick={() => toggleSection(section.id)}
                                  className="flex items-center gap-3 w-full text-left py-3 px-2 rounded-md hover-elevate"
                                  data-testid={`button-toggle-${section.id}`}
                                >
                                  <SIcon className="h-4 w-4 text-primary flex-shrink-0" />
                                  <span className="text-sm font-medium flex-1">{section.title}</span>
                                  <ArrowRight
                                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isSectionExpanded ? "rotate-90" : ""}`}
                                  />
                                </button>
                                {isSectionExpanded && (
                                  <div className="pl-9 pb-3 space-y-1.5">
                                    {section.content.map((line, i) => (
                                      <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                                        {line}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No resources match your search.</p>
        </div>
      )}
    </div>
  );
}
