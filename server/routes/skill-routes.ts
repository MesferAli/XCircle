import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { productivitySkills as productivitySkillsTable, userSkillProgress as userSkillProgressTable } from "@shared/schema";
import { getSecureTenantId, getAuthenticatedUserId } from "../routes";

const router = Router();

// Default productivity skills templates
const defaultProductivitySkills = [
  {
    name: "Task Automation with Scripts",
    nameAr: "أتمتة المهام بالبرمجة",
    description: "Learn to automate repetitive tasks using scripts and cron jobs to save hours every week.",
    descriptionAr: "تعلم أتمتة المهام المتكررة باستخدام السكربتات والمهام المجدولة لتوفير ساعات أسبوعياً.",
    category: "automation",
    level: "intermediate",
    icon: "Zap",
    estimatedHours: 4,
    steps: [
      { title: "Identify Repetitive Tasks", titleAr: "تحديد المهام المتكررة", description: "Audit your daily workflow to find tasks that can be automated.", descriptionAr: "راجع سير عملك اليومي لإيجاد المهام القابلة للأتمتة.", order: 1 },
      { title: "Write Your First Script", titleAr: "كتابة أول سكربت", description: "Create a simple automation script for a common task.", descriptionAr: "أنشئ سكربت أتمتة بسيط لمهمة شائعة.", order: 2 },
      { title: "Schedule Automation", titleAr: "جدولة الأتمتة", description: "Set up scheduled execution for your automation scripts.", descriptionAr: "إعداد التنفيذ المجدول لسكربتات الأتمتة.", order: 3 },
    ],
    resources: [],
    sortOrder: 1,
  },
  // Additional skills omitted for brevity - they're in the main routes.ts
];

// Get all productivity skills for tenant
router.get("/", async (req: Request, res: Response) => {
  try {
    const tenantId = getSecureTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Tenant not found" });

    const skills = await db.select().from(productivitySkillsTable).where(eq(productivitySkillsTable.tenantId, tenantId));
    res.json(skills);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch productivity skills", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Get seed/default productivity skills (no tenant required, returns templates)
router.get("/templates", async (_req: Request, res: Response) => {
  try {
    res.json(defaultProductivitySkills);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch skill templates" });
  }
});

// Seed default skills for tenant
router.post("/seed", async (req: Request, res: Response) => {
  try {
    const tenantId = getSecureTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Tenant not found" });

    // Check if already seeded
    const existing = await db.select().from(productivitySkillsTable).where(eq(productivitySkillsTable.tenantId, tenantId));
    if (existing.length > 0) {
      return res.json({ message: "Skills already seeded", count: existing.length });
    }

    const seeded = [];
    for (const skill of defaultProductivitySkills) {
      const [inserted] = await db.insert(productivitySkillsTable).values({ ...skill, tenantId }).returning();
      seeded.push(inserted);
    }
    res.json({ message: "Skills seeded successfully", count: seeded.length, skills: seeded });
  } catch (error) {
    res.status(500).json({ error: "Failed to seed skills", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Get user's skill progress
router.get("/progress", async (req: Request, res: Response) => {
  try {
    const tenantId = getSecureTenantId(req);
    const userId = getAuthenticatedUserId(req);
    if (!tenantId || !userId) return res.status(401).json({ error: "Authentication required" });

    const progress = await db.select().from(userSkillProgressTable).where(eq(userSkillProgressTable.userId, userId));
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch skill progress", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Update user's skill progress
router.post("/:skillId/progress", async (req: Request, res: Response) => {
  try {
    const tenantId = getSecureTenantId(req);
    const userId = getAuthenticatedUserId(req);
    if (!tenantId || !userId) return res.status(401).json({ error: "Authentication required" });

    const { skillId } = req.params;
    const { status, completedSteps, progressPercent, notes } = req.body;

    // Check if progress record exists
    const existing = await db.select().from(userSkillProgressTable)
      .where(eq(userSkillProgressTable.userId, userId));
    const existingProgress = existing.find(p => p.skillId === skillId);

    if (existingProgress) {
      const [updated] = await db.update(userSkillProgressTable)
        .set({
          status: status || existingProgress.status,
          completedSteps: completedSteps || existingProgress.completedSteps,
          progressPercent: progressPercent ?? existingProgress.progressPercent,
          notes: notes ?? existingProgress.notes,
          startedAt: existingProgress.startedAt || (status === "in_progress" ? new Date() : null),
          completedAt: status === "completed" ? new Date() : null,
        })
        .where(eq(userSkillProgressTable.id, existingProgress.id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(userSkillProgressTable)
        .values({
          tenantId,
          userId,
          skillId,
          status: status || "not_started",
          completedSteps: completedSteps || [],
          progressPercent: progressPercent || 0,
          notes,
          startedAt: status === "in_progress" ? new Date() : null,
          completedAt: status === "completed" ? new Date() : null,
        })
        .returning();
      res.json(created);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to update skill progress", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

export default router;
