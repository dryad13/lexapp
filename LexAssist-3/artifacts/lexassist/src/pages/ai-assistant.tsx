import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Sparkles } from "lucide-react";
import { getAuthToken } from "@/lib/queryClient";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const suggestedQuestions = [
  "What documents do I need for a standard purchase?",
  "Explain the exchange process step by step",
  "What are common SDLT rates for residential property?",
  "What checks should I do before completion?",
  "Draft a chase letter for outstanding searches",
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (question?: string) => {
    const text = question || input.trim();
    if (!text || isStreaming) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/ai/suggest", {
        method: "POST",
        headers,
        body: JSON.stringify({ question: text }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              fullText += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullText };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-3">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-assistant-title">
          AI Assistant
        </h1>
        <p className="text-muted-foreground">
          Your conveyancing knowledge partner
        </p>
      </div>

      <div className="flex-1 overflow-hidden px-6">
        <div ref={scrollRef} className="h-full overflow-y-auto pb-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="p-4 rounded-full bg-primary/10">
                <Bot className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">How can I help?</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Ask me anything about conveyancing, property law, or your transactions.
                  I can help draft letters, explain procedures, or advise on next steps.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                {suggestedQuestions.map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    className="text-left text-xs h-auto py-3 px-4 justify-start glass-subtle"
                    onClick={() => handleSend(q)}
                    data-testid={`button-suggested-${q.slice(0, 20).replace(/\s/g, "-")}`}
                  >
                    <Sparkles className="h-3 w-3 mr-2 flex-shrink-0 text-primary" />
                    <span className="truncate">{q}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.role}-${i}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-md p-3.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "glass-card"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.role === "assistant" && !msg.content && isStreaming && (
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]" />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]" />
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-6 pt-3">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <Textarea
            ref={textareaRef}
            placeholder="Ask about conveyancing, property law, procedures..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="resize-none glass-subtle min-h-[44px] max-h-32"
            data-testid="input-ai-message"
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            size="icon"
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
