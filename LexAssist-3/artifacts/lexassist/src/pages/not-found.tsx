import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 glass-card">
        <CardContent className="pt-6 pb-6 text-center">
          <div className="flex flex-col items-center gap-3 mb-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(27,77,62,0.10)" }}
            >
              <AlertCircle className="h-6 w-6" style={{ color: "#1B4D3E" }} />
            </div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1B4D3E" }}
            >
              Page Not Found
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/dashboard">
            <Button style={{ backgroundColor: "#1B4D3E", color: "#ffffff", border: "none" }}>
              Return to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
