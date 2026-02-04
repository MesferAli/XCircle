import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp, real, bigserial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models (sessions, authIdentities)
export * from "./models/auth";

// ==================== USE CASE TYPES ====================
export const useCaseTypes = [
  "inventory",
  "supply_chain", 
  "hr",
  "sales",
  "operations",
] as const;
export type UseCaseType = typeof useCaseTypes[number];

export const companySizeTypes = ["smb", "enterprise"] as const;
export type CompanySizeType = typeof companySizeTypes[number];

// ==================== TENANTS ====================
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"), // active, suspended, onboarding, trial_expired
  companySize: text("company_size"), // small, enterprise
  selectedUseCase: text("selected_use_case"), // inventory, supply_chain, hr, sales, operations
  allowedFeatures: jsonb("allowed_features").default([]), // List of feature keys the tenant can access
  onboardingCompleted: boolean("onboarding_completed").default(false),
  trialEndsAt: timestamp("trial_ends_at"), // For enterprise: 7-day trial end date
  trialReminderSent: boolean("trial_reminder_sent").default(false), // Track if expiry email sent
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenants).pick({
  name: true,
  status: true,
  companySize: true,
  selectedUseCase: true,
  allowedFeatures: true,
  onboardingCompleted: true,
  trialEndsAt: true,
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// ==================== MEETING REQUESTS (Enterprise Renewal) ====================
export const meetingRequests = pgTable("meeting_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  requestedBy: varchar("requested_by"), // User who requested the meeting
  contactEmail: text("contact_email").notNull(),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone"),
  preferredDate: timestamp("preferred_date"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending, scheduled, completed, cancelled
  scheduledAt: timestamp("scheduled_at"), // When the meeting was actually scheduled
  completedAt: timestamp("completed_at"),
  adminNotes: text("admin_notes"), // Notes from platform admin after meeting
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetingRequestStatuses = ["pending", "scheduled", "completed", "cancelled"] as const;
export type MeetingRequestStatus = typeof meetingRequestStatuses[number];

export const insertMeetingRequestSchema = createInsertSchema(meetingRequests).pick({
  tenantId: true,
  requestedBy: true,
  contactEmail: true,
  contactName: true,
  contactPhone: true,
  preferredDate: true,
  notes: true,
});

export type InsertMeetingRequest = z.infer<typeof insertMeetingRequestSchema>;
export type MeetingRequest = typeof meetingRequests.$inferSelect;

// ==================== USERS ====================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  password: text("password"), // Null for OAuth-only users
  googleId: text("google_id").unique(), // Google OAuth ID
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  tenantId: varchar("tenant_id"),
  role: text("role").notNull().default("viewer"), // admin, operator, viewer (tenant-level role)
  platformRole: text("platform_role"), // platform_admin for super-admin capabilities, null for regular users
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  googleId: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  tenantId: true,
  role: true,
  platformRole: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ==================== CONNECTORS ====================
export const connectors = pgTable("connectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("rest"), // rest, oracle, zoho, erpnext
  baseUrl: text("base_url").notNull(),
  authType: text("auth_type").notNull(), // api_key, oauth2_client_credentials, bearer, basic
  authConfig: jsonb("auth_config"), // encrypted credentials reference
  status: text("status").notNull().default("pending"), // pending, connected, error, disabled
  healthCheckEndpoint: text("health_check_endpoint"),
  lastHealthCheck: timestamp("last_health_check"),
  requestsPerMinute: integer("requests_per_minute").default(60),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConnectorSchema = createInsertSchema(connectors).pick({
  tenantId: true,
  name: true,
  type: true,
  baseUrl: true,
  authType: true,
  authConfig: true,
  healthCheckEndpoint: true,
});

export type InsertConnector = z.infer<typeof insertConnectorSchema>;
export type Connector = typeof connectors.$inferSelect;

// ==================== ENDPOINTS ====================
export const endpoints = pgTable("endpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectorId: varchar("connector_id").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  method: text("method").notNull().default("GET"),
  description: text("description"),
  capability: text("capability"), // read, write, draft
  isEnabled: boolean("is_enabled").default(true),
  paginationConfig: jsonb("pagination_config"), // { type: cursor|offset|page|time_window, ... }
  dataPath: text("data_path"), // JSONPath to extract data from response
  lastPolledAt: timestamp("last_polled_at"),
  lastPollStatus: text("last_poll_status"), // success, error
  lastCursor: text("last_cursor"), // cursor for pagination
});

export const insertEndpointSchema = createInsertSchema(endpoints).pick({
  connectorId: true,
  name: true,
  path: true,
  method: true,
  description: true,
  capability: true,
  paginationConfig: true,
  dataPath: true,
});

export type InsertEndpoint = z.infer<typeof insertEndpointSchema>;
export type Endpoint = typeof endpoints.$inferSelect;

// ==================== MAPPINGS ====================
export const mappings = pgTable("mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectorId: varchar("connector_id").notNull(),
  name: text("name").notNull(),
  sourceEndpoint: text("source_endpoint").notNull(),
  targetEntity: text("target_entity").notNull(), // item, location, stock_balance, etc.
  mappingConfig: jsonb("mapping_config").notNull(), // JSONPath mappings
  transformations: jsonb("transformations"), // type conversions, math, enums
  version: integer("version").default(1),
  status: text("status").notNull().default("draft"), // draft, active, archived
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMappingSchema = createInsertSchema(mappings).pick({
  connectorId: true,
  name: true,
  sourceEndpoint: true,
  targetEntity: true,
  mappingConfig: true,
  transformations: true,
});

export type InsertMapping = z.infer<typeof insertMappingSchema>;
export type Mapping = typeof mappings.$inferSelect;

// ==================== CANONICAL INVENTORY MODEL ====================

// Items (Products/SKUs)
export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  externalId: text("external_id"),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  unit: text("unit").default("each"),
  reorderPoint: integer("reorder_point"),
  reorderQuantity: integer("reorder_quantity"),
  leadTimeDays: integer("lead_time_days"),
  isActive: boolean("is_active").default(true),
});

export const insertItemSchema = createInsertSchema(items).pick({
  tenantId: true,
  externalId: true,
  sku: true,
  name: true,
  description: true,
  category: true,
  unit: true,
  reorderPoint: true,
  reorderQuantity: true,
  leadTimeDays: true,
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// Locations (Warehouses/Stores)
export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  externalId: text("external_id"),
  name: text("name").notNull(),
  type: text("type").notNull(), // warehouse, store, distribution_center
  address: text("address"),
  isActive: boolean("is_active").default(true),
});

export const insertLocationSchema = createInsertSchema(locations).pick({
  tenantId: true,
  externalId: true,
  name: true,
  type: true,
  address: true,
});

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

// Stock Balances
export const stockBalances = pgTable("stock_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  itemId: varchar("item_id").notNull(),
  locationId: varchar("location_id").notNull(),
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  quantityReserved: integer("quantity_reserved").default(0),
  quantityAvailable: integer("quantity_available").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertStockBalanceSchema = createInsertSchema(stockBalances).pick({
  tenantId: true,
  itemId: true,
  locationId: true,
  quantityOnHand: true,
  quantityReserved: true,
  quantityAvailable: true,
});

export type InsertStockBalance = z.infer<typeof insertStockBalanceSchema>;
export type StockBalance = typeof stockBalances.$inferSelect;

// Stock Movements
export const stockMovements = pgTable("stock_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  itemId: varchar("item_id").notNull(),
  locationId: varchar("location_id").notNull(),
  movementType: text("movement_type").notNull(), // in, out, transfer, adjustment
  quantity: integer("quantity").notNull(),
  referenceId: text("reference_id"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertStockMovementSchema = createInsertSchema(stockMovements).pick({
  tenantId: true,
  itemId: true,
  locationId: true,
  movementType: true,
  quantity: true,
  referenceId: true,
});

export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

// Demand Signals
export const demandSignals = pgTable("demand_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  itemId: varchar("item_id").notNull(),
  locationId: varchar("location_id"),
  signalType: text("signal_type").notNull(), // order, forecast, trend
  quantity: integer("quantity").notNull(),
  date: timestamp("date").notNull(),
  confidence: real("confidence"),
});

export const insertDemandSignalSchema = createInsertSchema(demandSignals).pick({
  tenantId: true,
  itemId: true,
  locationId: true,
  signalType: true,
  quantity: true,
  date: true,
  confidence: true,
});

export type InsertDemandSignal = z.infer<typeof insertDemandSignalSchema>;
export type DemandSignal = typeof demandSignals.$inferSelect;

// ==================== AI RECOMMENDATIONS ====================
export const recommendations = pgTable("recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  type: text("type").notNull(), // reorder, transfer, adjustment, alert
  priority: text("priority").notNull(), // critical, high, medium, low
  itemId: varchar("item_id"),
  locationId: varchar("location_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  explanation: text("explanation").notNull(), // AI explainability
  confidenceScore: real("confidence_score").notNull(),
  suggestedAction: jsonb("suggested_action"), // action details
  status: text("status").notNull().default("pending"), // pending, approved, rejected, deferred
  createdAt: timestamp("created_at").defaultNow(),
  decidedAt: timestamp("decided_at"),
  decidedBy: varchar("decided_by"),
});

export const insertRecommendationSchema = createInsertSchema(recommendations).pick({
  tenantId: true,
  type: true,
  priority: true,
  itemId: true,
  locationId: true,
  title: true,
  description: true,
  explanation: true,
  confidenceScore: true,
  suggestedAction: true,
});

export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Recommendation = typeof recommendations.$inferSelect;

// Anomalies
export const anomalies = pgTable("anomalies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  itemId: varchar("item_id"),
  locationId: varchar("location_id"),
  type: text("type").notNull(), // demand_spike, stock_discrepancy, unusual_movement
  severity: text("severity").notNull(), // critical, high, medium, low
  title: text("title").notNull(),
  description: text("description").notNull(),
  detectedValue: real("detected_value"),
  expectedValue: real("expected_value"),
  deviation: real("deviation"),
  status: text("status").notNull().default("open"), // open, investigating, resolved, dismissed
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnomalySchema = createInsertSchema(anomalies).pick({
  tenantId: true,
  itemId: true,
  locationId: true,
  type: true,
  severity: true,
  title: true,
  description: true,
  detectedValue: true,
  expectedValue: true,
  deviation: true,
});

export type InsertAnomaly = z.infer<typeof insertAnomalySchema>;
export type Anomaly = typeof anomalies.$inferSelect;

// ==================== POLICIES ====================
export const policies = pgTable("policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // approval_workflow, action_limit, environment_restriction, schedule_restriction, blast_radius
  enabled: boolean("enabled").default(true),
  priority: integer("priority").notNull().default(100), // Lower = higher priority
  conditions: jsonb("conditions").notNull().default([]), // PolicyCondition[]
  actions: jsonb("actions").notNull().default([]), // PolicyAction[]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPolicySchema = createInsertSchema(policies).pick({
  tenantId: true,
  name: true,
  description: true,
  type: true,
  enabled: true,
  priority: true,
  conditions: true,
  actions: true,
});

export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Policy = typeof policies.$inferSelect;

// Policy Condition Schema
export const policyConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "notEquals", "contains", "gt", "lt", "gte", "lte", "in", "notIn"]),
  value: z.unknown(),
});

export type PolicyCondition = z.infer<typeof policyConditionSchema>;

// Policy Action Schema
export const policyActionSchema = z.object({
  type: z.enum(["require_approval", "reject", "allow", "notify", "require_dry_run", "limit_quantity"]),
  config: z.record(z.unknown()).optional(),
});

export type PolicyAction = z.infer<typeof policyActionSchema>;

// ==================== APPROVALS ====================
export const approvals = pgTable("approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  recommendationId: varchar("recommendation_id"),
  actionType: text("action_type").notNull(), // execute_recommendation, create_order, update_stock
  actionData: jsonb("action_data"), // The action details for approval
  requestedBy: varchar("requested_by").notNull(),
  approvedBy: varchar("approved_by"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  requestedAt: timestamp("requested_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  comments: text("comments"),
  policyContext: jsonb("policy_context"), // The context that triggered approval requirement
});

export const insertApprovalSchema = createInsertSchema(approvals).pick({
  tenantId: true,
  recommendationId: true,
  actionType: true,
  actionData: true,
  requestedBy: true,
  comments: true,
  policyContext: true,
});

export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvals.$inferSelect;

// Policy Context Schema (for evaluation)
export const policyContextSchema = z.object({
  tenantId: z.string(),
  userId: z.string(),
  userRole: z.string(),
  action: z.object({
    type: z.string(),
    targetType: z.string(),
    targetId: z.string().optional(),
    data: z.record(z.unknown()),
  }),
  recommendation: z.object({
    id: z.string(),
    type: z.string(),
    priority: z.string(),
    confidenceScore: z.number(),
  }).optional(),
  environment: z.enum(["production", "staging", "development"]),
  requestTime: z.date(),
});

export type PolicyContext = z.infer<typeof policyContextSchema>;

// Policy Result Schema
export const policyViolationSchema = z.object({
  policyId: z.string(),
  policyName: z.string(),
  message: z.string(),
  severity: z.enum(["error", "warning"]),
});

export type PolicyViolation = z.infer<typeof policyViolationSchema>;

export const policyResultSchema = z.object({
  allowed: z.boolean(),
  requiresApproval: z.boolean(),
  requiresDryRun: z.boolean(),
  violations: z.array(policyViolationSchema),
  appliedPolicies: z.array(z.string()),
  explanation: z.string(),
});

export type PolicyResult = z.infer<typeof policyResultSchema>;

// ==================== AUDIT LOGS (Immutable Audit Engine) ====================
// This is an append-only event store for compliance and traceability
// NO UPDATE or DELETE operations allowed on audit logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sequenceNumber: bigserial("sequence_number", { mode: "number" }).notNull().unique(), // Ordering and integrity verification
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id"),
  eventType: text("event_type").notNull().default("action_executed"), // signal_received, decision_generated, policy_evaluated, approval_requested, approval_resolved, action_executed, action_blocked
  action: text("action").notNull(), // create, update, delete, approve, reject, login, etc.
  resourceType: text("resource_type").notNull(), // connector, mapping, recommendation, policy, etc.
  resourceId: varchar("resource_id"),
  correlationId: varchar("correlation_id"), // Tracing related events across a workflow
  parentEventId: varchar("parent_event_id"), // Link to parent event for hierarchical tracing
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  metadata: jsonb("metadata"), // additional context
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Event types for categorization
export const auditEventTypes = [
  "signal_received",
  "decision_generated",
  "policy_evaluated",
  "approval_requested",
  "approval_resolved",
  "action_executed",
  "action_blocked",
] as const;

export type AuditEventType = typeof auditEventTypes[number];

export const insertAuditLogSchema = createInsertSchema(auditLogs).pick({
  tenantId: true,
  userId: true,
  action: true,
  resourceType: true,
  resourceId: true,
  previousState: true,
  newState: true,
  metadata: true,
  ipAddress: true,
}).extend({
  // Make these optional - database provides defaults
  eventType: z.string().optional(),
  correlationId: z.string().optional(),
  parentEventId: z.string().optional(),
});

// Filter schema for querying audit logs
export const auditLogFilterSchema = z.object({
  eventType: z.string().optional(),
  resourceType: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  userId: z.string().optional(),
});

export type AuditLogFilters = z.infer<typeof auditLogFilterSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ==================== CAPABILITY DISCOVERY ====================
export const discoveredCapabilities = pgTable("discovered_capabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectorId: varchar("connector_id").notNull(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  capability: text("capability").notNull(), // read, list, create_draft, update_draft
  isSupported: boolean("is_supported").default(false),
  sampleResponse: jsonb("sample_response"),
  discoveredAt: timestamp("discovered_at").defaultNow(),
});

export const insertDiscoveredCapabilitySchema = createInsertSchema(discoveredCapabilities).pick({
  connectorId: true,
  endpoint: true,
  method: true,
  capability: true,
  isSupported: true,
  sampleResponse: true,
});

export type InsertDiscoveredCapability = z.infer<typeof insertDiscoveredCapabilitySchema>;
export type DiscoveredCapability = typeof discoveredCapabilities.$inferSelect;

// ==================== ONBOARDING STATE ====================
export const onboardingState = pgTable("onboarding_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().unique(),
  currentStep: integer("current_step").notNull().default(1),
  completedSteps: jsonb("completed_steps").default([]),
  connectorId: varchar("connector_id"),
  status: text("status").notNull().default("in_progress"), // in_progress, completed, abandoned
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertOnboardingStateSchema = createInsertSchema(onboardingState).pick({
  tenantId: true,
  currentStep: true,
  completedSteps: true,
  connectorId: true,
  status: true,
});

export type InsertOnboardingState = z.infer<typeof insertOnboardingStateSchema>;
export type OnboardingState = typeof onboardingState.$inferSelect;

// ==================== MAPPING CONFIGS ====================
export const mappingConfigs = pgTable("mapping_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  connectorId: varchar("connector_id").notNull(),
  endpointId: varchar("endpoint_id"),
  name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  sourceType: text("source_type").notNull(), // items, locations, stock_balances, stock_movements
  targetEntity: text("target_entity").notNull(), // items, locations, stockBalances, stockMovements
  fieldMappings: jsonb("field_mappings").notNull(), // FieldMapping[]
  arrayPath: text("array_path"), // JSONPath to array of records
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMappingConfigSchema = createInsertSchema(mappingConfigs).pick({
  tenantId: true,
  connectorId: true,
  endpointId: true,
  name: true,
  sourceType: true,
  targetEntity: true,
  fieldMappings: true,
  arrayPath: true,
});

export type InsertMappingConfig = z.infer<typeof insertMappingConfigSchema>;
export type MappingConfig = typeof mappingConfigs.$inferSelect;

// ==================== MAPPING HISTORY ====================
export const mappingHistory = pgTable("mapping_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mappingConfigId: varchar("mapping_config_id").notNull(),
  version: integer("version").notNull(),
  fieldMappings: jsonb("field_mappings").notNull(),
  arrayPath: text("array_path"),
  changedBy: varchar("changed_by"),
  changeReason: text("change_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMappingHistorySchema = createInsertSchema(mappingHistory).pick({
  mappingConfigId: true,
  version: true,
  fieldMappings: true,
  arrayPath: true,
  changedBy: true,
  changeReason: true,
});

export type InsertMappingHistory = z.infer<typeof insertMappingHistorySchema>;
export type MappingHistory = typeof mappingHistory.$inferSelect;

// ==================== FIELD MAPPING TYPES ====================
export const fieldMappingSchema = z.object({
  sourceField: z.string(),
  targetField: z.string(),
  transform: z.enum(["toString", "toNumber", "toDate", "uppercase", "lowercase", "trim"]).optional(),
  defaultValue: z.unknown().optional(),
  required: z.boolean().optional(),
});

export type FieldMapping = z.infer<typeof fieldMappingSchema>;

export const mappingConfigPayloadSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  version: z.number().optional(),
  sourceType: z.enum(["items", "locations", "stock_balances", "stock_movements"]),
  targetEntity: z.enum(["items", "locations", "stockBalances", "stockMovements"]),
  fieldMappings: z.array(fieldMappingSchema),
  arrayPath: z.string().optional(),
});

export type MappingConfigPayload = z.infer<typeof mappingConfigPayloadSchema>;

// ==================== SUBSCRIPTION PLANS ====================
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  priceMonthly: integer("price_monthly").notNull(),
  priceCurrency: text("price_currency").notNull().default("SAR"),
  features: jsonb("features").default([]),
  featuresAr: jsonb("features_ar").default([]),
  maxConnectors: integer("max_connectors").default(1),
  maxUsers: integer("max_users").default(1),
  maxItems: integer("max_items").default(100),
  aiRecommendations: boolean("ai_recommendations").default(false),
  prioritySupport: boolean("priority_support").default(false),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).pick({
  name: true,
  nameAr: true,
  description: true,
  descriptionAr: true,
  priceMonthly: true,
  priceCurrency: true,
  features: true,
  featuresAr: true,
  maxConnectors: true,
  maxUsers: true,
  maxItems: true,
  aiRecommendations: true,
  prioritySupport: true,
  sortOrder: true,
});

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// ==================== SUBSCRIPTIONS ====================
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  planId: varchar("plan_id").notNull(),
  status: text("status").notNull().default("trial"),
  currentPeriodStart: timestamp("current_period_start").defaultNow(),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  moyasarSubscriptionId: text("moyasar_subscription_id"),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subscriptionStatuses = ["trial", "active", "past_due", "cancelled", "expired"] as const;
