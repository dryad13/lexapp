import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Pause,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";

interface ComplianceDashboardData {
  totals: {
    active: number;
    blocked: number;
    inAbeyance: number;
    completedThisMonth: number;
  };
  blockedByStage: { stage: string; count: number }[];
  overduePostCompletion: {
    matterId: number;
    clientName: string;
    address: string;
    daysOverdue: number;
    missing: { ruleKey: string | null; ruleName: string }[];
  }[];
  redMatters: {
    matterId: number;
    clientName: string;
    stage: string;
    missingRequired: { ruleKey: string | null; ruleName: string }[];
  }[];
}

export default function ComplianceDashboard() {
  const { data, isLoading } = useQuery<ComplianceDashboardData>({
    queryKey: ["/api/dashboard/compliance-summary"],
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Compliance Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-muted-foreground">Failed to load compliance data</p>
      </div>
    );
  }

  const maxBlocked = Math.max(...data.blockedByStage.map(s => s.count), 1);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-compliance-dashboard-title">
          Compliance Dashboard
        </h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card rounded-md">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <p className="text-3xl font-bold" data-testid="text-total-active">{data.totals.active}</p>
            <p className="text-xs text-muted-foreground">Active Matters</p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-md border-destructive/30">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <p className="text-3xl font-bold text-destructive" data-testid="text-total-blocked">{data.totals.blocked}</p>
            <p className="text-xs text-muted-foreground">Blocked Matters</p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-md">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
            <Pause className="h-6 w-6 text-amber-500" />
            <p className="text-3xl font-bold text-amber-500" data-testid="text-total-abeyance">{data.totals.inAbeyance}</p>
            <p className="text-xs text-muted-foreground">In Abeyance</p>
          </CardContent>
        </Card>
        <Card className="glass-card rounded-md">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-chart-4" />
            <p className="text-3xl font-bold text-chart-4" data-testid="text-total-completed">{data.totals.completedThisMonth}</p>
            <p className="text-xs text-muted-foreground">Completed This Month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-card rounded-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Blocked by Stage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.blockedByStage.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No blocked matters</p>
            ) : (
              data.blockedByStage.map((item) => (
                <div key={item.stage} className="space-y-1" data-testid={`blocked-stage-${item.stage}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{item.stage}</span>
                    <span className="font-medium text-destructive">{item.count}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-destructive rounded-full h-2 transition-all"
                      style={{ width: `${(item.count / maxBlocked) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Overdue Post-Completion ({data.overduePostCompletion.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.overduePostCompletion.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No overdue matters</p>
            ) : (
              data.overduePostCompletion.map((item) => (
                <Link href={`/matters/${item.matterId}`} key={item.matterId}>
                  <div
                    className="flex items-center justify-between gap-3 p-3 rounded-md glass-subtle hover-elevate cursor-pointer"
                    data-testid={`overdue-matter-${item.matterId}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{item.clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.address}</p>
                    </div>
                    <Badge variant="destructive" className="text-xs flex-shrink-0">
                      {item.daysOverdue}d overdue
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card rounded-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Red Matters — Missing Required Checks ({data.redMatters.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.redMatters.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">All matters compliant</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Client</th>
                    <th className="text-left py-2 px-3 font-medium">Stage</th>
                    <th className="text-left py-2 px-3 font-medium">Missing Items</th>
                    <th className="py-2 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.redMatters.map((item) => (
                    <tr key={item.matterId} className="border-b last:border-0" data-testid={`red-matter-${item.matterId}`}>
                      <td className="py-2 px-3 font-medium">{item.clientName}</td>
                      <td className="py-2 px-3 text-muted-foreground">{item.stage}</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {item.missingRequired.slice(0, 3).map((check, i) => (
                            <Badge key={i} variant="outline" className="text-xs text-destructive border-destructive/30">
                              {check.ruleName}
                            </Badge>
                          ))}
                          {item.missingRequired.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{item.missingRequired.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Link href={`/matters/${item.matterId}`}>
                          <ArrowRight className="h-4 w-4 text-muted-foreground hover:text-primary cursor-pointer" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
