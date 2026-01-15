/**
 * MLOps Dashboard - Model Governance & Monitoring
 * 
 * لوحة تحكم للموافقات والمراقبة
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  Database,
  GitBranch,
  Eye,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Bell,
  BarChart3,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ============================================
// Types
// ============================================

interface ModelVersion {
  id: string;
  modelName: string;
  version: string;
  approvalStatus: 'draft' | 'pending_approval' | 'approved' | 'deployed' | 'deprecated' | 'rejected';
  metrics: {
    mae?: number;
    rmse?: number;
    accuracy?: number;
    baselineComparison?: number;
  };
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

interface ApprovalRequest {
  id: string;
  modelVersionId: string;
  modelName: string;
  version: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  backtestResults: {
    passed: boolean;
    comparisonWithBaseline: number;
    stabilityScore: number;
  };
}

interface DriftMetric {
  id: string;
  featureName: string;
  driftScore: number;
  severity: 'none' | 'low' | 'medium' | 'high';
  detectedAt: string;
}

interface MonitoringAlert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  messageAr?: string;
  acknowledged: boolean;
  createdAt: string;
}

interface DecisionStats {
  total: number;
  byUseCase: Record<string, number>;
  fallbackRate: number;
}

// ============================================
// Mock Data (Replace with API calls)
// ============================================

const mockModels: ModelVersion[] = [
  {
    id: '1',
    modelName: 'demand_forecasting',
    version: '1.2.0',
    approvalStatus: 'deployed',
    metrics: { mae: 8.5, baselineComparison: 15 },
    createdAt: '2024-01-10T10:00:00Z',
    approvedBy: 'admin@xcircle.sa',
    approvedAt: '2024-01-11T14:30:00Z',
  },
  {
    id: '2',
    modelName: 'stockout_risk',
    version: '1.0.0',
    approvalStatus: 'deployed',
    metrics: { accuracy: 0.92, baselineComparison: 12 },
    createdAt: '2024-01-08T09:00:00Z',
    approvedBy: 'admin@xcircle.sa',
    approvedAt: '2024-01-09T11:00:00Z',
  },
  {
    id: '3',
    modelName: 'demand_forecasting',
    version: '1.3.0',
    approvalStatus: 'pending_approval',
    metrics: { mae: 7.2, baselineComparison: 22 },
    createdAt: '2024-01-14T08:00:00Z',
  },
];

const mockApprovalRequests: ApprovalRequest[] = [
  {
    id: '1',
    modelVersionId: '3',
    modelName: 'demand_forecasting',
    version: '1.3.0',
    requestedBy: 'ml-team@xcircle.sa',
    requestedAt: '2024-01-14T08:00:00Z',
    status: 'pending',
    backtestResults: {
      passed: true,
      comparisonWithBaseline: 22,
      stabilityScore: 0.95,
    },
  },
];

const mockDriftMetrics: DriftMetric[] = [
  { id: '1', featureName: 'sales_last_7d', driftScore: 5.2, severity: 'low', detectedAt: '2024-01-14T12:00:00Z' },
  { id: '2', featureName: 'avg_daily_sales', driftScore: 2.1, severity: 'none', detectedAt: '2024-01-14T12:00:00Z' },
  { id: '3', featureName: 'seasonality_index', driftScore: 18.5, severity: 'medium', detectedAt: '2024-01-14T12:00:00Z' },
];

const mockAlerts: MonitoringAlert[] = [
  {
    id: '1',
    type: 'drift',
    severity: 'warning',
    message: 'Medium drift detected in seasonality_index feature',
    messageAr: 'تم اكتشاف انحراف متوسط في خاصية مؤشر الموسمية',
    acknowledged: false,
    createdAt: '2024-01-14T12:00:00Z',
  },
];

const mockStats: DecisionStats = {
  total: 1250,
  byUseCase: {
    demand_forecast: 520,
    stockout_risk: 480,
    anomaly_detection: 250,
  },
  fallbackRate: 2.4,
};

// ============================================
// Components
// ============================================

function StatusBadge({ status }: { status: ModelVersion['approvalStatus'] }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    draft: { variant: 'outline', icon: <Clock className="h-3 w-3" /> },
    pending_approval: { variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
    approved: { variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
    deployed: { variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
    deprecated: { variant: 'outline', icon: <XCircle className="h-3 w-3" /> },
    rejected: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  };

  const { variant, icon } = variants[status] || variants.draft;

  return (
    <Badge variant={variant} className="gap-1">
      {icon}
      {status.replace('_', ' ')}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: DriftMetric['severity'] }) {
  const colors: Record<string, string> = {
    none: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    low: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    medium: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[severity]}`}>
      {severity}
    </span>
  );
}

function ApprovalDialog({
  request,
  open,
  onOpenChange,
  onApprove,
  onReject,
}: {
  request: ApprovalRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string, comments: string) => void;
  onReject: (id: string, comments: string) => void;
}) {
  const [comments, setComments] = useState('');
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isRTL ? 'طلب موافقة على النموذج' : 'Model Approval Request'}
          </DialogTitle>
          <DialogDescription>
            {request.modelName} v{request.version}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Backtest Results */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {isRTL ? 'نتائج الاختبار الرجعي' : 'Backtest Results'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {isRTL ? 'الحالة' : 'Status'}
                </span>
                <Badge variant={request.backtestResults.passed ? 'default' : 'destructive'}>
                  {request.backtestResults.passed ? (isRTL ? 'ناجح' : 'Passed') : (isRTL ? 'فاشل' : 'Failed')}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {isRTL ? 'التحسن عن الأساس' : 'Improvement vs Baseline'}
                </span>
                <span className="font-medium text-green-600">
                  +{request.backtestResults.comparisonWithBaseline}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {isRTL ? 'درجة الاستقرار' : 'Stability Score'}
                </span>
                <span className="font-medium">
                  {(request.backtestResults.stabilityScore * 100).toFixed(0)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isRTL ? 'ملاحظات (اختياري)' : 'Comments (optional)'}
            </label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={isRTL ? 'أضف ملاحظاتك هنا...' : 'Add your comments here...'}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            onClick={() => {
              onReject(request.id, comments);
              onOpenChange(false);
            }}
          >
            <ThumbsDown className="h-4 w-4 me-2" />
            {isRTL ? 'رفض' : 'Reject'}
          </Button>
          <Button
            onClick={() => {
              onApprove(request.id, comments);
              onOpenChange(false);
            }}
          >
            <ThumbsUp className="h-4 w-4 me-2" />
            {isRTL ? 'موافقة' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Main Component
// ============================================

export default function MLOpsDashboard() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);

  // TODO: Replace with actual API calls
  const models = mockModels;
  const approvalRequests = mockApprovalRequests;
  const driftMetrics = mockDriftMetrics;
  const alerts = mockAlerts;
  const stats = mockStats;

  const deployedModels = models.filter(m => m.approvalStatus === 'deployed').length;
  const pendingApprovals = approvalRequests.filter(r => r.status === 'pending').length;
  const activeAlerts = alerts.filter(a => !a.acknowledged).length;

  const handleApprove = (id: string, comments: string) => {
    toast({
      title: isRTL ? 'تمت الموافقة' : 'Approved',
      description: isRTL ? 'تم الموافقة على النموذج بنجاح' : 'Model approved successfully',
    });
    // TODO: Call API
  };

  const handleReject = (id: string, comments: string) => {
    toast({
      title: isRTL ? 'تم الرفض' : 'Rejected',
      description: isRTL ? 'تم رفض النموذج' : 'Model rejected',
      variant: 'destructive',
    });
    // TODO: Call API
  };

  const handleAcknowledgeAlert = (id: string) => {
    toast({
      title: isRTL ? 'تم التأكيد' : 'Acknowledged',
      description: isRTL ? 'تم تأكيد التنبيه' : 'Alert acknowledged',
    });
    // TODO: Call API
  };

  return (
    <div className="flex flex-col gap-6 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader
        title={isRTL ? 'لوحة تحكم MLOps' : 'MLOps Dashboard'}
        description={isRTL ? 'إدارة النماذج والموافقات والمراقبة' : 'Model governance, approvals, and monitoring'}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={isRTL ? 'النماذج المنشورة' : 'Deployed Models'}
          value={deployedModels}
          icon={<Brain className="h-4 w-4" />}
          trend={{ value: 0, isPositive: true }}
        />
        <StatCard
          title={isRTL ? 'في انتظار الموافقة' : 'Pending Approvals'}
          value={pendingApprovals}
          icon={<Clock className="h-4 w-4" />}
          trend={{ value: pendingApprovals, isPositive: false }}
        />
        <StatCard
          title={isRTL ? 'القرارات (30 يوم)' : 'Decisions (30d)'}
          value={stats.total.toLocaleString()}
          icon={<BarChart3 className="h-4 w-4" />}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title={isRTL ? 'معدل الآلية البديلة' : 'Fallback Rate'}
          value={`${stats.fallbackRate}%`}
          icon={<Activity className="h-4 w-4" />}
          trend={{ value: stats.fallbackRate, isPositive: stats.fallbackRate < 5 }}
        />
      </div>

      {/* Active Alerts */}
      {activeAlerts > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{isRTL ? 'تنبيهات نشطة' : 'Active Alerts'}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {isRTL
                ? `لديك ${activeAlerts} تنبيه يتطلب انتباهك`
                : `You have ${activeAlerts} alert(s) requiring attention`}
            </span>
            <Button variant="outline" size="sm" onClick={() => {}}>
              <Eye className="h-4 w-4 me-2" />
              {isRTL ? 'عرض' : 'View'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs defaultValue="approvals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="approvals" className="gap-2">
            <Shield className="h-4 w-4" />
            {isRTL ? 'الموافقات' : 'Approvals'}
            {pendingApprovals > 0 && (
              <Badge variant="secondary" className="ms-1">{pendingApprovals}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2">
            <Brain className="h-4 w-4" />
            {isRTL ? 'النماذج' : 'Models'}
          </TabsTrigger>
          <TabsTrigger value="drift" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {isRTL ? 'الانحراف' : 'Drift'}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="h-4 w-4" />
            {isRTL ? 'التنبيهات' : 'Alerts'}
            {activeAlerts > 0 && (
              <Badge variant="destructive" className="ms-1">{activeAlerts}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Approvals Tab */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'طلبات الموافقة المعلقة' : 'Pending Approval Requests'}</CardTitle>
              <CardDescription>
                {isRTL
                  ? 'راجع وصادق على النماذج قبل نشرها'
                  : 'Review and approve models before deployment'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {approvalRequests.filter(r => r.status === 'pending').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{isRTL ? 'لا توجد طلبات معلقة' : 'No pending requests'}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'النموذج' : 'Model'}</TableHead>
                      <TableHead>{isRTL ? 'الإصدار' : 'Version'}</TableHead>
                      <TableHead>{isRTL ? 'مقدم الطلب' : 'Requested By'}</TableHead>
                      <TableHead>{isRTL ? 'نتيجة الاختبار' : 'Backtest'}</TableHead>
                      <TableHead>{isRTL ? 'التحسن' : 'Improvement'}</TableHead>
                      <TableHead>{isRTL ? 'الإجراء' : 'Action'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalRequests
                      .filter(r => r.status === 'pending')
                      .map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.modelName}</TableCell>
                          <TableCell>v{request.version}</TableCell>
                          <TableCell>{request.requestedBy}</TableCell>
                          <TableCell>
                            <Badge variant={request.backtestResults.passed ? 'default' : 'destructive'}>
                              {request.backtestResults.passed ? (isRTL ? 'ناجح' : 'Passed') : (isRTL ? 'فاشل' : 'Failed')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-green-600">
                            +{request.backtestResults.comparisonWithBaseline}%
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setApprovalDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 me-2" />
                              {isRTL ? 'مراجعة' : 'Review'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'سجل النماذج' : 'Model Registry'}</CardTitle>
              <CardDescription>
                {isRTL ? 'جميع إصدارات النماذج المسجلة' : 'All registered model versions'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'النموذج' : 'Model'}</TableHead>
                    <TableHead>{isRTL ? 'الإصدار' : 'Version'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isRTL ? 'المقاييس' : 'Metrics'}</TableHead>
                    <TableHead>{isRTL ? 'تاريخ الإنشاء' : 'Created'}</TableHead>
                    <TableHead>{isRTL ? 'الموافق' : 'Approved By'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">{model.modelName}</TableCell>
                      <TableCell>v{model.version}</TableCell>
                      <TableCell>
                        <StatusBadge status={model.approvalStatus} />
                      </TableCell>
                      <TableCell>
                        {model.metrics.mae && <span>MAE: {model.metrics.mae}</span>}
                        {model.metrics.accuracy && <span>Acc: {(model.metrics.accuracy * 100).toFixed(0)}%</span>}
                        {model.metrics.baselineComparison && (
                          <span className="text-green-600 ms-2">+{model.metrics.baselineComparison}%</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(model.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                      </TableCell>
                      <TableCell>{model.approvedBy || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Drift Tab */}
        <TabsContent value="drift">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{isRTL ? 'مراقبة الانحراف' : 'Drift Monitoring'}</CardTitle>
                <CardDescription>
                  {isRTL ? 'تتبع انحراف البيانات والنماذج' : 'Track data and model drift'}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 me-2" />
                {isRTL ? 'تحديث' : 'Refresh'}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الخاصية' : 'Feature'}</TableHead>
                    <TableHead>{isRTL ? 'نسبة الانحراف' : 'Drift Score'}</TableHead>
                    <TableHead>{isRTL ? 'الشدة' : 'Severity'}</TableHead>
                    <TableHead>{isRTL ? 'آخر فحص' : 'Last Check'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driftMetrics.map((metric) => (
                    <TableRow key={metric.id}>
                      <TableCell className="font-medium">{metric.featureName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(metric.driftScore, 100)} className="w-20" />
                          <span>{metric.driftScore.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={metric.severity} />
                      </TableCell>
                      <TableCell>
                        {new Date(metric.detectedAt).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'التنبيهات' : 'Alerts'}</CardTitle>
              <CardDescription>
                {isRTL ? 'تنبيهات المراقبة والأداء' : 'Monitoring and performance alerts'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{isRTL ? 'لا توجد تنبيهات' : 'No alerts'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <Alert
                      key={alert.id}
                      variant={alert.severity === 'error' || alert.severity === 'critical' ? 'destructive' : 'default'}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="flex items-center justify-between">
                        <span>{alert.type}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.createdAt).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                        </span>
                      </AlertTitle>
                      <AlertDescription className="flex items-center justify-between">
                        <span>{isRTL && alert.messageAr ? alert.messageAr : alert.message}</span>
                        {!alert.acknowledged && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 me-2" />
                            {isRTL ? 'تأكيد' : 'Acknowledge'}
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <ApprovalDialog
        request={selectedRequest}
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
