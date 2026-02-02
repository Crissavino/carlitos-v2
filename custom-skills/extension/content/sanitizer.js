/**
 * OpenClaw Browser Context - Sanitizer Utilities
 *
 * Additional sanitization utilities for content extraction.
 * Ensures no sensitive data leaks through.
 */

// ============================================================================
// SENSITIVE DATA PATTERNS
// ============================================================================

const SENSITIVE_PATTERNS = {
  // Credentials
  password: /password\s*[:=]\s*\S+/gi,
  apiKey: /api[_-]?key\s*[:=]\s*["']?[a-zA-Z0-9_-]+["']?/gi,
  token: /token\s*[:=]\s*["']?[a-zA-Z0-9_.-]+["']?/gi,
  bearer: /bearer\s+[a-zA-Z0-9_.-]+/gi,
  secret: /secret\s*[:=]\s*\S+/gi,

  // Financial
  creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  cvv: /\bcvv\s*[:=]?\s*\d{3,4}\b/gi,

  // Personal
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,

  // Technical
  privateKey: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
  awsKey: /AKIA[0-9A-Z]{16}/g,
  jwtToken: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g
};

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Redact all sensitive patterns from text
 * @param {string} text - Input text
 * @returns {string} - Sanitized text
 */
export function redactSensitiveData(text) {
  if (!text) return '';

  let sanitized = text;

  for (const [name, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    sanitized = sanitized.replace(pattern, `[REDACTED:${name}]`);
  }

  return sanitized;
}

/**
 * Check if text contains sensitive data
 * @param {string} text - Input text
 * @returns {boolean}
 */
export function containsSensitiveData(text) {
  if (!text) return false;

  for (const pattern of Object.values(SENSITIVE_PATTERNS)) {
    if (pattern.test(text)) {
      return true;
    }
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
  }

  return false;
}

/**
 * Strip HTML tags and scripts
 * @param {string} html - Input HTML
 * @returns {string} - Plain text
 */
export function stripHtml(html) {
  if (!html) return '';

  // Remove script tags and content
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and content
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Remove all other tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Decode HTML entities
 * @param {string} text - Input text
 * @returns {string}
 */
function decodeHtmlEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' '
  };

  return text.replace(/&\w+;|&#\d+;/g, match => {
    return entities[match] || match;
  });
}

/**
 * Truncate text to max length
 * @param {string} text - Input text
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
export function truncate(text, maxLength = 100000) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '... [TRUNCATED]';
}

/**
 * Full sanitization pipeline
 * @param {string} text - Input text
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
export function sanitize(text, maxLength = 100000) {
  let result = text;

  // Strip HTML
  result = stripHtml(result);

  // Redact sensitive data
  result = redactSensitiveData(result);

  // Truncate
  result = truncate(result, maxLength);

  return result;
}
