import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { ConfidenceScore } from "@/components/confidence-score";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Lightbulb,
  Search,
  Filter,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  Brain,
  Package,
  MapPin,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Shield,
  UserCheck,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Recommendation } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/export-button";
import { recommendationColumns } from "@/lib/export-utils";

const typeIcons: Record<string, typeof Package> = {
  reorder: Package,
  transfer: RefreshCw,
  adjustment: TrendingUp,
  alert: AlertTriangle,
};

export default function Recommendations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: recommendations, isLoading } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations"],
  });

  const updateRecommendationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/recommendations/${id}`, { status });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      setSelectedRecommendation(null);
      toast({
        title: status === "approved" ? "Recommendation Approved" : 
               status === "rejected" ? "Recommendation Rejected" : 
               "Recommendation Deferred",
        description: "The action has been recorded in the audit log.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update recommendation.",
        variant: "destructive",
      });
    },
  });

  const filteredRecommendations = recommendations?.filter((rec) => {
    const matchesSearch = rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rec.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || rec.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || rec.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const pendingCount = recommendations?.filter(r => r.status === "pending").length || 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="AI Recommendations"
        description="Review and action AI-generated inventory insights"
        actions={
          <ExportButton
            title="AI Recommendations"
            subtitle="AI-generated inventory insights"
            filename="recommendations"
            columns={recommendationColumns}
            data={(filteredRecommendations || []) as Record<string, unknown>[]}
            formats={['pdf', 'excel']}
          />
        }
      />

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">{pendingCount}</p>
                    <p className="text-xs text-muted-foreground">Pending Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">
                      {recommendations?.filter(r => r.status === "approved").length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <X className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">
                      {recommendations?.filter(r => r.status === "rejected").length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Rejected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">
                      {recommendations?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Generated</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-lg font-medium">Recommendations Queue</CardTitle>
                  <CardDescription>
                    AI-generated insights for inventory optimization
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search recommendations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-recommendations"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="deferred">Deferred</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-32" data-testid="select-priority-filter">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
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
                    <div key={i} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-1/3" />
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredRecommendations && filteredRecommendations.length > 0 ? (
                <div className="space-y-4">
                  {filteredRecommendations.map((rec) => {
                    const TypeIcon = typeIcons[rec.type] || Lightbulb;
                    const isExpanded = expandedExplanation === rec.id;
                    
                    return (
                      <Card key={rec.id} className="hover-elevate" data-testid={`recommendation-${rec.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                              <TypeIcon className="h-5 w-5" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium">{rec.title}</span>
                                <PriorityBadge priority={rec.priority as "critical" | "high" | "medium" | "low"} size="sm" />
                                <Badge variant="secondary" className="text-xs capitalize">
                                  {rec.type}
                                </Badge>
                                {rec.status === "pending" && (rec.priority === "critical" || rec.priority === "high") && (
                                  <Badge variant="outline" className="text-xs bg-chart-4/10 text-chart-4 border-chart-4/30">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Requires Approval
                                  </Badge>
                                )}
                              </div>
                              
                              <p className="text-sm text-muted-foreground mb-3">
                                {rec.description}
                              </p>
                              
                              <div className="flex items-center gap-4 mb-3 flex-wrap">
                                <div className="w-32">
                                  <ConfidenceScore score={rec.confidenceScore} size="sm" />
                                </div>
                                <StatusBadge 
                                  status={rec.status as "pending" | "approved" | "rejected" | "deferred"} 
                                  size="sm" 
                                />
                                {rec.status === "pending" && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <UserCheck className="h-3 w-3" />
                                    <span>Awaiting review</span>
                                  </div>
                                )}
                              </div>

                              <Collapsible open={isExpanded} onOpenChange={() => setExpandedExplanation(isExpanded ? null : rec.id)}>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" data-testid={`toggle-explanation-${rec.id}`}>
                                    <Brain className="mr-1 h-3 w-3" />
                                    AI Explanation
                                    {isExpanded ? (
                                      <ChevronUp className="ml-1 h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="ml-1 h-3 w-3" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3">
                                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                                    <p className="text-muted-foreground">{rec.explanation}</p>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                            
                            {rec.status === "pending" && (
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedRecommendation(rec)}
                                  data-testid={`button-review-${rec.id}`}
                                >
                                  Review
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={Lightbulb}
                  title="No recommendations found"
                  description={searchQuery || statusFilter !== "all" || priorityFilter !== "all" 
                    ? "Try adjusting your filters to see more results." 
                    : "AI recommendations will appear here once data is ingested and analyzed."}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Dialog open={!!selectedRecommendation} onOpenChange={() => setSelectedRecommendation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Lightbulb className="h-5 w-5" />
              </div>
              Review Recommendation
            </DialogTitle>
            <DialogDescription>
              Approve, reject, or defer this AI recommendation
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecommendation && (
            <div className="space-y-6 pt-4">
              {(selectedRecommendation.priority === "critical" || selectedRecommendation.priority === "high") && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-chart-4/10 text-chart-4 text-sm">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">This action requires approval before execution</span>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-2">{selectedRecommendation.title}</h3>
                <p className="text-sm text-muted-foreground">{selectedRecommendation.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</p>
                  <Badge variant="secondary" className="capitalize">
                    {selectedRecommendation.type}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</p>
                  <PriorityBadge priority={selectedRecommendation.priority as "critical" | "high" | "medium" | "low"} />
                </div>
                <div className="col-span-2">
                  <ConfidenceScore score={selectedRecommendation.confidenceScore} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Explanation</p>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm">{selectedRecommendation.explanation}</p>
                </div>
              </div>

              {selectedRecommendation.suggestedAction && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggested Action</p>
                  <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto font-mono">
                    {JSON.stringify(selectedRecommendation.suggestedAction, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="pt-4 border-t gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                if (selectedRecommendation) {
                  updateRecommendationMutation.mutate({ 
                    id: selectedRecommendation.id, 
                    status: "deferred" 
                  });
                }
              }}
              disabled={updateRecommendationMutation.isPending}
              data-testid="button-defer"
            >
              <Clock className="mr-2 h-4 w-4" />
              Defer
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (selectedRecommendation) {
                  updateRecommendationMutation.mutate({ 
                    id: selectedRecommendation.id, 
                    status: "rejected" 
                  });
                }
              }}
              disabled={updateRecommendationMutation.isPending}
              data-testid="button-reject"
            >
              <X className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button 
              onClick={() => {
                if (selectedRecommendation) {
                  updateRecommendationMutation.mutate({ 
                    id: selectedRecommendation.id, 
                    status: "approved" 
                  });
                }
              }}
              disabled={updateRecommendationMutation.isPending}
              data-testid="button-approve"
            >
              <Check className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
