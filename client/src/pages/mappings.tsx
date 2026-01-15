import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  GitBranch,
  Plus,
  Search,
  ArrowRight,
  Code,
  Eye,
  Settings,
  Trash2,
  History,
  Play,
  Save,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Mapping, Connector } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const canonicalEntities = [
  { value: "item", label: "Item (Product/SKU)" },
  { value: "location", label: "Location (Warehouse/Store)" },
  { value: "stock_balance", label: "Stock Balance" },
  { value: "stock_movement", label: "Stock Movement" },
  { value: "demand_signal", label: "Demand Signal" },
];

export default function Mappings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<Mapping | null>(null);
  const { toast } = useToast();

  const { data: mappings, isLoading: mappingsLoading } = useQuery<Mapping[]>({
    queryKey: ["/api/mappings"],
  });

  const { data: connectors } = useQuery<Connector[]>({
    queryKey: ["/api/connectors"],
  });

  const createMappingMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mappings"] });
      setShowCreateDialog(false);
      toast({
        title: "Mapping Created",
        description: "Your mapping has been saved as a draft.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create mapping.",
        variant: "destructive",
      });
    },
  });

  const filteredMappings = mappings?.filter((mapping) =>
    mapping.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mapping.targetEntity.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mapping Studio"
        description="Zero-code JSONPath to Canonical Model mapping"
        actions={
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-mapping">
            <Plus className="mr-2 h-4 w-4" />
            Create Mapping
          </Button>
        }
      />

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-medium">Data Mappings</CardTitle>
                  <CardDescription>
                    Transform source data to canonical inventory model
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search mappings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-mappings"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {mappingsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2 mb-4" />
                        <Skeleton className="h-8 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredMappings && filteredMappings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMappings.map((mapping) => (
                    <Card 
                      key={mapping.id} 
                      className="hover-elevate cursor-pointer"
                      onClick={() => setSelectedMapping(mapping)}
                      data-testid={`mapping-card-${mapping.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
                              <GitBranch className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{mapping.name}</p>
                              <p className="text-xs text-muted-foreground">v{mapping.version}</p>
                            </div>
                          </div>
                          <StatusBadge 
                            status={mapping.status as "draft" | "active" | "archived"} 
                            size="sm" 
                          />
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm mb-3">
                          <Badge variant="secondary" className="text-xs">
                            {mapping.sourceEndpoint}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs">
                            {canonicalEntities.find(e => e.value === mapping.targetEntity)?.label || mapping.targetEntity}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 pt-3 border-t">
                          <Button variant="ghost" size="sm" className="flex-1" data-testid={`mapping-preview-${mapping.id}`}>
                            <Eye className="mr-1 h-3 w-3" />
                            Preview
                          </Button>
                          <Button variant="ghost" size="sm" className="flex-1" data-testid={`mapping-edit-${mapping.id}`}>
                            <Code className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={GitBranch}
                  title="No mappings configured"
                  description="Create your first mapping to transform source data into the canonical inventory model."
                  action={{
                    label: "Create Mapping",
                    onClick: () => setShowCreateDialog(true),
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create New Mapping</DialogTitle>
            <DialogDescription>
              Map source data fields to the canonical inventory model
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="config" className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            
            <TabsContent value="config" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mapping Name</Label>
                  <Input placeholder="e.g., Products from ERP" data-testid="input-mapping-name" />
                </div>
                <div className="space-y-2">
                  <Label>Connector</Label>
                  <Select>
                    <SelectTrigger data-testid="select-connector">
                      <SelectValue placeholder="Select connector" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectors?.map((connector) => (
                        <SelectItem key={connector.id} value={connector.id}>
                          {connector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source Endpoint</Label>
                  <Input placeholder="e.g., /api/v1/products" data-testid="input-source-endpoint" />
                </div>
                <div className="space-y-2">
                  <Label>Target Entity</Label>
                  <Select>
                    <SelectTrigger data-testid="select-target-entity">
                      <SelectValue placeholder="Select canonical entity" />
                    </SelectTrigger>
                    <SelectContent>
                      {canonicalEntities.map((entity) => (
                        <SelectItem key={entity.value} value={entity.value}>
                          {entity.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="mapping" className="mt-4 h-[400px]">
              <div className="grid grid-cols-2 gap-4 h-full">
                <div className="space-y-2">
                  <Label>Source JSON (Sample)</Label>
                  <Textarea 
                    className="h-[350px] font-mono text-sm resize-none"
                    placeholder='{"id": "123", "name": "Product A", ...}'
                    data-testid="textarea-source-json"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mapping Configuration (JSONPath)</Label>
                  <Textarea 
                    className="h-[350px] font-mono text-sm resize-none"
                    placeholder='{"sku": "$.id", "name": "$.name", ...}'
                    data-testid="textarea-mapping-config"
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="preview" className="mt-4">
              <div className="rounded-lg border bg-muted/50 p-6 min-h-[300px]">
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Configure mapping and click "Run Preview" to test</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button variant="outline" data-testid="button-run-preview">
              <Play className="mr-2 h-4 w-4" />
              Run Preview
            </Button>
            <Button 
              onClick={() => createMappingMutation.mutate({})}
              disabled={createMappingMutation.isPending}
              data-testid="button-save-mapping"
            >
              <Save className="mr-2 h-4 w-4" />
              Save as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedMapping} onOpenChange={() => setSelectedMapping(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GitBranch className="h-5 w-5" />
              </div>
              {selectedMapping?.name}
            </DialogTitle>
            <DialogDescription>
              Mapping version {selectedMapping?.version}
            </DialogDescription>
          </DialogHeader>
          
          {selectedMapping && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source Endpoint</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded block">
                    {selectedMapping.sourceEndpoint}
                  </code>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Entity</p>
                  <p className="text-sm">{selectedMapping.targetEntity}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                  <StatusBadge 
                    status={selectedMapping.status as "draft" | "active" | "archived"} 
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Version</p>
                  <p className="text-sm">v{selectedMapping.version}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mapping Configuration</p>
                <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-48 font-mono">
                  {JSON.stringify(selectedMapping.mappingConfig, null, 2)}
                </pre>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" data-testid="button-edit-mapping">
                  <Code className="mr-2 h-4 w-4" />
                  Edit Mapping
                </Button>
                <Button variant="outline" data-testid="button-view-history">
                  <History className="mr-2 h-4 w-4" />
                  Version History
                </Button>
                <Button variant="outline" data-testid="button-test-mapping">
                  <Play className="mr-2 h-4 w-4" />
                  Test
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
