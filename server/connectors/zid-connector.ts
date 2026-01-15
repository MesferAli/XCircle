/**
 * Zid E-commerce Platform Connector
 * 
 * Enterprise AI Layer - Zid Integration
 * 
 * Zid is a leading e-commerce platform in Saudi Arabia.
 * This connector enables integration with Zid stores for:
 * - Inventory management
 * - Order tracking
 * - Product catalog sync
 * 
 * API Documentation: https://docs.zid.sa/
 */

import { BaseConnector, ConnectorConfig, ConnectorResult, EndpointConfig } from './base-connector';

// ============================================
// Types
// ============================================

interface ZidConfig extends ConnectorConfig {
  accessToken: string;
  storeId?: string;
  managerToken?: string;
}

interface ZidProduct {
  id: string;
  sku: string;
  name: {
    ar: string;
    en?: string;
  };
  description?: {
    ar: string;
    en?: string;
  };
  price: number;
  sale_price?: number;
  quantity: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface ZidOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_price: number;
  currency: string;
  items: ZidOrderItem[];
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  created_at: string;
}

interface ZidOrderItem {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

interface ZidInventory {
  product_id: string;
  sku: string;
  quantity: number;
  is_unlimited: boolean;
  warehouse_id?: string;
}

// ============================================
// Zid Connector Implementation
// ============================================

export class ZidConnector extends BaseConnector {
  private config: ZidConfig;
  private baseUrl = 'https://api.zid.sa/v1';

  constructor(config: ZidConfig) {
    super({
      name: 'Zid',
      type: 'ecommerce',
      baseUrl: 'https://api.zid.sa/v1',
      authType: 'bearer',
    });
    this.config = config;
  }

  // ============================================
  // API Methods
  // ============================================

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'ar',
    };

    if (this.config.managerToken) {
      headers['X-Manager-Token'] = this.config.managerToken;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Zid API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }

  // ============================================
  // Products
  // ============================================

  /**
   * Get all products with pagination
   */
  async getProducts(page = 1, perPage = 50): Promise<ConnectorResult<ZidProduct[]>> {
    try {
      const data = await this.request<{ products: ZidProduct[]; meta: any }>(
        `/products?page=${page}&per_page=${perPage}`
      );
      return {
        success: true,
        data: data.products,
        metadata: {
          pagination: data.meta,
          source: 'zid',
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
  async getProduct(productId: string): Promise<ConnectorResult<ZidProduct>> {
    try {
      const data = await this.request<{ product: ZidProduct }>(`/products/${productId}`);
      return {
        success: true,
        data: data.product,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search products
   */
  async searchProducts(query: string): Promise<ConnectorResult<ZidProduct[]>> {
    try {
      const data = await this.request<{ products: ZidProduct[] }>(
        `/products/search?q=${encodeURIComponent(query)}`
      );
      return {
        success: true,
        data: data.products,
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
  async getInventory(): Promise<ConnectorResult<ZidInventory[]>> {
    try {
      const data = await this.request<{ inventory: ZidInventory[] }>('/inventory');
      return {
        success: true,
        data: data.inventory,
        metadata: {
          source: 'zid',
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
   * Get inventory for specific product
   */
  async getProductInventory(productId: string): Promise<ConnectorResult<ZidInventory>> {
    try {
      const data = await this.request<{ inventory: ZidInventory }>(`/inventory/${productId}`);
      return {
        success: true,
        data: data.inventory,
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
  async updateInventory(productId: string, quantity: number): Promise<ConnectorResult<{ recommendation: string }>> {
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
  async getOrders(page = 1, perPage = 50): Promise<ConnectorResult<ZidOrder[]>> {
    try {
      const data = await this.request<{ orders: ZidOrder[]; meta: any }>(
        `/orders?page=${page}&per_page=${perPage}`
      );
      return {
        success: true,
        data: data.orders,
        metadata: {
          pagination: data.meta,
          source: 'zid',
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
  async getOrder(orderId: string): Promise<ConnectorResult<ZidOrder>> {
    try {
      const data = await this.request<{ order: ZidOrder }>(`/orders/${orderId}`);
      return {
        success: true,
        data: data.order,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(status: string): Promise<ConnectorResult<ZidOrder[]>> {
    try {
      const data = await this.request<{ orders: ZidOrder[] }>(
        `/orders?status=${encodeURIComponent(status)}`
      );
      return {
        success: true,
        data: data.orders,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================
  // Warehouses
  // ============================================

  /**
   * Get all warehouses
   */
  async getWarehouses(): Promise<ConnectorResult<any[]>> {
    try {
      const data = await this.request<{ warehouses: any[] }>('/warehouses');
      return {
        success: true,
        data: data.warehouses,
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
        console.log('[Zid] New order received:', payload.order?.id);
        break;
      case 'order.updated':
        console.log('[Zid] Order updated:', payload.order?.id);
        break;
      case 'product.created':
        console.log('[Zid] Product created:', payload.product?.id);
        break;
      case 'product.updated':
        console.log('[Zid] Product updated:', payload.product?.id);
        break;
      case 'inventory.updated':
        console.log('[Zid] Inventory updated:', payload.product_id);
        break;
      default:
        console.log('[Zid] Unknown webhook event:', event);
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
          message: 'Successfully connected to Zid',
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
          { name: 'id', type: 'string', required: true },
        ],
      },
      {
        name: 'Search Products',
        path: '/products/search',
        method: 'GET',
        description: 'Search products by name or SKU',
        parameters: [
          { name: 'q', type: 'string', required: true },
        ],
      },
      {
        name: 'Inventory',
        path: '/inventory',
        method: 'GET',
        description: 'Get inventory for all products',
        parameters: [],
      },
      {
        name: 'Orders',
        path: '/orders',
        method: 'GET',
        description: 'List all orders',
        parameters: [
          { name: 'page', type: 'number', required: false },
          { name: 'per_page', type: 'number', required: false },
          { name: 'status', type: 'string', required: false },
        ],
      },
      {
        name: 'Order Details',
        path: '/orders/{id}',
        method: 'GET',
        description: 'Get order by ID',
        parameters: [
          { name: 'id', type: 'string', required: true },
        ],
      },
      {
        name: 'Warehouses',
        path: '/warehouses',
        method: 'GET',
        description: 'List all warehouses',
        parameters: [],
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

export function createZidConnector(config: {
  accessToken: string;
  managerToken?: string;
}): ZidConnector {
  return new ZidConnector({
    ...config,
    name: 'Zid',
    type: 'ecommerce',
    baseUrl: 'https://api.zid.sa/v1',
    authType: 'bearer',
  });
}
