import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { eq } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { aiEngine } from "./ai-engine";
import { zaiService } from "./zai-service";
import { connectorEngine } from "./connector-engine";
import { mappingEngine } from "./mapping-engine";
import { policyEngine } from "./policy-engine";
import { mappingConfigPayloadSchema, policyContextSchema, tenants, useCaseFeatures, meetingRequests, insertMeetingRequestSchema, productivitySkills as productivitySkillsTable, userSkillProgress as userSkillProgressTable } from "@shared/schema";
import type { PolicyContext, User, PolicyResult, Recommendation } from "@shared/schema";
import { requireCapability, getCapabilitiesForRole, checkCapabilities } from "./capability-guard";
import { blockAllExecution, EXECUTION_MODE } from "./execution-lock";
import { setupAuth, isAuthenticated } from "./auth/customAuth";
export type { Capability } from "./capability-guard";
export { requireCapability, getCapabilitiesForRole, checkCapabilities };
export { EXECUTION_MODE } from "./execution-lock";

// Default productivity skills templates inspired by claude-code-templates
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
  {
    name: "AI-Powered Code Review",
    nameAr: "مراجعة الكود بالذكاء الاصطناعي",
    description: "Use AI tools to perform thorough code reviews, catch bugs, and improve code quality.",
    descriptionAr: "استخدم أدوات الذكاء الاصطناعي لمراجعة الكود بشكل شامل واكتشاف الأخطاء وتحسين الجودة.",
    category: "ai_tools",
    level: "advanced",
    icon: "Brain",
    estimatedHours: 3,
    steps: [
      { title: "Set Up AI Review Tools", titleAr: "إعداد أدوات المراجعة بالذكاء الاصطناعي", description: "Configure AI-powered code review tools in your development environment.", descriptionAr: "تهيئة أدوات مراجعة الكود بالذكاء الاصطناعي في بيئة التطوير.", order: 1 },
      { title: "Review Patterns & Anti-patterns", titleAr: "مراجعة الأنماط والأنماط المضادة", description: "Learn to identify common patterns AI tools flag during review.", descriptionAr: "تعلم تحديد الأنماط الشائعة التي تكشفها أدوات الذكاء الاصطناعي.", order: 2 },
      { title: "Integrate into CI/CD", titleAr: "الدمج في خط الإنتاج", description: "Add AI code review to your continuous integration pipeline.", descriptionAr: "أضف مراجعة الكود بالذكاء الاصطناعي إلى خط التكامل المستمر.", order: 3 },
    ],
    resources: [],
    sortOrder: 2,
  },
  {
    name: "Effective Time Blocking",
    nameAr: "تقنية تقسيم الوقت",
    description: "Master the time blocking technique to maximize focused work and minimize context switching.",
    descriptionAr: "أتقن تقنية تقسيم الوقت لتعظيم العمل المركز وتقليل التشتت.",
    category: "time_management",
    level: "beginner",
    icon: "Clock",
    estimatedHours: 2,
    steps: [
      { title: "Audit Your Current Schedule", titleAr: "تدقيق جدولك الحالي", description: "Track how you spend time for one week to identify patterns.", descriptionAr: "تتبع كيف تقضي وقتك لمدة أسبوع لتحديد الأنماط.", order: 1 },
      { title: "Create Time Blocks", titleAr: "إنشاء كتل زمنية", description: "Design your ideal day using time blocks for different task types.", descriptionAr: "صمم يومك المثالي باستخدام كتل زمنية لأنواع المهام المختلفة.", order: 2 },
      { title: "Protect Your Blocks", titleAr: "حماية كتلك الزمنية", description: "Learn strategies to defend your time blocks from interruptions.", descriptionAr: "تعلم استراتيجيات لحماية كتلك الزمنية من المقاطعات.", order: 3 },
    ],
    resources: [],
    sortOrder: 3,
  },
  {
    name: "Data-Driven Decision Making",
    nameAr: "اتخاذ القرارات المبنية على البيانات",
    description: "Learn to analyze data effectively and make informed decisions using dashboards and metrics.",
    descriptionAr: "تعلم تحليل البيانات بفعالية واتخاذ قرارات مستنيرة باستخدام لوحات المعلومات والمقاييس.",
    category: "data_analysis",
    level: "intermediate",
    icon: "BarChart3",
    estimatedHours: 5,
    steps: [
      { title: "Define Key Metrics", titleAr: "تحديد المقاييس الرئيسية", description: "Identify the KPIs that matter most for your role and team.", descriptionAr: "حدد مؤشرات الأداء الرئيسية الأكثر أهمية لدورك وفريقك.", order: 1 },
      { title: "Build a Dashboard", titleAr: "بناء لوحة معلومات", description: "Create a dashboard that visualizes your key metrics in real-time.", descriptionAr: "أنشئ لوحة معلومات تعرض مقاييسك الرئيسية في الوقت الفعلي.", order: 2 },
      { title: "Analyze Trends", titleAr: "تحليل الاتجاهات", description: "Learn to spot trends and anomalies in your data.", descriptionAr: "تعلم اكتشاف الاتجاهات والحالات الشاذة في بياناتك.", order: 3 },
      { title: "Present Findings", titleAr: "عرض النتائج", description: "Communicate data insights effectively to stakeholders.", descriptionAr: "تواصل رؤى البيانات بفعالية لأصحاب المصلحة.", order: 4 },
    ],
    resources: [],
    sortOrder: 4,
  },
  {
    name: "Async Communication Mastery",
    nameAr: "إتقان التواصل غير المتزامن",
    description: "Write clear async messages, reduce unnecessary meetings, and improve team collaboration.",
    descriptionAr: "اكتب رسائل واضحة غير متزامنة، قلل الاجتماعات غير الضرورية، وحسّن التعاون مع الفريق.",
    category: "communication",
    level: "beginner",
    icon: "MessageSquare",
    estimatedHours: 2,
    steps: [
      { title: "Write Clear Updates", titleAr: "كتابة تحديثات واضحة", description: "Structure your written updates for maximum clarity and action.", descriptionAr: "هيكل تحديثاتك المكتوبة لأقصى وضوح وفعالية.", order: 1 },
      { title: "Reduce Meeting Load", titleAr: "تقليل عبء الاجتماعات", description: "Identify meetings that can be replaced with async communication.", descriptionAr: "حدد الاجتماعات التي يمكن استبدالها بالتواصل غير المتزامن.", order: 2 },
      { title: "Document Decisions", titleAr: "توثيق القرارات", description: "Create a system for documenting and sharing decisions asynchronously.", descriptionAr: "أنشئ نظاماً لتوثيق ومشاركة القرارات بشكل غير متزامن.", order: 3 },
    ],
    resources: [],
    sortOrder: 5,
  },
  {
    name: "Agile Project Management",
    nameAr: "إدارة المشاريع الرشيقة",
    description: "Apply agile methodologies to manage projects efficiently with sprints, standups, and retrospectives.",
    descriptionAr: "طبق منهجيات أجايل لإدارة المشاريع بكفاءة مع السبرنتات والاجتماعات اليومية والمراجعات.",
    category: "project_management",
    level: "intermediate",
    icon: "Target",
    estimatedHours: 6,
    steps: [
      { title: "Understand Agile Principles", titleAr: "فهم مبادئ أجايل", description: "Learn the core principles behind agile project management.", descriptionAr: "تعلم المبادئ الأساسية وراء إدارة المشاريع الرشيقة.", order: 1 },
      { title: "Set Up Sprint Workflow", titleAr: "إعداد سير عمل السبرنت", description: "Create a sprint-based workflow for your team.", descriptionAr: "أنشئ سير عمل قائم على السبرنتات لفريقك.", order: 2 },
      { title: "Run Effective Standups", titleAr: "إدارة اجتماعات يومية فعالة", description: "Conduct focused daily standups that keep the team aligned.", descriptionAr: "أدر اجتماعات يومية مركزة تبقي الفريق متوافقاً.", order: 3 },
      { title: "Conduct Retrospectives", titleAr: "إجراء المراجعات", description: "Use retrospectives to continuously improve team processes.", descriptionAr: "استخدم المراجعات لتحسين عمليات الفريق باستمرار.", order: 4 },
    ],
    resources: [],
    sortOrder: 6,
  },
  {
    name: "Prompt Engineering for Productivity",
    nameAr: "هندسة الأوامر للإنتاجية",
    description: "Master prompt engineering to get better results from AI assistants and automate complex workflows.",
    descriptionAr: "أتقن هندسة الأوامر للحصول على نتائج أفضل من مساعدي الذكاء الاصطناعي وأتمتة سير العمل المعقدة.",
    category: "ai_tools",
    level: "beginner",
    icon: "Sparkles",
    estimatedHours: 3,
    steps: [
      { title: "Understand Prompt Basics", titleAr: "فهم أساسيات الأوامر", description: "Learn the fundamentals of writing effective prompts.", descriptionAr: "تعلم أساسيات كتابة أوامر فعالة.", order: 1 },
      { title: "Apply Prompt Patterns", titleAr: "تطبيق أنماط الأوامر", description: "Use proven prompt patterns like chain-of-thought and few-shot examples.", descriptionAr: "استخدم أنماط الأوامر المثبتة مثل سلسلة التفكير والأمثلة القليلة.", order: 2 },
      { title: "Build Reusable Templates", titleAr: "بناء قوالب قابلة لإعادة الاستخدام", description: "Create a library of reusable prompt templates for common tasks.", descriptionAr: "أنشئ مكتبة من قوالب الأوامر القابلة لإعادة الاستخدام للمهام الشائعة.", order: 3 },
    ],
    resources: [],
    sortOrder: 7,
  },
  {
    name: "Database Query Optimization",
    nameAr: "تحسين استعلامات قواعد البيانات",
    description: "Optimize database queries to improve application performance and reduce response times.",
    descriptionAr: "حسّن استعلامات قواعد البيانات لتحسين أداء التطبيق وتقليل أوقات الاستجابة.",
    category: "data_analysis",
    level: "advanced",
    icon: "Database",
    estimatedHours: 4,
    steps: [
      { title: "Analyze Slow Queries", titleAr: "تحليل الاستعلامات البطيئة", description: "Identify and profile slow-running database queries.", descriptionAr: "حدد وحلل الاستعلامات البطيئة في قاعدة البيانات.", order: 1 },
      { title: "Apply Indexing Strategies", titleAr: "تطبيق استراتيجيات الفهرسة", description: "Learn when and how to add indexes for optimal query performance.", descriptionAr: "تعلم متى وكيف تضيف الفهارس لأداء استعلام أمثل.", order: 2 },
      { title: "Optimize Query Patterns", titleAr: "تحسين أنماط الاستعلام", description: "Rewrite queries using best practices for better performance.", descriptionAr: "أعد كتابة الاستعلامات باستخدام أفضل الممارسات لأداء أفضل.", order: 3 },
    ],
    resources: [],
    sortOrder: 8,
  },
  {
    name: "CI/CD Pipeline Mastery",
    nameAr: "إتقان خطوط التكامل والنشر المستمر",
    description: "Build and optimize CI/CD pipelines to automate testing, building, and deployment processes.",
    descriptionAr: "ابنِ وحسّن خطوط CI/CD لأتمتة عمليات الاختبار والبناء والنشر.",
    category: "automation",
    level: "advanced",
    icon: "GitBranch",
    estimatedHours: 5,
    steps: [
      { title: "Design Pipeline Architecture", titleAr: "تصميم بنية خط الإنتاج", description: "Plan the stages and steps of your CI/CD pipeline.", descriptionAr: "خطط لمراحل وخطوات خط التكامل والنشر المستمر.", order: 1 },
      { title: "Implement Automated Tests", titleAr: "تنفيذ الاختبارات الآلية", description: "Add automated testing stages to your pipeline.", descriptionAr: "أضف مراحل الاختبار الآلي إلى خط الإنتاج.", order: 2 },
      { title: "Configure Deployments", titleAr: "تهيئة عمليات النشر", description: "Set up automated deployment with rollback capabilities.", descriptionAr: "أعد عمليات النشر الآلي مع إمكانيات التراجع.", order: 3 },
    ],
    resources: [],
    sortOrder: 9,
  },
  {
    name: "Stakeholder Communication",
    nameAr: "التواصل مع أصحاب المصلحة",
    description: "Develop skills to communicate technical concepts to non-technical stakeholders effectively.",
    descriptionAr: "طور مهارات التواصل لشرح المفاهيم التقنية لأصحاب المصلحة غير التقنيين بفعالية.",
    category: "communication",
    level: "intermediate",
    icon: "Users",
    estimatedHours: 3,
    steps: [
      { title: "Know Your Audience", titleAr: "اعرف جمهورك", description: "Learn to tailor your message to different stakeholder groups.", descriptionAr: "تعلم تكييف رسالتك لمجموعات أصحاب المصلحة المختلفة.", order: 1 },
      { title: "Create Executive Summaries", titleAr: "إنشاء ملخصات تنفيذية", description: "Write concise summaries that highlight business impact.", descriptionAr: "اكتب ملخصات موجزة تبرز التأثير على الأعمال.", order: 2 },
      { title: "Handle Difficult Conversations", titleAr: "التعامل مع المحادثات الصعبة", description: "Navigate challenging discussions about timelines, resources, and trade-offs.", descriptionAr: "تعامل مع المناقشات الصعبة حول الجداول الزمنية والموارد والمقايضات.", order: 3 },
    ],
    resources: [],
    sortOrder: 10,
  },
];

