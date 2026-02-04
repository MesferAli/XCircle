import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  Send,
  History,
  Lightbulb,
  Database,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Code,
  Sparkles,
  Clock,
  BookOpen,
  Layers,
  Table2,
  FileText,
  GitBranch,
  Brain,
  Zap,
  Settings2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslations } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

const layerIcons: Record<string, any> = {
  table_metadata: Table2,
  annotations: FileText,
  query_patterns: GitBranch,
  institutional: BookOpen,
  learnings: Brain,
  runtime: Zap,
  basic_knowledge: Database,
  fallback: Settings2,
};

const layerColors: Record<string, string> = {
  table_metadata: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  annotations: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  query_patterns: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  institutional: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  learnings: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  runtime: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  basic_knowledge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  fallback: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
};

export default function DataAgent() {
  const t = useTranslations();
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [showContextDetails, setShowContextDetails] = useState(false);

  const da = t.dataAgent;

  const { data: history = [] } = useQuery({
    queryKey: ["/api/data-agent/history"],
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ["/api/data-agent/suggestions"],
  });

  const { data: contextLayers } = useQuery({
    queryKey: ["/api/data-agent/context"],
  });

  const seedContextMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/data-agent/context/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-agent/context"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-agent/suggestions"] });
      toast({ title: "تم تهيئة طبقات السياق بنجاح" });
    },
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => apiRequest("POST", "/api/data-agent/ask", { question: q }),
    onSuccess: (data) => {
      setCurrentResult(data);
      setQuestion("");
      queryClient.invalidateQueries({ queryKey: ["/api/data-agent/history"] });
    },
    onError: () => {
      toast({ title: da.error, variant: "destructive" });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ queryId, rating }: { queryId: string; rating: number }) =>
      apiRequest("POST", `/api/data-agent/${queryId}/feedback`, { rating }),
    onSuccess: () => {
      toast({ title: da.feedbackThanks });
      queryClient.invalidateQueries({ queryKey: ["/api/data-agent/context"] });
    },
  });

  const handleAsk = () => {
    if (!question.trim()) return;
    askMutation.mutate(question.trim());
  };

  const handleSuggestionClick = (q: string) => {
    setQuestion(q);
    askMutation.mutate(q);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const ctx = contextLayers as any;
  const totalContext = ctx?.totalContextItems || 0;

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader
        title={da.title}
        description={da.description}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chat Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Context Layers Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  6 طبقات السياق (Dash)
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{totalContext} عنصر</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowContextDetails(!showContextDetails)}
                  >
                    {showContextDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {showContextDetails && ctx?.layers && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { key: "tableMetadata", label: "Table Metadata", labelAr: "بيانات الجداول", icon: Table2 },
                    { key: "annotations", label: "Annotations", labelAr: "التعليقات التوضيحية", icon: FileText },
                    { key: "queryPatterns", label: "Query Patterns", labelAr: "أنماط الاستعلام", icon: GitBranch },
                    { key: "institutionalKnowledge", label: "Institutional", labelAr: "المعرفة المؤسسية", icon: BookOpen },
                    { key: "learnings", label: "Learnings", labelAr: "التعلمات", icon: Brain },
                    { key: "runtimeContext", label: "Runtime", labelAr: "سياق التشغيل", icon: Zap },
                  ].map((layer) => {
                    const LayerIcon = layer.icon;
                    const count = ctx.layers[layer.key]?.count || 0;
                    return (
                      <div key={layer.key} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                        <LayerIcon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{layer.labelAr}</p>
                          <p className="text-xs text-muted-foreground">{count} عنصر</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalContext === 0 && (
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => seedContextMutation.mutate()}
                    disabled={seedContextMutation.isPending}
                  >
                    <Sparkles className="h-4 w-4 me-2" />
                    {seedContextMutation.isPending ? "جاري التهيئة..." : "تهيئة طبقات السياق"}
                  </Button>
                )}
              </CardContent>
            )}
          </Card>

          {/* Input */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Input
                  placeholder={da.placeholder}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                  className="flex-1"
                  disabled={askMutation.isPending}
                />
                <Button onClick={handleAsk} disabled={askMutation.isPending || !question.trim()}>
                  {askMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ms-2 hidden sm:inline">{da.askButton}</span>
                </Button>
              </div>

              {/* Suggestions */}
              {(suggestions as any[]).length > 0 && !currentResult && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">{da.suggestedQuestions}</p>
                  <div className="flex flex-wrap gap-2">
                    {(suggestions as any[]).slice(0, 4).map((s: any, idx: number) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => handleSuggestionClick(s.question)}
                      >
                        {s.question}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loading State */}
          {askMutation.isPending && (
            <Card>
              <CardContent className="py-8 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">{da.thinking}</p>
              </CardContent>
            </Card>
          )}

          {/* Current Result */}
          {currentResult && !askMutation.isPending && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      {currentResult.question}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {currentResult.executionTimeMs}ms
                      </span>
                      {currentResult.confidence !== undefined && (
                        <span className="flex items-center gap-1">
                          <span className="text-xs">الثقة:</span>
                          <Progress value={currentResult.confidence} className="w-16 h-2" />
                          <span className="text-xs">{currentResult.confidence}%</span>
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant={currentResult.status === "success" ? "default" : "destructive"}>
                    {currentResult.status}
                  </Badge>
                </div>

                {/* Used Layers */}
                {currentResult.usedLayers && currentResult.usedLayers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {currentResult.usedLayers.map((layer: string, idx: number) => {
                      const LayerIcon = layerIcons[layer] || Layers;
                      return (
                        <Badge key={idx} variant="outline" className={`text-xs ${layerColors[layer] || ""}`}>
                          <LayerIcon className="h-3 w-3 me-1" />
                          {layer.replace(/_/g, " ")}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Generated SQL */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      {da.generatedSql}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(currentResult.generatedSql, currentResult.id)}
                    >
                      {copiedId === currentResult.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span className="ms-1">{copiedId === currentResult.id ? da.copiedSQL : da.copySQL}</span>
                    </Button>
                  </div>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto font-mono">
                    {currentResult.generatedSql}
                  </pre>
                </div>

                {/* Insight */}
                <div>
                  <span className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    {da.insight}
                  </span>
                  <div className="text-muted-foreground bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">
                    {currentResult.insight}
                  </div>
                </div>

                {/* Feedback */}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{da.feedback}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => feedbackMutation.mutate({ queryId: currentResult.id, rating: 5 })}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => feedbackMutation.mutate({ queryId: currentResult.id, rating: 2 })}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Tabs defaultValue="history">
            <TabsList className="w-full">
              <TabsTrigger value="history" className="flex-1">
                <History className="h-4 w-4 me-1" />
                {da.history}
              </TabsTrigger>
              <TabsTrigger value="context" className="flex-1">
                <Layers className="h-4 w-4 me-1" />
                السياق
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{da.recentQuestions}</CardTitle>
                </CardHeader>
                <CardContent>
                  {(history as any[]).length === 0 ? (
                    <EmptyState
                      icon={<History className="h-8 w-8" />}
                      title={da.noHistory}
                      description={da.noHistoryDesc}
                    />
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {(history as any[]).map((h: any) => (
                          <div
                            key={h.id}
                            className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => setCurrentResult(h)}
                          >
                            <p className="text-sm font-medium line-clamp-2">{h.question}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {h.status}
                              </Badge>
                              {h.feedbackRating && (
                                <span className="text-xs text-muted-foreground">
                                  {h.feedbackRating}/5
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="context">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">طبقات السياق النشطة</CardTitle>
                </CardHeader>
                <CardContent>
                  {!ctx?.layers ? (
                    <div className="text-center py-6">
                      <Layers className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">لم يتم تهيئة السياق</p>
                      <Button
                        size="sm"
                        onClick={() => seedContextMutation.mutate()}
                        disabled={seedContextMutation.isPending}
                      >
                        <Sparkles className="h-4 w-4 me-2" />
                        تهيئة
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {/* Tables */}
                        {ctx.layers.tableMetadata?.items?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                              <Table2 className="h-3 w-3" /> الجداول
                            </p>
                            {ctx.layers.tableMetadata.items.map((t: any) => (
                              <div key={t.id} className="p-2 rounded border mb-1 text-xs">
                                <span className="font-mono">{t.tableName}</span>
                                <span className="text-muted-foreground ms-2">{t.tableNameAr}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Patterns */}
                        {ctx.layers.queryPatterns?.items?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                              <GitBranch className="h-3 w-3" /> أنماط الاستعلام
                            </p>
                            {ctx.layers.queryPatterns.items.map((p: any) => (
                              <div key={p.id} className="p-2 rounded border mb-1 text-xs">
                                <span className="font-medium">{p.nameAr || p.name}</span>
                                <Badge variant="outline" className="ms-2 text-[10px]">{p.category}</Badge>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Learnings */}
                        {ctx.layers.learnings?.items?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                              <Brain className="h-3 w-3" /> التعلمات
                            </p>
                            {ctx.layers.learnings.items.map((l: any) => (
                              <div key={l.id} className="p-2 rounded border mb-1 text-xs">
                                <Badge variant="outline" className="text-[10px]">{l.learningType}</Badge>
                                <p className="text-muted-foreground mt-1">{l.explanationAr || l.explanation}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
