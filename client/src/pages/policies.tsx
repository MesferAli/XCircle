import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Plus,
  Search,
  Settings,
  Trash2,
  Power,
  PowerOff,
  Code,
  Users,
  Lock,
  Zap,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Policy } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const policyTypeIcons: Record<string, typeof Shield> = {
  approval: Users,
  action: Zap,
  access: Lock,
};


export default function Policies() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const { toast } = useToast();

  const { data: policies, isLoading } = useQuery<Policy[]>({
    queryKey: ["/api/policies"],
  });

  const togglePolicyMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/policies/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      toast({
        title: "Policy Updated",
        description: "Policy status has been changed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update policy.",
        variant: "destructive",
      });
    },
  });

  const deletePolicyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/policies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      setSelectedPolicy(null);
      toast({
        title: "Policy Deleted",
        description: "The policy has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete policy.",
        variant: "destructive",
      });
    },
  });

  const filteredPolicies = policies?.filter((policy) =>
    policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    policy.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = policies?.filter(p => p.enabled).length || 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Policy Engine"
        description="Governance rules for actions and approvals"
        actions={
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-policy">
            <Plus className="mr-2 h-4 w-4" />
            Create Policy
          </Button>
        }
      />

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                    <Power className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">{activeCount}</p>
                    <p className="text-xs text-muted-foreground">Active Policies</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <PowerOff className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">
                      {(policies?.length || 0) - activeCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Disabled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-light">{policies?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Policies</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-medium">Policy Rules</CardTitle>
                  <CardDescription>
                    Control who can approve what and under which conditions
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search policies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-policies"
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
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
              ) : filteredPolicies && filteredPolicies.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Enabled</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPolicies.map((policy) => {
                      const TypeIcon = policyTypeIcons[policy.type] || Shield;
                      return (
                        <TableRow 
                          key={policy.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedPolicy(policy)}
                          data-testid={`policy-row-${policy.id}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <TypeIcon className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium">{policy.name}</p>
                                {policy.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {policy.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {policy.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {policy.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {policy.enabled ? (
                              <StatusBadge status="active" size="sm" />
                            ) : (
                              <StatusBadge status="disabled" size="sm" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={policy.enabled ?? false}
                              onCheckedChange={(checked) => {
                                togglePolicyMutation.mutate({ id: policy.id, enabled: checked });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`policy-toggle-${policy.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPolicy(policy);
                              }}
                              data-testid={`policy-settings-${policy.id}`}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={Shield}
                  title="No policies configured"
                  description="Create your first policy to control approvals and actions in the platform."
                  action={{
                    label: "Create Policy",
                    onClick: () => setShowCreateDialog(true),
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Policy</DialogTitle>
            <DialogDescription>
              Define governance rules for actions and approvals
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Policy Name</Label>
                <Input placeholder="e.g., Require Manager Approval" data-testid="input-policy-name" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select>
                  <SelectTrigger data-testid="select-policy-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approval">Approval</SelectItem>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="access">Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="Describe what this policy controls..."
                className="resize-none"
                data-testid="input-policy-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Conditions (JSON)</Label>
              <Textarea 
                className="h-24 font-mono text-sm resize-none"
                placeholder='[{"field": "priority", "operator": "equals", "value": "critical"}]'
                data-testid="input-policy-conditions"
              />
            </div>

            <div className="space-y-2">
              <Label>Actions (JSON)</Label>
              <Textarea 
                className="h-24 font-mono text-sm resize-none"
                placeholder='[{"type": "require_approval", "config": {}}]'
                data-testid="input-policy-actions"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="enabled" defaultChecked data-testid="switch-enabled" />
              <Label htmlFor="enabled">Enable policy immediately</Label>
            </div>
          </div>
          
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button data-testid="button-save-policy">
              Create Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPolicy} onOpenChange={() => setSelectedPolicy(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              {selectedPolicy?.name}
            </DialogTitle>
            <DialogDescription>
              Policy configuration and rules
            </DialogDescription>
          </DialogHeader>
          
          {selectedPolicy && (
            <div className="space-y-6 pt-4">
              {selectedPolicy.description && (
                <p className="text-sm text-muted-foreground">{selectedPolicy.description}</p>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</p>
                  <Badge variant="secondary" className="capitalize">
                    {selectedPolicy.type}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</p>
                  <Badge variant="outline">
                    {selectedPolicy.priority}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                  {selectedPolicy.enabled ? (
                    <StatusBadge status="active" />
                  ) : (
                    <StatusBadge status="disabled" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conditions</p>
                <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-32 font-mono">
                  {JSON.stringify(selectedPolicy.conditions, null, 2)}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</p>
                <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-32 font-mono">
                  {JSON.stringify(selectedPolicy.actions, null, 2)}
                </pre>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" data-testid="button-edit-policy">
                  <Code className="mr-2 h-4 w-4" />
                  Edit Rules
                </Button>
                <div className="flex-1" />
                <Button 
                  variant="destructive" 
                  onClick={() => deletePolicyMutation.mutate(selectedPolicy.id)}
                  disabled={deletePolicyMutation.isPending}
                  data-testid="button-delete-policy"
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