interface PolicyRequest extends Request {
  policyResult?: PolicyResult;
  policyContext?: PolicyContext;
}

// SECURITY: Helper functions for Zero Trust tenant identity resolution
// NEVER fall back to client-supplied tenant metadata in production

/**
 * Get tenant ID from authenticated session ONLY
 * Returns null if user is not authenticated
 * This is the most secure method - no fallbacks
 */
function getAuthenticatedTenant(req: Request): string | null {
  return (req as any).user?.tenantId || null;
}

/**
 * Get authenticated user ID from session
 * Returns null if user is not authenticated
 */
function getAuthenticatedUserId(req: Request): string | null {
  return (req as any).user?.id || null;
}

/**
 * Secure tenant ID resolution with multiple priority levels
 * Priority 1: Resource ownership from database (most authoritative)
 * Priority 2: Authenticated session (secure)
 * Priority 3: Development mode fallback (WARNING: disabled in production)
 * 
 * @param req Express request object
 * @param resourceTenantId Tenant ID from resource lookup (database)
 * @returns Tenant ID from authoritative source, or null if cannot be determined securely
 */
function getSecureTenantId(req: Request, resourceTenantId?: string): string | null {
  // Priority 1: Resource ownership from database (most authoritative)
  if (resourceTenantId) {
    return resourceTenantId;
  }
  
  // Priority 2: Authenticated session
  const authenticatedTenant = getAuthenticatedTenant(req);
  if (authenticatedTenant) {
    return authenticatedTenant;
  }
  
  // Priority 3: Development mode fallback (NEVER in production)
  if (process.env.NODE_ENV === 'development') {
    const devTenant = (req as any).body?.tenantId || (req as any).query?.tenantId || null;
    if (devTenant) {
      console.warn('[SECURITY] Using development tenant fallback from request body/query');
    }
    return devTenant;
  }
  
  // No tenant could be determined securely
  return null;
}

// ===================================================================================
// ZERO TRUST PATTERNS: Stub Auth Middleware & Resource Lookup Helpers
// ===================================================================================

// Supported action types for Zero Trust validation
const SUPPORTED_ACTION_TYPES = [
  'execute_recommendation',
  'update_stock',
  'adjust_stock',
  'update_item'
];

/**
 * Stub auth middleware for development and production
 * MUST ALWAYS populate req.user with authenticated identity
 * Priority: 1) Session-authenticated user with tenantId/role, 2) Environment defaults
 * 
 * CRITICAL: This middleware NEVER allows a request through without req.user
 * Fails closed if no identity can be established
 */
function stubAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  // Check if user has complete auth context (from OIDC session with hydrated domain user)
  if (user && user.tenantId && user.role) {
    return next();
  }

  // Fall back to environment defaults (development mode)
  const userId = process.env.DEV_USER_ID || process.env.DEFAULT_USER_ID;
  const tenantId = process.env.DEV_TENANT_ID || process.env.DEFAULT_TENANT_ID;
  const userRole = process.env.DEV_USER_ROLE || process.env.DEFAULT_USER_ROLE;

  // Fail closed: If no identity is configured and no session, reject the request
  if (!userId || !tenantId) {
    return res.status(401).json({
      error: "Authentication required",
      message: "Please sign in to access this resource.",
    });
  }

  // Populate req.user with environment-configured identity (dev mode only)
  (req as any).user = {
    id: userId,
    tenantId: tenantId,
    role: userRole || 'operator'
  };

  next();
}

/**
 * Centralized resource lookup matrix for Zero Trust validation
 * Returns resource along with its authoritative tenantId from the database
 * 
 * SECURITY: This function:
 * - Only handles explicitly supported action types (exhaustive)
 * - Returns null only when resourceId is missing or resource not found
 * - For unsupported action types, caller must check SUPPORTED_ACTION_TYPES before calling
 */
async function lookupResourceForAction(
  actionType: string,
  resourceId: string | undefined
): Promise<{ resource: unknown; tenantId: string; targetType: string } | null> {
  if (!resourceId) return null;

  switch (actionType) {
    case 'execute_recommendation':
      const rec = await storage.getRecommendation(resourceId);
      if (!rec) return null;
      return { resource: rec, tenantId: rec.tenantId, targetType: 'recommendation' };

    case 'update_stock':
    case 'adjust_stock':
      const balance = await storage.getStockBalance(resourceId);
      if (!balance) return null;
      return { resource: balance, tenantId: balance.tenantId, targetType: 'stockBalance' };

    case 'update_item':
      const item = await storage.getItem(resourceId);
      if (!item) return null;
      return { resource: item, tenantId: item.tenantId, targetType: 'item' };

    default:
      // Unsupported action type - should never reach here if caller validates first
      return null;
  }
}

/**
 * Extract action-specific data from a resource for policy context
 * Ensures all policy-relevant data is derived server-side from the resource
 */
function extractActionDataFromResource(
  resource: unknown,
  actionType: string
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (actionType === 'execute_recommendation') {
    const rec = resource as Recommendation;
    data.recommendationId = rec.id;
    data.priority = rec.priority;
    data.confidenceScore = rec.confidenceScore;
    data.suggestedAction = rec.suggestedAction;
    data.type = rec.type;

    // Derive quantities from recommendation
    const { quantity, affectedItems, quantityMissing, affectedItemsMissing } =
      deriveQuantityFromRecommendation(rec);
    data.quantity = quantity;
    data.affectedItems = affectedItems;
    data.quantityMissing = quantityMissing;
    data.affectedItemsMissing = affectedItemsMissing;
  } else if (actionType === 'update_item') {
    const item = resource as { id: string; name: string; sku: string };
    data.itemId = item.id;
    data.itemName = item.name;
    data.sku = item.sku;
  } else if (actionType === 'update_stock' || actionType === 'adjust_stock') {
    const balance = resource as {
      id: string;
      itemId: string;
      locationId: string;
      quantityOnHand: number;
      quantityReserved: number;
      quantityAvailable: number;
    };
    data.itemId = balance.itemId;
    data.locationId = balance.locationId;
    data.quantityOnHand = balance.quantityOnHand;
    data.quantityReserved = balance.quantityReserved;
    data.quantityAvailable = balance.quantityAvailable;
  }

  return data;
}

interface BuildContextResult {
  context: PolicyContext | null;
  violations: Array<{ message: string; code: string }>;
}

/**
 * Build policy context from resource with Zero Trust validation
 * Returns {context, violations} so routes cannot regress on security checks
 * 
 * SECURITY: All rejection paths are logged to audit
 * - Unsupported action type
 * - Missing resourceId
 * - Resource not found
 * - Tenant mismatch
 */
async function buildPolicyContextFromResource(
  actionType: string,
  resourceId: string | undefined,
  user: { id: string; tenantId: string; role: string }
): Promise<BuildContextResult> {
  const violations: Array<{ message: string; code: string }> = [];

  // Step 1: Check if action type is supported (exhaustive validation)
  if (!SUPPORTED_ACTION_TYPES.includes(actionType)) {
    violations.push({
      message: `Unsupported action type: ${actionType}`,
      code: 'UNSUPPORTED_ACTION'
    });
    // Log denial for unsupported action type
    await policyEngine.logPolicyDecision({
      tenantId: user.tenantId,
      userId: user.id,
      actionType,
      decision: 'denied',
      reason: `Unsupported action type: ${actionType}. Supported types are: ${SUPPORTED_ACTION_TYPES.join(', ')}`,
      policyIds: [],
      context: { actionType, supportedTypes: SUPPORTED_ACTION_TYPES }
    });
    return { context: null, violations };
  }

  // Step 2: Check if resourceId is provided (required for all action types)
  if (!resourceId) {
    violations.push({
      message: 'Missing required parameter: resourceId',
      code: 'MISSING_RESOURCE_ID'
    });
    // Log denial for missing resourceId
    await policyEngine.logPolicyDecision({
      tenantId: user.tenantId,
      userId: user.id,
      actionType,
      decision: 'denied',
      reason: 'Resource ID is required for policy evaluation',
      policyIds: [],
      context: { actionType, resourceId: undefined }
    });
    return { context: null, violations };
  }

  // Step 3: Lookup resource from database (authoritative source)
  const lookup = await lookupResourceForAction(actionType, resourceId);
  if (!lookup) {
    violations.push({
      message: `Resource not found: ${resourceId}`,
      code: 'RESOURCE_NOT_FOUND'
    });
    // Log denial for resource not found
    await policyEngine.logPolicyDecision({
      tenantId: user.tenantId,
      userId: user.id,
      actionType,
      decision: 'denied',
      reason: `Resource not found: ${resourceId}`,
      policyIds: [],
      context: { actionType, resourceId }
    });
    return { context: null, violations };
  }

  // Step 4: Verify tenant ownership (Zero Trust tenant isolation)
  if (lookup.tenantId !== user.tenantId) {
    violations.push({
      message: 'Resource does not belong to your tenant',
      code: 'TENANT_MISMATCH'
    });
    // Log denial for tenant mismatch
    await policyEngine.logPolicyDecision({
      tenantId: user.tenantId,
      userId: user.id,
      actionType,
      decision: 'denied',
      reason: `Tenant mismatch: resource belongs to tenant ${lookup.tenantId}`,
      policyIds: [],
      context: { 
        actionType, 
        resourceId, 
        userTenant: user.tenantId, 
        resourceTenant: lookup.tenantId 
      }
    });
    return { context: null, violations };
  }

  // Step 5: Build context from server-derived resource data ONLY
  const context: PolicyContext = {
    tenantId: lookup.tenantId,
    userId: user.id,
    userRole: user.role,
    action: {
      type: actionType,
      targetType: lookup.targetType,
      targetId: resourceId,
      data: extractActionDataFromResource(lookup.resource, actionType)
    },
    environment: (process.env.NODE_ENV || 'development') as "production" | "staging" | "development",
    requestTime: new Date()
  };

  return { context, violations: [] };
}

// ===================================================================================
// END ZERO TRUST PATTERNS
// ===================================================================================

