export function renderHeader(doc: any, username: string, label: string) {
  doc.fontSize(18).fillColor("#111").text("Reflective Learning Journal", { align: "left" });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#666").text(`${username}  ·  ${label}  ·  Generated ${new Date().toLocaleString("en-GB")}`);
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.8);
}

export function renderEntry(doc: any, entry: any) {
  if (doc.y > 720) doc.addPage();
  const date = entry.entryDate ? new Date(entry.entryDate) : new Date(entry.createdAt);
  doc.fontSize(13).fillColor("#111").text(entry.title || "(untitled)", { continued: false });
  doc.fontSize(9).fillColor("#888").text(`${date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}  ·  ${entry.category || "general"}`);
  doc.moveDown(0.4);
  const section = (label: string, body: string | null) => {
    if (!body) return;
    doc.fontSize(10).fillColor("#444").text(label, { continued: false });
    doc.fontSize(10).fillColor("#222").text(body, { paragraphGap: 4 });
    doc.moveDown(0.3);
  };
  section("Activity", entry.activity);
  section("Learning", entry.learning);
  section("Reflection", entry.reflection);
  if (!entry.activity && !entry.learning && !entry.reflection && entry.content) {
    section("Notes", entry.content);
  }
  doc.moveDown(0.4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#eee").stroke();
  doc.moveDown(0.6);
}

async function loadPdfDocument() {
  const pdfMod: any = await import("pdfkit");
  return pdfMod.default || pdfMod;
}

function pdfToBuffer(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function buildJournalPdf(opts: {
  username: string;
  label: string;
  entries: any[];
  filename: string;
}): Promise<{ buffer: Buffer; filename: string }> {
  const PDFDocument = await loadPdfDocument();
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const done = pdfToBuffer(doc);
  renderHeader(doc, opts.username, opts.label);
  if (opts.entries.length === 0) {
    doc.fontSize(11).fillColor("#666").text("No entries in this period.");
  } else {
    for (const e of opts.entries) {
      renderEntry(doc, e);
    }
  }
  doc.end();
  return { buffer: await done, filename: opts.filename };
}

export async function buildMatterPdf(opts: {
  title: string;
  clientName?: string | null;
  propertyAddress?: string | null;
  type?: string | null;
}): Promise<{ buffer: Buffer; filename: string }> {
  const PDFDocument = await loadPdfDocument();
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const done = pdfToBuffer(doc);
  doc.fontSize(18).fillColor("#111").text("Matter report");
  doc.moveDown(0.4);
  doc.fontSize(12).fillColor("#222").text(opts.title || "Untitled matter");
  if (opts.type) doc.fontSize(10).fillColor("#666").text(`Type: ${opts.type}`);
  if (opts.clientName) doc.fontSize(10).fillColor("#666").text(`Client: ${opts.clientName}`);
  if (opts.propertyAddress) doc.fontSize(10).fillColor("#666").text(`Property: ${opts.propertyAddress}`);
  doc.moveDown(0.6);
  doc.fontSize(10).fillColor("#444").text(`Generated ${new Date().toLocaleString("en-GB")}`);
  const safe = String(opts.title || "matter").replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
  doc.end();
  return { buffer: await done, filename: `matter-${safe}.pdf` };
}