export type SubscriptionStatus = typeof subscriptionStatuses[number];

export const insertSubscriptionSchema = createInsertSchema(subscriptions).pick({
  tenantId: true,
  planId: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  trialEndsAt: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// ==================== PAYMENTS ====================
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  subscriptionId: varchar("subscription_id"),
  moyasarPaymentId: text("moyasar_payment_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("SAR"),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  description: text("description"),
  metadata: jsonb("metadata"),
  paidAt: timestamp("paid_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const paymentStatuses = ["pending", "initiated", "paid", "failed", "refunded"] as const;
export type PaymentStatus = typeof paymentStatuses[number];

export const insertPaymentSchema = createInsertSchema(payments).pick({
  tenantId: true,
  subscriptionId: true,
  moyasarPaymentId: true,
  amount: true,
  currency: true,
  status: true,
  paymentMethod: true,
  description: true,
  metadata: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// ==================== TYPE HELPERS ====================
export type ConnectorStatus = "pending" | "connected" | "error" | "disabled";
export type AuthType = "api_key" | "oauth2" | "bearer" | "custom_header";
export type RecommendationType = "reorder" | "transfer" | "adjustment" | "alert";
export type Priority = "critical" | "high" | "medium" | "low";
export type RecommendationStatus = "pending" | "approved" | "rejected" | "deferred";
export type AnomalySeverity = "critical" | "high" | "medium" | "low";
export type PolicyType = "approval_workflow" | "action_limit" | "environment_restriction" | "schedule_restriction" | "blast_radius";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PolicyActionType = "require_approval" | "reject" | "allow" | "notify" | "require_dry_run" | "limit_quantity";
export type PolicyConditionOperator = "equals" | "notEquals" | "contains" | "gt" | "lt" | "gte" | "lte" | "in" | "notIn";
export type Environment = "production" | "staging" | "development";
export type SourceType = "items" | "locations" | "stock_balances" | "stock_movements";
export type TargetEntity = "items" | "locations" | "stockBalances" | "stockMovements";
export type TransformType = "toString" | "toNumber" | "toDate" | "uppercase" | "lowercase" | "trim";

// ==================== PRODUCTIVITY SKILLS ====================
export const productivitySkillCategories = [
  "time_management",
  "automation",
  "data_analysis",
  "communication",
  "project_management",
  "ai_tools",
] as const;
export type ProductivitySkillCategory = typeof productivitySkillCategories[number];

export const productivitySkillLevels = ["beginner", "intermediate", "advanced", "expert"] as const;
export type ProductivitySkillLevel = typeof productivitySkillLevels[number];

export const productivitySkills = pgTable("productivity_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar").notNull(),
  category: text("category").notNull(), // time_management, automation, data_analysis, communication, project_management, ai_tools
  level: text("level").notNull().default("beginner"), // beginner, intermediate, advanced, expert
  icon: text("icon"), // lucide icon name
  estimatedHours: integer("estimated_hours").default(1),
  steps: jsonb("steps").default([]), // Array of step objects { title, titleAr, description, descriptionAr, order }
  resources: jsonb("resources").default([]), // Array of { url, title, type }
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductivitySkillSchema = createInsertSchema(productivitySkills).pick({
  tenantId: true,
  name: true,
  nameAr: true,
  description: true,
  descriptionAr: true,
  category: true,
  level: true,
  icon: true,
  estimatedHours: true,
  steps: true,
  resources: true,
  sortOrder: true,
});

export type InsertProductivitySkill = z.infer<typeof insertProductivitySkillSchema>;
export type ProductivitySkill = typeof productivitySkills.$inferSelect;

// User Skill Progress
export const userSkillProgress = pgTable("user_skill_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  skillId: varchar("skill_id").notNull(),
  tenantId: varchar("tenant_id").notNull(),
  status: text("status").notNull().default("not_started"), // not_started, in_progress, completed
  completedSteps: jsonb("completed_steps").default([]), // Array of step indices
  progressPercent: integer("progress_percent").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSkillProgressSchema = createInsertSchema(userSkillProgress).pick({
  userId: true,
  skillId: true,
  tenantId: true,
  status: true,
  completedSteps: true,
  progressPercent: true,
  notes: true,
});

export type InsertUserSkillProgress = z.infer<typeof insertUserSkillProgressSchema>;
export type UserSkillProgress = typeof userSkillProgress.$inferSelect;

// ==================== DATA AGENT (Dash-inspired) ====================
// Stores natural language queries and their SQL results
export const dataAgentQueries = pgTable("data_agent_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  question: text("question").notNull(), // Natural language question
  generatedSql: text("generated_sql"), // The SQL query generated
  result: jsonb("result"), // Query result data
  insight: text("insight"), // AI-generated insight from the data
  status: text("status").notNull().default("pending"), // pending, success, error
  errorMessage: text("error_message"),
  executionTimeMs: integer("execution_time_ms"),
  feedbackRating: integer("feedback_rating"), // 1-5 user rating
  feedbackNote: text("feedback_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDataAgentQuerySchema = createInsertSchema(dataAgentQueries).pick({
  tenantId: true,
  userId: true,
  question: true,
  generatedSql: true,
  result: true,
  insight: true,
  status: true,
  errorMessage: true,
  executionTimeMs: true,
});

export type InsertDataAgentQuery = z.infer<typeof insertDataAgentQuerySchema>;
export type DataAgentQuery = typeof dataAgentQueries.$inferSelect;

// Stores learned patterns for improving future queries (self-learning)
export const dataAgentKnowledge = pgTable("data_agent_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  type: text("type").notNull(), // pattern, fix, annotation, business_rule
  pattern: text("pattern").notNull(), // The question pattern or error pattern
  solution: text("solution").notNull(), // The working SQL or fix
  description: text("description"),
  descriptionAr: text("description_ar"),
  usageCount: integer("usage_count").default(0),
  successRate: integer("success_rate").default(100), // percentage
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDataAgentKnowledgeSchema = createInsertSchema(dataAgentKnowledge).pick({
  tenantId: true,
  type: true,
  pattern: true,
  solution: true,
  description: true,
  descriptionAr: true,
});

export type InsertDataAgentKnowledge = z.infer<typeof insertDataAgentKnowledgeSchema>;
export type DataAgentKnowledge = typeof dataAgentKnowledge.$inferSelect;

// ==================== DATA AGENT - 6 CONTEXT LAYERS (Dash-inspired) ====================

// Layer 1: Table Metadata (Schema & Relationships)
export const dataAgentTableMetadata = pgTable("data_agent_table_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  tableName: text("table_name").notNull(),
  tableNameAr: text("table_name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  columns: jsonb("columns").default([]), // Array of { name, type, description, descriptionAr, isPrimaryKey, isForeignKey, references }
  relationships: jsonb("relationships").default([]), // Array of { type: 'one-to-many'|'many-to-one', relatedTable, foreignKey }
  sampleQueries: jsonb("sample_queries").default([]), // Array of example SQL queries for this table
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DataAgentTableMetadata = typeof dataAgentTableMetadata.$inferSelect;

// Layer 2: Human Annotations (Metrics & Business Rules)
export const dataAgentAnnotations = pgTable("data_agent_annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  targetType: text("target_type").notNull(), // table, column, metric, rule
  targetName: text("target_name").notNull(), // e.g., "orders.total_amount" or "monthly_revenue"
  annotationType: text("annotation_type").notNull(), // metric_definition, business_rule, calculation, warning
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  content: text("content").notNull(), // The annotation content (formula, rule, etc.)
  contentAr: text("content_ar"),
  sqlFragment: text("sql_fragment"), // Optional SQL snippet for this annotation
  priority: integer("priority").default(0), // Higher = more important
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DataAgentAnnotation = typeof dataAgentAnnotations.$inferSelect;

// Layer 3: Query Patterns (Proven SQL Templates)
export const dataAgentQueryPatterns = pgTable("data_agent_query_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  category: text("category").notNull(), // aggregation, filtering, joining, time_series, comparison
  intentPatterns: jsonb("intent_patterns").default([]), // Array of natural language patterns that match this query
  sqlTemplate: text("sql_template").notNull(), // SQL with {{placeholders}}
  parameters: jsonb("parameters").default([]), // Array of { name, type, description, defaultValue }
  exampleQuestions: jsonb("example_questions").default([]), // Array of { ar, en }
  usageCount: integer("usage_count").default(0),
  successRate: integer("success_rate").default(100),
  avgExecutionMs: integer("avg_execution_ms"),
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DataAgentQueryPattern = typeof dataAgentQueryPatterns.$inferSelect;

// Layer 4: Institutional Knowledge (Documentation & Context)
export const dataAgentInstitutionalKnowledge = pgTable("data_agent_institutional_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  category: text("category").notNull(), // terminology, process, policy, faq, best_practice
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  content: text("content").notNull(),
  contentAr: text("content_ar"),
  keywords: jsonb("keywords").default([]), // Array of keywords for matching
  keywordsAr: jsonb("keywords_ar").default([]),
  relatedTables: jsonb("related_tables").default([]), // Array of table names this knowledge relates to
  relevanceScore: integer("relevance_score").default(50), // 0-100, used for ranking
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DataAgentInstitutionalKnowledge = typeof dataAgentInstitutionalKnowledge.$inferSelect;

// Layer 5: Learnings (Error Patterns & Fixes)
export const dataAgentLearnings = pgTable("data_agent_learnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  learningType: text("learning_type").notNull(), // error_fix, optimization, alternative, clarification
  triggerPattern: text("trigger_pattern").notNull(), // The error message or question pattern that triggers this
  originalSql: text("original_sql"), // The SQL that caused the issue
  correctedSql: text("corrected_sql"), // The fixed/optimized SQL
  explanation: text("explanation"),
  explanationAr: text("explanation_ar"),
  autoApply: boolean("auto_apply").default(false), // Whether to automatically apply this fix
  confidenceScore: integer("confidence_score").default(50), // 0-100
  appliedCount: integer("applied_count").default(0),
  successCount: integer("success_count").default(0),
  sourceQueryId: varchar("source_query_id"), // Reference to the original query that created this learning
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DataAgentLearning = typeof dataAgentLearnings.$inferSelect;

// Layer 6: Runtime Context (Session & Real-time Data)
export const dataAgentRuntimeContext = pgTable("data_agent_runtime_context", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  contextType: text("context_type").notNull(), // filter, preference, recent_table, recent_metric, session_var
  contextKey: text("context_key").notNull(),
  contextValue: jsonb("context_value").notNull(),
  expiresAt: timestamp("expires_at"), // Optional expiration for temporary context
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DataAgentRuntimeContext = typeof dataAgentRuntimeContext.$inferSelect;

// ==================== USE CASE FEATURES MAPPING ====================
// Defines which features are available for each use case
export const useCaseFeatures: Record<UseCaseType, string[]> = {
  inventory: ["connectors", "mappings", "items", "locations", "stock_balances", "recommendations", "anomalies", "audit"],
  supply_chain: ["connectors", "mappings", "items", "locations", "stock_balances", "stock_movements", "recommendations", "policies", "audit"],
  hr: ["connectors", "mappings", "recommendations", "policies", "audit"],
  sales: ["connectors", "mappings", "recommendations", "anomalies", "audit"],
  operations: ["connectors", "mappings", "recommendations", "policies", "anomalies", "audit"],
};

// All possible features in the platform
export const allPlatformFeatures = [
  "connectors",
  "mappings", 
  "items",
  "locations",
  "stock_balances",
  "stock_movements",
  "recommendations",
  "anomalies",
  "policies",
  "audit",
  "productivity_skills",
  "data_agent",
] as const;

export type PlatformFeature = typeof allPlatformFeatures[number];
