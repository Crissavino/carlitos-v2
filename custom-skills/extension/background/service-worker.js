/**
 * OpenClaw Browser Context - Background Service Worker
 *
 * Responsibilities:
 * - Validate domains against allowlist
 * - Handle messages from content scripts
 * - Enforce access rules (dom, tables, screenshot)
 * - Send data to OpenClaw server (localhost only)
 *
 * RESTRICTIONS:
 * - NO clicks, NO forms, NO navigation
 * - NO learning, NO long-term storage
 * - Read-only context only
 */

import allowlist from '../config/allowlist.json' assert { type: 'json' };

// ============================================================================
// ALLOWLIST VALIDATION
// ============================================================================

/**
 * Check if a URL is in the allowlist
 * @param {string} url - Full URL to check
 * @returns {{ allowed: boolean, access: string[], reason?: string }}
 */
function checkAllowlist(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    const fullPath = hostname + pathname;

    // Check blocked list first (always takes precedence)
    for (const blocked of allowlist.blocked) {
      if (fullPath.includes(blocked.pattern) || hostname.includes(blocked.pattern)) {
        return {
          allowed: false,
          access: [],
          reason: `Blocked: ${blocked.reason}`
        };
      }
    }

    // Check allowed domains
    for (const domain of allowlist.domains) {
      const pattern = domain.pattern;

      // Exact match or prefix match
      if (hostname === pattern ||
          hostname.endsWith('.' + pattern) ||
          fullPath.startsWith(pattern) ||
          hostname.startsWith(pattern.replace('/*', ''))) {

        // Special case for GitHub - must be under crissavino/
        if (pattern.includes('github.com/crissavino/')) {
          if (!pathname.startsWith('/crissavino/')) {
            return {
              allowed: false,
              access: [],
              reason: 'GitHub access limited to crissavino/ repos only'
            };
          }
        }

        return {
          allowed: true,
          access: domain.access || ['dom']
        };
      }
    }

    // Not in allowlist
    return {
      allowed: false,
      access: [],
      reason: 'Domain not in allowlist'
    };

  } catch (error) {
    return {
      allowed: false,
      access: [],
      reason: `Invalid URL: ${error.message}`
    };
  }
}

/**
 * Check if a specific access type is allowed for a URL
 * @param {string} url - URL to check
 * @param {string} accessType - 'dom', 'tables', or 'screenshot'
 * @returns {boolean}
 */
function hasAccess(url, accessType) {
  const result = checkAllowlist(url);
  return result.allowed && result.access.includes(accessType);
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, data } = message;
  const url = sender.tab?.url || '';

  console.log(`[OpenClaw] Message received: ${type} from ${url}`);

  switch (type) {
    case 'CHECK_ALLOWLIST':
      sendResponse(checkAllowlist(url));
      break;

    case 'GET_PAGE_CONTEXT':
      if (!hasAccess(url, 'dom')) {
        sendResponse({ error: 'DOM access not allowed for this domain' });
        break;
      }
      // Forward to content script to extract
      sendResponse({ allowed: true });
      break;

    case 'GET_TABLES':
      if (!hasAccess(url, 'tables')) {
        sendResponse({ error: 'Table access not allowed for this domain' });
        break;
      }
      sendResponse({ allowed: true });
      break;

    case 'TAKE_SCREENSHOT':
      if (!hasAccess(url, 'screenshot')) {
        sendResponse({ error: 'Screenshot not allowed for this domain' });
        break;
      }
      // Screenshots require explicit invocation - this is just validation
      sendResponse({ allowed: true });
      break;

    case 'SEND_CONTEXT':
      // Validate before sending to OpenClaw server
      if (!checkAllowlist(url).allowed) {
        sendResponse({ error: 'Domain not allowed' });
        break;
      }
      // Send to localhost OpenClaw server
      sendToOpenClaw(data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true; // Keep channel open for async response

    default:
      sendResponse({ error: `Unknown message type: ${type}` });
  }

  return true; // Keep channel open
});

// ============================================================================
// OPENCLAW SERVER COMMUNICATION
// ============================================================================

const OPENCLAW_SERVER = 'http://localhost:3847'; // Dedicated port for browser context

/**
 * Send page context to OpenClaw server
 * @param {object} context - Page context data
 */
async function sendToOpenClaw(context) {
  try {
    const response = await fetch(`${OPENCLAW_SERVER}/browser/context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...context,
        receivedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + allowlist.defaults.ttlMinutes * 60 * 1000).toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('[OpenClaw] Failed to send context:', error.message);
    // Don't throw - extension should work even if server is offline
    return {
      sent: false,
      error: error.message,
      note: 'Context extracted but not sent to server'
    };
  }
}

// ============================================================================
// EXTENSION ICON / BADGE
// ============================================================================

/**
 * Update extension badge based on current tab's allowlist status
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updateBadge(tab);
  } catch (error) {
    // Tab might not exist anymore
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateBadge(tab);
  }
});

function updateBadge(tab) {
  if (!tab.url) return;

  const result = checkAllowlist(tab.url);

  if (result.allowed) {
    chrome.action.setBadgeText({ tabId: tab.id, text: '✓' });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#22c55e' });
  } else {
    chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('[OpenClaw] Browser Context extension loaded');
console.log(`[OpenClaw] Allowlist version: ${allowlist.version}`);
console.log(`[OpenClaw] Allowed domains: ${allowlist.domains.length}`);
console.log(`[OpenClaw] Blocked patterns: ${allowlist.blocked.length}`);
