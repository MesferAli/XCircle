import { storage } from "./storage";
import type { Connector, Endpoint } from "@shared/schema";

interface AuthConfig {
  headerName?: string;
  apiKey?: string;
  token?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
}

interface PaginationConfig {
  type: "cursor" | "offset" | "page" | "time_window";
  cursorParam?: string;
  cursorPath?: string;
  offsetParam?: string;
  limitParam?: string;
  pageParam?: string;
  limit?: number;
  timestampParam?: string;
  timestampPath?: string;
}

interface PaginationState {
  type: "cursor" | "offset" | "page" | "time_window";
  cursor?: string;
  offset?: number;
  page?: number;
  timeWindow?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

interface RateLimitState {
  requests: number[];
  requestsPerMinute: number;
}

interface HealthStatus {
  status: "online" | "offline" | "degraded";
  lastChecked: Date;
  latencyMs: number;
  errorMessage?: string;
}

interface PollResult {
  success: boolean;
  data?: unknown;
  error?: string;
  rateLimited?: boolean;
  pagination?: {
    hasMore: boolean;
    nextCursor?: string;
    nextOffset?: number;
    nextPage?: number;
    recordCount?: number;
  };
  requestLog: {
    url: string;
    method: string;
    statusCode?: number;
    responseTimeMs: number;
    timestamp: Date;
  };
}

/**
 * ConnectorEngine handles polling of external APIs with support for 4 pagination strategies:
 * 
 * PAGINATION STATE PERSISTENCE:
 * The engine persists pagination state in the `lastCursor` column as JSON, enabling resumable polling:
 * 
 * 1. CURSOR PAGINATION:
 *    - State stored: { type: "cursor", cursor: "next_cursor_value" }
 *    - Used: For APIs that provide an opaque cursor (e.g., Stripe, GraphQL APIs)
 *    - Flow: Extract nextCursor from response → Store in state → Include in next request
 *    - Example: GitHub API pagination with "after" cursor
 * 
 * 2. OFFSET PAGINATION:
 *    - State stored: { type: "offset", offset: 100 }
 *    - Used: For APIs with limit/offset parameters (e.g., REST APIs with ?offset=X&limit=Y)
 *    - Flow: Extract items count from response → Calculate nextOffset = currentOffset + limit
 *    - Resumable: If last poll returned 100 items with limit=100, next poll starts at offset=100
 *    - Example: Database APIs that return 100 records per page
 * 
 * 3. PAGE PAGINATION:
 *    - State stored: { type: "page", page: 2 }
 *    - Used: For APIs with page numbers (e.g., ?page=1&pageSize=100)
 *    - Flow: Check hasNextPage flag → Increment page number for next request
 *    - Resumable: If last poll was page=1, next poll fetches page=2
 *    - Example: WordPress REST API with /posts?page=1&per_page=10
 * 
 * 4. TIME_WINDOW PAGINATION:
 *    - State stored: { type: "time_window", timeWindow: "2024-01-15T12:34:56Z" }
 *    - Used: For APIs that track changes by timestamp (e.g., ?since=timestamp)
 *    - Flow: Extract lastTimestamp from response → Use as since/after parameter in next request
 *    - Resumable: Each poll fetches records modified since last sync time
 *    - Example: Webhook delivery logs, audit logs, or change data capture APIs
 * 
 * BACKWARDS COMPATIBILITY:
 * Legacy string cursors (non-JSON) are auto-converted to cursor-type pagination state.
 * This ensures existing integrations continue working during the migration.
 */
export class ConnectorEngine {
  private tokenCache: Map<string, CachedToken> = new Map();
  private rateLimitState: Map<string, RateLimitState> = new Map();
  private healthCache: Map<string, HealthStatus> = new Map();
  private readonly TOKEN_BUFFER_MS = 60000; // 1 minute buffer before token expiry

