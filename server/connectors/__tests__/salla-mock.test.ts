import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SallaConnector } from '../salla-connector';

describe('SallaConnector Mock Test', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch products correctly from mock API', async () => {
    const connector = new SallaConnector({
      clientId: 'mock_id',
      clientSecret: 'mock_secret',
      accessToken: 'mock_token'
    });

    const MOCK_SALLA_PRODUCTS = {
      success: true,
      data: [
        { id: 101, name: 'منتج تجريبي 1', price: { amount: 100, currency: 'SAR' }, sku: 'SKU1', quantity: 10, status: 'sale' },
        { id: 102, name: 'منتج تجريبي 2', price: { amount: 250, currency: 'SAR' }, sku: 'SKU2', quantity: 5, status: 'sale' }
      ],
      pagination: { total: 2 }
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_SALLA_PRODUCTS
    } as Response);

    const result = await connector.getProducts();
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.length).toBe(2);
    expect(result.data?.[0].name).toBe('منتج تجريبي 1');
  });

  it('should handle API errors gracefully', async () => {
    const connector = new SallaConnector({
      clientId: 'mock_id',
      clientSecret: 'mock_secret',
      accessToken: 'mock_token'
    });

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Unauthorized' })
    } as Response);

    const result = await connector.getProducts();
    expect(result.success).toBe(false);
    // The error is 'No refresh token available' because it tries to refresh on 401
    expect(result.error).toBeDefined();
  });
});
