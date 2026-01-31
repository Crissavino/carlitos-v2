/**
 * GoogleApiSource - Google Ads API DataSource (STUB)
 * 
 * Futuro: Implementar cuando tengamos el Basic Token de Google Ads API.
 * 
 * Ventajas sobre AdsScript:
 * - Puede obtener campañas con status REMOVED
 * - Queries históricas más flexibles
 * - No depende de ejecución manual/scheduled
 * 
 * Requisitos para implementar:
 * - Developer Token (Basic access)
 * - OAuth2 credentials (client_id, client_secret, refresh_token)
 * - Customer ID
 */

import { AdsDataSource, ValidationResult } from "./interface.js";
import { AdsIngestPayload } from "../types.js";

export class GoogleApiSource implements AdsDataSource {
  readonly type = 'google-api' as const;
  readonly name = 'Google Ads API';
  
  isConfigured(): boolean {
    // TODO: Check environment variables for API credentials
    const hasDevToken = !!process.env.GOOGLE_ADS_DEV_TOKEN;
    const hasClientId = !!process.env.GOOGLE_ADS_CLIENT_ID;
    const hasClientSecret = !!process.env.GOOGLE_ADS_CLIENT_SECRET;
    const hasRefreshToken = !!process.env.GOOGLE_ADS_REFRESH_TOKEN;
    const hasCustomerId = !!process.env.GOOGLE_ADS_CUSTOMER_ID;
    
    return hasDevToken && hasClientId && hasClientSecret && hasRefreshToken && hasCustomerId;
  }
  
  validate(rawData: unknown): ValidationResult {
    // STUB: Not implemented yet
    return {
      valid: false,
      errors: ['GoogleApiSource not implemented yet. Use ads-script datasource.'],
      warnings: []
    };
  }
  
  transform(rawData: unknown): AdsIngestPayload {
    // STUB: Not implemented yet
    throw new Error('GoogleApiSource not implemented yet. Use ads-script datasource.');
  }
  
  /**
   * STUB: Future method to fetch data directly from Google Ads API
   */
  async fetch(dateRange: string): Promise<AdsIngestPayload> {
    throw new Error('GoogleApiSource.fetch() not implemented yet.');
  }
}
