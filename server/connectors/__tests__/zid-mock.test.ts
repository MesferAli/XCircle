import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZidConnector } from '../zid-connector';

describe('ZidConnector Mock Test', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch products correctly from mock API', async () => {
    const connector = new ZidConnector({
      accessToken: 'mock_zid_token',
      storeId: '999'
    });

    const MOCK_ZID_PRODUCTS = {
      products: [
        { id: '101', name: { ar: 'منتج زد 1' }, price: 100, sku: 'SKU1', quantity: 10, is_available: true },
        { id: '102', name: { ar: 'منتج زد 2' }, price: 200, sku: 'SKU2', quantity: 5, is_available: true }
      ],
      meta: { total: 2 }
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_ZID_PRODUCTS
    } as Response);

    const result = await connector.getProducts();
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.length).toBe(2);
    expect(result.data?.[0].name.ar).toBe('منتج زد 1');
  });

  it('should handle API errors gracefully', async () => {
    const connector = new ZidConnector({
      accessToken: 'mock_zid_token'
    });

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Unauthorized' })
    } as Response);

    const result = await connector.getProducts();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Zid API error');
  });
});
