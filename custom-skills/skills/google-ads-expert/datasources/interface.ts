/**
 * DataSource Interface
 * 
 * Abstracción para diferentes fuentes de datos de Google Ads.
 * Permite cambiar de AdsScript a API sin modificar el Analyzer.
 */

import { AdsIngestPayload, DataSourceType } from "../types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AdsDataSource {
  /**
   * Identificador del tipo de datasource
   */
  readonly type: DataSourceType;
  
  /**
   * Nombre descriptivo para logs
   */
  readonly name: string;
  
  /**
   * Validar datos entrantes según formato específico del source.
   * Cada source tiene su propio formato de entrada.
   */
  validate(rawData: unknown): ValidationResult;
  
  /**
   * Transformar datos del formato del source al schema unificado.
   * Precondición: validate() debe haber retornado valid: true
   */
  transform(rawData: unknown): AdsIngestPayload;
  
  /**
   * Verificar si el datasource está configurado correctamente.
   * Para AdsScript: siempre true si el webhook está habilitado.
   * Para GoogleApi: true si las credenciales están configuradas.
   */
  isConfigured(): boolean;
}
