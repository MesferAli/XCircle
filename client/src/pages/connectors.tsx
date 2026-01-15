import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plug,
  Plus,
  Search,
  MoreHorizontal,
  Settings,
  Trash2,
  RefreshCw,
  ExternalLink,
  Key,
  Shield,
} from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Connector } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const authTypeLabels: Record<string, string> = {
  api_key: "API Key",
  oauth2: "OAuth 2.0",
  bearer: "Bearer Token",
  custom_header: "Custom Header",
};

export default function Connectors() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const { toast } = useToast();

  const { data: connectors, isLoading } = useQuery<Connector[]>({
    queryKey: ["/api/connectors"],
  });

  const healthCheckMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      return apiRequest("POST", `/api/connectors/${connectorId}/health-check`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({
        title: "Health Check Complete",
        description: "Connector status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Health Check Failed",
        description: "Unable to verify connector status.",
        variant: "destructive",
      });
    },
  });

  const deleteConnectorMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      return apiRequest("DELETE", `/api/connectors/${connectorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({
        title: "Connector Deleted",
        description: "The connector has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Unable to delete connector.",
        variant: "destructive",
      });
    },
  });

  const filteredConnectors = connectors?.filter((connector) =>
    connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    connector.baseUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Connectors"
        description="Manage your REST API data sources"
        actions={
          <Link href="/onboarding">
            <Button data-testid="button-add-connector">
              <Plus className="mr-2 h-4 w-4" />
              Add Connector
            </Button>
          </Link>
        }
      />

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-medium">Connected Systems</CardTitle>
                  <CardDescription>
                    REST API endpoints configured for data ingestion
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search connectors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-connectors"
                  />
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
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : filteredConnectors && filteredConnectors.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Base URL</TableHead>
                      <TableHead>Auth Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Check</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConnectors.map((connector) => (
                      <TableRow 
                        key={connector.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedConnector(connector)}
                        data-testid={`connector-row-${connector.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Plug className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">{connector.name}</p>
                              <p className="text-xs text-muted-foreground">{connector.type.toUpperCase()}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {connector.baseUrl}
                            </code>
                            <a 
                              href={connector.baseUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <Key className="h-3 w-3" />
                            {authTypeLabels[connector.authType] || connector.authType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge 
                            status={connector.status as "pending" | "connected" | "error" | "disabled"} 
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {connector.lastHealthCheck 
                              ? new Date(connector.lastHealthCheck).toLocaleString()
                              : "Never"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" data-testid={`connector-menu-${connector.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  healthCheckMutation.mutate(connector.id);
                                }}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Run Health Check
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                <Settings className="mr-2 h-4 w-4" />
                                Configure
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteConnectorMutation.mutate(connector.id);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={Plug}
                  title="No connectors configured"
                  description="Connect your first REST API to start ingesting data and generating AI recommendations."
                  action={{
                    label: "Add Connector",
                    onClick: () => window.location.href = "/onboarding",
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Dialog open={!!selectedConnector} onOpenChange={() => setSelectedConnector(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plug className="h-5 w-5" />
              </div>
              {selectedConnector?.name}
            </DialogTitle>
            <DialogDescription>
              Connector configuration and details
            </DialogDescription>
          </DialogHeader>
          
          {selectedConnector && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Base URL</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded block break-all">
                    {selectedConnector.baseUrl}
                  </code>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</p>
                  <p className="text-sm">{selectedConnector.type.toUpperCase()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Authentication</p>
                  <Badge variant="secondary" className="gap-1">
                    <Shield className="h-3 w-3" />
                    {authTypeLabels[selectedConnector.authType] || selectedConnector.authType}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                  <StatusBadge 
                    status={selectedConnector.status as "pending" | "connected" | "error" | "disabled"} 
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => healthCheckMutation.mutate(selectedConnector.id)}
                  disabled={healthCheckMutation.isPending}
                  data-testid="button-run-health-check"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${healthCheckMutation.isPending ? 'animate-spin' : ''}`} />
                  Run Health Check
                </Button>
                <Link href={`/mappings?connector=${selectedConnector.id}`}>
                  <Button variant="outline" data-testid="button-view-mappings">
                    View Mappings
                  </Button>
                </Link>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    deleteConnectorMutation.mutate(selectedConnector.id);
                    setSelectedConnector(null);
                  }}
                  disabled={deleteConnectorMutation.isPending}
                  data-testid="button-delete-connector"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
