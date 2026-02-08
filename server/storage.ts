import { eq, sql, and, gte, lte, asc, inArray } from "drizzle-orm";
import { db, auditGuard } from "./db";
import {
  users,
  tenants,
  connectors,
  endpoints,
  mappings,
  items,
  locations,
  stockBalances,
  stockMovements,
  demandSignals,
  recommendations,
  anomalies,
  policies,
  approvals,
  auditLogs,
  discoveredCapabilities,
  onboardingState,
  mappingConfigs,
  mappingHistory,
  subscriptionPlans,
  subscriptions,
  payments,
} from "@shared/schema";
import type {
  User, InsertUser,
  Tenant, InsertTenant,
  Connector, InsertConnector,
  Endpoint, InsertEndpoint,
  Mapping, InsertMapping,
  Item, InsertItem,
  Location, InsertLocation,
  StockBalance, InsertStockBalance,
  StockMovement, InsertStockMovement,
  DemandSignal, InsertDemandSignal,
  Recommendation, InsertRecommendation,
  Anomaly, InsertAnomaly,
  Policy, InsertPolicy,
  Approval, InsertApproval,
  AuditLog, InsertAuditLog, AuditLogFilters,
  DiscoveredCapability, InsertDiscoveredCapability,
  OnboardingState, InsertOnboardingState,
  MappingConfig, InsertMappingConfig,
  MappingHistory, InsertMappingHistory,
  SubscriptionPlan, InsertSubscriptionPlan,
  Subscription, InsertSubscription,
  Payment, InsertPayment,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tenants
  getTenants(limit?: number, offset?: number): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant | undefined>;

  // Connectors
  getConnectors(tenantId?: string, limit?: number, offset?: number): Promise<Connector[]>;
  getConnector(id: string): Promise<Connector | undefined>;
  createConnector(connector: InsertConnector): Promise<Connector>;
  updateConnector(id: string, updates: Partial<Connector>): Promise<Connector | undefined>;
  deleteConnector(id: string): Promise<boolean>;

  // Endpoints
  getEndpoints(connectorId: string, limit?: number, offset?: number): Promise<Endpoint[]>;
  getEndpoint(id: string): Promise<Endpoint | undefined>;
  createEndpoint(endpoint: InsertEndpoint): Promise<Endpoint>;
  updateEndpoint(id: string, updates: Partial<Endpoint>): Promise<Endpoint | undefined>;

  // Mappings
  getMappings(connectorId?: string, limit?: number, offset?: number): Promise<Mapping[]>;
  getMapping(id: string): Promise<Mapping | undefined>;
  createMapping(mapping: InsertMapping): Promise<Mapping>;
  updateMapping(id: string, updates: Partial<Mapping>): Promise<Mapping | undefined>;
  deleteMapping(id: string): Promise<boolean>;

  // Items
  getItems(tenantId: string, limit?: number, offset?: number): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;

  // Locations
  getLocations(tenantId: string, limit?: number, offset?: number): Promise<Location[]>;
  createLocation(location: InsertLocation): Promise<Location>;

  // Stock Balances
  getStockBalances(tenantId: string, limit?: number, offset?: number): Promise<StockBalance[]>;
  getStockBalance(id: string): Promise<StockBalance | undefined>;
  createStockBalance(balance: InsertStockBalance): Promise<StockBalance>;

  // Stock Movements
  getStockMovements(tenantId: string, limit?: number, offset?: number): Promise<StockMovement[]>;
  createStockMovement(movement: InsertStockMovement): Promise<StockMovement>;

  // Demand Signals
  getDemandSignals(tenantId: string, limit?: number, offset?: number): Promise<DemandSignal[]>;
  createDemandSignal(signal: InsertDemandSignal): Promise<DemandSignal>;

  // Recommendations
  getRecommendations(tenantId?: string, limit?: number, offset?: number): Promise<Recommendation[]>;
  getRecommendation(id: string): Promise<Recommendation | undefined>;
  createRecommendation(rec: InsertRecommendation): Promise<Recommendation>;
  updateRecommendation(id: string, updates: Partial<Recommendation>): Promise<Recommendation | undefined>;

  // Anomalies
  getAnomalies(tenantId?: string, limit?: number, offset?: number): Promise<Anomaly[]>;
  getAnomaly(id: string): Promise<Anomaly | undefined>;
  createAnomaly(anomaly: InsertAnomaly): Promise<Anomaly>;
  updateAnomaly(id: string, updates: Partial<Anomaly>): Promise<Anomaly | undefined>;

  // Policies
  getPolicies(tenantId?: string, limit?: number, offset?: number): Promise<Policy[]>;
  getPolicy(id: string): Promise<Policy | undefined>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy | undefined>;
  deletePolicy(id: string): Promise<boolean>;

  // Approvals
  getApprovals(tenantId?: string, status?: string, limit?: number, offset?: number): Promise<Approval[]>;
  getApproval(id: string): Promise<Approval | undefined>;
  createApproval(approval: InsertApproval): Promise<Approval>;
  updateApproval(id: string, updates: Partial<Approval>): Promise<Approval | undefined>;
  getPendingApprovals(tenantId?: string, limit?: number, offset?: number): Promise<Approval[]>;

  // Audit Logs (Immutable - append-only, no updates, no deletes)
  getAuditLogs(tenantId?: string, limit?: number, offset?: number): Promise<AuditLog[]>;
  getAuditLogsByResource(resourceType: string, resourceId: string): Promise<AuditLog[]>;
  getAuditLogsByCorrelation(correlationId: string): Promise<AuditLog[]>;
  getAuditLogsWithFilters(tenantId: string, filters: AuditLogFilters): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Discovered Capabilities
  getCapabilities(connectorId?: string, limit?: number, offset?: number): Promise<DiscoveredCapability[]>;
  createCapability(capability: InsertDiscoveredCapability): Promise<DiscoveredCapability>;

  // Onboarding State
  getOnboardingState(tenantId: string): Promise<OnboardingState | undefined>;
  createOnboardingState(state: InsertOnboardingState): Promise<OnboardingState>;
  updateOnboardingState(id: string, updates: Partial<OnboardingState>): Promise<OnboardingState | undefined>;

  // Mapping Configs
  getMappingConfigs(tenantId?: string, connectorId?: string, limit?: number, offset?: number): Promise<MappingConfig[]>;
  getMappingConfig(id: string): Promise<MappingConfig | undefined>;
  createMappingConfig(config: InsertMappingConfig): Promise<MappingConfig>;
  updateMappingConfig(id: string, updates: Partial<MappingConfig>): Promise<MappingConfig | undefined>;
  deleteMappingConfig(id: string): Promise<boolean>;

  // Mapping History
  getMappingHistory(mappingConfigId: string, limit?: number, offset?: number): Promise<MappingHistory[]>;
  getMappingHistoryByVersion(mappingConfigId: string, version: number): Promise<MappingHistory | undefined>;
  getMappingHistoryByTenant(tenantId: string, limit?: number, offset?: number): Promise<MappingHistory[]>;
  createMappingHistory(history: InsertMappingHistory): Promise<MappingHistory>;

  // Stats
  getStats(tenantId: string): Promise<{
    items: number;
    locations: number;
    recommendations: number;
    anomalies: number;
    connectors: number;
    activeConnectors: number;
  }>;

  // Subscription Plans
  getSubscriptionPlans(limit?: number, offset?: number): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined>;

  // Subscriptions
  getSubscriptions(tenantId?: string, limit?: number, offset?: number): Promise<Subscription[]>;
  getSubscription(id: string): Promise<Subscription | undefined>;
  getSubscriptionByTenant(tenantId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined>;

  // Payments
  getPayments(tenantId?: string, limit?: number, offset?: number): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentByMoyasarId(moyasarPaymentId: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined>;
}

/**
 * SECURITY GUARANTEE:
 * No state mutation can occur without an audit record.
 * This is enforced by transaction atomicity - if audit fails, operation is rolled back.
 *
 * All write operations in DatabaseStorage use the AuditGuard to ensure that:
 * 1. A transaction is started before any state change
 * 2. The operation is executed within the transaction
 * 3. An audit log entry is created within the same transaction
 * 4. If the audit log fails, the entire transaction is rolled back
 * 5. Only if both succeed does the transaction commit
 *
 * EXCEPTION: createAuditLog itself does NOT use the guard to avoid infinite recursion.
 */
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: user.tenantId || "system",
        action: "create",
        resourceType: "user",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(users).values(user).returning();
        return result[0];
      }
    );
  }

  async getTenants(limit?: number, offset?: number): Promise<Tenant[]> {
    let query = db.select().from(tenants);
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.id, id));
    return result[0];
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: "system",
        action: "create",
        resourceType: "tenant",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(tenants).values(tenant).returning();
        return result[0];
      }
    );
  }

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant | undefined> {
    const previous = await this.getTenant(id);
    if (!previous) return undefined;

    return auditGuard.withAuditAndCapture(
      {
        tenantId: "system",
        action: "update",
        resourceType: "tenant",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(tenants).set(updates).where(eq(tenants.id, id)).returning();
        return result[0];
      }
    );
  }

  async getConnectors(tenantId?: string, limit?: number, offset?: number): Promise<Connector[]> {
    let query = tenantId
      ? db.select().from(connectors).where(eq(connectors.tenantId, tenantId))
      : db.select().from(connectors);
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getConnector(id: string): Promise<Connector | undefined> {
    const result = await db.select().from(connectors).where(eq(connectors.id, id));
    return result[0];
  }

  async createConnector(connector: InsertConnector): Promise<Connector> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: connector.tenantId,
        action: "create",
        resourceType: "connector",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(connectors).values(connector).returning();
        return result[0];
      }
    );
  }

  async updateConnector(id: string, updates: Partial<Connector>): Promise<Connector | undefined> {
    const previous = await this.getConnector(id);
    if (!previous) return undefined;

    return auditGuard.withAuditAndCapture(
      {
        tenantId: previous.tenantId,
        action: "update",
        resourceType: "connector",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(connectors).set(updates).where(eq(connectors.id, id)).returning();
        return result[0];
      }
    );
  }

  async deleteConnector(id: string): Promise<boolean> {
    const previous = await this.getConnector(id);
    if (!previous) return false;

    return auditGuard.withAudit(
      {
        tenantId: previous.tenantId,
        action: "delete",
        resourceType: "connector",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
        newState: null,
      },
      async (tx) => {
        const result = await tx.delete(connectors).where(eq(connectors.id, id));
        return (result.rowCount ?? 0) > 0;
      }
    );
  }

  async getEndpoints(connectorId: string, limit?: number, offset?: number): Promise<Endpoint[]> {
    let query = db.select().from(endpoints).where(eq(endpoints.connectorId, connectorId));
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getEndpoint(id: string): Promise<Endpoint | undefined> {
    const result = await db.select().from(endpoints).where(eq(endpoints.id, id));
    return result[0];
  }

  async createEndpoint(endpoint: InsertEndpoint): Promise<Endpoint> {
    const connector = await this.getConnector(endpoint.connectorId);
    const tenantId = connector?.tenantId || "system";

    return auditGuard.withAuditAndCapture(
      {
        tenantId,
        action: "create",
        resourceType: "endpoint",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(endpoints).values(endpoint).returning();
        return result[0];
      }
    );
  }

  async updateEndpoint(id: string, updates: Partial<Endpoint>): Promise<Endpoint | undefined> {
    const previous = await this.getEndpoint(id);
    if (!previous) return undefined;

    const connector = await this.getConnector(previous.connectorId);
    const tenantId = connector?.tenantId || "system";

    return auditGuard.withAuditAndCapture(
      {
        tenantId,
        action: "update",
        resourceType: "endpoint",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(endpoints).set(updates).where(eq(endpoints.id, id)).returning();
        return result[0];
      }
    );
  }

  async getMappings(connectorId?: string, limit?: number, offset?: number): Promise<Mapping[]> {
    let query = connectorId
      ? db.select().from(mappings).where(eq(mappings.connectorId, connectorId))
      : db.select().from(mappings);
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getMapping(id: string): Promise<Mapping | undefined> {
    const result = await db.select().from(mappings).where(eq(mappings.id, id));
    return result[0];
  }

  async createMapping(mapping: InsertMapping): Promise<Mapping> {
    const connector = await this.getConnector(mapping.connectorId);
    const tenantId = connector?.tenantId || "system";

    return auditGuard.withAuditAndCapture(
      {
        tenantId,
        action: "create",
        resourceType: "mapping",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(mappings).values(mapping).returning();
        return result[0];
      }
    );
  }

  async updateMapping(id: string, updates: Partial<Mapping>): Promise<Mapping | undefined> {
    const previous = await this.getMapping(id);
    if (!previous) return undefined;

    const connector = await this.getConnector(previous.connectorId);
    const tenantId = connector?.tenantId || "system";

    return auditGuard.withAuditAndCapture(
      {
        tenantId,
        action: "update",
        resourceType: "mapping",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(mappings).set(updates).where(eq(mappings.id, id)).returning();
        return result[0];
      }
    );
  }

  async deleteMapping(id: string): Promise<boolean> {
    const previous = await this.getMapping(id);
    if (!previous) return false;

    const connector = await this.getConnector(previous.connectorId);
    const tenantId = connector?.tenantId || "system";

    return auditGuard.withAudit(
      {
        tenantId,
        action: "delete",
        resourceType: "mapping",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
        newState: null,
      },
      async (tx) => {
        const result = await tx.delete(mappings).where(eq(mappings.id, id));
        return (result.rowCount ?? 0) > 0;
      }
    );
  }

  async getItems(tenantId: string, limit?: number, offset?: number): Promise<Item[]> {
    let query = db.select().from(items).where(eq(items.tenantId, tenantId));
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getItem(id: string): Promise<Item | undefined> {
    const result = await db.select().from(items).where(eq(items.id, id));
    return result[0];
  }

  async createItem(item: InsertItem): Promise<Item> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: item.tenantId,
        action: "create",
        resourceType: "item",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(items).values(item).returning();
        return result[0];
      }
    );
  }

  async getLocations(tenantId: string, limit?: number, offset?: number): Promise<Location[]> {
    let query = db.select().from(locations).where(eq(locations.tenantId, tenantId));
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: location.tenantId,
        action: "create",
        resourceType: "location",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(locations).values(location).returning();
        return result[0];
      }
    );
  }

  async getStockBalances(tenantId: string, limit?: number, offset?: number): Promise<StockBalance[]> {
    let query = db.select().from(stockBalances).where(eq(stockBalances.tenantId, tenantId));
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getStockBalance(id: string): Promise<StockBalance | undefined> {
    const result = await db.select().from(stockBalances).where(eq(stockBalances.id, id));
    return result[0];
  }

  async createStockBalance(balance: InsertStockBalance): Promise<StockBalance> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: balance.tenantId,
        action: "create",
        resourceType: "stock_balance",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(stockBalances).values(balance).returning();
        return result[0];
      }
    );
  }

  async getStockMovements(tenantId: string, limit?: number, offset?: number): Promise<StockMovement[]> {
    let query = db.select().from(stockMovements).where(eq(stockMovements.tenantId, tenantId));
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async createStockMovement(movement: InsertStockMovement): Promise<StockMovement> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: movement.tenantId,
        action: "create",
        resourceType: "stock_movement",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(stockMovements).values(movement).returning();
        return result[0];
      }
    );
  }

  async getDemandSignals(tenantId: string, limit?: number, offset?: number): Promise<DemandSignal[]> {
    let query = db.select().from(demandSignals).where(eq(demandSignals.tenantId, tenantId));
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async createDemandSignal(signal: InsertDemandSignal): Promise<DemandSignal> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: signal.tenantId,
        action: "create",
        resourceType: "demand_signal",
        eventType: "signal_received",
      },
      async (tx) => {
        const result = await tx.insert(demandSignals).values(signal).returning();
        return result[0];
      }
    );
  }

  async getRecommendations(tenantId?: string, limit?: number, offset?: number): Promise<Recommendation[]> {
    let query = tenantId
      ? db.select().from(recommendations).where(eq(recommendations.tenantId, tenantId))
      : db.select().from(recommendations);
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    const result = await db.select().from(recommendations).where(eq(recommendations.id, id));
    return result[0];
  }

  async createRecommendation(rec: InsertRecommendation): Promise<Recommendation> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: rec.tenantId,
        action: "create",
        resourceType: "recommendation",
        eventType: "decision_generated",
      },
      async (tx) => {
        const result = await tx.insert(recommendations).values(rec).returning();
        return result[0];
      }
    );
  }

  async updateRecommendation(id: string, updates: Partial<Recommendation>): Promise<Recommendation | undefined> {
    const previous = await this.getRecommendation(id);
    if (!previous) return undefined;

    const updateData: Partial<Recommendation> = { ...updates };
    if (updates.status && updates.status !== "pending") {
      updateData.decidedAt = new Date();
    }

    return auditGuard.withAuditAndCapture(
      {
        tenantId: previous.tenantId,
        action: "update",
        resourceType: "recommendation",
        resourceId: id,
        eventType: updates.status === "approved" ? "approval_resolved" : "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(recommendations).set(updateData).where(eq(recommendations.id, id)).returning();
        return result[0];
      }
    );
  }

  async getAnomalies(tenantId?: string, limit?: number, offset?: number): Promise<Anomaly[]> {
    let query = tenantId
      ? db.select().from(anomalies).where(eq(anomalies.tenantId, tenantId))
      : db.select().from(anomalies);
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getAnomaly(id: string): Promise<Anomaly | undefined> {
    const result = await db.select().from(anomalies).where(eq(anomalies.id, id));
    return result[0];
  }

  async createAnomaly(anomaly: InsertAnomaly): Promise<Anomaly> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: anomaly.tenantId,
        action: "create",
        resourceType: "anomaly",
        eventType: "decision_generated",
      },
      async (tx) => {
        const result = await tx.insert(anomalies).values(anomaly).returning();
        return result[0];
      }
    );
  }

  async updateAnomaly(id: string, updates: Partial<Anomaly>): Promise<Anomaly | undefined> {
    const previous = await this.getAnomaly(id);
    if (!previous) return undefined;

    return auditGuard.withAuditAndCapture(
      {
        tenantId: previous.tenantId,
        action: "update",
        resourceType: "anomaly",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(anomalies).set(updates).where(eq(anomalies.id, id)).returning();
        return result[0];
      }
    );
  }

  async getPolicies(tenantId?: string, limit?: number, offset?: number): Promise<Policy[]> {
    let query = tenantId
      ? db.select().from(policies).where(eq(policies.tenantId, tenantId))
      : db.select().from(policies);
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getPolicy(id: string): Promise<Policy | undefined> {
    const result = await db.select().from(policies).where(eq(policies.id, id));
    return result[0];
  }

  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: policy.tenantId,
        action: "create",
        resourceType: "policy",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(policies).values(policy).returning();
        return result[0];
      }
    );
  }

  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy | undefined> {
    const previous = await this.getPolicy(id);
    if (!previous) return undefined;

    return auditGuard.withAuditAndCapture(
      {
        tenantId: previous.tenantId,
        action: "update",
        resourceType: "policy",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(policies).set(updates).where(eq(policies.id, id)).returning();
        return result[0];
      }
    );
  }

  async deletePolicy(id: string): Promise<boolean> {
    const previous = await this.getPolicy(id);
    if (!previous) return false;

    return auditGuard.withAudit(
      {
        tenantId: previous.tenantId,
        action: "delete",
        resourceType: "policy",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
        newState: null,
      },
      async (tx) => {
        const result = await tx.delete(policies).where(eq(policies.id, id));
        return (result.rowCount ?? 0) > 0;
      }
    );
  }

  async getApprovals(tenantId?: string, status?: string, limit?: number, offset?: number): Promise<Approval[]> {
    let query;
    if (tenantId && status) {
      query = db.select().from(approvals).where(
        sql`${approvals.tenantId} = ${tenantId} AND ${approvals.status} = ${status}`
      );
    } else if (tenantId) {
      query = db.select().from(approvals).where(eq(approvals.tenantId, tenantId));
    } else if (status) {
      query = db.select().from(approvals).where(eq(approvals.status, status));
    } else {
      query = db.select().from(approvals);
    }
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getApproval(id: string): Promise<Approval | undefined> {
    const result = await db.select().from(approvals).where(eq(approvals.id, id));
    return result[0];
  }

  async createApproval(approval: InsertApproval): Promise<Approval> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: approval.tenantId,
        action: "create",
        resourceType: "approval",
        eventType: "approval_requested",
      },
      async (tx) => {
        const result = await tx.insert(approvals).values(approval).returning();
        return result[0];
      }
    );
  }

  async updateApproval(id: string, updates: Partial<Approval>): Promise<Approval | undefined> {
    const previous = await this.getApproval(id);
    if (!previous) return undefined;

    const updateData: Partial<Approval> = { ...updates };
    if (updates.status && updates.status !== "pending") {
      updateData.resolvedAt = new Date();
    }

    return auditGuard.withAuditAndCapture(
      {
        tenantId: previous.tenantId,
        action: "update",
        resourceType: "approval",
        resourceId: id,
        eventType: "approval_resolved",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(approvals).set(updateData).where(eq(approvals.id, id)).returning();
        return result[0];
      }
    );
  }

  async getPendingApprovals(tenantId?: string, limit?: number, offset?: number): Promise<Approval[]> {
    return this.getApprovals(tenantId, "pending", limit, offset);
  }

  // Audit Logs (Immutable - append-only, no updates, no deletes)
  // NOTE: createAuditLog does NOT use the audit guard to avoid infinite recursion
  async getAuditLogs(tenantId?: string, limit?: number, offset?: number): Promise<AuditLog[]> {
    let query = tenantId
      ? db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenantId)).orderBy(asc(auditLogs.sequenceNumber))
      : db.select().from(auditLogs).orderBy(asc(auditLogs.sequenceNumber));
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getAuditLogsByResource(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    return db.select().from(auditLogs)
      .where(and(
        eq(auditLogs.resourceType, resourceType),
        eq(auditLogs.resourceId, resourceId)
      ))
      .orderBy(asc(auditLogs.sequenceNumber));
  }

  async getAuditLogsByCorrelation(correlationId: string): Promise<AuditLog[]> {
    return db.select().from(auditLogs)
      .where(eq(auditLogs.correlationId, correlationId))
      .orderBy(asc(auditLogs.sequenceNumber));
  }

  async getAuditLogsWithFilters(tenantId: string, filters: AuditLogFilters): Promise<AuditLog[]> {
    const conditions = [eq(auditLogs.tenantId, tenantId)];
    
    if (filters.eventType) {
      conditions.push(eq(auditLogs.eventType, filters.eventType));
    }
    if (filters.resourceType) {
      conditions.push(eq(auditLogs.resourceType, filters.resourceType));
    }
    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters.startDate) {
      conditions.push(gte(auditLogs.timestamp, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(auditLogs.timestamp, filters.endDate));
    }
    
    return db.select().from(auditLogs)
      .where(and(...conditions))
      .orderBy(asc(auditLogs.sequenceNumber));
  }

  /**
   * EXCEPTION: createAuditLog does NOT use the audit guard.
   * This is intentional to avoid infinite recursion - the audit guard itself
   * creates audit logs, so we cannot wrap this method in the guard.
   *
   * Security Note: This is the ONLY write operation that bypasses the guard.
   * The audit log table is append-only with no update/delete capabilities.
   */
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    return auditGuard.createAuditLogDirect(log);
  }

  async getCapabilities(connectorId?: string, limit?: number, offset?: number): Promise<DiscoveredCapability[]> {
    let query = connectorId
      ? db.select().from(discoveredCapabilities).where(eq(discoveredCapabilities.connectorId, connectorId))
      : db.select().from(discoveredCapabilities);
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async createCapability(capability: InsertDiscoveredCapability): Promise<DiscoveredCapability> {
    const connector = await this.getConnector(capability.connectorId);
    const tenantId = connector?.tenantId || "system";

    return auditGuard.withAuditAndCapture(
      {
        tenantId,
        action: "create",
        resourceType: "capability",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(discoveredCapabilities).values(capability).returning();
        return result[0];
      }
    );
  }

  async getOnboardingState(tenantId: string): Promise<OnboardingState | undefined> {
    const result = await db.select().from(onboardingState).where(eq(onboardingState.tenantId, tenantId));
    return result[0];
  }

  async createOnboardingState(state: InsertOnboardingState): Promise<OnboardingState> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: state.tenantId,
        action: "create",
        resourceType: "onboarding_state",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(onboardingState).values(state).returning();
        return result[0];
      }
    );
  }

  async updateOnboardingState(id: string, updates: Partial<OnboardingState>): Promise<OnboardingState | undefined> {
    const previous = await db.select().from(onboardingState).where(eq(onboardingState.id, id));
    if (!previous[0]) return undefined;

    return auditGuard.withAuditAndCapture(
      {
        tenantId: previous[0].tenantId,
        action: "update",
        resourceType: "onboarding_state",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous[0],
      },
      async (tx) => {
        const result = await tx.update(onboardingState).set(updates).where(eq(onboardingState.id, id)).returning();
        return result[0];
      }
    );
  }

  async getMappingConfigs(tenantId?: string, connectorId?: string, limit?: number, offset?: number): Promise<MappingConfig[]> {
    let query;
    if (tenantId && connectorId) {
      query = db.select().from(mappingConfigs).where(
        sql`${mappingConfigs.tenantId} = ${tenantId} AND ${mappingConfigs.connectorId} = ${connectorId}`
      );
    } else if (tenantId) {
      query = db.select().from(mappingConfigs).where(eq(mappingConfigs.tenantId, tenantId));
    } else if (connectorId) {
      query = db.select().from(mappingConfigs).where(eq(mappingConfigs.connectorId, connectorId));
    } else {
      query = db.select().from(mappingConfigs);
    }
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getMappingConfig(id: string): Promise<MappingConfig | undefined> {
    const result = await db.select().from(mappingConfigs).where(eq(mappingConfigs.id, id));
    return result[0];
  }

  async createMappingConfig(config: InsertMappingConfig): Promise<MappingConfig> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: config.tenantId,
        action: "create",
        resourceType: "mapping_config",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(mappingConfigs).values(config).returning();
        return result[0];
      }
    );
  }

  async updateMappingConfig(id: string, updates: Partial<MappingConfig>): Promise<MappingConfig | undefined> {
    const previous = await this.getMappingConfig(id);
    if (!previous) return undefined;

    return auditGuard.withAuditAndCapture(
      {
        tenantId: previous.tenantId,
        action: "update",
        resourceType: "mapping_config",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(mappingConfigs).set(updates).where(eq(mappingConfigs.id, id)).returning();
        return result[0];
      }
    );
  }

  async deleteMappingConfig(id: string): Promise<boolean> {
    const previous = await this.getMappingConfig(id);
    if (!previous) return false;

    return auditGuard.withAudit(
      {
        tenantId: previous.tenantId,
        action: "delete",
        resourceType: "mapping_config",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
        newState: null,
      },
      async (tx) => {
        const result = await tx.delete(mappingConfigs).where(eq(mappingConfigs.id, id));
        return (result.rowCount ?? 0) > 0;
      }
    );
  }

  async getMappingHistory(mappingConfigId: string, limit?: number, offset?: number): Promise<MappingHistory[]> {
    let query = db.select().from(mappingHistory).where(eq(mappingHistory.mappingConfigId, mappingConfigId));
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getMappingHistoryByVersion(mappingConfigId: string, version: number): Promise<MappingHistory | undefined> {
    const result = await db.select().from(mappingHistory).where(
      sql`${mappingHistory.mappingConfigId} = ${mappingConfigId} AND ${mappingHistory.version} = ${version}`
    );
    return result[0];
  }

  async getMappingHistoryByTenant(tenantId: string, limit?: number, offset?: number): Promise<MappingHistory[]> {
    const configs = await this.getMappingConfigs(tenantId);
    const configIds = configs.map((c) => c.id);
    if (configIds.length === 0) {
      return [];
    }
    // Use single query with IN clause instead of N+1 loop
    let query = db.select().from(mappingHistory).where(inArray(mappingHistory.mappingConfigId, configIds));
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async createMappingHistory(history: InsertMappingHistory): Promise<MappingHistory> {
    const mappingConfig = await this.getMappingConfig(history.mappingConfigId);
    const tenantId = mappingConfig?.tenantId || "system";

    return auditGuard.withAuditAndCapture(
      {
        tenantId,
        action: "create",
        resourceType: "mapping_history",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(mappingHistory).values(history).returning();
        return result[0];
      }
    );
  }

  async getStats(tenantId: string): Promise<{
    items: number;
    locations: number;
    recommendations: number;
    anomalies: number;
    connectors: number;
    activeConnectors: number;
  }> {
    const [
      [itemsCount],
      [locationsCount],
      [recommendationsCount],
      [anomaliesCount],
      [connectorsCount],
      [activeConnectorsCount],
    ] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(items).where(eq(items.tenantId, tenantId)),
      db.select({ count: sql`count(*)` }).from(locations).where(eq(locations.tenantId, tenantId)),
      db.select({ count: sql`count(*)` }).from(recommendations).where(eq(recommendations.tenantId, tenantId)),
      db.select({ count: sql`count(*)` }).from(anomalies).where(eq(anomalies.tenantId, tenantId)),
      db.select({ count: sql`count(*)` }).from(connectors).where(eq(connectors.tenantId, tenantId)),
      db.select({ count: sql`count(*)` }).from(connectors).where(sql`${connectors.tenantId} = ${tenantId} AND ${connectors.status} = 'connected'`),
    ]);

    return {
      items: Number(itemsCount?.count ?? 0),
      locations: Number(locationsCount?.count ?? 0),
      recommendations: Number(recommendationsCount?.count ?? 0),
      anomalies: Number(anomaliesCount?.count ?? 0),
      connectors: Number(connectorsCount?.count ?? 0),
      activeConnectors: Number(activeConnectorsCount?.count ?? 0),
    };
  }

  // Subscription Plans
  async getSubscriptionPlans(limit?: number, offset?: number): Promise<SubscriptionPlan[]> {
    let query = db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.sortOrder));
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return result[0];
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: "system",
        action: "create",
        resourceType: "subscription_plan",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(subscriptionPlans).values(plan).returning();
        return result[0];
      }
    );
  }

  async updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const previous = await this.getSubscriptionPlan(id);
    if (!previous) return undefined;

    return auditGuard.withAuditAndCapture(
      {
        tenantId: "system",
        action: "update",
        resourceType: "subscription_plan",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(subscriptionPlans).set(updates).where(eq(subscriptionPlans.id, id)).returning();
        return result[0];
      }
    );
  }

  // Subscriptions
  async getSubscriptions(tenantId?: string, limit?: number, offset?: number): Promise<Subscription[]> {
    let query = tenantId
      ? db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId))
      : db.select().from(subscriptions);
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return result[0];
  }

  async getSubscriptionByTenant(tenantId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(
      sql`${subscriptions.tenantId} = ${tenantId} AND ${subscriptions.status} = 'active'`
    ).orderBy(sql`${subscriptions.createdAt} DESC`).limit(1);
    return result[0];
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: subscription.tenantId,
        action: "create",
        resourceType: "subscription",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(subscriptions).values(subscription).returning();
        return result[0];
      }
    );
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined> {
    const previous = await this.getSubscription(id);
    if (!previous) return undefined;

    return auditGuard.withAuditAndCapture(
      {
        tenantId: previous.tenantId,
        action: "update",
        resourceType: "subscription",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(subscriptions).set(updates).where(eq(subscriptions.id, id)).returning();
        return result[0];
      }
    );
  }

  // Payments
  async getPayments(tenantId?: string, limit?: number, offset?: number): Promise<Payment[]> {
    let query = tenantId
      ? db.select().from(payments).where(eq(payments.tenantId, tenantId))
      : db.select().from(payments);
    if (limit !== undefined) query = query.limit(limit) as typeof query;
    if (offset !== undefined) query = query.offset(offset) as typeof query;
    return query;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(eq(payments.id, id));
    return result[0];
  }

  async getPaymentByMoyasarId(moyasarPaymentId: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(eq(payments.moyasarPaymentId, moyasarPaymentId));
    return result[0];
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    return auditGuard.withAuditAndCapture(
      {
        tenantId: payment.tenantId,
        action: "create",
        resourceType: "payment",
        eventType: "action_executed",
      },
      async (tx) => {
        const result = await tx.insert(payments).values(payment).returning();
        return result[0];
      }
    );
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined> {
    const previous = await this.getPayment(id);
    if (!previous) return undefined;

    return auditGuard.withAuditAndCapture(
      {
        tenantId: previous.tenantId,
        action: "update",
        resourceType: "payment",
        resourceId: id,
        eventType: "action_executed",
        previousState: previous,
      },
      async (tx) => {
        const result = await tx.update(payments).set(updates).where(eq(payments.id, id)).returning();
        return result[0];
      }
    );
  }
}

export const storage = new DatabaseStorage();