  async pollEndpoint(
    connectorId: string,
    endpointId: string,
    tenantId: string
  ): Promise<PollResult> {
    const connector = await storage.getConnector(connectorId);
    if (!connector) {
      return {
        success: false,
        error: "Connector not found",
        requestLog: {
          url: "",
          method: "",
          responseTimeMs: 0,
          timestamp: new Date(),
        },
      };
    }

    if (connector.tenantId !== tenantId) {
      return {
        success: false,
        error: "Connector does not belong to tenant",
        requestLog: {
          url: "",
          method: "",
          responseTimeMs: 0,
          timestamp: new Date(),
        },
      };
    }

    const endpoint = await storage.getEndpoint(endpointId);
    if (!endpoint) {
      return {
        success: false,
        error: "Endpoint not found",
        requestLog: {
          url: "",
          method: "",
          responseTimeMs: 0,
          timestamp: new Date(),
        },
      };
    }

    if (endpoint.connectorId !== connectorId) {
      return {
        success: false,
        error: "Endpoint does not belong to connector",
        requestLog: {
          url: "",
          method: "",
          responseTimeMs: 0,
          timestamp: new Date(),
        },
      };
    }

    if (!endpoint.isEnabled) {
      return {
        success: false,
        error: "Endpoint is disabled",
        requestLog: {
          url: "",
          method: "",
          responseTimeMs: 0,
          timestamp: new Date(),
        },
      };
    }

    const rateLimitCheck = this.checkRateLimit(connectorId, connector.requestsPerMinute || 60);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded. ${rateLimitCheck.remaining} requests remaining. Reset in ${rateLimitCheck.resetInMs}ms`,
        rateLimited: true,
        requestLog: {
          url: `${connector.baseUrl}${endpoint.path}`,
          method: endpoint.method,
          responseTimeMs: 0,
          timestamp: new Date(),
        },
      };
    }

    const result = await this.executeRequest(connector, endpoint);

    // Persist pagination state for next poll
    let lastCursor = endpoint.lastCursor;
    if (result.success && result.pagination) {
      const paginationConfig = endpoint.paginationConfig as PaginationConfig | null;
      if (paginationConfig) {
        // FIX 4: Pass previousState to buildPaginationStateFromResult for time_window fallback
        const previousState = this.deserializePaginationState(endpoint.lastCursor);
        const newState = this.buildPaginationStateFromResult(
          paginationConfig.type,
          result.pagination,
          previousState
        );

        // FIX 3: buildPaginationStateFromResult returns null when there's no new data
        // In this case, we preserve the existing lastCursor (don't update it)
        // This is essential for time_window pagination to maintain the checkpoint
        if (newState !== null) {
          lastCursor = newState;
        }
      }
    }

    await storage.updateEndpoint(endpointId, {
      lastPolledAt: new Date(),
      lastPollStatus: result.success ? "success" : "error",
      lastCursor,
    });

    await storage.createAuditLog({
      tenantId,
      userId: "system",
      action: "poll",
      resourceType: "endpoint",
      resourceId: endpointId,
      metadata: {
        connectorId,
        success: result.success,
        statusCode: result.requestLog.statusCode,
        responseTimeMs: result.requestLog.responseTimeMs,
      },
      ipAddress: "internal",
    });

    return result;
  }

  async executeRequest(connector: Connector, endpoint: Endpoint): Promise<PollResult> {
    const startTime = Date.now();
    const paginationState = this.deserializePaginationState(endpoint.lastCursor);
    const url = this.buildUrl(connector, endpoint, paginationState);
    const method = endpoint.method || "GET";

    try {
      const headers = await this.buildAuthHeaders(connector);
      headers["Accept"] = "application/json";
      headers["Content-Type"] = "application/json";

      this.recordRequest(connector.id);

      const response = await fetch(url, {
        method,
        headers,
      });

      const responseTimeMs = Date.now() - startTime;
      const requestLog = {
        url,
        method,
        statusCode: response.status,
        responseTimeMs,
        timestamp: new Date(),
      };

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText.substring(0, 500)}`,
          requestLog,
        };
      }

      const rawData = await response.json();
      const data = this.extractData(rawData, endpoint.dataPath);
      // FIX 4: Pass previousState to extractPagination so it can fallback to previous timeWindow
      const pagination = this.extractPagination(rawData, endpoint.paginationConfig as PaginationConfig | null, paginationState, data, paginationState);

