import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CapabilityBadge } from "@/components/capability-badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Sparkles,
  Search,
  RefreshCw,
  Plug,
  Check,
  X,
  AlertCircle,
  Eye,
  Globe,
  Code,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { DiscoveredCapability, Connector } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Capabilities() {
  const [searchQuery, setSearchQuery] = useState("");
  const [connectorFilter, setConnectorFilter] = useState<string>("all");
  const [selectedCapability, setSelectedCapability] = useState<DiscoveredCapability | null>(null);
  const { toast } = useToast();

  const { data: capabilities, isLoading } = useQuery<DiscoveredCapability[]>({
    queryKey: ["/api/capabilities"],
  });

  const { data: connectors } = useQuery<Connector[]>({
    queryKey: ["/api/connectors"],
  });

  const discoverMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      return apiRequest("POST", `/api/connectors/${connectorId}/discover`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capabilities"] });
      toast({
        title: "Discovery Complete",
        description: "API capabilities have been analyzed.",
      });
    },
    onError: () => {
      toast({
        title: "Discovery Failed",
        description: "Unable to probe API endpoints.",
        variant: "destructive",
      });
    },
  });

  const filteredCapabilities = capabilities?.filter((cap) => {
    const matchesSearch = 
      cap.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cap.capability.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesConnector = connectorFilter === "all" || cap.connectorId === connectorFilter;
    return matchesSearch && matchesConnector;
  });

  const supportedCount = capabilities?.filter(c => c.isSupported).length || 0;
  const totalCount = capabilities?.length || 0;
  const supportPercentage = totalCount > 0 ? Math.round((supportedCount / totalCount) * 100) : 0;

  const getConnectorName = (id: string) => {
    return connectors?.find(c => c.id === id)?.name || "Unknown";
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Capability Discovery"
        description="AI-powered API capability detection and analysis"
        actions={
          <Select onValueChange={(id) => discoverMutation.mutate(id)}>
            <SelectTrigger className="w-48" data-testid="select-discover-connector">
              <div className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${discoverMutation.isPending ? 'animate-spin' : ''}`} />
                <span>Run Discovery</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {connectors?.map((connector) => (
                <SelectItem key={connector.id} value={connector.id}>
                  {connector.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">{totalCount}</p>
                    <p className="text-xs text-muted-foreground">Endpoints Scanned</p>
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
                    <p className="text-2xl font-light">{supportedCount}</p>
                    <p className="text-xs text-muted-foreground">Supported</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <X className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">{totalCount - supportedCount}</p>
                    <p className="text-xs text-muted-foreground">Unsupported</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Coverage</span>
                    <span className="text-sm font-medium">{supportPercentage}%</span>
                  </div>
                  <Progress value={supportPercentage} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-lg font-medium">Discovered Capabilities</CardTitle>
                  <CardDescription>
                    Safe GET-only probing to detect API features
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search endpoints..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-capabilities"
                    />
                  </div>
                  <Select value={connectorFilter} onValueChange={setConnectorFilter}>
                    <SelectTrigger className="w-40" data-testid="select-connector-filter">
                      <SelectValue placeholder="Connector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Connectors</SelectItem>
                      {connectors?.map((connector) => (
                        <SelectItem key={connector.id} value={connector.id}>
                          {connector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                      <Skeleton className="h-8 w-8 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : filteredCapabilities && filteredCapabilities.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Connector</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Capability</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Discovered</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCapabilities.map((cap) => (
                      <TableRow 
                        key={cap.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedCapability(cap)}
                        data-testid={`capability-row-${cap.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Plug className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{getConnectorName(cap.connectorId)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-0.5 rounded">
                            {cap.endpoint}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`font-mono text-xs ${
                              cap.method === "GET" ? "bg-chart-2/10 text-chart-2 border-chart-2/20" :
                              cap.method === "POST" ? "bg-chart-4/10 text-chart-4 border-chart-4/20" :
                              cap.method === "PUT" ? "bg-chart-5/10 text-chart-5 border-chart-5/20" :
                              cap.method === "DELETE" ? "bg-destructive/10 text-destructive border-destructive/20" :
                              ""
                            }`}
                          >
                            {cap.method}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <CapabilityBadge 
                            capability={cap.capability as "read" | "list" | "create_draft" | "update_draft" | "unknown"} 
                            isSupported={cap.isSupported ?? false}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell>
                          {cap.isSupported ? (
                            <div className="flex items-center gap-1 text-chart-2">
                              <Check className="h-4 w-4" />
                              <span className="text-sm">Supported</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <X className="h-4 w-4" />
                              <span className="text-sm">Unsupported</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {cap.discoveredAt ? new Date(cap.discoveredAt).toLocaleDateString() : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCapability(cap);
                            }}
                            data-testid={`capability-view-${cap.id}`}
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
                  icon={Sparkles}
                  title="No capabilities discovered"
                  description={searchQuery || connectorFilter !== "all" 
                    ? "Try adjusting your filters to see more results." 
                    : "Run capability discovery on a connector to detect available API features."}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Dialog open={!!selectedCapability} onOpenChange={() => setSelectedCapability(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Globe className="h-5 w-5" />
              </div>
              Endpoint Details
            </DialogTitle>
            <DialogDescription>
              Discovered capability information
            </DialogDescription>
          </DialogHeader>
          
          {selectedCapability && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Connector</p>
                  <p className="text-sm">{getConnectorName(selectedCapability.connectorId)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Method</p>
                  <Badge 
                    variant="outline" 
                    className={`font-mono ${
                      selectedCapability.method === "GET" ? "bg-chart-2/10 text-chart-2 border-chart-2/20" :
                      selectedCapability.method === "POST" ? "bg-chart-4/10 text-chart-4 border-chart-4/20" :
                      ""
                    }`}
                  >
                    {selectedCapability.method}
                  </Badge>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Endpoint</p>
                  <code className="text-sm bg-muted px-3 py-2 rounded block">
                    {selectedCapability.endpoint}
                  </code>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Capability</p>
                  <CapabilityBadge 
                    capability={selectedCapability.capability as "read" | "list" | "create_draft" | "update_draft" | "unknown"} 
                    isSupported={selectedCapability.isSupported ?? false}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                  {selectedCapability.isSupported ? (
                    <div className="flex items-center gap-2 text-chart-2">
                      <Check className="h-4 w-4" />
                      <span className="text-sm font-medium">Supported</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <X className="h-4 w-4" />
                      <span className="text-sm font-medium">Unsupported</span>
                    </div>
                  )}
                </div>
              </div>

              {!!selectedCapability.sampleResponse && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sample Response</p>
                  <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-64 font-mono">
                    {JSON.stringify(selectedCapability.sampleResponse, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" data-testid="button-create-mapping">
                  <Code className="mr-2 h-4 w-4" />
                  Create Mapping
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (selectedCapability) {
                      discoverMutation.mutate(selectedCapability.connectorId);
                    }
                  }}
                  disabled={discoverMutation.isPending}
                  data-testid="button-rediscover"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${discoverMutation.isPending ? 'animate-spin' : ''}`} />
                  Re-discover
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
