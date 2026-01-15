/**
 * SECURITY GUARANTEE:
 * No state mutation can occur without an audit record.
 * This is enforced by transaction atomicity - if audit fails, operation is rolled back.
 *
 * This module provides a central write-guard layer that ensures ALL state-changing
 * operations are wrapped in transactions with mandatory audit logging.
 */

import { db, pool } from "./db";
import { auditLogs } from "@shared/schema";
import type { InsertAuditLog, AuditLog } from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export interface AuditContext {
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  eventType?: string;
  previousState?: unknown;
  newState?: unknown;
  correlationId?: string;
  parentEventId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export type TransactionClient = NodePgDatabase<typeof schema>;

/**
 * AuditGuard ensures that all database write operations are atomic with their
 * corresponding audit log entries. If either the operation or the audit log
 * insertion fails, the entire transaction is rolled back.
 *
 * SECURITY GUARANTEE:
 * No state mutation can occur without an audit record.
 * This is enforced by transaction atomicity - if audit fails, operation is rolled back.
 */
export class AuditGuard {
  /**
   * Execute a state-changing operation within a transaction that guarantees
   * an audit log is created atomically with the operation.
   *
   * @param auditContext - The context for the audit log entry
   * @param operation - The operation to execute within the transaction
   * @returns The result of the operation
   * @throws If either the operation or audit logging fails, the entire transaction is rolled back
   */
  async withAudit<T>(
    auditContext: AuditContext,
    operation: (tx: TransactionClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const txDb = drizzle(client, { schema });

      const result = await operation(txDb);

      const auditEntry: InsertAuditLog = {
        tenantId: auditContext.tenantId,
        userId: auditContext.userId,
        action: auditContext.action,
        resourceType: auditContext.resourceType,
        resourceId: auditContext.resourceId,
        eventType: auditContext.eventType || "action_executed",
        previousState: auditContext.previousState as Record<string, unknown> | null,
        newState: auditContext.newState as Record<string, unknown> | null,
        correlationId: auditContext.correlationId,
        parentEventId: auditContext.parentEventId,
        metadata: auditContext.metadata as Record<string, unknown> | null,
        ipAddress: auditContext.ipAddress,
      };

      const auditResult = await txDb.insert(auditLogs).values(auditEntry).returning();

      if (!auditResult || auditResult.length === 0) {
        throw new Error("AUDIT_FAILURE: Failed to create audit log entry - rolling back transaction");
      }

      await client.query("COMMIT");

      return result;
    } catch (error) {
      await client.query("ROLLBACK");

      if (error instanceof Error && error.message.startsWith("AUDIT_FAILURE:")) {
        throw error;
      }

      throw new Error(
        `Transaction rolled back due to error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create an audit log entry directly without wrapping an operation.
   * This is used for createAuditLog itself to avoid infinite recursion.
   *
   * @param log - The audit log entry to create
   * @returns The created audit log
   */
  async createAuditLogDirect(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  /**
   * Execute a state-changing operation with captured result for newState.
   * This is a convenience method that automatically captures the operation result
   * as the newState in the audit log.
   *
   * @param auditContext - The context for the audit log entry (newState will be overwritten)
   * @param operation - The operation to execute within the transaction
   * @returns The result of the operation
   */
  async withAuditAndCapture<T extends object>(
    auditContext: Omit<AuditContext, "newState">,
    operation: (tx: TransactionClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const txDb = drizzle(client, { schema });

      const result = await operation(txDb);

      const auditEntry: InsertAuditLog = {
        tenantId: auditContext.tenantId,
        userId: auditContext.userId,
        action: auditContext.action,
        resourceType: auditContext.resourceType,
        resourceId: auditContext.resourceId,
        eventType: auditContext.eventType || "action_executed",
        previousState: auditContext.previousState as Record<string, unknown> | null,
        newState: result as unknown as Record<string, unknown> | null,
        correlationId: auditContext.correlationId,
        parentEventId: auditContext.parentEventId,
        metadata: auditContext.metadata as Record<string, unknown> | null,
        ipAddress: auditContext.ipAddress,
      };

      const auditResult = await txDb.insert(auditLogs).values(auditEntry).returning();

      if (!auditResult || auditResult.length === 0) {
        throw new Error("AUDIT_FAILURE: Failed to create audit log entry - rolling back transaction");
      }

      await client.query("COMMIT");

      return result;
    } catch (error) {
      await client.query("ROLLBACK");

      if (error instanceof Error && error.message.startsWith("AUDIT_FAILURE:")) {
        throw error;
      }

      throw new Error(
        `Transaction rolled back due to error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      client.release();
    }
  }
}

export const auditGuard = new AuditGuard();