      return {
        success: true,
        data,
        pagination,
        requestLog,
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        requestLog: {
          url,
          method,
          responseTimeMs,
          timestamp: new Date(),
        },
      };
    }
  }

  async checkHealth(connectorId: string): Promise<HealthStatus> {
    const startTime = Date.now();
    const connector = await storage.getConnector(connectorId);
    
    if (!connector) {
      return {
        status: "offline",
        lastChecked: new Date(),
        latencyMs: 0,
        errorMessage: "Connector not found",
      };
    }

    const healthEndpoint = connector.healthCheckEndpoint || "/";
    const url = `${connector.baseUrl}${healthEndpoint}`;

    try {
      const headers = await this.buildAuthHeaders(connector);
      
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const latencyMs = Date.now() - startTime;
      let status: HealthStatus["status"] = "online";
      let errorMessage: string | undefined;

      if (!response.ok) {
        if (response.status >= 500) {
          status = "offline";
          errorMessage = `Server error: ${response.status}`;
        } else if (response.status >= 400) {
          status = "degraded";
          errorMessage = `Client error: ${response.status}`;
        }
      }

      if (latencyMs > 5000) {
        status = status === "online" ? "degraded" : status;
        errorMessage = errorMessage || "High latency detected";
      }

      const healthStatus: HealthStatus = {
        status,
        lastChecked: new Date(),
        latencyMs,
        errorMessage,
      };

      this.healthCache.set(connectorId, healthStatus);

      await storage.updateConnector(connectorId, {
        status: status === "online" ? "connected" : status === "degraded" ? "connected" : "error",
        lastHealthCheck: new Date(),
      });

      return healthStatus;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const healthStatus: HealthStatus = {
        status: "offline",
        lastChecked: new Date(),
        latencyMs,
        errorMessage: error instanceof Error ? error.message : "Connection failed",
      };

      this.healthCache.set(connectorId, healthStatus);

      await storage.updateConnector(connectorId, {
        status: "error",
        lastHealthCheck: new Date(),
      });

      return healthStatus;
    }
  }

  async testConnection(connectorId: string): Promise<{
    success: boolean;
    message: string;
    details: {
      authValid: boolean;
      healthStatus: HealthStatus;
      endpointCount: number;
    };
  }> {
    const connector = await storage.getConnector(connectorId);
    if (!connector) {
      return {
        success: false,
        message: "Connector not found",
        details: {
          authValid: false,
          healthStatus: {
            status: "offline",
            lastChecked: new Date(),
            latencyMs: 0,
            errorMessage: "Connector not found",
          },
          endpointCount: 0,
        },
      };
    }

    let authValid = false;
    try {
      await this.buildAuthHeaders(connector);
      authValid = true;
    } catch (error) {
      return {
        success: false,
        message: `Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        details: {
          authValid: false,
          healthStatus: {
            status: "offline",
            lastChecked: new Date(),
            latencyMs: 0,
            errorMessage: "Auth validation failed",
          },
          endpointCount: 0,
        },
      };
    }

    const healthStatus = await this.checkHealth(connectorId);
    const endpoints = await storage.getEndpoints(connectorId);

    const success = healthStatus.status !== "offline";
    const message = success
      ? `Connection successful. Status: ${healthStatus.status}. Latency: ${healthStatus.latencyMs}ms`
      : `Connection failed: ${healthStatus.errorMessage}`;

    return {
      success,
      message,
      details: {
        authValid,
        healthStatus,
        endpointCount: endpoints.length,
      },
    };
  }

  async pollAllEndpoints(
    connectorId: string,
    tenantId: string
  ): Promise<{
    success: boolean;
    results: { endpointId: string; endpointName: string; result: PollResult }[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      rateLimited: number;
    };
  }> {
    const connector = await storage.getConnector(connectorId);
    if (!connector) {
      return {
        success: false,
        results: [],
        summary: { total: 0, successful: 0, failed: 0, rateLimited: 0 },
      };
    }

    if (connector.tenantId !== tenantId) {
      return {
        success: false,
        results: [],
        summary: { total: 0, successful: 0, failed: 0, rateLimited: 0 },
      };
    }

    const endpoints = await storage.getEndpoints(connectorId);
    const enabledEndpoints = endpoints.filter((e) => e.isEnabled);
    const results: { endpointId: string; endpointName: string; result: PollResult }[] = [];

    for (const endpoint of enabledEndpoints) {
      const result = await this.pollEndpoint(connectorId, endpoint.id, tenantId);
      results.push({
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        result,
      });

      if (result.rateLimited) {
        break;
      }
    }

    const summary = {
      total: results.length,
      successful: results.filter((r) => r.result.success).length,
      failed: results.filter((r) => !r.result.success && !r.result.rateLimited).length,
      rateLimited: results.filter((r) => r.result.rateLimited).length,
    };

    return {
      success: summary.failed === 0 && summary.rateLimited === 0,
      results,
      summary,
    };
  }

  getHealthStatus(connectorId: string): HealthStatus | undefined {
    return this.healthCache.get(connectorId);
  }

  getRateLimitStatus(connectorId: string): {
    requestsUsed: number;
    requestsPerMinute: number;
    remaining: number;
    resetInMs: number;
  } {
    const state = this.rateLimitState.get(connectorId);
    if (!state) {
      return {
        requestsUsed: 0,
        requestsPerMinute: 60,
        remaining: 60,
        resetInMs: 0,
      };
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const validRequests = state.requests.filter((t) => t > oneMinuteAgo);

    return {
      requestsUsed: validRequests.length,
      requestsPerMinute: state.requestsPerMinute,
      remaining: Math.max(0, state.requestsPerMinute - validRequests.length),
      resetInMs: validRequests.length > 0 ? validRequests[0] + 60000 - now : 0,
    };
  }

  private async buildAuthHeaders(connector: Connector): Promise<Record<string, string>> {
    const authConfig = connector.authConfig as AuthConfig | null;
    const headers: Record<string, string> = {};

    switch (connector.authType) {
      case "api_key": {
        if (!authConfig?.apiKey) {
          throw new Error("API key not configured");
        }
        const headerName = authConfig.headerName || "X-API-Key";
        headers[headerName] = authConfig.apiKey;
        break;
      }

      case "bearer": {
        if (!authConfig?.token) {
          throw new Error("Bearer token not configured");
        }
        headers["Authorization"] = `Bearer ${authConfig.token}`;
        break;
      }

      case "oauth2_client_credentials": {
        const token = await this.getOAuth2Token(connector.id, authConfig);
        headers["Authorization"] = `Bearer ${token}`;
        break;
      }

      case "basic": {
        if (!authConfig?.username || !authConfig?.password) {
          throw new Error("Basic auth credentials not configured");
        }
        const credentials = Buffer.from(
          `${authConfig.username}:${authConfig.password}`
        ).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
        break;
      }

      default:
        throw new Error(`Unsupported auth type: ${connector.authType}`);
    }

    return headers;
  }

  private async getOAuth2Token(connectorId: string, authConfig: AuthConfig | null): Promise<string> {
    if (!authConfig?.tokenUrl || !authConfig?.clientId || !authConfig?.clientSecret) {
      throw new Error("OAuth2 client credentials not configured");
    }

    const cached = this.tokenCache.get(connectorId);
    if (cached && cached.expiresAt > Date.now() + this.TOKEN_BUFFER_MS) {
      return cached.accessToken;
    }

    const response = await fetch(authConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: authConfig.clientId,
        client_secret: authConfig.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth2 token request failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json() as { access_token: string; expires_in: number };
    const expiresIn = tokenData.expires_in || 3600;

    this.tokenCache.set(connectorId, {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    return tokenData.access_token;
  }

  private buildUrl(
    connector: Connector,
    endpoint: Endpoint,
    paginationState: PaginationState | null = null
  ): string {
    let url = `${connector.baseUrl}${endpoint.path}`;
    const paginationConfig = endpoint.paginationConfig as PaginationConfig | null;

    if (paginationConfig) {
      const params = new URLSearchParams();

      switch (paginationConfig.type) {
        case "cursor": {
          const cursor = paginationState?.cursor;
          if (cursor && paginationConfig.cursorParam) {
            params.set(paginationConfig.cursorParam, cursor);
          }
          break;
        }

        case "offset": {
          if (paginationConfig.offsetParam && paginationConfig.limitParam) {
            const limit = paginationConfig.limit || 100;
            const offset = paginationState?.offset ?? 0;
            params.set(paginationConfig.offsetParam, offset.toString());
            params.set(paginationConfig.limitParam, limit.toString());
          }
          break;
        }

        case "page": {
          if (paginationConfig.pageParam) {
            const page = paginationState?.page ?? 1;
            params.set(paginationConfig.pageParam, page.toString());
          }
          break;
        }

        case "time_window": {
          if (paginationConfig.timestampParam) {
            const timeWindow = paginationState?.timeWindow;
            if (timeWindow) {
              params.set(paginationConfig.timestampParam, timeWindow);
            }
          }
          break;
        }
      }

      const queryString = params.toString();
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString;
      }
    }

    return url;
  }

  private extractData(rawData: unknown, dataPath: string | null): unknown {
    if (!dataPath) {
      return rawData;
    }

    const parts = dataPath.replace(/^\$\.?/, "").split(".");
    let current: unknown = rawData;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }

      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = (current as Record<string, unknown>)[key];
        if (Array.isArray(current)) {
          current = current[parseInt(index, 10)];
        }
      } else if (part === "*" && Array.isArray(current)) {
        return current;
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  }

  private countRecordsRecursive(data: unknown): number {
    let maxCount = 0;
    
    const recurse = (value: unknown) => {
      if (Array.isArray(value)) {
        if (value.length > maxCount) {
          maxCount = value.length;
        }
        // Also recurse into array items in case they contain nested arrays
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            recurse(item);
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const prop of Object.values(value as Record<string, unknown>)) {
          recurse(prop);
        }
      }
    };
    
    recurse(data);
    return maxCount;
  }

  private countRecords(data: unknown): number {
    return this.countRecordsRecursive(data);
  }

  private findTimestampInObject(obj: Record<string, unknown>, field: string): string | null {
    // Direct lookup
    if (field in obj && typeof obj[field] === 'string') {
      return obj[field] as string;
    }
    
    // Handle dot-notation paths like "attributes.updated_at"
    if (field.includes('.')) {
      const parts = field.split('.');
      let current: unknown = obj;
      for (const part of parts) {
        if (typeof current === 'object' && current !== null && part in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return null;
        }
      }
      return typeof current === 'string' ? current : null;
    }
    
    // Deep search in all properties
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const found = this.findTimestampInObject(value as Record<string, unknown>, field);
        if (found) return found;
      }
    }
    
    return null;
  }

  private extractMaxTimestamp(data: unknown, fieldName: string): string | null {
    const timestamps: string[] = [];
    
    // FIX 2: Recursively search for timestamp fields in nested data structures
    const recurse = (value: unknown) => {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "object" && item !== null) {
            // Extract timestamp from object using findTimestampInObject for deep nested search
            const ts = this.findTimestampInObject(item as Record<string, unknown>, fieldName);
            if (ts) {
              timestamps.push(ts);
            }
            // Also recurse into object properties to find nested arrays
            for (const prop of Object.values(item as Record<string, unknown>)) {
              recurse(prop);
            }
          }
        }
      } else if (typeof value === "object" && value !== null) {
        // Recurse into object properties to find nested arrays
        for (const prop of Object.values(value as Record<string, unknown>)) {
          recurse(prop);
        }
      }
    };

    recurse(data);

    if (timestamps.length === 0) {
      return null;
    }

    // Return the maximum timestamp (assuming ISO format which is lexicographically sortable)
    return timestamps.sort().pop() || null;
  }

  private getTimestampFieldFromPath(timestampPath: string | undefined): string {
    if (!timestampPath) {
      return "timestamp";
    }

    // Extract the last part of the path (e.g., "data.timestamp" -> "timestamp")
    const parts = timestampPath.split(".");
    return parts[parts.length - 1];
  }

  private extractPagination(
    rawData: unknown,
    paginationConfig: PaginationConfig | null,
    paginationState: PaginationState | null,
    extractedData?: unknown,
    previousState?: PaginationState | null
  ): PollResult["pagination"] | undefined {
    if (!paginationConfig) {
      return undefined;
    }

    const data = rawData as Record<string, unknown>;
    const recordCount = this.countRecords(extractedData);

    switch (paginationConfig.type) {
      case "cursor": {
        const cursorPath = paginationConfig.cursorPath || "nextCursor";
        const nextCursor = this.extractData(data, cursorPath) as string | null;
        return {
          hasMore: !!nextCursor,
          nextCursor: nextCursor || undefined,
          recordCount,
        };
      }

      case "offset": {
        const limit = paginationConfig.limit || 100;
        const currentOffset = paginationState?.offset ?? 0;
        const items = Array.isArray(data) ? data : (data.data || data.items || []);
        const hasMore = Array.isArray(items) && items.length >= limit;
        return {
          hasMore,
          nextOffset: hasMore ? currentOffset + limit : undefined,
          recordCount,
        };
      }

      case "page": {
        const currentPage = paginationState?.page ?? 1;
        const hasNextPage = !!(data.hasNextPage || data.has_next_page || data.nextPage);
        return {
          hasMore: hasNextPage,
          nextPage: hasNextPage ? currentPage + 1 : undefined,
          recordCount,
        };
      }

      case "time_window": {
        const timestampPath = paginationConfig.timestampPath || "lastTimestamp";
        let nextTimestamp = this.extractData(data, timestampPath) as string | null;

        // If no explicit nextTimestamp in response, extract max timestamp from the actual data
        if (!nextTimestamp && extractedData && recordCount > 0) {
          const fieldName = this.getTimestampFieldFromPath(paginationConfig.timestampPath);
          nextTimestamp = this.extractMaxTimestamp(extractedData, fieldName);
        }

        // FIX 2: If we still have no timestamp but we have records,
        // preserve the previous timeWindow to maintain the checkpoint
        if (!nextTimestamp && recordCount > 0 && previousState?.timeWindow) {
          nextTimestamp = previousState.timeWindow;
        }

        return {
          hasMore: !!nextTimestamp,
          nextCursor: nextTimestamp || undefined,
          recordCount,
        };
      }

      default:
        return undefined;
    }
  }

  private checkRateLimit(
    connectorId: string,
    requestsPerMinute: number
  ): { allowed: boolean; remaining: number; resetInMs: number } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    let state = this.rateLimitState.get(connectorId);
    if (!state) {
      state = { requests: [], requestsPerMinute };
      this.rateLimitState.set(connectorId, state);
    }

    state.requests = state.requests.filter((t) => t > oneMinuteAgo);
    state.requestsPerMinute = requestsPerMinute;

    const remaining = Math.max(0, requestsPerMinute - state.requests.length);
    const resetInMs = state.requests.length > 0 ? state.requests[0] + 60000 - now : 0;

    return {
      allowed: state.requests.length < requestsPerMinute,
      remaining,
      resetInMs,
    };
  }

  private recordRequest(connectorId: string): void {
    const state = this.rateLimitState.get(connectorId);
    if (state) {
      state.requests.push(Date.now());
    }
  }

  private serializePaginationState(state: PaginationState): string {
    return JSON.stringify(state);
  }

  private deserializePaginationState(json: string | null | undefined): PaginationState | null {
    if (!json) {
      return null;
    }

    try {
      // Check if it looks like JSON (starts with '{')
      if (json.startsWith("{")) {
        const parsed = JSON.parse(json) as PaginationState;
        if (parsed.type) {
          return parsed;
        }
      }
    } catch (error) {
      // If JSON parsing fails, fall through to legacy string handling
    }

    // Legacy support: if it's just a cursor string, convert to cursor pagination state
    // This maintains backward compatibility with existing data
    return {
      type: "cursor",
      cursor: json,
    };
  }

  /**
   * Builds and serializes pagination state from extraction results.
   * This persists the pagination position for the next poll cycle.
   * 
   * EXAMPLES OF STATE PROGRESSION:
   * 
   * OFFSET PAGINATION:
   *   Poll 1: Returns 100 items → state: { type: "offset", offset: 0 } → persist nextOffset: 100
   *   Poll 2: Returns 100 items → state: { type: "offset", offset: 100 } → persist nextOffset: 200
   *   Poll 3: Returns 50 items → state: { type: "offset", offset: 200 } → hasMore: false, no nextOffset
   *          → Clear state (return "") to start fresh next poll
   * 
   * PAGE PAGINATION:
   *   Poll 1: hasNextPage=true → state: { type: "page", page: 1 } → persist nextPage: 2
   *   Poll 2: hasNextPage=true → state: { type: "page", page: 2 } → persist nextPage: 3
   *   Poll 3: hasNextPage=false → state: { type: "page", page: 3 } → Clear state (return "")
   * 
   * TIME_WINDOW PAGINATION:
   *   Poll 1: Returns records modified after 2024-01-15T00:00:00Z → store lastTimestamp: 2024-01-15T12:34:56Z
   *   Poll 2: Returns records modified after 2024-01-15T12:34:56Z → store lastTimestamp: 2024-01-15T18:45:30Z
   *   Poll 3: No new records → Keep previous timestamp (return null to skip update)
   *
   * FIX: When hasMore=false AND recordCount > 0, clear state entirely (return "").
   * This ensures next poll starts fresh instead of maintaining partial state.
   * When hasMore=false AND recordCount === 0, the caller should NOT update lastCursor,
   * preserving the checkpoint for the next attempt.
   */
  private buildPaginationStateFromResult(
    paginationType: string,
    pagination: PollResult["pagination"],
    previousState?: PaginationState | null
  ): string | null {
    if (!pagination) {
      return "";
    }

    const recordCount = pagination.recordCount || 0;

    // FIX 1: When pagination is complete (hasMore=false) AND we have records,
    // clear the state entirely. Next poll will use default values (offset=0, page=1, etc)
    // This is correct for offset/page pagination which want fresh full syncs after completion
    if (!pagination.hasMore && recordCount > 0) {
      return "";
    }

    // FIX 3: When no new records (hasMore=false AND recordCount=0),
    // return null to signal the caller to preserve the existing lastCursor
    // This is essential for time_window pagination to maintain the checkpoint
    if (!pagination.hasMore && recordCount === 0) {
      return null;
    }

    const state: PaginationState = {
      type: paginationType as "cursor" | "offset" | "page" | "time_window",
    };

    switch (paginationType) {
      case "cursor":
        if (pagination.nextCursor) {
          state.cursor = pagination.nextCursor;
        }
        break;
      case "offset":
        if (pagination.nextOffset !== undefined) {
          state.offset = pagination.nextOffset;
        }
        break;
      case "page":
        if (pagination.nextPage !== undefined) {
          state.page = pagination.nextPage;
        }
        break;
      case "time_window":
        // FIX 3: For time_window, preserve the timestamp checkpoint
        // Use nextCursor from pagination (set by extractPagination), or fallback to previous state
        if (pagination.nextCursor) {
          state.timeWindow = pagination.nextCursor;
        } else if (previousState?.timeWindow) {
          // Fallback to previous timeWindow if no new cursor found
          state.timeWindow = previousState.timeWindow;
        }
        break;
    }

    return this.serializePaginationState(state);
  }

  clearTokenCache(connectorId?: string): void {
    if (connectorId) {
      this.tokenCache.delete(connectorId);
    } else {
      this.tokenCache.clear();
    }
  }

  clearRateLimitState(connectorId?: string): void {
    if (connectorId) {
      this.rateLimitState.delete(connectorId);
    } else {
      this.rateLimitState.clear();
    }
  }
}

export const connectorEngine = new ConnectorEngine();
