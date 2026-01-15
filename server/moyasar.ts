import crypto from 'crypto';

const MOYASAR_API_URL = 'https://api.moyasar.com/v1';

// ==================== PAYMENT SOURCE TYPES ====================

export interface CreditCardSource {
  type: 'creditcard';
  name: string;
  number: string;
  cvc: string;
  month: string;
  year: string;
}

export interface MadaSource {
  type: 'mada';
  name: string;
  number: string;
  cvc: string;
  month: string;
  year: string;
}

export interface ApplePaySource {
  type: 'applepay';
  token: string;
}

// Token-based payment source (PCI-compliant)
// Used when card was tokenized via Moyasar frontend SDK
export interface TokenSource {
  type: 'token';
  token: string;
  '3ds'?: boolean;
  manual?: boolean;
}

export type PaymentSource = CreditCardSource | MadaSource | ApplePaySource | TokenSource;

// ==================== REQUEST TYPES ====================

export interface CreatePaymentRequest {
  amount: number;
  currency: string;
  description: string;
  callback_url: string;
  source: PaymentSource;
  metadata?: Record<string, string>;
}

export interface RefundPaymentRequest {
  amount?: number;
}

// ==================== RESPONSE TYPES ====================

export type PaymentStatus = 
  | 'initiated'
  | 'paid'
  | 'failed'
  | 'authorized'
  | 'captured'
  | 'refunded'
  | 'voided'
  | 'verified';

export interface PaymentSourceResponse {
  type: string;
  company?: string;
  name?: string;
  number?: string;
  gateway_id?: string;
  reference_number?: string;
  token?: string;
  message?: string;
  transaction_url?: string;
}

export interface PaymentResponse {
  id: string;
  status: PaymentStatus;
  amount: number;
  fee: number;
  currency: string;
  refunded: number;
  refunded_at: string | null;
  captured: number;
  captured_at: string | null;
  voided_at: string | null;
  description: string;
  amount_format: string;
  fee_format: string;
  refunded_format: string;
  captured_format: string;
  invoice_id: string | null;
  ip: string | null;
  callback_url: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, string> | null;
  source: PaymentSourceResponse;
}

export interface RefundResponse {
  id: string;
  payment_id: string;
  status: 'refunded' | 'failed';
  amount: number;
  fee: number;
  currency: string;
  amount_format: string;
  fee_format: string;
  created_at: string;
  updated_at: string;
}

export interface MoyasarError {
  type: string;
  message: string;
  errors?: Record<string, string[]>;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Convert SAR amount to halalas (smallest currency unit)
 * 1 SAR = 100 halalas
 * @param amount Amount in SAR
 * @returns Amount in halalas
 */
export function formatAmountForMoyasar(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert halalas to SAR amount
 * 100 halalas = 1 SAR
 * @param halalas Amount in halalas
 * @returns Amount in SAR
 */
export function formatAmountFromMoyasar(halalas: number): number {
  return halalas / 100;
}

// ==================== MOYASAR CLIENT ====================

export class MoyasarClient {
  private secretKey: string;
  private baseUrl: string;

  constructor(secretKey?: string) {
    this.secretKey = secretKey || process.env.MOYASAR_SECRET_KEY || '';
    this.baseUrl = MOYASAR_API_URL;

    if (!this.secretKey) {
      console.warn('[MoyasarClient] No secret key provided. Set MOYASAR_SECRET_KEY environment variable.');
    }
  }

  /**
   * Get Basic Auth header value
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.secretKey}:`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Make authenticated request to Moyasar API
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      const error = data as MoyasarError;
      throw new MoyasarApiError(
        error.message || 'Moyasar API request failed',
        response.status,
        error.type,
        error.errors
      );
    }

    return data as T;
  }

  /**
   * Create a new payment
   * @param amount Amount in halalas (smallest currency unit)
   * @param currency Currency code (e.g., 'SAR')
   * @param description Payment description
   * @param callbackUrl URL to redirect after payment
   * @param source Payment source (creditcard, mada, or applepay)
   * @param metadata Optional metadata key-value pairs
   * @returns Payment response
   */
  async createPayment(
    amount: number,
    currency: string,
    description: string,
    callbackUrl: string,
    source: PaymentSource,
    metadata?: Record<string, string>
  ): Promise<PaymentResponse> {
    const payload: CreatePaymentRequest = {
      amount,
      currency,
      description,
      callback_url: callbackUrl,
      source,
    };

    if (metadata) {
      payload.metadata = metadata;
    }

    return this.request<PaymentResponse>('POST', '/payments', payload);
  }

  /**
   * Get payment details by ID
   * @param paymentId The payment ID to retrieve
   * @returns Payment response
   */
  async getPayment(paymentId: string): Promise<PaymentResponse> {
    return this.request<PaymentResponse>('GET', `/payments/${paymentId}`);
  }

  /**
   * Refund a payment
   * @param paymentId The payment ID to refund
   * @param amount Optional amount to refund in halalas (partial refund). If not provided, full refund.
   * @returns Refund response
   */
  async refundPayment(paymentId: string, amount?: number): Promise<RefundResponse> {
    const payload: RefundPaymentRequest = {};
    
    if (amount !== undefined) {
      payload.amount = amount;
    }

    return this.request<RefundResponse>('POST', `/payments/${paymentId}/refund`, payload);
  }

  /**
   * Verify webhook signature to ensure authenticity
   * Moyasar uses HMAC-SHA256 for webhook signatures
   * @param payload The raw webhook payload (string or Buffer)
   * @param signature The signature from the X-Moyasar-Signature header
   * @returns Boolean indicating if signature is valid
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    if (!this.secretKey) {
      console.error('[MoyasarClient] Cannot verify webhook: No secret key configured');
      return false;
    }

    try {
      const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');
      
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(payloadString)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('[MoyasarClient] Webhook signature verification failed:', error);
      return false;
    }
  }
}

// ==================== CUSTOM ERROR CLASS ====================

export class MoyasarApiError extends Error {
  public statusCode: number;
  public type: string;
  public errors?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode: number,
    type: string,
    errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'MoyasarApiError';
    this.statusCode = statusCode;
    this.type = type;
    this.errors = errors;
  }
}

// ==================== SINGLETON INSTANCE ====================

export const moyasarClient = new MoyasarClient();
