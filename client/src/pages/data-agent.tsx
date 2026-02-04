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
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslations } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

export default function DataAgent() {
  const t = useTranslations();
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<any>(null);

  const da = t.dataAgent;

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["/api/data-agent/history"],
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ["/api/data-agent/suggestions"],
  });

  const { data: knowledge = [] } = useQuery({
    queryKey: ["/api/data-agent/knowledge"],
  });

  const seedKnowledgeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/data-agent/knowledge/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-agent/knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-agent/suggestions"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/data-agent/knowledge"] });
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

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader
        title={da.title}
        description={da.description}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chat Area */}
        <div className="lg:col-span-2 space-y-4">
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
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3" />
                      {currentResult.executionTimeMs}ms
                    </CardDescription>
                  </div>
                  <Badge variant={currentResult.status === "success" ? "default" : "destructive"}>
                    {currentResult.status}
                  </Badge>
                </div>
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
                  <p className="text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {currentResult.insight}
                  </p>
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
              <TabsTrigger value="knowledge" className="flex-1">
                <BookOpen className="h-4 w-4 me-1" />
                {da.knowledge}
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
                            <div className="flex items-center gap-2 mt-1">
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

            <TabsContent value="knowledge">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{da.learnedPatterns}</CardTitle>
                </CardHeader>
                <CardContent>
                  {(knowledge as any[]).length === 0 ? (
                    <div className="text-center py-6">
                      <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">{da.noHistory}</p>
                      <Button
                        size="sm"
                        onClick={() => seedKnowledgeMutation.mutate()}
                        disabled={seedKnowledgeMutation.isPending}
                      >
                        <Sparkles className="h-4 w-4 me-2" />
                        Initialize Knowledge
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {(knowledge as any[]).map((k: any) => (
                          <div key={k.id} className="p-3 rounded-lg border">
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="secondary" className="text-xs">{k.type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {da.successRate}: {k.successRate}%
                              </span>
                            </div>
                            <p className="text-sm font-medium">{k.pattern}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {k.descriptionAr || k.description}
                            </p>
                          </div>
                        ))}
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