function deriveQuantityFromRecommendation(recommendation: Recommendation): {
  quantity: number | null;
  affectedItems: number | null;
  quantityMissing: boolean;
  affectedItemsMissing: boolean;
} {
  const suggestedAction = recommendation.suggestedAction as Record<string, unknown> | null;
  
  let quantity: number | null = null;
  let affectedItems: number | null = null;
  let quantityMissing = true;
  let affectedItemsMissing = true;

  if (suggestedAction) {
    // Try to extract quantity from various fields
    if (typeof suggestedAction.quantity === "number") {
      quantity = suggestedAction.quantity;
      quantityMissing = false;
    } else if (typeof suggestedAction.orderQuantity === "number") {
      quantity = suggestedAction.orderQuantity;
      quantityMissing = false;
    } else if (typeof suggestedAction.transferQuantity === "number") {
      quantity = suggestedAction.transferQuantity;
      quantityMissing = false;
    } else if (typeof suggestedAction.adjustQuantity === "number") {
      quantity = suggestedAction.adjustQuantity;
      quantityMissing = false;
    }

    // Try to extract affectedItems from various fields
    if (typeof suggestedAction.affectedItems === "number") {
      affectedItems = suggestedAction.affectedItems;
      affectedItemsMissing = false;
    } else if (typeof suggestedAction.itemCount === "number") {
      affectedItems = suggestedAction.itemCount;
      affectedItemsMissing = false;
    } else if (Array.isArray(suggestedAction.items)) {
      affectedItems = suggestedAction.items.length;
      affectedItemsMissing = false;
    } else if (Array.isArray(suggestedAction.locations)) {
      affectedItems = suggestedAction.locations.length;
      affectedItemsMissing = false;
    }
  }

  return { quantity, affectedItems, quantityMissing, affectedItemsMissing };
}

function buildPolicyContext(
  tenantId: string,
  userId: string,
  userRole: string,
  actionType: string,
  targetType: string,
  targetId: string,
  actionData: Record<string, unknown>,
  recommendation?: { id: string; type: string; priority: string; confidenceScore: number },
  environment: "production" | "staging" | "development" = "production"
): PolicyContext {
  return {
    tenantId,
    userId,
    userRole,
    action: {
      type: actionType,
      targetType,
      targetId,
      data: actionData,
    },
    recommendation,
    environment,
    requestTime: new Date(),
  };
}

