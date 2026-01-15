/**
 * Base Connector Interface
 * 
 * Enterprise AI Layer - Connector Foundation
 * 
 * This module defines the base interface and types for all connectors.
 * All platform-specific connectors (Salla, Zid, etc.) extend this base.
 */

// ============================================
// Types
// ============================================

export interface ConnectorConfig {
  name: string;
  type: 'ecommerce' | 'erp' | 'crm' | 'warehouse' | 'custom';
  baseUrl: string;
  authType: 'apikey' | 'oauth2' | 'bearer' | 'basic';
}

export interface ConnectorResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface EndpointConfig {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  parameters: EndpointParameter[];
}

export interface EndpointParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  default?: any;
}

export interface ConnectionStatus {
  connected: boolean;
  lastSync?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================
// Base Connector Class
// ============================================

export abstract class BaseConnector {
  protected connectorConfig: ConnectorConfig;
  protected connectionStatus: ConnectionStatus = { connected: false };

  constructor(config: ConnectorConfig) {
    this.connectorConfig = config;
  }

  // ============================================
  // Abstract Methods (must be implemented)
  // ============================================

  /**
   * Test the connection to the external system
   */
  abstract testConnection(): Promise<ConnectorResult<boolean>>;

  /**
   * Get available endpoints for this connector
   */
  abstract getAvailableEndpoints(): EndpointConfig[];

  // ============================================
  // Common Methods
  // ============================================

  /**
   * Get connector name
   */
  getName(): string {
    return this.connectorConfig.name;
  }

  /**
   * Get connector type
   */
  getType(): string {
    return this.connectorConfig.type;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Update connection status
   */
  protected updateConnectionStatus(status: Partial<ConnectionStatus>): void {
    this.connectionStatus = {
      ...this.connectionStatus,
      ...status,
    };
  }

  /**
   * Log connector activity
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = `[${this.connectorConfig.name}]`;
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Validate required configuration
   */
  protected validateConfig(required: string[], config: Record<string, any>): void {
    const missing = required.filter(key => !config[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
  }

  /**
   * Build URL with query parameters
   */
  protected buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(path, this.connectorConfig.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  /**
   * Handle API errors consistently
   */
  protected handleError(error: unknown): ConnectorResult<never> {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    this.log(message, 'error');
    return {
      success: false,
      error: message,
    };
  }
}

// ============================================
// Connector Registry
// ============================================

export class ConnectorRegistry {
  private static connectors: Map<string, BaseConnector> = new Map();

  /**
   * Register a connector
   */
  static register(id: string, connector: BaseConnector): void {
    this.connectors.set(id, connector);
  }

  /**
   * Get a connector by ID
   */
  static get(id: string): BaseConnector | undefined {
    return this.connectors.get(id);
  }

  /**
   * Get all registered connectors
   */
  static getAll(): Map<string, BaseConnector> {
    return this.connectors;
  }

  /**
   * Remove a connector
   */
  static remove(id: string): boolean {
    return this.connectors.delete(id);
  }

  /**
   * Check if a connector exists
   */
  static has(id: string): boolean {
    return this.connectors.has(id);
  }

  /**
   * Get connector count
   */
  static count(): number {
    return this.connectors.size;
  }
}
