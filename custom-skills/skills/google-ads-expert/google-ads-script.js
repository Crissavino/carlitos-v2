/**
 * OpenClaw - Google Ads Export Script
 * 
 * Este script exporta métricas de campañas a OpenClaw via webhook.
 * 
 * Instalación:
 * 1. Ir a Google Ads > Tools & Settings > Scripts
 * 2. Click en "+" para crear nuevo script
 * 3. Pegar este código
 * 4. Configurar WEBHOOK_URL y WEBHOOK_TOKEN
 * 5. Autorizar el script
 * 6. Ejecutar manualmente o programar (recomendado: diario)
 * 
 * Notas:
 * - Solo exporta campañas ENABLED y PAUSED
 * - Las campañas REMOVED no están disponibles en Scripts
 * - Los valores de cost están en la moneda de la cuenta
 */

// ============================================================================
// CONFIGURACIÓN - MODIFICAR ESTOS VALORES
// ============================================================================

var CONFIG = {
  // URL del webhook de OpenClaw (reemplazar con tu URL real)
  WEBHOOK_URL: 'https://YOUR_DOMAIN/ingest/google-ads',
  
  // Token de autenticación (debe coincidir con GOOGLE_ADS_WEBHOOK_TOKEN en el servidor)
  WEBHOOK_TOKEN: 'YOUR_SECRET_TOKEN_HERE',
  
  // Rango de fechas para las métricas
  // Opciones: 'LAST_7_DAYS', 'LAST_30_DAYS', 'TODAY', 'YESTERDAY'
  DATE_RANGE: 'LAST_7_DAYS'
};

// ============================================================================
// NO MODIFICAR DEBAJO DE ESTA LÍNEA
// ============================================================================

function main() {
  Logger.log('OpenClaw Export Script - Starting...');
  
  // Obtener información de la cuenta
  var account = AdsApp.currentAccount();
  var accountId = account.getCustomerId();
  var accountName = account.getName();
  var currency = account.getCurrencyCode();
  
  Logger.log('Account: ' + accountName + ' (' + accountId + ')');
  Logger.log('Currency: ' + currency);
  Logger.log('Date Range: ' + CONFIG.DATE_RANGE);
  
  // Recolectar métricas de campañas
  var campaigns = [];
  
  var campaignIterator = AdsApp.campaigns()
    .withCondition('Status IN [ENABLED, PAUSED]')
    .get();
  
  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var stats = campaign.getStatsFor(CONFIG.DATE_RANGE);
    
    var clicks = stats.getClicks();
    var impressions = stats.getImpressions();
    var cost = stats.getCost();
    var conversions = stats.getConversions();
    var conversionValue = stats.getConversionValue();
    
    campaigns.push({
      campaignId: campaign.getId().toString(),
      campaignName: campaign.getName(),
      status: campaign.isEnabled() ? 'ENABLED' : 'PAUSED',
      cost: cost,
      clicks: clicks,
      impressions: impressions,
      conversions: conversions,
      conversionValue: conversionValue,
      // Métricas derivadas (el servidor las recalcula)
      ctr: impressions > 0 ? (clicks / impressions) : 0,
      cpc: clicks > 0 ? (cost / clicks) : 0,
      conversionRate: clicks > 0 ? (conversions / clicks) : 0
    });
  }
  
  Logger.log('Found ' + campaigns.length + ' campaigns');
  
  // Construir payload
  var payload = {
    source: 'ads-script',
    accountId: accountId,
    accountName: accountName,
    currency: currency,
    dateRange: CONFIG.DATE_RANGE,
    fetchedAt: new Date().toISOString(),
    campaigns: campaigns
  };
  
  // Enviar a webhook
  Logger.log('Sending to webhook...');
  
  var options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.WEBHOOK_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();
    
    Logger.log('Response Code: ' + responseCode);
    Logger.log('Response Body: ' + responseBody);
    
    if (responseCode === 200) {
      Logger.log('SUCCESS: Data exported to OpenClaw');
    } else {
      Logger.log('ERROR: Webhook returned ' + responseCode);
    }
  } catch (e) {
    Logger.log('ERROR: Failed to send webhook - ' + e.message);
  }
  
  Logger.log('OpenClaw Export Script - Finished');
}
