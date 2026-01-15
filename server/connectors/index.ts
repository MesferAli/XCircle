/**
 * Connectors Module
 * 
 * Enterprise AI Layer - E-commerce Platform Integrations
 * 
 * This module exports all available connectors for external systems.
 */

// Base connector
export {
  BaseConnector,
  ConnectorConfig,
  ConnectorResult,
  EndpointConfig,
  EndpointParameter,
  ConnectionStatus,
  ConnectorRegistry,
} from './base-connector';

// Salla connector
export {
  SallaConnector,
  createSallaConnector,
} from './salla-connector';

// Zid connector
export {
  ZidConnector,
  createZidConnector,
} from './zid-connector';

// ============================================
// Connector Factory
// ============================================

import { BaseConnector } from './base-connector';
import { createSallaConnector } from './salla-connector';
import { createZidConnector } from './zid-connector';

export type ConnectorType = 'salla' | 'zid' | 'custom';

export interface ConnectorFactoryConfig {
  type: ConnectorType;
  credentials: Record<string, string>;
}

/**
 * Create a connector based on type
 */
export function createConnector(config: ConnectorFactoryConfig): BaseConnector {
  switch (config.type) {
    case 'salla':
      return createSallaConnector({
        clientId: config.credentials.clientId,
        clientSecret: config.credentials.clientSecret,
        accessToken: config.credentials.accessToken,
        refreshToken: config.credentials.refreshToken,
      });

    case 'zid':
      return createZidConnector({
        accessToken: config.credentials.accessToken,
        managerToken: config.credentials.managerToken,
      });

    case 'custom':
      throw new Error('Custom connectors should be created directly');

    default:
      throw new Error(`Unknown connector type: ${config.type}`);
  }
}

/**
 * Get list of supported connectors
 */
export function getSupportedConnectors(): Array<{
  type: ConnectorType;
  name: string;
  description: string;
  authType: string;
  requiredCredentials: string[];
}> {
  return [
    {
      type: 'salla',
      name: 'Salla',
      description: 'منصة سلة للتجارة الإلكترونية',
      authType: 'OAuth2',
      requiredCredentials: ['clientId', 'clientSecret'],
    },
    {
      type: 'zid',
      name: 'Zid',
      description: 'منصة زد للتجارة الإلكترونية',
      authType: 'Bearer Token',
      requiredCredentials: ['accessToken'],
    },
  ];
}
