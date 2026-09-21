import OpenAI from "openai";
import fs from "fs";
import { storage } from "./storage";
import type { Matter, Document as MatterDocument } from "../shared/schema";
import {
  isAiConfigured,
  resolveAiApiKey,
  resolveAiBaseUrl,
  resolveAiModel,
} from "./ai-config";

const openai = new OpenAI({
  apiKey: resolveAiApiKey() || "missing-key",
  baseURL: resolveAiBaseUrl(),
});

const AI_MODEL = resolveAiModel();

function assertAiConfigured() {
  if (!isAiConfigured()) {
    throw new Error("AI_NOT_CONFIGURED");
  }
}

const REDACTION_PATTERNS = [
  { pattern: /\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-Z]\b/gi, replacement: "[NI NUMBER REDACTED]" },
  { pattern: /\b\d{9}\b/g, replacement: "[PASSPORT REDACTED]" },
  { pattern: /\b\d{2}[\/-]\d{2}[\/-]\d{4}\b/g, replacement: "[DOB REDACTED]" },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: "[BANK CARD REDACTED]" },
  { pattern: /\b\d{6,8}\s?\d{6,10}\b/g, replacement: "[BANK ACCOUNT REDACTED]" },
  { pattern: /\bsort\s*code[:\s]*\d{2}[-\s]?\d{2}[-\s]?\d{2}\b/gi, replacement: "[SORT CODE REDACTED]" },
];

