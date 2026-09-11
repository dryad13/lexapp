import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import type { ControlCheck } from "@shared/schema";
import { WORKFLOW_STAGES, IMMIGRATION_WORKFLOW_STAGES, isImmigrationMatterType } from "@shared/schema";
import RiskAssessmentForm from "./risk-assessment-form";

interface ComplianceTabProps {
  matterId: number;
  currentStage: string;
  matterData?: {
    clientRef?: string;
    clientName?: string;
    type?: string;
    propertyAddress?: string;
  };
}

export default function ComplianceTab({ matterId, currentStage, matterData }: ComplianceTabProps) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();

  const { data: checks, isLoading } = useQuery<ControlCheck[]>({
    queryKey: ["/api/matters", matterId, "compliance"],
  });

  const completeMutation = useMutation({
    mutationFn: async ({ checkId, action }: { checkId: number; action: "complete" | "uncomplete" }) => {
      const res = await apiRequest("POST", `/api/matters/${matterId}/compliance/${checkId}/${action}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId, "compliance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!checks || checks.length === 0) {
    return (
      <Card className="glass-card rounded-md">
        <CardContent className="py-12 text-center">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No compliance checks configured for this matter</p>
        </CardContent>
      </Card>
    );
  }

  const uniqueStages = [...new Set(checks.map(c => c.stage))];
  const isImmigrationMatter = matterData?.type ? isImmigrationMatterType(matterData.type) : false;
  const stageOrder = isImmigrationMatter ? IMMIGRATION_WORKFLOW_STAGES : WORKFLOW_STAGES;
  const stages = uniqueStages.sort((a, b) => {
    const ai = stageOrder.indexOf(a as any);
    const bi = stageOrder.indexOf(b as any);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const getStageStatus = (stage: string) => {
    const stageChecks = checks.filter(c => c.stage === stage);
    const completed = stageChecks.filter(c => c.completed).length;
    const required = stageChecks.filter(c => c.required);
    const requiredIncomplete = required.filter(c => !c.completed).length;

    if (completed === stageChecks.length) return "green";
    if (requiredIncomplete > 0) return "red";
    return "amber";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "green": return <ShieldCheck className="h-5 w-5 text-green-500" />;
      case "amber": return <ShieldAlert className="h-5 w-5 text-amber-500" />;
      case "red": return <ShieldX className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "green": return <Badge className="bg-green-500/10 text-green-600 border-green-500/20" data-testid="badge-compliance-green">Complete</Badge>;
      case "amber": return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20" data-testid="badge-compliance-amber">Optional Pending</Badge>;
      case "red": return <Badge className="bg-red-500/10 text-red-600 border-red-500/20" data-testid="badge-compliance-red">Required Pending</Badge>;
      default: return null;
    }
  };

  const canComplete = hasPermission("canCompleteChecks");

  const overallRequired = checks.filter(c => c.required);
  const overallCompleted = overallRequired.filter(c => c.completed).length;

  return (
    <Tabs defaultValue="checks" className="w-full">
      <TabsList className="mb-4" data-testid="tabs-compliance-sub">
        <TabsTrigger value="checks" data-testid="tab-compliance-checks">
          <ShieldCheck className="h-4 w-4 mr-1.5" />
          Stage Checks
        </TabsTrigger>
        <TabsTrigger value="risk-assessment" data-testid="tab-risk-assessment">
          <FileText className="h-4 w-4 mr-1.5" />
          Risk Assessment
        </TabsTrigger>
      </TabsList>

      <TabsContent value="checks">
        <div className="space-y-6">
          <Card className="glass-card rounded-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-medium text-sm" data-testid="text-compliance-summary">
                      {overallCompleted} of {overallRequired.length} required checks completed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Current stage: {currentStage}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {checks.filter(c => !c.completed).length === 0 ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20" data-testid="badge-compliance-all-complete">All Complete</Badge>
                  ) : (
                    <Badge variant="outline" data-testid="badge-compliance-pending">{checks.filter(c => !c.completed).length} pending</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {stages.map(stage => {
            const stageChecks = checks.filter(c => c.stage === stage);
            const status = getStageStatus(stage);
            const isCurrentStage = stage === currentStage;

            return (
              <Card key={stage} className={`glass-card rounded-md ${isCurrentStage ? "ring-2 ring-primary/30" : ""}`} data-testid={`card-compliance-stage-${stage.replace(/\s+/g, "-").toLowerCase()}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <CardTitle className="text-base">{stage}</CardTitle>
                      {isCurrentStage && (
                        <Badge variant="secondary" className="text-xs" data-testid="badge-current-stage">Current</Badge>
                      )}
                    </div>
                    {getStatusBadge(status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stageChecks.map(check => (
                    <div
                      key={check.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-md glass-subtle ${check.completed ? "opacity-75" : ""}`}
                      data-testid={`row-compliance-check-${check.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          disabled={!canComplete || completeMutation.isPending}
                          onClick={() => completeMutation.mutate({
                            checkId: check.id,
                            action: check.completed ? "uncomplete" : "complete",
                          })}
                          data-testid={`button-toggle-check-${check.id}`}
                        >
                          {check.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                        <div className="min-w-0">
                          <p className={`text-sm ${check.completed ? "line-through text-muted-foreground" : "font-medium"}`}>
                            {check.ruleName}
                          </p>
                          {check.completedAt && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Completed {new Date(check.completedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {check.required ? (
                          <Badge variant="destructive" className="text-xs" data-testid={`badge-required-${check.id}`}>Required</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-optional-${check.id}`}>Optional</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {status === "red" && isCurrentStage && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-red-500/5 border border-red-500/10 mt-2" data-testid="alert-compliance-blocking">
                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Stage progression is blocked until all required checks are completed.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="risk-assessment">
        <RiskAssessmentForm matterId={matterId} matterData={matterData} />
      </TabsContent>
    </Tabs>
  );
}
