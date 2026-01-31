import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
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
  Zap,
  Brain,
  Clock,
  BarChart3,
  MessageSquare,
  Target,
  Sparkles,
  Database,
  GitBranch,
  Users,
  CheckCircle2,
  Play,
  BookOpen,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslations } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, any> = {
  Zap, Brain, Clock, BarChart3, MessageSquare, Target, Sparkles, Database, GitBranch, Users,
};

const levelColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  intermediate: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  advanced: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  expert: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const categoryColors: Record<string, string> = {
  time_management: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  automation: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  data_analysis: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  communication: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  project_management: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  ai_tools: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
};

export default function ProductivitySkills() {
  const t = useTranslations();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [detailSkill, setDetailSkill] = useState<any>(null);

  const { data: skills = [], isLoading: skillsLoading } = useQuery({
    queryKey: ["/api/productivity-skills"],
  });

  const { data: progress = [] } = useQuery({
    queryKey: ["/api/productivity-skills/progress"],
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/productivity-skills/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productivity-skills"] });
    },
  });

  const progressMutation = useMutation({
    mutationFn: ({ skillId, data }: { skillId: string; data: any }) =>
      apiRequest("POST", `/api/productivity-skills/${skillId}/progress`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productivity-skills/progress"] });
      toast({ title: t.productivitySkills.skillCompleted });
    },
  });

  const getProgressForSkill = (skillId: string) => {
    return (progress as any[]).find((p: any) => p.skillId === skillId);
  };

  const filteredSkills = (skills as any[]).filter((skill: any) => {
    if (selectedCategory !== "all" && skill.category !== selectedCategory) return false;
    if (selectedLevel !== "all" && skill.level !== selectedLevel) return false;
    return true;
  });

  const completedCount = (progress as any[]).filter((p: any) => p.status === "completed").length;
  const inProgressCount = (progress as any[]).filter((p: any) => p.status === "in_progress").length;

  const handleStartSkill = (skillId: string) => {
    progressMutation.mutate({ skillId, data: { status: "in_progress", progressPercent: 0 } });
  };

  const handleCompleteStep = (skillId: string, stepIndex: number, totalSteps: number) => {
    const existing = getProgressForSkill(skillId);
    const completedSteps = [...((existing?.completedSteps as number[]) || []), stepIndex];
    const uniqueSteps = [...new Set(completedSteps)];
    const percent = Math.round((uniqueSteps.length / totalSteps) * 100);
    progressMutation.mutate({
      skillId,
      data: {
        status: percent >= 100 ? "completed" : "in_progress",
        completedSteps: uniqueSteps,
        progressPercent: percent,
      },
    });
  };

  const ps = t.productivitySkills;

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader
        title={ps.title}
        description={ps.description}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-sm text-muted-foreground">{ps.completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{inProgressCount}</p>
                <p className="text-sm text-muted-foreground">{ps.inProgressCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{(skills as any[]).length}</p>
                <p className="text-sm text-muted-foreground">{ps.totalSkills}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">{ps.allSkills}</TabsTrigger>
          <TabsTrigger value="progress">{ps.myProgress}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={ps.filterByCategory} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ps.allCategories}</SelectItem>
                {Object.entries(ps.categories).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={ps.filterByLevel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ps.allLevels}</SelectItem>
                {Object.entries(ps.levels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(skills as any[]).length === 0 && !skillsLoading ? (
            <Card className="p-8">
              <EmptyState
                icon={<Sparkles className="h-12 w-12" />}
                title={ps.noSkills}
                description={ps.description}
                action={
                  <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                    {seedMutation.isPending ? "..." : ps.startSkill}
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSkills.map((skill: any) => {
                const IconComponent = iconMap[skill.icon] || Sparkles;
                const skillProgress = getProgressForSkill(skill.id);
                const steps = (skill.steps as any[]) || [];

                return (
                  <Card key={skill.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailSkill(skill)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{skill.nameAr || skill.name}</CardTitle>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className={categoryColors[skill.category] || ""}>
                          {(ps.categories as any)[skill.category] || skill.category}
                        </Badge>
                        <Badge variant="outline" className={levelColors[skill.level] || ""}>
                          {(ps.levels as any)[skill.level] || skill.level}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-3 line-clamp-2">
                        {skill.descriptionAr || skill.description}
                      </CardDescription>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                        <span>{ps.estimatedHours}: {skill.estimatedHours}h</span>
                        <span>{ps.steps}: {steps.length}</span>
                      </div>
                      {skillProgress ? (
                        <div className="space-y-2">
                          <Progress value={skillProgress.progressPercent || 0} className="h-2" />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {skillProgress.progressPercent || 0}%
                            </span>
                            <Badge variant={skillProgress.status === "completed" ? "default" : "secondary"}>
                              {(ps.status as any)[skillProgress.status]}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full mt-2"
                          onClick={(e) => { e.stopPropagation(); handleStartSkill(skill.id); }}
                        >
                          <Play className="h-4 w-4 me-2" />
                          {ps.startSkill}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          {(progress as any[]).length === 0 ? (
            <Card className="p-8">
              <EmptyState
                icon={<TrendingUp className="h-12 w-12" />}
                title={ps.noProgress}
                description={ps.description}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(progress as any[]).map((p: any) => {
                const skill = (skills as any[]).find((s: any) => s.id === p.skillId);
                if (!skill) return null;
                const IconComponent = iconMap[skill.icon] || Sparkles;
                const steps = (skill.steps as any[]) || [];

                return (
                  <Card key={p.id} className="cursor-pointer" onClick={() => setDetailSkill(skill)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <IconComponent className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{skill.nameAr || skill.name}</CardTitle>
                        {p.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500 ms-auto" />}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Progress value={p.progressPercent || 0} className="h-2 mb-2" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{p.progressPercent || 0}%</span>
                        <span>{((p.completedSteps as any[]) || []).length}/{steps.length} {ps.steps}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Skill Detail Dialog */}
      <Dialog open={!!detailSkill} onOpenChange={() => setDetailSkill(null)}>
        {detailSkill && (
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detailSkill.nameAr || detailSkill.name}</DialogTitle>
              <DialogDescription>{detailSkill.descriptionAr || detailSkill.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge variant="outline" className={categoryColors[detailSkill.category] || ""}>
                  {(ps.categories as any)[detailSkill.category]}
                </Badge>
                <Badge variant="outline" className={levelColors[detailSkill.level] || ""}>
                  {(ps.levels as any)[detailSkill.level]}
                </Badge>
                <Badge variant="outline">{detailSkill.estimatedHours}h</Badge>
              </div>

              <div>
                <h4 className="font-semibold mb-3">{ps.steps}</h4>
                <div className="space-y-3">
                  {((detailSkill.steps as any[]) || []).map((step: any, idx: number) => {
                    const skillProgress = getProgressForSkill(detailSkill.id);
                    const isCompleted = ((skillProgress?.completedSteps as number[]) || []).includes(idx);

                    return (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                        <button
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                            isCompleted ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/30"
                          }`}
                          onClick={() => {
                            if (!isCompleted) {
                              handleCompleteStep(detailSkill.id, idx, (detailSkill.steps as any[]).length);
                            }
                          }}
                        >
                          {isCompleted && <CheckCircle2 className="h-4 w-4" />}
                          {!isCompleted && <span className="text-xs">{idx + 1}</span>}
                        </button>
                        <div>
                          <p className={`font-medium text-sm ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                            {step.titleAr || step.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {step.descriptionAr || step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!getProgressForSkill(detailSkill.id) && (
                <Button className="w-full" onClick={() => handleStartSkill(detailSkill.id)}>
                  <Play className="h-4 w-4 me-2" />
                  {ps.startSkill}
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
