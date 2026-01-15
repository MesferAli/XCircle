import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Anomaly } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/export-button";
import { anomalyColumns } from "@/lib/export-utils";

export default function Anomalies() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const { toast } = useToast();

  const { data: anomalies, isLoading } = useQuery<Anomaly[]>({
    queryKey: ["/api/anomalies"],
  });

  const updateAnomalyMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/anomalies/${id}`, { status });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/anomalies"] });
      setSelectedAnomaly(null);
      toast({
        title: status === "resolved" ? "Anomaly Resolved" : 
               status === "dismissed" ? "Anomaly Dismissed" : 
               "Anomaly Updated",
        description: "Status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update anomaly.",
        variant: "destructive",
      });
    },
  });

  const filteredAnomalies = anomalies?.filter((anomaly) => {
    const matchesSearch = anomaly.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         anomaly.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || anomaly.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || anomaly.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const openCount = anomalies?.filter(a => a.status === "open").length || 0;
  const criticalCount = anomalies?.filter(a => a.severity === "critical" && a.status === "open").length || 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Anomaly Detection"
        description="AI-detected unusual patterns and discrepancies"
        actions={
          <ExportButton
            title="Anomaly Detection"
            subtitle="AI-detected unusual patterns and discrepancies"
            filename="anomalies"
            columns={anomalyColumns}
            data={(filteredAnomalies || []) as Record<string, unknown>[]}
            formats={['pdf', 'excel']}
          />
        }
      />

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className={criticalCount > 0 ? "border-destructive" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">{criticalCount}</p>
                    <p className="text-xs text-muted-foreground">Critical</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-5/10 text-chart-5">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">{openCount}</p>
                    <p className="text-xs text-muted-foreground">Open</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">
                      {anomalies?.filter(a => a.status === "investigating").length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Investigating</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">
                      {anomalies?.filter(a => a.status === "resolved").length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Resolved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-lg font-medium">Detected Anomalies</CardTitle>
                  <CardDescription>
                    Unusual patterns identified by AI analysis
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search anomalies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-anomalies"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-32" data-testid="select-severity-filter">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                      <Skeleton className="h-10 w-10 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : filteredAnomalies && filteredAnomalies.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Anomaly</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Deviation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detected</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnomalies.map((anomaly) => (
                      <TableRow 
                        key={anomaly.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedAnomaly(anomaly)}
                        data-testid={`anomaly-row-${anomaly.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-destructive/10 text-destructive">
                              <AlertTriangle className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{anomaly.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {anomaly.description}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {anomaly.type.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={anomaly.severity as "critical" | "high" | "medium" | "low"} size="sm" />
                        </TableCell>
                        <TableCell>
                          {anomaly.deviation !== null && (
                            <div className="flex items-center gap-1">
                              {anomaly.deviation > 0 ? (
                                <TrendingUp className="h-4 w-4 text-chart-5" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-chart-1" />
                              )}
                              <span className={`text-sm font-medium ${anomaly.deviation > 0 ? 'text-chart-5' : 'text-chart-1'}`}>
                                {anomaly.deviation > 0 ? "+" : ""}{anomaly.deviation.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge 
                            status={anomaly.status as "open" | "investigating" | "resolved" | "dismissed"} 
                            size="sm" 
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {anomaly.createdAt ? new Date(anomaly.createdAt).toLocaleDateString() : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAnomaly(anomaly);
                            }}
                            data-testid={`anomaly-view-${anomaly.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={AlertTriangle}
                  title="No anomalies detected"
                  description={searchQuery || statusFilter !== "all" || severityFilter !== "all" 
                    ? "Try adjusting your filters to see more results." 
                    : "AI monitoring is active. Anomalies will appear here when detected."}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Dialog open={!!selectedAnomaly} onOpenChange={() => setSelectedAnomaly(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              Anomaly Details
            </DialogTitle>
            <DialogDescription>
              Review and take action on this detected anomaly
            </DialogDescription>
          </DialogHeader>
          
          {selectedAnomaly && (
            <div className="space-y-6 pt-4">
              <div>
                <h3 className="font-medium mb-2">{selectedAnomaly.title}</h3>
                <p className="text-sm text-muted-foreground">{selectedAnomaly.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</p>
                  <Badge variant="secondary" className="capitalize">
                    {selectedAnomaly.type.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Severity</p>
                  <PriorityBadge priority={selectedAnomaly.severity as "critical" | "high" | "medium" | "low"} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                  <StatusBadge 
                    status={selectedAnomaly.status as "open" | "investigating" | "resolved" | "dismissed"} 
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detected</p>
                  <p className="text-sm">
                    {selectedAnomaly.createdAt ? new Date(selectedAnomaly.createdAt).toLocaleString() : "-"}
                  </p>
                </div>
              </div>

              {(selectedAnomaly.detectedValue !== null || selectedAnomaly.expectedValue !== null) && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Value Analysis</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Expected</p>
                      <p className="text-lg font-medium">{selectedAnomaly.expectedValue?.toLocaleString() || "-"}</p>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Detected</p>
                      <p className="text-lg font-medium">{selectedAnomaly.detectedValue?.toLocaleString() || "-"}</p>
                    </div>
                  </div>
                  {selectedAnomaly.deviation !== null && (
                    <div className="flex items-center justify-center gap-2 pt-2 border-t">
                      {selectedAnomaly.deviation > 0 ? (
                        <TrendingUp className="h-5 w-5 text-chart-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-chart-1" />
                      )}
                      <span className={`text-lg font-semibold ${selectedAnomaly.deviation > 0 ? 'text-chart-5' : 'text-chart-1'}`}>
                        {selectedAnomaly.deviation > 0 ? "+" : ""}{selectedAnomaly.deviation.toFixed(1)}% deviation
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="pt-4 border-t gap-2">
            {selectedAnomaly?.status === "open" && (
              <Button 
                variant="outline" 
                onClick={() => {
                  if (selectedAnomaly) {
                    updateAnomalyMutation.mutate({ 
                      id: selectedAnomaly.id, 
                      status: "investigating" 
                    });
                  }
                }}
                disabled={updateAnomalyMutation.isPending}
                data-testid="button-investigate"
              >
                <Eye className="mr-2 h-4 w-4" />
                Start Investigation
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => {
                if (selectedAnomaly) {
                  updateAnomalyMutation.mutate({ 
                    id: selectedAnomaly.id, 
                    status: "dismissed" 
                  });
                }
              }}
              disabled={updateAnomalyMutation.isPending}
              data-testid="button-dismiss"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Dismiss
            </Button>
            <Button 
              onClick={() => {
                if (selectedAnomaly) {
                  updateAnomalyMutation.mutate({ 
                    id: selectedAnomaly.id, 
                    status: "resolved" 
                  });
                }
              }}
              disabled={updateAnomalyMutation.isPending}
              data-testid="button-resolve"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