function redactSensitiveData(text: string): string {
  let result = text;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

async function getKnowledgeContext(): Promise<string> {
  const resources = await storage.getKnowledgeResources();
  if (resources.length === 0) return "";
  const graceResource = resources.find(r =>
    r.name.toLowerCase().includes("grace") || r.originalName.toLowerCase().includes("grace")
  );
  if (graceResource?.extractedText) {
    return `\n\nKNOWLEDGE RESOURCE - GRACE GUIDANCE (summarised rules):\n${graceResource.extractedText.slice(0, 4000)}`;
  }
  return "";
}

function buildDocumentContext(docs: MatterDocument[]): string {
  return docs.map(d => {
    let content = `[Document: ${d.originalName} (Type: ${d.documentType})]`;
    try {
      const text = fs.readFileSync(d.filePath, "utf-8");
      content += `\n${redactSensitiveData(text.slice(0, 3000))}`;
    } catch {
      content += "\n[Binary file - content not extractable as text]";
    }
    return content;
  }).join("\n\n---\n\n");
}

const PURCHASE_SYSTEM_PROMPT = `You are a senior UK conveyancing assistant generating a Suggested Enquiries Pack for a PURCHASE matter.

CRITICAL RULES:
- This is DRAFT assistance only. Add disclaimer: "DRAFT – For solicitor review only. Not legal advice."
- Follow GRACE guidance: avoid unnecessary enquiries that cause delays
- Do NOT raise Category A enquiries (identity, charges covered by TA13, state/condition, duplicate searches)
- Do NOT raise Category B enquiries unless property-specific and legally justified
- Apply the GRACE flowchart: Is it specific? Not about condition? Clarifying title/docs/searches? Not publicly available? Has buyer/lender instruction?
- Do NOT request identity/condition questions
- Do NOT duplicate TA form content
- Do NOT ask about publicly available information
- Respect caveat emptor principle
- Ask for missing documents rather than making assumptions
- Use "draft" language throughout
- Flag any risks clearly

OUTPUT FORMAT - Return valid JSON with these exact keys:
{
  "required_enquiries": [{"enquiry_text": "", "legal_reason": "", "trigger_source_doc": "", "suggested_evidence": ""}],
  "recommended_clarifications": [{"text": "", "reason": ""}],
  "matters_to_report_to_client": [{"text": "", "reason": ""}],
  "matters_for_indemnity_insurance": [{"text": "", "reasoning": ""}],
  "enquiries_avoided": [{"text": "", "reason": ""}],
  "risk_flags": [""],
  "missing_documents": [""]
}`;

const SALE_SYSTEM_PROMPT = `You are a senior UK conveyancing assistant drafting replies to buyer enquiries for a SALE matter.

CRITICAL RULES:
- This is DRAFT assistance only. Add disclaimer: "DRAFT – For solicitor review only. Not legal advice."
- Reference TA6/TA10/TA13 forms where questions are already answered
- Mark enquiries as "not appropriate" where they breach Protocol/CQS/GRACE guidance
- Apply caveat emptor: condition/survey questions are buyer's responsibility
- Flag where client confirmation is needed before sending
- Do NOT provide definitive legal advice
- Use "draft" language throughout

OUTPUT FORMAT - Return valid JSON with these exact keys:
{
  "draft_replies": [{"buyer_question": "", "draft_answer": "", "source_reference": ""}],
  "documents_enclosed": [{"document": "", "reference": ""}],
  "enquiries_not_appropriate": [{"enquiry": "", "protocol_reason": ""}],
  "client_confirmation_required": [{"question": "", "reason": ""}],
  "ta13_undertakings_matters": [{"matter": "", "detail": ""}],
  "risk_flags": [""]
}`;

function jsonToMarkdown(contentJson: Record<string, any>, packType: string): string {
  let md = `# ${packType === "purchase_enquiries" ? "Suggested Enquiries Pack" : "Draft Replies to Buyer Enquiries"}\n\n`;
  md += `> **DRAFT – For solicitor review only. Not legal advice.**\n\n`;

  if (packType === "purchase_enquiries") {
    const data = contentJson;
    if (data.required_enquiries?.length) {
      md += `## 1. Required Enquiries\n\n`;
      data.required_enquiries.forEach((e: any, i: number) => {
        md += `### ${i + 1}. ${e.enquiry_text}\n`;
        md += `- **Legal reason:** ${e.legal_reason}\n`;
        md += `- **Source document:** ${e.trigger_source_doc}\n`;
        md += `- **Suggested evidence:** ${e.suggested_evidence}\n\n`;
      });
    }
    if (data.recommended_clarifications?.length) {
      md += `## 2. Recommended Clarifications\n\n`;
      data.recommended_clarifications.forEach((c: any, i: number) => {
        md += `${i + 1}. **${c.text}**\n   - ${c.reason}\n\n`;
      });
    }
    if (data.matters_to_report_to_client?.length) {
      md += `## 3. Matters to Report to Client\n\n`;
      data.matters_to_report_to_client.forEach((m: any, i: number) => {
        md += `${i + 1}. **${m.text}**\n   - ${m.reason}\n\n`;
      });
    }
    if (data.matters_for_indemnity_insurance?.length) {
      md += `## 4. Matters Suitable for Indemnity Insurance\n\n`;
      data.matters_for_indemnity_insurance.forEach((m: any, i: number) => {
        md += `${i + 1}. **${m.text}**\n   - Reasoning: ${m.reasoning}\n\n`;
      });
    }
    if (data.enquiries_avoided?.length) {
      md += `## 5. Enquiries Avoided\n\n`;
      data.enquiries_avoided.forEach((e: any, i: number) => {
        md += `${i + 1}. ~~${e.text}~~\n   - **Reason avoided:** ${e.reason}\n\n`;
      });
    }
    if (data.missing_documents?.length) {
      md += `## Missing Documents\n\n`;
      data.missing_documents.forEach((d: string) => {
        md += `- ${d}\n`;
      });
      md += "\n";
    }
  } else {
    const data = contentJson;
    if (data.draft_replies?.length) {
      md += `## 1. Draft Replies to Buyer Enquiries\n\n`;
      data.draft_replies.forEach((r: any, i: number) => {
        md += `### ${i + 1}. ${r.buyer_question}\n`;
        md += `**Draft reply:** ${r.draft_answer}\n`;
        if (r.source_reference) md += `*Source: ${r.source_reference}*\n`;
        md += "\n";
      });
    }
    if (data.documents_enclosed?.length) {
      md += `## 2. Documents Enclosed\n\n`;
      data.documents_enclosed.forEach((d: any) => {
        md += `- ${d.document} *(${d.reference})*\n`;
      });
      md += "\n";
    }
    if (data.enquiries_not_appropriate?.length) {
      md += `## 3. Enquiries Not Appropriate\n\n`;
      data.enquiries_not_appropriate.forEach((e: any, i: number) => {
        md += `${i + 1}. ~~${e.enquiry}~~\n   - **Protocol reason:** ${e.protocol_reason}\n\n`;
      });
    }
    if (data.client_confirmation_required?.length) {
      md += `## 4. Client Confirmation Required\n\n`;
      data.client_confirmation_required.forEach((c: any, i: number) => {
        md += `${i + 1}. **${c.question}**\n   - ${c.reason}\n\n`;
      });
    }
    if (data.ta13_undertakings_matters?.length) {
      md += `## 5. TA13 / Undertakings Matters\n\n`;
      data.ta13_undertakings_matters.forEach((t: any, i: number) => {
        md += `${i + 1}. **${t.matter}**\n   - ${t.detail}\n\n`;
      });
    }
  }

  if (contentJson.risk_flags?.length) {
    md += `## ⚠ Risk Flags\n\n`;
    contentJson.risk_flags.forEach((f: string) => {
      md += `- 🔴 ${f}\n`;
    });
    md += "\n";
  }

  return md;
}

export async function generatePurchaseEnquiriesPack(
  matter: Matter,
  documentIds: number[]
): Promise<{ contentJson: Record<string, any>; contentMarkdown: string; riskFlags: string[] }> {
  assertAiConfigured();
  const docs = [];
  for (const id of documentIds) {
    const doc = await storage.getDocument(id);
    if (doc) docs.push(doc);
  }

  const knowledgeCtx = await getKnowledgeContext();
  const docContext = buildDocumentContext(docs);

  const userPrompt = `MATTER DETAILS:
- Type: Purchase
- Property: ${redactSensitiveData(matter.propertyAddress)}
- Price: ${matter.price || "Not specified"}
- Current Stage: ${matter.currentStage}

UPLOADED DOCUMENTS:
${docContext}
${knowledgeCtx}

Please analyse the above documents and produce a structured Suggested Enquiries Pack. Return ONLY valid JSON.`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: PURCHASE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  let contentJson: Record<string, any>;
  try {
    contentJson = JSON.parse(raw);
  } catch {
    contentJson = { error: "Failed to parse AI response", raw_response: raw };
  }

  const riskFlags = contentJson.risk_flags || [];
  const contentMarkdown = jsonToMarkdown(contentJson, "purchase_enquiries");

  return { contentJson, contentMarkdown, riskFlags };
}

export async function generateSaleRepliesPack(
  matter: Matter,
  enquiryDocId: number,
  supportingDocIds: number[]
): Promise<{ contentJson: Record<string, any>; contentMarkdown: string; riskFlags: string[] }> {
  assertAiConfigured();
  const enquiryDoc = await storage.getDocument(enquiryDocId);
  const supportingDocs = [];
  for (const id of supportingDocIds) {
    const doc = await storage.getDocument(id);
    if (doc) supportingDocs.push(doc);
  }

  const knowledgeCtx = await getKnowledgeContext();
  const enquiryContext = enquiryDoc ? buildDocumentContext([enquiryDoc]) : "[No enquiry document provided]";
  const supportingContext = buildDocumentContext(supportingDocs);

  const userPrompt = `MATTER DETAILS:
- Type: Sale
- Property: ${redactSensitiveData(matter.propertyAddress)}
- Price: ${matter.price || "Not specified"}
- Current Stage: ${matter.currentStage}

BUYER'S ENQUIRIES:
${enquiryContext}

SUPPORTING DOCUMENTS (TA6, TA10, TA13, Title, etc.):
${supportingContext}
${knowledgeCtx}

Please draft replies to the buyer's enquiries. Return ONLY valid JSON.`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: SALE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  let contentJson: Record<string, any>;
  try {
    contentJson = JSON.parse(raw);
  } catch {
    contentJson = { error: "Failed to parse AI response", raw_response: raw };
  }

  const riskFlags = contentJson.risk_flags || [];
  const contentMarkdown = jsonToMarkdown(contentJson, "sale_replies");

  return { contentJson, contentMarkdown, riskFlags };
}

const SEARCH_ANALYSIS_SYSTEM_PROMPT = `You are a senior UK conveyancing assistant. Your task is to analyse property search results, title documents, and contract packs to identify which enquiries should be raised with the seller's solicitor.

You will be given:
1. Text from property search results (local authority, environmental, drainage, mining, chancel, flood risk, etc.) — if provided
2. Content from uploaded documents such as Title Register, Title Plan, Contract Pack, TA forms, etc. — if provided
3. A complete library of standard conveyancing enquiries with IDs

CRITICAL RULES:
- Follow GRACE guidance: only flag enquiries that are genuinely triggered by findings in the material provided
- Do NOT flag Category A enquiries (identity, charges covered by TA13, state/condition, duplicate searches) unless there is an exceptional reason
- Category B enquiries should only be flagged when the material specifically triggers them
- Category C enquiries are standard and can be flagged more freely when relevant
- Be specific: explain exactly which finding in which document triggers each suggested enquiry
- If documents are clear and raise no concerns, say so — do not invent issues
- Respect caveat emptor: do NOT raise enquiries about property condition
- Apply professional scrutiny to documents — look for:
  * Name discrepancies between contract parties and registered proprietors on the title
  * Entries on the register (restrictions, notices, cautions, charges)
  * Discrepancies between the title plan and property boundaries described in the contract
  * Missing or incomplete information in TA forms
  * Restrictive covenants and positive covenants affecting the property
  * Leasehold issues (if applicable): service charge arrears, management company details, lease term
  * Rights of way, easements, and third-party rights
  * Planning issues: recent works without evidence of planning permission or building regulations sign-off
  * Occupiers not named on the title who may have overriding interests
  * Defective title issues requiring indemnity insurance
- Cross-reference documents against each other for consistency
- Group your analysis by document/search type for clarity

OUTPUT FORMAT - Return valid JSON with these exact keys:
{
  "search_summary": "Brief overall summary of ALL materials analysed (searches AND documents)",
  "flagged_enquiries": [
    {
      "library_item_id": 0,
      "library_item_title": "",
      "reason": "Specific finding that triggers this enquiry — reference the exact document and entry",
      "search_type": "e.g. Title Register, Contract Pack, Local Authority, Environmental",
      "priority": "high|medium|low",
      "suggested_wording": "Tailored wording for this specific situation, referencing the document finding. Empty string if standard wording is fine"
    }
  ],
  "additional_enquiries_not_in_library": [
    {
      "suggested_text": "Full text of a bespoke enquiry not covered by the library",
      "reason": "Why this is needed based on the findings",
      "search_type": "",
      "priority": "high|medium|low"
    }
  ],
  "document_issues": [
    {
      "document": "Name of the document where the issue was found",
      "issue": "Description of the discrepancy or concern",
      "severity": "high|medium|low",
      "recommended_action": "What the solicitor should do about this"
    }
  ],
  "no_action_items": [
    {
      "search_type": "",
      "summary": "Brief note on why no enquiries are needed for this search/document"
    }
  ],
  "risk_flags": ["Any significant risks identified"],
  "matters_to_report_to_client": ["Items the client should be made aware of even if no enquiry is raised"]
}`;

export async function analyseSearchResults(
  searchText: string,
  libraryItems: { id: number; title: string; enquiryText: string; category: string; subcategory: string | null; tags: string[] | null; whenToUse: string | null; graceParagraph: string | null }[],
  documentContent?: string
): Promise<{ contentJson: Record<string, any>; contentMarkdown: string }> {
  assertAiConfigured();
  const knowledgeCtx = await getKnowledgeContext();

  const libraryContext = libraryItems.map(item =>
    `[ID:${item.id}] ${item.title} (${item.category}${item.subcategory ? ' > ' + item.subcategory : ''}) ${item.graceParagraph || ''}\n  Text: ${item.enquiryText}\n  When to use: ${item.whenToUse || 'General'}`
  ).join("\n\n");

  let materialsSection = "";
  if (searchText && searchText.trim().length > 0) {
    materialsSection += `SEARCH RESULTS:\n${redactSensitiveData(searchText)}\n\n`;
  }
  if (documentContent && documentContent.trim().length > 0) {
    materialsSection += `UPLOADED DOCUMENTS:\n${documentContent}\n\n`;
  }

  const userPrompt = `MATERIALS TO ANALYSE:
${materialsSection}
ENQUIRIES LIBRARY (use these IDs when flagging):
${libraryContext}
${knowledgeCtx}

Analyse ALL the materials above — both search results and uploaded documents (if provided). Cross-reference documents against each other for inconsistencies (e.g. name discrepancies between contract and title register, missing entries, boundary issues). Identify which enquiries from the library should be raised. Return ONLY valid JSON.`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: SEARCH_ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  let contentJson: Record<string, any>;
  try {
    contentJson = JSON.parse(raw);
  } catch {
    contentJson = { error: "Failed to parse AI response", raw_response: raw };
  }

  const contentMarkdown = searchAnalysisToMarkdown(contentJson);
  return { contentJson, contentMarkdown };
}

function searchAnalysisToMarkdown(data: Record<string, any>): string {
  let md = `# Search Analysis Results\n\n`;
  md += `> **DRAFT – For solicitor review only. Not legal advice.**\n\n`;

  if (data.search_summary) {
    md += `## Summary\n\n${data.search_summary}\n\n`;
  }

  if (data.flagged_enquiries?.length) {
    md += `## Flagged Enquiries\n\n`;
    data.flagged_enquiries.forEach((e: any, i: number) => {
      md += `### ${i + 1}. ${e.library_item_title}\n`;
      md += `- **Search type:** ${e.search_type}\n`;
      md += `- **Priority:** ${e.priority}\n`;
      md += `- **Reason:** ${e.reason}\n`;
      if (e.suggested_wording) {
        md += `- **Suggested wording:** ${e.suggested_wording}\n`;
      }
      md += `\n`;
    });
  }

  if (data.additional_enquiries_not_in_library?.length) {
    md += `## Additional Bespoke Enquiries\n\n`;
    data.additional_enquiries_not_in_library.forEach((e: any, i: number) => {
      md += `${i + 1}. **${e.suggested_text}**\n`;
      md += `   - Search type: ${e.search_type}\n`;
      md += `   - Priority: ${e.priority}\n`;
      md += `   - Reason: ${e.reason}\n\n`;
    });
  }

  if (data.document_issues?.length) {
    md += `## Document Issues\n\n`;
    data.document_issues.forEach((d: any, i: number) => {
      md += `### ${i + 1}. ${d.document}\n`;
      md += `- **Issue:** ${d.issue}\n`;
      md += `- **Severity:** ${d.severity}\n`;
      md += `- **Recommended action:** ${d.recommended_action}\n\n`;
    });
  }

  if (data.no_action_items?.length) {
    md += `## No Action Required\n\n`;
    data.no_action_items.forEach((n: any) => {
      md += `- **${n.search_type}:** ${n.summary}\n`;
    });
    md += `\n`;
  }

  if (data.matters_to_report_to_client?.length) {
    md += `## Matters to Report to Client\n\n`;
    data.matters_to_report_to_client.forEach((m: string) => {
      md += `- ${m}\n`;
    });
    md += `\n`;
  }

  if (data.risk_flags?.length) {
    md += `## Risk Flags\n\n`;
    data.risk_flags.forEach((f: string) => {
      md += `- ${f}\n`;
    });
    md += `\n`;
  }

  return md;
}

export { jsonToMarkdown, redactSensitiveData };
