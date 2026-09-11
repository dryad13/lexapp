/**
 * Minimal OpenAI-compatible mock for LexAssist AI routes (chat completions + SSE).
 */
import http from "node:http";
import { OPENAI_MOCK_PORT } from "./env.js";

function sseChunk(delta: string, finish: boolean = false): string {
  const payload = {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4o",
    choices: [
      {
        index: 0,
        delta: finish ? {} : { content: delta },
        finish_reason: finish ? "stop" : null,
      },
    ],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function jsonCompletion(content: string) {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4o",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  };
}

/** Default JSON body used by enquiries-ai pack generators. */
const ENQUIRY_PACK_JSON = JSON.stringify({
  title: "Test Purchase Enquiries Pack",
  summary: "Mock AI summary of enquiries",
  items: [
    {
      category: "Title",
      question: "Please confirm the registered proprietors.",
      priority: "high",
      notes: "Mock note",
    },
  ],
});

const SALE_REPLIES_JSON = JSON.stringify({
  title: "Test Sale Replies Pack",
  summary: "Mock sale replies",
  items: [
    {
      category: "Property",
      question: "Is there a working burglar alarm?",
      answer: "Yes, maintained annually.",
      priority: "medium",
    },
  ],
});

const SEARCH_ANALYSIS_JSON = JSON.stringify({
  flagged: [
    {
      category: "Local Authority",
      issue: "Planning notice nearby",
      severity: "medium",
      suggestedEnquiry: "Please clarify the planning notice outcome.",
    },
  ],
  summary: "Mock search analysis",
});

function pickContent(body: any): string {
  const text = JSON.stringify(body?.messages || []).toLowerCase();
  if (text.includes("sale") && text.includes("repl")) return SALE_REPLIES_JSON;
  if (text.includes("search")) return SEARCH_ANALYSIS_JSON;
  if (text.includes("enquir")) return ENQUIRY_PACK_JSON;
  if (text.includes("email")) {
    return "Dear Client,\n\nThis is a mock AI-generated email body for testing.\n\nKind regards";
  }
  return "This is a mock AI assistant response for LexAssist tests.";
}

export function startOpenAIMock(port = OPENAI_MOCK_PORT): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/healthz")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && req.url?.includes("/chat/completions")) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      let body: any = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        body = {};
      }
      const content = pickContent(body);

      if (body.stream) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        // Stream content in a few chunks
        const parts = content.match(/.{1,40}/gs) || [content];
        for (const part of parts) {
          res.write(sseChunk(part));
        }
        res.write(sseChunk("", true));
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(jsonCompletion(content)));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startOpenAIMock().then(() => {
    console.log(`OpenAI mock listening on ${OPENAI_MOCK_PORT}`);
  });
}
