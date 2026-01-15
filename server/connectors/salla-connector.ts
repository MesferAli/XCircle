/**
 * Salla E-commerce Platform Connector
 * 
 * Enterprise AI Layer - Salla Integration
 * 
 * Salla is a leading e-commerce platform in Saudi Arabia.
 * This connector enables integration with Salla stores for:
 * - Inventory management
 * - Order tracking
 * - Product catalog sync
 * 
 * API Documentation: https://docs.salla.dev/
 */

import { BaseConnector, ConnectorConfig, ConnectorResult, EndpointConfig } from './base-connector';

// ============================================
// Types
// ============================================

interface SallaConfig extends ConnectorConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  storeId?: string;
}

interface SallaProduct {
  id: number;
  sku: string;
  name: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
  };
  quantity: number;
  status: 'sale' | 'out' | 'hidden';
  created_at: string;
  updated_at: string;
}

interface SallaOrder {
  id: number;
  reference_id: string;
  status: {
    id: number;
    name: string;
    slug: string;
  };
  payment_method: string;
  amounts: {
    total: {
      amount: number;
      currency: string;
    };
  };
  items: SallaOrderItem[];
  created_at: string;
}

interface SallaOrderItem {
  id: number;
  product_id: number;
  sku: string;
  name: string;
  quantity: number;
  price: {
    amount: number;
    currency: string;
  };
}

interface SallaInventory {
  product_id: number;
  sku: string;
  quantity: number;
  unlimited: boolean;
}

// ============================================
// Salla Connector Implementation
// ============================================

export class SallaConnector extends BaseConnector {
  private config: SallaConfig;
  private baseUrl = 'https://api.salla.dev/admin/v2';

  constructor(config: SallaConfig) {
    super({
      name: 'Salla',
      type: 'ecommerce',
      baseUrl: 'https://api.salla.dev/admin/v2',
      authType: 'oauth2',
    });
    this.config = config;
  }

  // ============================================
  // Authentication
  // ============================================

  /**
   * Get OAuth2 authorization URL
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'offline_access',
      state,
    });
    return `https://accounts.salla.sa/oauth2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const response = await fetch('https://accounts.salla.sa/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code: ${response.statusText}`);
    }

    const data = await response.json();
    this.config.accessToken = data.access_token;
    this.config.refreshToken = data.refresh_token;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<string> {
    if (!this.config.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://accounts.salla.sa/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();
    this.config.accessToken = data.access_token;
    this.config.refreshToken = data.refresh_token;

    return data.access_token;
  }

  // ============================================
  // API Methods
  // ============================================

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.config.accessToken) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Try to refresh token
      await this.refreshAccessToken();
      return this.request<T>(endpoint, options);
    }

    if (!response.ok) {
      throw new Error(`Salla API error: ${response.statusText}`);
    }

    return response.json();
  }

  // ============================================
  // Products
  // ============================================

  /**
   * Get all products with pagination
   */
  async getProducts(page = 1, perPage = 50): Promise<ConnectorResult<SallaProduct[]>> {
    try {
      const data = await this.request<{ data: SallaProduct[]; pagination: any }>(
        `/products?page=${page}&per_page=${perPage}`
      );
      return {
        success: true,
        data: data.data,
        metadata: {
          pagination: data.pagination,
          source: 'salla',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: number): Promise<ConnectorResult<SallaProduct>> {
    try {
      const data = await this.request<{ data: SallaProduct }>(`/products/${productId}`);
      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================
  // Inventory
  // ============================================

  /**
   * Get inventory for all products
   */
  async getInventory(): Promise<ConnectorResult<SallaInventory[]>> {
    try {
      const products = await this.getProducts(1, 100);
      if (!products.success || !products.data) {
        return { success: false, error: 'Failed to fetch products' };
      }

      const inventory: SallaInventory[] = products.data.map(product => ({
        product_id: product.id,
        sku: product.sku,
        quantity: product.quantity,
        unlimited: product.quantity === -1,
      }));

      return {
        success: true,
        data: inventory,
        metadata: {
          source: 'salla',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update product inventory (READ-ONLY in EAL - returns recommendation only)
   */
  async updateInventory(productId: number, quantity: number): Promise<ConnectorResult<{ recommendation: string }>> {
    // EAL is READ-ONLY - we don't execute, we recommend
    return {
      success: true,
      data: {
        recommendation: `Update product ${productId} quantity to ${quantity}`,
      },
      metadata: {
        action: 'RECOMMENDATION_ONLY',
        reason: 'Enterprise AI Layer does not execute changes. Human approval required.',
      },
    };
  }

  // ============================================
  // Orders
  // ============================================

  /**
   * Get orders with pagination
   */
  async getOrders(page = 1, perPage = 50): Promise<ConnectorResult<SallaOrder[]>> {
    try {
      const data = await this.request<{ data: SallaOrder[]; pagination: any }>(
        `/orders?page=${page}&per_page=${perPage}`
      );
      return {
        success: true,
        data: data.data,
        metadata: {
          pagination: data.pagination,
          source: 'salla',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: number): Promise<ConnectorResult<SallaOrder>> {
    try {
      const data = await this.request<{ data: SallaOrder }>(`/orders/${orderId}`);
      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================
  // Webhooks
  // ============================================

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return signature === expectedSignature;
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(event: string, payload: any): Promise<void> {
    switch (event) {
      case 'order.created':
        console.log('[Salla] New order received:', payload.data?.id);
        break;
      case 'product.updated':
        console.log('[Salla] Product updated:', payload.data?.id);
        break;
      case 'inventory.updated':
        console.log('[Salla] Inventory updated:', payload.data?.product_id);
        break;
      default:
        console.log('[Salla] Unknown webhook event:', event);
    }
  }

  // ============================================
  // Connection Test
  // ============================================

  async testConnection(): Promise<ConnectorResult<boolean>> {
    try {
      await this.request('/store');
      return {
        success: true,
        data: true,
        metadata: {
          message: 'Successfully connected to Salla',
        },
      };
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  // ============================================
  // Endpoint Discovery
  // ============================================

  getAvailableEndpoints(): EndpointConfig[] {
    return [
      {
        name: 'Products',
        path: '/products',
        method: 'GET',
        description: 'List all products',
        parameters: [
          { name: 'page', type: 'number', required: false },
          { name: 'per_page', type: 'number', required: false },
        ],
      },
      {
        name: 'Product Details',
        path: '/products/{id}',
        method: 'GET',
        description: 'Get product by ID',
        parameters: [
          { name: 'id', type: 'number', required: true },
        ],
      },
      {
        name: 'Orders',
        path: '/orders',
        method: 'GET',
        description: 'List all orders',
        parameters: [
          { name: 'page', type: 'number', required: false },
          { name: 'per_page', type: 'number', required: false },
        ],
      },
      {
        name: 'Order Details',
        path: '/orders/{id}',
        method: 'GET',
        description: 'Get order by ID',
        parameters: [
          { name: 'id', type: 'number', required: true },
        ],
      },
      {
        name: 'Store Info',
        path: '/store',
        method: 'GET',
        description: 'Get store information',
        parameters: [],
      },
    ];
  }
}

// ============================================
// Factory Function
// ============================================

export function createSallaConnector(config: {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
}): SallaConnector {
  return new SallaConnector({
    ...config,
    name: 'Salla',
    type: 'ecommerce',
    baseUrl: 'https://api.salla.dev/admin/v2',
    authType: 'oauth2',
  });
}
