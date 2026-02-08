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

// Export helper functions for use by route modules
export { buildPolicyContextFromResource, getSecureTenantId, getAuthenticatedTenant, getAuthenticatedUserId, stubAuthMiddleware };

// Import route modules
import connectorRoutes from "./routes/connector-routes";
import recommendationRoutes from "./routes/recommendation-routes";
import aiRoutes from "./routes/ai-routes";
import policyRoutes from "./routes/policy-routes";
import mappingRoutes from "./routes/mapping-routes";
import approvalRoutes from "./routes/approval-routes";
import subscriptionRoutes from "./routes/subscription-routes";
import adminRoutes from "./routes/admin-routes";
import inventoryRoutes from "./routes/inventory-routes";
import skillRoutes from "./routes/skill-routes";
import onboardingRoutes from "./routes/onboarding-routes";

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

  // Apply isAuthenticated middleware to onboarding and features routes
  app.use('/api/onboarding', isAuthenticated);
  app.use('/api/features', isAuthenticated);
  app.use('/api/productivity-skills', isAuthenticated);

  // ===================================================================================
  // MOUNT ROUTE MODULES
  // ===================================================================================
  app.use("/api/connectors", connectorRoutes);
  app.use("/api/recommendations", recommendationRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/policies", policyRoutes);
  app.use("/api", mappingRoutes); // Handles /api/mappings and /api/mapping-configs
  app.use("/api/approvals", approvalRoutes);
  app.use("/api", subscriptionRoutes); // Handles /api/subscription-plans, /api/subscriptions, /api/payments, /api/webhooks
  app.use("/api", adminRoutes); // Handles /api/admin/*
  app.use("/api", inventoryRoutes); // Handles /api/items, /api/locations, /api/endpoints
  app.use("/api/productivity-skills", skillRoutes);
  app.use("/api/onboarding", onboardingRoutes);

  // ===================================================================================
  // STANDALONE ROUTES (not in any module)
  // ===================================================================================
  
  // Settings - Environment
  app.get("/api/settings/environment", (req, res) => {
    const nodeEnv = process.env.NODE_ENV || "development";
    let environment: "production" | "staging" | "development" = "development";
    if (nodeEnv === "production") {
      environment = "production";
    } else if (nodeEnv === "staging") {
      environment = "staging";
    }
    res.json({ 
      environment, 
      executionMode: EXECUTION_MODE,
      nodeEnv 
    });
  });

  // Tenant
  app.get("/api/tenant", stubAuthMiddleware, async (req, res) => {
    const user = (req as any).user;
    if (!user?.tenantId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const tenant = await storage.getTenant(user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json(tenant);
  });

  // Stats
  app.get("/api/stats", async (req, res) => {
    const tenantId = (req.query.tenantId as string) || "default";
    const connectors = await storage.getConnectors(tenantId);
    const recommendations = await storage.getRecommendations(tenantId);
    const anomalies = await storage.getAnomalies(tenantId);
    res.json({
      connectors: connectors.length,
      recommendations: recommendations.length,
      anomalies: anomalies.length,
    });
  });

  // Audit Logs
  app.get("/api/audit-logs", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const logs = await storage.getAuditLogs(undefined, limit, offset);
    res.json(logs);
  });

  // Capabilities
  app.get("/api/capabilities", async (req, res) => {
    const connectorId = req.query.connector as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const capabilities = await storage.getCapabilities(connectorId, limit, offset);
    res.json(capabilities);
  });

  // Feature access check
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
}
