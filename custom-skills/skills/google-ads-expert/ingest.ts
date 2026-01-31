/**
 * GoogleAdsExpert - Ingest Handler
 * 
 * Maneja el webhook HTTP para recibir datos de Google Ads Scripts.
 * 
 * Seguridad:
 * - Requiere Authorization header con Bearer token
 * - Rechaza y loguea requests sin auth o con token inválido
 * - Valida schema estrictamente antes de persistir
 */

import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { getDataSource } from "./datasources/index.js";
import { AdsDataRecord, IngestResponse, DataSourceType } from "./types.js";
import { audit } from "../../core/audit.js";

const DATA_DIR = '/root/.openclaw/custom-skills/data/google-ads';

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Verificar token de autorización
 */
function verifyToken(authHeader: string | undefined): { valid: boolean; error?: string } {
  const expectedToken = process.env.GOOGLE_ADS_WEBHOOK_TOKEN;
  
  if (!expectedToken) {
    return { valid: false, error: 'Webhook token not configured on server' };
  }
  
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Invalid Authorization format (expected Bearer token)' };
  }
  
  const token = authHeader.substring(7);
  if (token !== expectedToken) {
    return { valid: false, error: 'Invalid token' };
  }
  
  return { valid: true };
}

/**
 * Persistir record en archivo JSONL
 */
function persistRecord(record: AdsDataRecord): void {
  ensureDataDir();
  
  const date = new Date().toISOString().split('T')[0];
  const filename = path.join(DATA_DIR, date + '.jsonl');
  
  const line = JSON.stringify(record) + '\n';
  fs.appendFileSync(filename, line, 'utf-8');
}

/**
 * Procesar ingest de datos de Google Ads
 */
export async function handleIngest(
  authHeader: string | undefined,
  rawPayload: unknown,
  sourceType: DataSourceType = 'ads-script'
): Promise<IngestResponse> {
  const recordId = randomUUID();
  const ingestedAt = new Date().toISOString();
  
  // 1. Verificar autenticación
  const authResult = verifyToken(authHeader);
  if (!authResult.valid) {
    await audit.log({
      skill: 'google-ads-expert',
      action: 'ingest_blocked',
      input: { 
        reason: authResult.error,
        sourceType 
      },
      output: { blocked: true },
      queries: []
    });
    
    return {
      success: false,
      error: authResult.error
    };
  }
  
  // 2. Obtener datasource
  const dataSource = getDataSource(sourceType);
  
  // 3. Validar payload
  const validation = dataSource.validate(rawPayload);
  
  if (!validation.valid) {
    await audit.log({
      skill: 'google-ads-expert',
      action: 'ingest_validation_failed',
      input: { 
        sourceType,
        errors: validation.errors 
      },
      output: { valid: false },
      queries: []
    });
    
    return {
      success: false,
      error: 'Validation failed',
      validation
    };
  }
  
  // 4. Transformar a schema unificado
  const payload = dataSource.transform(rawPayload);
  
  // 5. Crear record
  const record: AdsDataRecord = {
    id: recordId,
    ingestedAt,
    source: sourceType,
    payload,
    validation
  };
  
  // 6. Persistir
  try {
    persistRecord(record);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    
    await audit.log({
      skill: 'google-ads-expert',
      action: 'ingest_persist_error',
      input: { recordId },
      output: { error: errorMsg },
      queries: []
    });
    
    return {
      success: false,
      error: 'Failed to persist data: ' + errorMsg
    };
  }
  
  // 7. Log success
  await audit.log({
    skill: 'google-ads-expert',
    action: 'ingest_success',
    input: { 
      recordId,
      sourceType,
      accountId: payload.accountId,
      accountName: payload.accountName,
      dateRange: payload.dateRange,
      campaignCount: payload.campaigns.length
    },
    output: { 
      persisted: true,
      warnings: validation.warnings 
    },
    queries: []
  });
  
  return {
    success: true,
    recordId,
    validation
  };
}

/**
 * Leer registros de un día específico
 */
export function readRecords(date: string): AdsDataRecord[] {
  const filename = path.join(DATA_DIR, date + '.jsonl');
  
  if (!fs.existsSync(filename)) {
    return [];
  }
  
  const content = fs.readFileSync(filename, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);
  
  return lines.map(line => JSON.parse(line) as AdsDataRecord);
}

/**
 * Obtener último registro
 */
export function getLatestRecord(): AdsDataRecord | null {
  ensureDataDir();
  
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    return null;
  }
  
  const latestFile = path.join(DATA_DIR, files[0]);
  const content = fs.readFileSync(latestFile, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return null;
  }
  
  return JSON.parse(lines[lines.length - 1]) as AdsDataRecord;
}