export function requirePolicyCheck(actionType: string) {
  return async (req: PolicyRequest, res: Response, next: NextFunction) => {
    try {
      // SECURITY: Zero Trust - ALL context derived from authenticated session + database lookups
      // NEVER trust client-supplied values for security-critical decisions
      
      // STEP 1: Get authenticated user (stub middleware ensures this exists)
      const user = (req as any).user;
      if (!user?.id || !user?.tenantId) {
        return res.status(401).json({
          error: "Authentication required",
          message: "User authentication and tenant identity are required for policy evaluation",
        });
      }
      
      // STEP 2: Get resourceId from URL params ONLY (not request body)
      const resourceId = req.params.id;
      
      // STEP 3: Use buildPolicyContextFromResource for ALL action types
      // This ensures Zero Trust: context is built from DB entities only
      const { context, violations } = await buildPolicyContextFromResource(
        actionType,
        resourceId,
        { id: user.id, tenantId: user.tenantId, role: user.role || 'viewer' }
      );
      
      // STEP 4: If context could not be built, return appropriate error
      if (!context || violations.length > 0) {
        const violation = violations[0];
        const statusCode = 
          violation?.code === 'UNSUPPORTED_ACTION' ? 400 :
          violation?.code === 'MISSING_RESOURCE_ID' ? 400 :
          violation?.code === 'RESOURCE_NOT_FOUND' ? 404 :
          violation?.code === 'TENANT_MISMATCH' ? 403 : 400;
        
        return res.status(statusCode).json({
          error: violation?.code || "POLICY_CONTEXT_ERROR",
          message: violation?.message || "Failed to build policy context from resource",
          violations,
        });
      }
      
      // STEP 5: Evaluate policy with server-derived context
      const result = await policyEngine.evaluatePolicy(context);

      if (!result.allowed && !result.requiresApproval) {
        // MANDATORY: Log policy denial to audit before returning
        await policyEngine.logPolicyDecision({
          tenantId: context.tenantId,
          userId: context.userId,
          actionType: context.action.type,
          decision: "denied",
          reason: result.explanation,
          policyIds: result.appliedPolicies,
          context: {
            action: context.action,
            environment: context.environment,
            violations: result.violations,
          },
        });
        
        return res.status(403).json({
          error: "Policy violation",
          violations: result.violations,
          explanation: result.explanation,
        });
      }

      req.policyResult = result;
      req.policyContext = context;
      next();
    } catch (error) {
      console.error("Policy check middleware error:", error);
      res.status(500).json({
        error: "Failed to evaluate policies",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}

export async function registerRoutes(server: Server, app: Express): Promise<void> {
  // ===================================================================================
  // AUTHENTICATION: Set up custom auth (Email/Password + Google OAuth)
  // This provides user identity via local login and Google OAuth
  // ===================================================================================
  await setupAuth(app);

  // ===================================================================================
  // ZERO TRUST: Apply stub auth middleware to policy-protected routes
  // In development, this hydrates req.user from environment defaults when no session
  // In production, users must authenticate via Replit Auth
  // ===================================================================================
  app.use('/api/policies', stubAuthMiddleware);
  app.use('/api/approvals', stubAuthMiddleware);
  app.use('/api/recommendations', stubAuthMiddleware);
  app.use('/api/connectors', stubAuthMiddleware);
  app.use('/api/mappings', stubAuthMiddleware);
  app.use('/api/mapping-configs', stubAuthMiddleware);

  // Settings - Environment
  app.get("/api/settings/environment", (req, res) => {
    const nodeEnv = process.env.NODE_ENV || "development";
    let environment: "production" | "staging" | "development" = "development";
    if (nodeEnv === "production") {
      environment = "production";
    } else if (nodeEnv === "staging") {
      environment = "staging";
    }
    res.json({ environment });
  });

  // Tenant - Get current tenant info for trial banner
  app.get("/api/tenant", stubAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const tenantId = user?.tenantId;
      
      if (!tenantId) {
        return res.status(401).json({ error: "No tenant ID in session" });
      }
      
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      res.json({
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        companySize: tenant.companySize,
        trialEndsAt: tenant.trialEndsAt,
        onboardingCompleted: tenant.onboardingCompleted,
      });
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ error: "Failed to fetch tenant info" });
    }
  });

  // Stats
  app.get("/api/stats", async (req, res) => {
    const tenantId = "default";
    const stats = await storage.getStats(tenantId);
    res.json(stats);
  });

  // Connectors
  app.get("/api/connectors", async (req, res) => {
    const connectors = await storage.getConnectors();
    res.json(connectors);
  });

  app.get("/api/connectors/:id", async (req, res) => {
    const connector = await storage.getConnector(req.params.id);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }
    res.json(connector);
  });

  // SECURITY: Capability enforcement for connector write operations
  app.post("/api/connectors", requireCapability("connector_write"), async (req, res) => {
    const user = (req as any).user;
    const connector = await storage.createConnector(req.body);
    await storage.createAuditLog({
      tenantId: connector.tenantId,
      userId: user?.id || "admin",
      action: "create",
      resourceType: "connector",
      resourceId: connector.id,
      newState: { name: connector.name },
      ipAddress: req.ip || "unknown",
    });
    res.status(201).json(connector);
  });

  app.patch("/api/connectors/:id", requireCapability("connector_write"), async (req, res) => {
    const connector = await storage.updateConnector(req.params.id, req.body);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }
    res.json(connector);
  });

  app.delete("/api/connectors/:id", requireCapability("connector_write"), async (req, res) => {
    const user = (req as any).user;
    const connector = await storage.getConnector(req.params.id);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }
    await storage.deleteConnector(req.params.id);
    await storage.createAuditLog({
      tenantId: connector.tenantId,
      userId: user?.id || "admin",
      action: "delete",
      resourceType: "connector",
      resourceId: req.params.id,
      previousState: { name: connector.name },
      ipAddress: req.ip || "unknown",
    });
    res.status(204).send();
  });

  app.post("/api/connectors/:id/health-check", async (req, res) => {
    const connector = await storage.getConnector(req.params.id);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }
    const updated = await storage.updateConnector(req.params.id, {
      status: "connected",
      lastHealthCheck: new Date(),
    });
    res.json(updated);
  });

  app.post("/api/connectors/:id/discover", async (req, res) => {
    const connector = await storage.getConnector(req.params.id);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }
    const capabilities = [
      { endpoint: "/api/products", method: "GET", capability: "list", isSupported: true },
      { endpoint: "/api/products/{id}", method: "GET", capability: "read", isSupported: true },
      { endpoint: "/api/inventory", method: "GET", capability: "list", isSupported: true },
    ];
    for (const cap of capabilities) {
      await storage.createCapability({
        connectorId: connector.id,
        ...cap,
        sampleResponse: {},
      });
    }
    res.json({ discovered: capabilities.length });
  });

  app.post("/api/connectors/:id/test", async (req, res) => {
    try {
      const result = await connectorEngine.testConnection(req.params.id);
      
      if (result.success) {
        await storage.createAuditLog({
          tenantId: result.details.healthStatus.status === "online" ? "default" : "default",
          userId: "admin",
          action: "test_connection",
          resourceType: "connector",
          resourceId: req.params.id,
          newState: { 
            success: result.success,
            status: result.details.healthStatus.status,
            latencyMs: result.details.healthStatus.latencyMs,
          },
          ipAddress: req.ip || "unknown",
        });
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        details: {
          authValid: false,
          healthStatus: {
            status: "offline",
            lastChecked: new Date(),
            latencyMs: 0,
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          },
          endpointCount: 0,
        },
      });
    }
  });

  app.post("/api/connectors/:id/poll", async (req, res) => {
    try {
      const connector = await storage.getConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({ error: "Connector not found" });
      }
      
      const tenantId = connector.tenantId;
      const result = await connectorEngine.pollAllEndpoints(req.params.id, tenantId);
      
      await storage.createAuditLog({
        tenantId,
        userId: "admin",
        action: "poll_connector",
        resourceType: "connector",
        resourceId: req.params.id,
        newState: {
          success: result.success,
          summary: result.summary,
        },
        ipAddress: req.ip || "unknown",
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        results: [],
        summary: { total: 0, successful: 0, failed: 0, rateLimited: 0 },
      });
    }
  });

  app.get("/api/connectors/:id/health", async (req, res) => {
    try {
      const healthStatus = await connectorEngine.checkHealth(req.params.id);
      const rateLimitStatus = connectorEngine.getRateLimitStatus(req.params.id);
      
      res.json({
        health: healthStatus,
        rateLimit: rateLimitStatus,
      });
    } catch (error) {
      res.status(500).json({
        health: {
          status: "offline",
          lastChecked: new Date(),
          latencyMs: 0,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
        rateLimit: {
          requestsUsed: 0,
          requestsPerMinute: 60,
          remaining: 60,
          resetInMs: 0,
        },
      });
    }
  });

  // Endpoints
  app.get("/api/endpoints", async (req, res) => {
    const connectorId = req.query.connector as string;
    if (!connectorId) {
      return res.status(400).json({ error: "connector query parameter is required" });
    }
    const endpointList = await storage.getEndpoints(connectorId);
    res.json(endpointList);
  });

  app.get("/api/endpoints/:id", async (req, res) => {
    const endpoint = await storage.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({ error: "Endpoint not found" });
    }
    res.json(endpoint);
  });

  app.post("/api/endpoints", async (req, res) => {
    const endpoint = await storage.createEndpoint(req.body);
    res.status(201).json(endpoint);
  });

  app.patch("/api/endpoints/:id", async (req, res) => {
    const endpoint = await storage.updateEndpoint(req.params.id, req.body);
    if (!endpoint) {
      return res.status(404).json({ error: "Endpoint not found" });
    }
    res.json(endpoint);
  });

  app.post("/api/endpoints/:id/poll", async (req, res) => {
    try {
      const endpoint = await storage.getEndpoint(req.params.id);
      if (!endpoint) {
        return res.status(404).json({ error: "Endpoint not found" });
      }
      
      const connector = await storage.getConnector(endpoint.connectorId);
      if (!connector) {
        return res.status(404).json({ error: "Connector not found for endpoint" });
      }
      
      const tenantId = connector.tenantId;
      const result = await connectorEngine.pollEndpoint(
        endpoint.connectorId,
        req.params.id,
        tenantId
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        requestLog: {
          url: "",
          method: "",
          responseTimeMs: 0,
          timestamp: new Date(),
        },
      });
    }
  });

  // Mappings
  app.get("/api/mappings", async (req, res) => {
    const connectorId = req.query.connector as string | undefined;
    const mappings = await storage.getMappings(connectorId);
    res.json(mappings);
  });

  app.get("/api/mappings/:id", async (req, res) => {
    const mapping = await storage.getMapping(req.params.id);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json(mapping);
  });

  // SECURITY: Capability enforcement for mapping write operations
  app.post("/api/mappings", requireCapability("mapping_write"), async (req, res) => {
    const user = (req as any).user;
    const mapping = await storage.createMapping(req.body);
    await storage.createAuditLog({
      tenantId: user?.tenantId || "default",
      userId: user?.id || "admin",
      action: "create",
      resourceType: "mapping",
      resourceId: mapping.id,
      newState: { name: mapping.name },
      ipAddress: req.ip || "unknown",
    });
    res.status(201).json(mapping);
  });

  app.patch("/api/mappings/:id", requireCapability("mapping_write"), async (req, res) => {
    const mapping = await storage.updateMapping(req.params.id, req.body);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json(mapping);
  });

  app.delete("/api/mappings/:id", async (req, res) => {
    const deleted = await storage.deleteMapping(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.status(204).send();
  });

  // Recommendations
  app.get("/api/recommendations", async (req, res) => {
    const recommendations = await storage.getRecommendations();
    res.json(recommendations);
  });

  app.get("/api/recommendations/:id", async (req, res) => {
    const rec = await storage.getRecommendation(req.params.id);
    if (!rec) {
      return res.status(404).json({ error: "Recommendation not found" });
    }
    res.json(rec);
  });

  app.patch("/api/recommendations/:id", async (req, res) => {
    const user = (req as any).user;
    const rec = await storage.getRecommendation(req.params.id);
    if (!rec) {
      return res.status(404).json({ error: "Recommendation not found" });
    }
    const previousStatus = rec.status;
    const updated = await storage.updateRecommendation(req.params.id, {
      ...req.body,
      decidedBy: user?.id || "admin",
    });
    await storage.createAuditLog({
      tenantId: rec.tenantId,
      userId: user?.id || "admin",
      action: req.body.status === "approved" ? "approve" : 
              req.body.status === "rejected" ? "reject" : "update",
      resourceType: "recommendation",
      resourceId: req.params.id,
      previousState: { status: previousStatus },
      newState: { status: req.body.status },
      ipAddress: req.ip || "unknown",
    });
    res.json(updated);
  });

  // SECURITY: Capability enforcement for recommendation approval
  app.post("/api/recommendations/:id/approve", requireCapability("recommendation_approve"), async (req, res) => {
    try {
      const user = (req as any).user;
      const rec = await storage.getRecommendation(req.params.id);
      if (!rec) {
        return res.status(404).json({ error: "Recommendation not found" });
      }

      // Verify tenant ownership
      if (rec.tenantId !== user.tenantId) {
        await storage.createAuditLog({
          tenantId: user.tenantId,
          userId: user.id,
          action: "approve_recommendation",
          resourceType: "recommendation",
          resourceId: req.params.id,
          eventType: "CAPABILITY_DENIED",
          newState: {
            denied: true,
            reason: "Tenant mismatch",
            userTenant: user.tenantId,
            resourceTenant: rec.tenantId,
          },
          ipAddress: req.ip || "unknown",
        });
        return res.status(403).json({ 
          error: "Access denied",
          message: "Resource does not belong to your tenant" 
        });
      }

      if (rec.status !== "pending") {
        return res.status(400).json({
          error: "Cannot approve recommendation",
          message: `Recommendation is already ${rec.status}`,
        });
      }

      const previousStatus = rec.status;
      const updated = await storage.updateRecommendation(req.params.id, {
        status: "approved",
        decidedBy: user.id,
      });

      await storage.createAuditLog({
        tenantId: rec.tenantId,
        userId: user.id,
        action: "approve_recommendation",
        resourceType: "recommendation",
        resourceId: req.params.id,
        previousState: { status: previousStatus },
        newState: { status: "approved", approvedBy: user.id },
        ipAddress: req.ip || "unknown",
      });

      res.json({
        success: true,
        message: "Recommendation approved successfully",
        recommendation: updated,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to approve recommendation",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Anomalies
  app.get("/api/anomalies", async (req, res) => {
    const anomalies = await storage.getAnomalies();
    res.json(anomalies);
  });

  app.get("/api/anomalies/:id", async (req, res) => {
    const anomaly = await storage.getAnomaly(req.params.id);
    if (!anomaly) {
      return res.status(404).json({ error: "Anomaly not found" });
    }
    res.json(anomaly);
  });

  app.patch("/api/anomalies/:id", async (req, res) => {
    const anomaly = await storage.updateAnomaly(req.params.id, req.body);
    if (!anomaly) {
      return res.status(404).json({ error: "Anomaly not found" });
    }
    await storage.createAuditLog({
      tenantId: anomaly.tenantId,
      userId: "admin",
      action: "update",
      resourceType: "anomaly",
      resourceId: req.params.id,
      newState: { status: req.body.status },
      ipAddress: req.ip || "unknown",
    });
    res.json(anomaly);
  });

  // Policies
  app.get("/api/policies", async (req, res) => {
    const policies = await storage.getPolicies();
    res.json(policies);
  });

  // Get default policies (must be before /:id route)
  app.get("/api/policies/defaults", async (req, res) => {
    try {
      const defaults = policyEngine.getDefaultPolicies();
      res.json(defaults);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get default policies",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Policy Evaluation Endpoint (must be before /:id route)
  // SECURITY: Zero Trust - Uses buildPolicyContextFromResource helper
  // All context is derived from authoritative sources (database) only
  app.post("/api/policies/evaluate", async (req, res) => {
    try {
      // STEP 1: Check req.user exists (stub middleware ensures this in dev)
      const user = (req as any).user;
      if (!user?.id || !user?.tenantId) {
        return res.status(401).json({
          error: "Authentication required",
          message: "User authentication required for policy evaluation",
        });
      }

      const { actionType, resourceId } = req.body;

      if (!actionType) {
        return res.status(400).json({
          error: "Missing required field: actionType is required"
        });
      }

      // STEP 2: Use buildPolicyContextFromResource helper for Zero Trust validation
      const { context, violations } = await buildPolicyContextFromResource(
        actionType,
        resourceId,
        { id: user.id, tenantId: user.tenantId, role: user.role || "viewer" }
      );

      // STEP 3: If violations, return error
      if (violations.length > 0) {
        const firstViolation = violations[0];
        const statusCode = firstViolation.code === "RESOURCE_NOT_FOUND" ? 404 :
                          firstViolation.code === "TENANT_MISMATCH" ? 403 : 400;
        return res.status(statusCode).json({
          error: firstViolation.code,
          message: firstViolation.message,
          violations,
        });
      }

      if (!context) {
        return res.status(400).json({
          error: "Cannot determine action context from request",
          message: `Unsupported action type or missing resourceId: ${actionType}`,
        });
      }

      // STEP 4: Evaluate policy
      const result = await policyEngine.evaluatePolicy(context);

      await storage.createAuditLog({
        tenantId: context.tenantId,
        userId: context.userId,
        action: "policy_evaluation_request",
        resourceType: "policy",
        resourceId: result.appliedPolicies.join(",") || "none",
        newState: {
          allowed: result.allowed,
          requiresApproval: result.requiresApproval,
          requiresDryRun: result.requiresDryRun,
          violationCount: result.violations.length,
        },
        ipAddress: req.ip || "unknown",
      });

      res.json(result);
    } catch (error) {
      console.error("Policy evaluation error:", error);
      res.status(500).json({
        error: "Failed to evaluate policies",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Validate action (must be before /:id route)
  // SECURITY: Zero Trust - Uses buildPolicyContextFromResource helper
  app.post("/api/policies/validate-action", async (req, res) => {
    try {
      // STEP 1: Check req.user exists (stub middleware ensures this in dev)
      const user = (req as any).user;
      if (!user?.id || !user?.tenantId) {
        return res.status(401).json({
          error: "Authentication required",
          message: "User authentication required for action validation",
        });
      }

      const { actionType, resourceId } = req.body;

      if (!actionType) {
        return res.status(400).json({
          error: "Missing required field: actionType is required"
        });
      }

      // STEP 2: Use buildPolicyContextFromResource helper for Zero Trust validation
      const { context, violations } = await buildPolicyContextFromResource(
        actionType,
        resourceId,
        { id: user.id, tenantId: user.tenantId, role: user.role || "viewer" }
      );

      // STEP 3: If violations, return error
      if (violations.length > 0) {
        const firstViolation = violations[0];
        const statusCode = firstViolation.code === "RESOURCE_NOT_FOUND" ? 404 :
                          firstViolation.code === "TENANT_MISMATCH" ? 403 : 400;
        return res.status(statusCode).json({
          error: firstViolation.code,
          message: firstViolation.message,
          violations,
        });
      }

      if (!context) {
        return res.status(400).json({
          error: "Cannot determine action context from request",
          message: `Unsupported action type or missing resourceId: ${actionType}`,
        });
      }

      // STEP 4: Build user object and validate action
      const userObj: User = {
        id: user.id,
        username: "authenticated_user",
        email: null,
        password: "",
        googleId: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        tenantId: user.tenantId,
        role: user.role || "viewer",
        platformRole: user.platformRole || null,
        createdAt: new Date(),
      };

      const result = await policyEngine.validateAction(context.action as any, userObj, user.tenantId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: "Failed to validate action",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Check blast radius (must be before /:id route)
  // SECURITY: Zero Trust - Uses buildPolicyContextFromResource helper
  app.post("/api/policies/check-blast-radius", async (req, res) => {
    try {
      // STEP 1: Check req.user exists (stub middleware ensures this in dev)
      const user = (req as any).user;
      if (!user?.id || !user?.tenantId) {
        return res.status(401).json({
          error: "Authentication required",
          message: "User authentication required for blast radius check",
        });
      }

      const { actionType, resourceId } = req.body;

      if (!actionType) {
        return res.status(400).json({
          error: "Missing required field: actionType is required"
        });
      }

      // STEP 2: Use buildPolicyContextFromResource helper for Zero Trust validation
      const { context, violations } = await buildPolicyContextFromResource(
        actionType,
        resourceId,
        { id: user.id, tenantId: user.tenantId, role: user.role || "viewer" }
      );

      // STEP 3: If violations, return error
      if (violations.length > 0) {
        const firstViolation = violations[0];
        const statusCode = firstViolation.code === "RESOURCE_NOT_FOUND" ? 404 :
                          firstViolation.code === "TENANT_MISMATCH" ? 403 : 400;
        return res.status(statusCode).json({
          error: firstViolation.code,
          message: firstViolation.message,
          violations,
        });
      }

      if (!context) {
        return res.status(400).json({
          error: "Cannot determine action context from request",
          message: `Unsupported action type or missing resourceId: ${actionType}`,
        });
      }

      // STEP 4: Enforce blast radius using context.action
      const result = await policyEngine.enforceBlastRadius(context.action as any, user.tenantId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: "Failed to check blast radius",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Check dry-run requirement (must be before /:id route)
  // SECURITY: Zero Trust - Uses buildPolicyContextFromResource helper
  app.post("/api/policies/check-dry-run", async (req, res) => {
    try {
      // STEP 1: Check req.user exists (stub middleware ensures this in dev)
      const user = (req as any).user;
      if (!user?.id || !user?.tenantId) {
        return res.status(401).json({
          error: "Authentication required",
          message: "User authentication required for dry-run check",
        });
      }

      const { actionType, resourceId } = req.body;

      if (!actionType) {
        return res.status(400).json({
          error: "Missing required field: actionType is required"
        });
      }

      // STEP 2: Use buildPolicyContextFromResource helper for Zero Trust validation
      const { context, violations } = await buildPolicyContextFromResource(
        actionType,
        resourceId,
        { id: user.id, tenantId: user.tenantId, role: user.role || "viewer" }
      );

      // STEP 3: If violations, return error
      if (violations.length > 0) {
        const firstViolation = violations[0];
        const statusCode = firstViolation.code === "RESOURCE_NOT_FOUND" ? 404 :
                          firstViolation.code === "TENANT_MISMATCH" ? 403 : 400;
        return res.status(statusCode).json({
          error: firstViolation.code,
          message: firstViolation.message,
          violations,
        });
      }

      if (!context) {
        return res.status(400).json({
          error: "Cannot determine action context from request",
          message: `Unsupported action type or missing resourceId: ${actionType}`,
        });
      }

      // STEP 4: Check dry-run requirement using context.action
      const result = await policyEngine.checkDryRunRequired(context.action as any, user.tenantId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: "Failed to check dry-run requirement",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/policies/:id", async (req, res) => {
    const policy = await storage.getPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json(policy);
  });

  // SECURITY: Capability enforcement for policy write operations
  app.post("/api/policies", requireCapability("policy_write"), async (req, res) => {
    const user = (req as any).user;
    const policy = await storage.createPolicy(req.body);
    await storage.createAuditLog({
      tenantId: policy.tenantId,
      userId: user?.id || "admin",
      action: "create",
      resourceType: "policy",
      resourceId: policy.id,
      newState: { name: policy.name },
      ipAddress: req.ip || "unknown",
    });
    res.status(201).json(policy);
  });

  app.patch("/api/policies/:id", requireCapability("policy_write"), async (req, res) => {
    const policy = await storage.updatePolicy(req.params.id, req.body);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json(policy);
  });

  app.delete("/api/policies/:id", requireCapability("policy_write"), async (req, res) => {
    const user = (req as any).user;
    const policy = await storage.getPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    await storage.deletePolicy(req.params.id);
    await storage.createAuditLog({
      tenantId: policy.tenantId,
      userId: user?.id || "admin",
      action: "delete",
      resourceType: "policy",
      resourceId: req.params.id,
      previousState: { name: policy.name },
      ipAddress: req.ip || "unknown",
    });
    res.status(204).send();
  });

  // Audit Logs
  app.get("/api/audit-logs", async (req, res) => {
    const logs = await storage.getAuditLogs();
    res.json(logs);
  });

  // Capabilities
  app.get("/api/capabilities", async (req, res) => {
    const connectorId = req.query.connector as string | undefined;
    const capabilities = await storage.getCapabilities(connectorId);
    res.json(capabilities);
  });

  // Items
  app.get("/api/items", async (req, res) => {
    const items = await storage.getItems("default");
    res.json(items);
  });

  // Locations
  app.get("/api/locations", async (req, res) => {
    const locations = await storage.getLocations("default");
    res.json(locations);
  });

  // AI Engine Routes
  app.post("/api/ai/analyze", async (req, res) => {
    try {
      const tenantId = req.body.tenantId || "default";
      const result = await aiEngine.generateRecommendations(tenantId);
      
      await storage.createAuditLog({
        tenantId,
        userId: "admin",
        action: "analyze",
        resourceType: "ai_engine",
        resourceId: "full_analysis",
        newState: {
          recommendationsCreated: result.recommendationsCreated,
          anomaliesCreated: result.anomaliesCreated,
          forecastsGenerated: result.demandForecasts.length,
          stockoutRisksAnalyzed: result.stockoutRisks.length,
        },
        ipAddress: req.ip || "unknown",
      });

      res.json({
        success: true,
        tenantId: result.tenantId,
        timestamp: result.timestamp,
        summary: {
          demandForecasts: result.demandForecasts.length,
          stockoutRisks: result.stockoutRisks.length,
          anomaliesDetected: result.anomalies.length,
          recommendationsCreated: result.recommendationsCreated,
          anomaliesCreated: result.anomaliesCreated,
        },
        demandForecasts: result.demandForecasts,
        stockoutRisks: result.stockoutRisks,
        anomalies: result.anomalies,
      });
    } catch (error) {
      console.error("AI analysis error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to run AI analysis",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/ai/forecast/:itemId", async (req, res) => {
    try {
      const { itemId } = req.params;
      const locationId = req.query.locationId as string | undefined;
      const tenantId = (req.query.tenantId as string) || "default";

      const item = await storage.getItems(tenantId);
      const foundItem = item.find((i) => i.id === itemId);
      if (!foundItem) {
        return res.status(404).json({
          success: false,
          error: "Item not found",
        });
      }

      const forecast = await aiEngine.analyzeDemand(
        itemId,
        locationId || null,
        tenantId
      );

      res.json({
        success: true,
        itemId,
        itemName: foundItem.name,
        forecast,
      });
    } catch (error) {
      console.error("Demand forecast error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate demand forecast",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/ai/stockout-risk", async (req, res) => {
    try {
      const tenantId = (req.query.tenantId as string) || "default";
      const itemId = req.query.itemId as string | undefined;
      const locationId = req.query.locationId as string | undefined;

      const items = await storage.getItems(tenantId);
      const stockBalances = await storage.getStockBalances(tenantId);

      const results: Array<{
        itemId: string;
        itemName: string;
        locationId: string;
        risk: Awaited<ReturnType<typeof aiEngine.predictStockoutRisk>>;
      }> = [];

      const balancesToAnalyze = stockBalances.filter((b) => {
        if (itemId && b.itemId !== itemId) return false;
        if (locationId && b.locationId !== locationId) return false;
        return true;
      });

      for (const balance of balancesToAnalyze) {
        const item = items.find((i) => i.id === balance.itemId);
        if (!item) continue;

        const risk = await aiEngine.predictStockoutRisk(
          balance.itemId,
          balance.locationId,
          tenantId
        );

        results.push({
          itemId: balance.itemId,
          itemName: item.name,
          locationId: balance.locationId,
          risk,
        });
      }

      const highRiskCount = results.filter(
        (r) =>
          r.risk.riskAssessment.risk7Days === "high" ||
          r.risk.riskAssessment.risk14Days === "high"
      ).length;

      const shouldReorderCount = results.filter((r) => r.risk.shouldReorder).length;

      res.json({
        success: true,
        tenantId,
        summary: {
          totalAnalyzed: results.length,
          highRiskItems: highRiskCount,
          itemsNeedingReorder: shouldReorderCount,
        },
        risks: results,
      });
    } catch (error) {
      console.error("Stockout risk analysis error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to analyze stockout risk",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/ai/anomalies", async (req, res) => {
    try {
      const tenantId = (req.query.tenantId as string) || "default";
      const anomalies = await aiEngine.detectAnomalies(tenantId);

      const items = await storage.getItems(tenantId);
      const locations = await storage.getLocations(tenantId);

      const enrichedAnomalies = anomalies.map((a) => ({
        ...a,
        itemName: items.find((i) => i.id === a.itemId)?.name,
        locationName: locations.find((l) => l.id === a.locationId)?.name,
      }));

      res.json({
        success: true,
        tenantId,
        summary: {
          total: anomalies.length,
          critical: anomalies.filter((a) => a.severity === "critical").length,
          high: anomalies.filter((a) => a.severity === "high").length,
          medium: anomalies.filter((a) => a.severity === "medium").length,
          low: anomalies.filter((a) => a.severity === "low").length,
        },
        anomalies: enrichedAnomalies,
      });
    } catch (error) {
      console.error("Anomaly detection error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to detect anomalies",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== Z.AI ENHANCED ENDPOINTS ====================

  /**
   * Get Z.ai service status
   * Returns configuration status and available features
   */
  app.get("/api/ai/zai/status", async (req, res) => {
    try {
      const status = zaiService.getStatus();
      res.json({
        success: true,
        ...status,
        availableFeatures: status.configured ? [
          "demandInsights",
          "anomalyAnalysis",
          "naturalLanguageQuestions",
          "reportGeneration",
          "enhancedRecommendations",
        ] : [],
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to get Z.ai status",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Configure Z.ai service with API key
   */
  app.post("/api/ai/zai/configure", async (req, res) => {
    try {
      const { apiKey, baseUrl } = req.body;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: "apiKey is required",
        });
      }

      zaiService.configure(apiKey, baseUrl);

      res.json({
        success: true,
        message: "Z.ai service configured successfully",
        status: zaiService.getStatus(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to configure Z.ai service",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Get AI-powered demand insights using Z.ai GLM models
   */
  app.get("/api/ai/zai/insights", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string || "default";

      if (!zaiService.isConfigured()) {
        return res.status(400).json({
          success: false,
          error: "Z.ai service not configured",
          message: "Please configure Z.ai API key first using POST /api/ai/zai/configure",
        });
      }

      const insights = await aiEngine.getAIInsights(tenantId);

      if (!insights) {
        return res.status(500).json({
          success: false,
          error: "Failed to generate insights",
        });
      }

      res.json({
        success: true,
        tenantId,
        insights,
      });
    } catch (error) {
      console.error("Z.ai insights error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get AI insights",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Analyze an anomaly using Z.ai for root cause analysis
   */
  app.get("/api/ai/zai/anomaly-analysis/:anomalyId", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string || "default";
      const { anomalyId } = req.params;

      if (!zaiService.isConfigured()) {
        return res.status(400).json({
          success: false,
          error: "Z.ai service not configured",
        });
      }

      const analysis = await aiEngine.getAnomalyAnalysis(anomalyId, tenantId);

      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: "Anomaly not found or analysis failed",
        });
      }

      res.json({
        success: true,
        anomalyId,
        analysis,
      });
    } catch (error) {
      console.error("Z.ai anomaly analysis error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to analyze anomaly",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Ask a natural language question about inventory
   */
  app.post("/api/ai/zai/ask", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string || "default";
      const { question } = req.body;

      if (!question) {
        return res.status(400).json({
          success: false,
          error: "question is required in request body",
        });
      }

      if (!zaiService.isConfigured()) {
        return res.status(400).json({
          success: false,
          error: "Z.ai service not configured",
        });
      }

      const answer = await aiEngine.askQuestion(question, tenantId);

      if (!answer) {
        return res.status(500).json({
          success: false,
          error: "Failed to process question",
        });
      }

      res.json({
        success: true,
        question,
        ...answer,
      });
    } catch (error) {
      console.error("Z.ai question error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to answer question",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Generate an inventory report using Z.ai
   */
  app.post("/api/ai/zai/report", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string || "default";
      const {
        type = "daily",
        sections = ["overview", "inventory_status", "recommendations", "anomalies"],
      } = req.body;

      if (!zaiService.isConfigured()) {
        return res.status(400).json({
          success: false,
          error: "Z.ai service not configured",
        });
      }

      const report = await aiEngine.generateReport(tenantId, type, sections);

      if (!report) {
        return res.status(500).json({
          success: false,
          error: "Failed to generate report",
        });
      }

      res.json({
        success: true,
        tenantId,
        report,
      });
    } catch (error) {
      console.error("Z.ai report generation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate report",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Run enhanced analysis with Z.ai insights
   */
  app.post("/api/ai/zai/enhanced-analyze", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string || "default";

      const result = await aiEngine.generateEnhancedRecommendations(tenantId);

      res.json({
        success: true,
        tenantId,
        timestamp: result.timestamp,
        summary: {
          demandForecastsGenerated: result.demandForecasts.length,
          stockoutRisksAnalyzed: result.stockoutRisks.length,
          anomaliesDetected: result.anomalies.length,
          recommendationsCreated: result.recommendationsCreated,
          anomaliesCreated: result.anomaliesCreated,
          hasAiInsights: !!result.aiInsights,
        },
        demandForecasts: result.demandForecasts,
        stockoutRisks: result.stockoutRisks,
        anomalies: result.anomalies,
        aiInsights: result.aiInsights,
      });
    } catch (error) {
      console.error("Z.ai enhanced analysis error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to run enhanced analysis",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== END Z.AI ENDPOINTS ====================

  const validateTenant = async (tenantId: string | undefined): Promise<{ valid: boolean; error?: string }> => {
    if (!tenantId) {
      return { valid: false, error: "tenantId is required" };
    }
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return { valid: false, error: `Tenant '${tenantId}' not found` };
    }
    if (tenant.status === "suspended") {
      return { valid: false, error: `Tenant '${tenantId}' is suspended` };
    }
    return { valid: true };
  };

  // Mapping Configs (Mapping Engine)
  app.get("/api/mapping-configs", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const connectorId = req.query.connectorId as string | undefined;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId query parameter is required" });
      }
      
      const tenantValidation = await validateTenant(tenantId);
      if (!tenantValidation.valid) {
        return res.status(401).json({ error: tenantValidation.error });
      }
      
      const configs = await storage.getMappingConfigs(tenantId, connectorId);
      res.json(configs);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch mapping configs",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/mapping-configs/:id", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId query parameter is required" });
      }
      
      const tenantValidation = await validateTenant(tenantId);
      if (!tenantValidation.valid) {
        return res.status(401).json({ error: tenantValidation.error });
      }
      
      const config = await storage.getMappingConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Mapping config not found" });
      }
      
      if (config.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
      }
      
      res.json(config);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch mapping config",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // SECURITY: Capability enforcement for mapping config write operations
  app.post("/api/mapping-configs", requireCapability("mapping_write"), async (req, res) => {
    try {
      const user = (req as any).user;
      const { tenantId, connectorId, endpointId, ...configData } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required in request body" });
      }
      
      const tenantValidation = await validateTenant(tenantId);
      if (!tenantValidation.valid) {
        return res.status(401).json({ error: tenantValidation.error });
      }
      
      const parseResult = mappingConfigPayloadSchema.safeParse(configData);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid mapping configuration",
          details: parseResult.error.errors,
        });
      }

      const validationResult = mappingEngine.validateMapping(parseResult.data);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Mapping validation failed",
          errors: validationResult.errors,
        });
      }

      const config = await storage.createMappingConfig({
        tenantId,
        connectorId,
        endpointId,
        name: parseResult.data.name,
        sourceType: parseResult.data.sourceType,
        targetEntity: parseResult.data.targetEntity,
        fieldMappings: parseResult.data.fieldMappings,
        arrayPath: parseResult.data.arrayPath,
      });

      await storage.createAuditLog({
        tenantId,
        userId: user?.id || "admin",
        action: "create",
        resourceType: "mapping_config",
        resourceId: config.id,
        newState: { name: config.name, version: config.version },
        ipAddress: req.ip || "unknown",
      });

      res.status(201).json(config);
    } catch (error) {
      res.status(500).json({
        error: "Failed to create mapping config",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.patch("/api/mapping-configs/:id", requireCapability("mapping_write"), async (req, res) => {
    try {
      const tenantId = req.body.tenantId || req.query.tenantId as string | undefined;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      
      const tenantValidation = await validateTenant(tenantId);
      if (!tenantValidation.valid) {
        return res.status(401).json({ error: tenantValidation.error });
      }
      
      const existingConfig = await storage.getMappingConfig(req.params.id);
      if (!existingConfig) {
        return res.status(404).json({ error: "Mapping config not found" });
      }
      
      if (existingConfig.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
      }

      await storage.createMappingHistory({
        mappingConfigId: existingConfig.id,
        version: existingConfig.version,
        fieldMappings: existingConfig.fieldMappings as Record<string, unknown>,
        arrayPath: existingConfig.arrayPath || undefined,
        changedBy: "admin",
        changeReason: req.body.changeReason || "Update",
      });

      const { fieldMappings, arrayPath, name, sourceType, targetEntity, tenantId: _, ...otherUpdates } = req.body;
      
      if (fieldMappings) {
        const validationPayload = {
          name: name || existingConfig.name,
          sourceType: sourceType || existingConfig.sourceType,
          targetEntity: targetEntity || existingConfig.targetEntity,
          fieldMappings,
          arrayPath: arrayPath ?? existingConfig.arrayPath,
        };
        
        const parseResult = mappingConfigPayloadSchema.safeParse(validationPayload);
        if (!parseResult.success) {
          return res.status(400).json({
            error: "Invalid field mappings",
            details: parseResult.error.errors,
          });
        }

        const validationResult = mappingEngine.validateMapping(parseResult.data);
        if (!validationResult.success) {
          return res.status(400).json({
            error: "Mapping validation failed",
            errors: validationResult.errors,
          });
        }
      }

      const updates = {
        ...otherUpdates,
        ...(fieldMappings && { fieldMappings }),
        ...(arrayPath !== undefined && { arrayPath }),
        ...(name && { name }),
        ...(sourceType && { sourceType }),
        ...(targetEntity && { targetEntity }),
        version: existingConfig.version + 1,
        updatedAt: new Date(),
      };

      const updated = await storage.updateMappingConfig(req.params.id, updates);

      await storage.createAuditLog({
        tenantId: existingConfig.tenantId,
        userId: "admin",
        action: "update",
        resourceType: "mapping_config",
        resourceId: req.params.id,
        previousState: { version: existingConfig.version },
        newState: { version: updated?.version },
        ipAddress: req.ip || "unknown",
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({
        error: "Failed to update mapping config",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.delete("/api/mapping-configs/:id", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId query parameter is required" });
      }
      
      const tenantValidation = await validateTenant(tenantId);
      if (!tenantValidation.valid) {
        return res.status(401).json({ error: tenantValidation.error });
      }
      
      const config = await storage.getMappingConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Mapping config not found" });
      }
      
      if (config.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
      }

      await storage.deleteMappingConfig(req.params.id);

      await storage.createAuditLog({
        tenantId: config.tenantId,
        userId: "admin",
        action: "delete",
        resourceType: "mapping_config",
        resourceId: req.params.id,
        previousState: { name: config.name, version: config.version },
        ipAddress: req.ip || "unknown",
      });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({
        error: "Failed to delete mapping config",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/mapping-configs/:id/preview", async (req, res) => {
    try {
      const tenantId = req.body.tenantId || req.query.tenantId as string | undefined;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      
      const tenantValidation = await validateTenant(tenantId);
      if (!tenantValidation.valid) {
        return res.status(401).json({ error: tenantValidation.error });
      }
      
      const config = await storage.getMappingConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Mapping config not found" });
      }
      
      if (config.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
      }

      const { sampleData } = req.body;
      if (!sampleData) {
        return res.status(400).json({ error: "sampleData is required" });
      }

      const mappingPayload = {
        name: config.name,
        sourceType: config.sourceType as "items" | "locations" | "stock_balances" | "stock_movements",
        targetEntity: config.targetEntity as "items" | "locations" | "stockBalances" | "stockMovements",
        fieldMappings: config.fieldMappings as any[],
        arrayPath: config.arrayPath || undefined,
      };

      const result = await mappingEngine.previewMapping(sampleData, mappingPayload);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: "Failed to preview mapping",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/mapping-configs/:id/validate", async (req, res) => {
    try {
      const tenantId = req.body.tenantId || req.query.tenantId as string | undefined;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      
      const tenantValidation = await validateTenant(tenantId);
      if (!tenantValidation.valid) {
        return res.status(401).json({ error: tenantValidation.error });
      }
      
      const config = await storage.getMappingConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Mapping config not found" });
      }
      
      if (config.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
      }

      const mappingPayload = {
        id: config.id,
        name: config.name,
        version: config.version,
        sourceType: config.sourceType as "items" | "locations" | "stock_balances" | "stock_movements",
        targetEntity: config.targetEntity as "items" | "locations" | "stockBalances" | "stockMovements",
        fieldMappings: config.fieldMappings as any[],
        arrayPath: config.arrayPath || undefined,
      };

      const result = mappingEngine.validateMapping(mappingPayload);
      res.json({
        valid: result.success,
        errors: result.errors,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to validate mapping",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/mapping-configs/:id/transform", async (req, res) => {
    try {
      const { data, persist = false, tenantId } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required in request body" });
      }
      
      const tenantValidation = await validateTenant(tenantId);
      if (!tenantValidation.valid) {
        return res.status(401).json({ error: tenantValidation.error });
      }
      
      const config = await storage.getMappingConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Mapping config not found" });
      }
      
      if (config.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
      }

      if (!data) {
        return res.status(400).json({ error: "data is required" });
      }

      if (persist) {
        const result = await mappingEngine.transformAndPersist(data, req.params.id, tenantId);
        
        await storage.createAuditLog({
          tenantId,
          userId: "admin",
          action: "transform_persist",
          resourceType: "mapping_config",
          resourceId: req.params.id,
          newState: result.data,
          ipAddress: req.ip || "unknown",
        });

        res.json(result);
      } else {
        const result = await mappingEngine.transformPayload(data, req.params.id);
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({
        error: "Failed to transform data",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/mapping-configs/:id/history", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId query parameter is required" });
      }
      
      const tenantValidation = await validateTenant(tenantId);
      if (!tenantValidation.valid) {
        return res.status(401).json({ error: tenantValidation.error });
      }
      
      const config = await storage.getMappingConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Mapping config not found" });
      }
      
      if (config.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
      }

      const history = await storage.getMappingHistory(req.params.id);
      res.json({
        currentVersion: config.version,
        history: history.sort((a, b) => b.version - a.version),
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch mapping history",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/mapping-configs/:id/rollback", async (req, res) => {
    try {
      const { targetVersion, tenantId } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required in request body" });
      }
      
      const tenantValidation = await validateTenant(tenantId);
      if (!tenantValidation.valid) {
        return res.status(401).json({ error: tenantValidation.error });
      }
      
      const config = await storage.getMappingConfig(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Mapping config not found" });
      }
      
      if (config.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
      }
      
      if (typeof targetVersion !== "number") {
        return res.status(400).json({ error: "targetVersion is required and must be a number" });
      }

      const result = await mappingEngine.rollbackToVersion(req.params.id, targetVersion);

      if (!result.success) {
        return res.status(400).json({
          error: "Rollback failed",
          errors: result.errors,
        });
      }

      await storage.createAuditLog({
        tenantId: result.data!.tenantId,
        userId: "admin",
        action: "rollback",
        resourceType: "mapping_config",
        resourceId: req.params.id,
        newState: { rolledBackToVersion: targetVersion, newVersion: result.data!.version },
        ipAddress: req.ip || "unknown",
      });

      res.json(result.data);
    } catch (error) {
      res.status(500).json({
        error: "Failed to rollback mapping",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== APPROVAL ROUTES ====================

  // List approvals (with optional filters)
  app.get("/api/approvals", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const status = req.query.status as string | undefined;
      
      const approvalList = await storage.getApprovals(tenantId, status);
      res.json(approvalList);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch approvals",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get pending approvals
  app.get("/api/approvals/pending", async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const pendingApprovals = await storage.getPendingApprovals(tenantId);
      res.json(pendingApprovals);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch pending approvals",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get single approval
  app.get("/api/approvals/:id", async (req, res) => {
    try {
      const approval = await storage.getApproval(req.params.id);
      if (!approval) {
        return res.status(404).json({ error: "Approval not found" });
      }
      res.json(approval);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch approval",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Request approval (create new approval request)
  app.post("/api/approvals", async (req, res) => {
    try {
      const { tenantId, recommendationId, actionType, actionData, requestedBy, comments, policyContext } = req.body;
      
      if (!tenantId || !actionType || !requestedBy) {
        return res.status(400).json({ 
          error: "Missing required fields: tenantId, actionType, and requestedBy are required" 
        });
      }

      const approval = await storage.createApproval({
        tenantId,
        recommendationId,
        actionType,
        actionData,
        requestedBy,
        comments,
        policyContext,
      });

      await storage.createAuditLog({
        tenantId,
        userId: requestedBy,
        action: "request_approval",
        resourceType: "approval",
        resourceId: approval.id,
        newState: {
          actionType,
          status: "pending",
        },
        ipAddress: req.ip || "unknown",
      });

      res.status(201).json(approval);
    } catch (error) {
      res.status(500).json({
        error: "Failed to create approval request",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Update approval (approve/reject)
  app.patch("/api/approvals/:id", async (req, res) => {
    try {
      const approval = await storage.getApproval(req.params.id);
      if (!approval) {
        return res.status(404).json({ error: "Approval not found" });
      }

      if (approval.status !== "pending") {
        return res.status(400).json({ 
          error: "Approval has already been resolved",
          currentStatus: approval.status,
        });
      }

      const { status, approvedBy, comments } = req.body;
      
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ 
          error: "Invalid status. Must be 'approved' or 'rejected'" 
        });
      }

      if (!approvedBy) {
        return res.status(400).json({ 
          error: "approvedBy is required to resolve an approval" 
        });
      }

      const previousStatus = approval.status;
      const updated = await storage.updateApproval(req.params.id, {
        status,
        approvedBy,
        comments: comments || approval.comments,
      });

      await storage.createAuditLog({
        tenantId: approval.tenantId,
        userId: approvedBy,
        action: status === "approved" ? "approve" : "reject",
        resourceType: "approval",
        resourceId: req.params.id,
        previousState: { status: previousStatus },
        newState: { status, approvedBy },
        ipAddress: req.ip || "unknown",
      });

      if (status === "approved" && approval.recommendationId) {
        await storage.updateRecommendation(approval.recommendationId, {
          status: "approved",
          decidedBy: approvedBy,
        });

        await storage.createAuditLog({
          tenantId: approval.tenantId,
          userId: approvedBy,
          action: "execute_recommendation",
          resourceType: "recommendation",
          resourceId: approval.recommendationId,
          previousState: { status: "pending" },
          newState: { status: "approved", approvedViaApprovalId: approval.id },
          ipAddress: req.ip || "unknown",
        });
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({
        error: "Failed to update approval",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== EXECUTION HARD LOCK ====================
  // ===================================================================================
  // SECURITY GUARANTEE:
  // This endpoint is BLOCKED BY DESIGN.
  // The EAL platform operates in DRAFT_ONLY mode.
  // AI recommendations are for human review only - they cannot be auto-executed.
  // This is hardcoded and cannot be changed at runtime or via configuration.
  //
  // Even if someone bypasses UI or calls API directly, execution will fail.
  // NO database mutations occur when this endpoint is called.
  // All attempts are logged to the audit trail for security monitoring.
  // ===================================================================================
  app.post("/api/recommendations/:id/execute", blockAllExecution);

  // Check approval requirement for a recommendation
  app.post("/api/recommendations/:id/check-approval", async (req, res) => {
    try {
      const rec = await storage.getRecommendation(req.params.id);
      if (!rec) {
        return res.status(404).json({ error: "Recommendation not found" });
      }

      const userId = req.body.userId || "anonymous";
      const userRole = req.body.userRole || "viewer";

      const user: User = {
        id: userId,
        username: "anonymous",
        email: null,
        password: "",
        googleId: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        tenantId: rec.tenantId,
        role: userRole,
        platformRole: null,
        createdAt: new Date(),
      };

      const result = await policyEngine.checkApprovalRequired(rec, user, rec.tenantId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: "Failed to check approval requirement",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== SUBSCRIPTION PLANS (Public) ====================
  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get subscription plans",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/subscription-plans/:id", async (req, res) => {
    try {
      const plan = await storage.getSubscriptionPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      res.json(plan);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get subscription plan",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== SUBSCRIPTIONS (Protected) ====================
  app.get("/api/subscriptions", stubAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const subscriptions = await storage.getSubscriptions(user.tenantId);
      res.json(subscriptions);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get subscriptions",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/subscriptions/current", stubAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const subscription = await storage.getSubscriptionByTenant(user.tenantId);
      if (!subscription) {
        return res.json(null);
      }
      const plan = await storage.getSubscriptionPlan(subscription.planId);
      res.json({ ...subscription, plan });
    } catch (error) {
      res.status(500).json({
        error: "Failed to get current subscription",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/subscriptions", stubAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ error: "planId is required" });
      }

      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const subscription = await storage.createSubscription({
        tenantId: user.tenantId,
        planId,
        status: "trial",
        trialEndsAt,
      });

      res.status(201).json(subscription);
    } catch (error) {
      res.status(500).json({
        error: "Failed to create subscription",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== PAYMENTS (Protected) ====================
  app.get("/api/payments", stubAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const payments = await storage.getPayments(user.tenantId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get payments",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/payments/:id", stubAuthMiddleware, async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get payment",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/payments/initiate", stubAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { planId, paymentMethod, token } = req.body;

      if (!planId) {
        return res.status(400).json({ error: "planId is required" });
      }

      if (!paymentMethod || !["mada", "creditcard"].includes(paymentMethod)) {
        return res.status(400).json({ error: "Valid paymentMethod is required (mada or creditcard)" });
      }

      if (!token) {
        return res.status(400).json({ error: "Payment token is required" });
      }

      // Get the subscription plan to determine the amount
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: "Subscription plan not found" });
      }

      // Get or create subscription for this tenant
      let subscription = await storage.getSubscriptionByTenant(user.tenantId);
      if (!subscription) {
        subscription = await storage.createSubscription({
          tenantId: user.tenantId,
          planId: plan.id,
          status: "trial",
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }

      // Create payment record
      const amountInHalalas = plan.priceMonthly; // Already in halalas
      const payment = await storage.createPayment({
        tenantId: user.tenantId,
        subscriptionId: subscription.id,
        amount: amountInHalalas,
        currency: "SAR",
        status: "initiated",
        description: `Subscription: ${plan.name}`,
      });

      // If Moyasar secret key is configured, process payment through Moyasar
      if (process.env.MOYASAR_SECRET_KEY) {
        try {
          const { moyasarClient } = await import("./moyasar");
          
          const callbackUrl = `${process.env.APP_URL || "https://" + process.env.REPL_SLUG + "." + process.env.REPL_OWNER + ".repl.co"}/api/payments/callback`;
          
          // Use token-based payment (PCI-compliant)
          // The token was created client-side via Moyasar's frontend tokenization
          const source = {
            type: "token" as const,
            token: token,
          };

          const moyasarResponse = await moyasarClient.createPayment(
            amountInHalalas,
            "SAR",
            `Atlas Subscription: ${plan.name}`,
            callbackUrl,
            source as any, // Token source type
            {
              tenant_id: user.tenantId,
              payment_id: payment.id,
              plan_id: planId,
            }
          );

          // Update payment with Moyasar ID
          await storage.updatePayment(payment.id, {
            moyasarPaymentId: moyasarResponse.id,
            status: moyasarResponse.status,
          });

          // If 3D Secure is required, return the transaction URL
          if (moyasarResponse.source?.transaction_url) {
            return res.status(200).json({
              paymentId: payment.id,
              status: "pending_3ds",
              redirectUrl: moyasarResponse.source.transaction_url,
            });
          }

          // Payment completed successfully
          if (moyasarResponse.status === "paid") {
            await storage.updatePayment(payment.id, {
              status: "paid",
              paidAt: new Date(),
            });

            // Activate subscription
            const periodEnd = new Date();
            periodEnd.setMonth(periodEnd.getMonth() + 1);
            await storage.updateSubscription(subscription.id, {
              planId: plan.id,
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: periodEnd,
            });

            // Update tenant status
            await storage.updateTenant(user.tenantId, { status: "active" });

            return res.status(200).json({
              paymentId: payment.id,
              status: "paid",
              message: "Payment successful",
            });
          }

          return res.status(200).json({
            paymentId: payment.id,
            status: moyasarResponse.status,
          });
        } catch (moyasarError) {
          console.error("Moyasar payment error:", moyasarError);
          await storage.updatePayment(payment.id, {
            status: "failed",
            failedAt: new Date(),
            failureReason: moyasarError instanceof Error ? moyasarError.message : "Payment processing failed",
          });
          return res.status(400).json({
            error: "Payment processing failed",
            message: moyasarError instanceof Error ? moyasarError.message : "Unknown error",
          });
        }
      } else {
        // No Moyasar key - return payment as initiated (for testing)
        console.log("[Payment] Moyasar not configured, returning simulated response");
        return res.status(200).json({
          paymentId: payment.id,
          status: "initiated",
          message: "Payment initiated (test mode - Moyasar not configured)",
        });
      }
    } catch (error) {
      console.error("Payment initiation error:", error);
      res.status(500).json({
        error: "Failed to initiate payment",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Payment callback for 3D Secure redirect
  // SECURITY: We verify the payment status with Moyasar API, not from query params
  app.get("/api/payments/callback", async (req, res) => {
    try {
      const { id } = req.query;

      if (!id || typeof id !== "string") {
        console.error("[Payment Callback] Missing payment ID");
        return res.redirect("/subscription?payment=error");
      }

      // Find payment by Moyasar ID
      const payment = await storage.getPaymentByMoyasarId(id);
      if (!payment) {
        console.error("[Payment Callback] Payment not found for Moyasar ID:", id);
        return res.redirect("/subscription?payment=error");
      }

      // SECURITY: Verify payment status directly with Moyasar API
      // DO NOT trust query params - always fetch from gateway
      if (process.env.MOYASAR_SECRET_KEY) {
        try {
          const { moyasarClient } = await import("./moyasar");
          const moyasarPayment = await moyasarClient.getPayment(id);

          // Only trust the status from Moyasar's verified response
          if (moyasarPayment.status === "paid") {
            await storage.updatePayment(payment.id, {
              status: "paid",
              paidAt: new Date(),
            });

            // Activate subscription
            if (payment.subscriptionId) {
              const periodEnd = new Date();
              periodEnd.setMonth(periodEnd.getMonth() + 1);
              const subscription = await storage.getSubscription(payment.subscriptionId);
              if (subscription) {
                await storage.updateSubscription(subscription.id, {
                  status: "active",
                  currentPeriodStart: new Date(),
                  currentPeriodEnd: periodEnd,
                });
                await storage.updateTenant(payment.tenantId, { status: "active" });

                // Audit log for successful payment
                await storage.createAuditLog({
                  tenantId: payment.tenantId,
                  action: "payment_verified",
                  resourceType: "payment",
                  resourceId: payment.id,
                  metadata: { moyasarId: id, status: "paid", verified: true },
                  ipAddress: req.ip || "unknown",
                });
              }
            }

            return res.redirect("/subscription?payment=success");
          } else if (moyasarPayment.status === "failed") {
            await storage.updatePayment(payment.id, {
              status: "failed",
              failedAt: new Date(),
              failureReason: moyasarPayment.source?.message || "Payment failed",
            });
            return res.redirect("/subscription?payment=failed");
          } else {
            // Payment still processing or in another state
            console.log("[Payment Callback] Payment in status:", moyasarPayment.status);
            return res.redirect("/subscription?payment=pending");
          }
        } catch (verifyError) {
          console.error("[Payment Callback] Verification failed:", verifyError);
          // If we can't verify, don't activate - redirect with error
          return res.redirect("/subscription?payment=error");
        }
      } else {
        // No Moyasar key - testing mode, just redirect
        console.log("[Payment Callback] Test mode - Moyasar not configured");
        return res.redirect("/subscription?payment=error");
      }
    } catch (error) {
      console.error("Payment callback error:", error);
      res.redirect("/subscription?payment=error");
    }
  });

  // ==================== MOYASAR WEBHOOK ====================
  app.post("/api/webhooks/moyasar", async (req, res) => {
    try {
      const { id, status, amount, metadata } = req.body;

      if (!id) {
        return res.status(400).json({ error: "Missing payment id" });
      }

      const payment = await storage.getPaymentByMoyasarId(id);
      if (!payment) {
        console.log("Webhook received for unknown payment:", id);
        return res.status(200).json({ received: true });
      }

      const updates: any = { status };
      if (status === "paid") {
        updates.paidAt = new Date();
        
        if (payment.subscriptionId) {
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          await storage.updateSubscription(payment.subscriptionId, {
            status: "active",
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
          });
        }
      } else if (status === "failed") {
        updates.failedAt = new Date();
        updates.failureReason = req.body.message || "Payment failed";
      }

      await storage.updatePayment(payment.id, updates);

      await storage.createAuditLog({
        tenantId: payment.tenantId,
        action: "webhook_received",
        resourceType: "payment",
        resourceId: payment.id,
        metadata: { moyasarId: id, status, amount },
        ipAddress: req.ip || "unknown",
      });

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ==================== ADMIN: CUSTOMER MANAGEMENT ====================
  // SECURITY: Platform admin routes require platformRole === "platform_admin"
  // This is separate from tenant-level admin role for zero-trust isolation
  app.get("/api/admin/tenants", stubAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.platformRole !== "platform_admin") {
        return res.status(403).json({ error: "Platform admin access required" });
      }

      const tenants = await storage.getTenants();
      const tenantsWithSubscriptions = await Promise.all(
        tenants.map(async (tenant) => {
          const subscription = await storage.getSubscriptionByTenant(tenant.id);
          const plan = subscription ? await storage.getSubscriptionPlan(subscription.planId) : null;
          return {
            ...tenant,
            subscription: subscription ? { ...subscription, plan } : null,
          };
        })
      );

      res.json(tenantsWithSubscriptions);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get tenants",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.patch("/api/admin/tenants/:id/status", stubAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.platformRole !== "platform_admin") {
        return res.status(403).json({ error: "Platform admin access required" });
      }

      const { status } = req.body;
      if (!status || !["active", "suspended", "onboarding"].includes(status)) {
        return res.status(400).json({ error: "Valid status required (active, suspended, onboarding)" });
      }

      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const updated = await db.update(tenants)
        .set({ status })
        .where(eq(tenants.id, req.params.id))
        .returning();

      await storage.createAuditLog({
        tenantId: req.params.id,
        userId: user.id,
        action: "update_tenant_status",
        resourceType: "tenant",
        resourceId: req.params.id,
        previousState: { status: tenant.status },
        newState: { status },
        ipAddress: req.ip || "unknown",
      });

      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({
        error: "Failed to update tenant status",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Admin: Seed default subscription plans
  app.post("/api/admin/seed-plans", stubAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.platformRole !== "platform_admin") {
        return res.status(403).json({ error: "Platform admin access required" });
      }

      const existingPlans = await storage.getSubscriptionPlans();
      if (existingPlans.length > 0) {
        return res.json({ message: "Plans already exist", plans: existingPlans });
      }

      const plans = [
        {
          name: "Basic",
          nameAr: "الأساسية",
          description: "Perfect for small businesses getting started",
          descriptionAr: "مثالية للشركات الصغيرة في البداية",
          priceMonthly: 299,
          priceCurrency: "SAR",
          features: ["1 Connector", "1 User", "100 Items", "Email Support"],
          featuresAr: ["موصل واحد", "مستخدم واحد", "100 منتج", "دعم بالبريد"],
          maxConnectors: 1,
          maxUsers: 1,
          maxItems: 100,
          aiRecommendations: false,
          prioritySupport: false,
          sortOrder: 1,
        },
        {
          name: "Professional",
          nameAr: "الاحترافية",
          description: "For growing businesses with advanced needs",
          descriptionAr: "للشركات النامية ذات الاحتياجات المتقدمة",
          priceMonthly: 799,
          priceCurrency: "SAR",
          features: ["5 Connectors", "5 Users", "1000 Items", "AI Recommendations", "Priority Support"],
          featuresAr: ["5 موصلات", "5 مستخدمين", "1000 منتج", "توصيات الذكاء الاصطناعي", "دعم أولوية"],
          maxConnectors: 5,
          maxUsers: 5,
          maxItems: 1000,
          aiRecommendations: true,
          prioritySupport: true,
          sortOrder: 2,
        },
        {
          name: "Enterprise",
          nameAr: "المؤسسية",
          description: "Unlimited access for large organizations",
          descriptionAr: "وصول غير محدود للمؤسسات الكبيرة",
          priceMonthly: 1999,
          priceCurrency: "SAR",
          features: ["Unlimited Connectors", "Unlimited Users", "Unlimited Items", "AI Recommendations", "Dedicated Support", "SLA Guarantee"],
          featuresAr: ["موصلات غير محدودة", "مستخدمين غير محدودين", "منتجات غير محدودة", "توصيات الذكاء الاصطناعي", "دعم مخصص", "ضمان SLA"],
          maxConnectors: 999,
          maxUsers: 999,
          maxItems: 999999,
          aiRecommendations: true,
          prioritySupport: true,
          sortOrder: 3,
        },
      ];

      const createdPlans = [];
      for (const plan of plans) {
        const created = await storage.createSubscriptionPlan(plan);
        createdPlans.push(created);
      }

      res.status(201).json({ message: "Plans created", plans: createdPlans });
    } catch (error) {
      res.status(500).json({
        error: "Failed to seed plans",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== ONBOARDING ====================
  // Apply isAuthenticated middleware to onboarding routes (ensures domain user is provisioned)
  app.use('/api/onboarding', isAuthenticated);
  app.use('/api/features', isAuthenticated);
  
  // Get current tenant onboarding status
  app.get("/api/onboarding/status", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.tenantId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Calculate trial days remaining if applicable
      let trialDaysRemaining = null;
      let trialExpired = false;
      if (tenant.trialEndsAt) {
        const now = new Date();
        const trialEnd = new Date(tenant.trialEndsAt);
        const diffTime = trialEnd.getTime() - now.getTime();
        trialDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        trialExpired = trialDaysRemaining < 0;
      }

      res.json({
        onboardingCompleted: tenant.onboardingCompleted,
        companySize: tenant.companySize,
        selectedUseCase: tenant.selectedUseCase,
        allowedFeatures: tenant.allowedFeatures,
        trialEndsAt: tenant.trialEndsAt,
        trialDaysRemaining,
        trialExpired,
        status: tenant.status,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to get onboarding status",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Complete onboarding
  app.post("/api/onboarding/complete", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.tenantId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { companySize, selectedUseCase, planId } = req.body;

      if (!companySize || !selectedUseCase) {
        return res.status(400).json({
          error: "Missing required fields: companySize and selectedUseCase are required",
        });
      }

      // Get allowed features for the selected use case
      const allowedFeatures = useCaseFeatures[selectedUseCase as keyof typeof useCaseFeatures] || [];

      // Calculate trial end date - BOTH Enterprise and SMB get 7-day trial
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      const trialEndsAt = trialEnd;
      const status = "active"; // Will be set to trial_expired by cron if expired

      // Update tenant with onboarding data
      const updatedTenant = await db
        .update(tenants)
        .set({
          companySize,
          selectedUseCase,
          allowedFeatures,
          onboardingCompleted: true,
          trialEndsAt,
          status,
        })
        .where(eq(tenants.id, user.tenantId))
        .returning();

      if (updatedTenant.length === 0) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // If small business with plan selected, create subscription
      if (companySize === "small" && planId) {
        const plan = await storage.getSubscriptionPlan(planId);
        if (plan) {
          await storage.createSubscription({
            tenantId: user.tenantId,
            planId,
            status: "active",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });
        }
      }

      // Log to audit
      await storage.createAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        eventType: "action_executed",
        action: "complete_onboarding",
        resourceType: "tenant",
        resourceId: user.tenantId,
        newState: {
          companySize,
          selectedUseCase,
          allowedFeatures,
        },
      });

      res.json({
        success: true,
        tenant: updatedTenant[0],
        message: companySize === "enterprise" 
          ? "Trial started successfully! You have 7 days to explore the platform."
          : "Account setup complete!",
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to complete onboarding",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Request meeting (for enterprise trial expiry)
  app.post("/api/onboarding/request-meeting", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.tenantId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { contactName, contactEmail, contactPhone, preferredDate, notes } = req.body;

      if (!contactName || !contactEmail) {
        return res.status(400).json({
          error: "Missing required fields: contactName and contactEmail are required",
        });
      }

      // Create meeting request
      const [meetingRequest] = await db
        .insert(meetingRequests)
        .values({
          tenantId: user.tenantId,
          requestedBy: user.id,
          contactName,
          contactEmail,
          contactPhone,
          preferredDate: preferredDate ? new Date(preferredDate) : null,
          notes,
          status: "pending",
        })
        .returning();

      // Log to audit
      await storage.createAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        eventType: "action_executed",
        action: "request_meeting",
        resourceType: "meeting_request",
        resourceId: meetingRequest.id,
        newState: {
          contactName,
          contactEmail,
          status: "pending",
        },
      });

      res.status(201).json({
        success: true,
        meetingRequest,
        message: "Meeting request submitted successfully. Our team will contact you shortly.",
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to submit meeting request",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get meeting requests for a tenant
  app.get("/api/onboarding/meeting-requests", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.tenantId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const requests = await db
        .select()
        .from(meetingRequests)
        .where(eq(meetingRequests.tenantId, user.tenantId));

      res.json(requests);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get meeting requests",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Admin: Get all meeting requests (platform admin only)
  app.get("/api/admin/meeting-requests", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || user.platformRole !== "platform_admin") {
        return res.status(403).json({ error: "Platform admin privileges required" });
      }

      const requests = await db
        .select()
        .from(meetingRequests);

      res.json(requests);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get meeting requests",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Admin: Update meeting request status (platform admin only)
  app.patch("/api/admin/meeting-requests/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || user.platformRole !== "platform_admin") {
        return res.status(403).json({ error: "Platform admin privileges required" });
      }

      const { status, scheduledAt, adminNotes } = req.body;

      const updateData: any = {};
      if (status) updateData.status = status;
      if (scheduledAt) updateData.scheduledAt = new Date(scheduledAt);
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      if (status === "completed") updateData.completedAt = new Date();

      const [updated] = await db
        .update(meetingRequests)
        .set(updateData)
        .where(eq(meetingRequests.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Meeting request not found" });
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({
        error: "Failed to update meeting request",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== FEATURE ACCESS CHECK ====================
  // Middleware to check if tenant has access to a feature
  app.get("/api/features/check/:feature", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.tenantId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const feature = req.params.feature;
      const allowedFeatures = (tenant.allowedFeatures as string[]) || [];
      
      // Check if trial has expired for enterprise
      let trialExpired = false;
      if (tenant.companySize === "enterprise" && tenant.trialEndsAt) {
        trialExpired = new Date(tenant.trialEndsAt) < new Date();
      }

      const hasAccess = !trialExpired && (allowedFeatures.length === 0 || allowedFeatures.includes(feature));

      res.json({
        feature,
        hasAccess,
        trialExpired,
        reason: trialExpired ? "trial_expired" : hasAccess ? "allowed" : "not_in_plan",
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to check feature access",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== PRODUCTIVITY SKILLS ====================

  // Get all productivity skills for tenant
  app.get("/api/productivity-skills", isAuthenticated, async (req: Request, res: Response) => {
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
  app.get("/api/productivity-skills/templates", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      res.json(defaultProductivitySkills);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch skill templates" });
    }
  });

  // Seed default skills for tenant
  app.post("/api/productivity-skills/seed", isAuthenticated, async (req: Request, res: Response) => {
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
  app.get("/api/productivity-skills/progress", isAuthenticated, async (req: Request, res: Response) => {
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
  app.post("/api/productivity-skills/:skillId/progress", isAuthenticated, async (req: Request, res: Response) => {
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
            updatedAt: new Date(),
          })
          .where(eq(userSkillProgressTable.id, existingProgress.id))
          .returning();
        return res.json(updated);
      }

      const [created] = await db.insert(userSkillProgressTable).values({
        userId,
        skillId,
        tenantId,
        status: status || "in_progress",
        completedSteps: completedSteps || [],
        progressPercent: progressPercent || 0,
        notes,
        startedAt: new Date(),
      }).returning();
      res.json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to update skill progress", message: error instanceof Error ? error.message : "Unknown error" });
    }
  });
}
