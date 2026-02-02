/**
 * OpenClaw Browser Context - Content Extractor
 *
 * Extracts page content in a safe, sanitized way.
 * Injected only into allowlisted domains.
 *
 * CAPABILITIES:
 * - Read visible text content
 * - Extract tables as structured data
 * - Get headings hierarchy
 * - Extract links
 *
 * RESTRICTIONS:
 * - NO clicks
 * - NO form filling
 * - NO navigation
 * - NO DOM modification
 * - NO script execution
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  maxTextLength: 100000,
  maxTables: 20,
  maxLinks: 100,
  maxHeadings: 50,
  sensitivePatterns: [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /bearer/i,
    /credit[_-]?card/i,
    /cvv/i,
    /ssn/i,
    /social[_-]?security/i
  ]
};

// ============================================================================
// SANITIZATION
// ============================================================================

/**
 * Remove sensitive data patterns from text
 * @param {string} text - Input text
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
  if (!text) return '';

  let sanitized = text;

  // Remove script content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]+>/g, ' ');

  // Mask sensitive patterns
  for (const pattern of CONFIG.sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // Collapse whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Truncate if too long
  if (sanitized.length > CONFIG.maxTextLength) {
    sanitized = sanitized.substring(0, CONFIG.maxTextLength) + '... [TRUNCATED]';
  }

  return sanitized;
}

/**
 * Check if an element should be excluded from extraction
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
function shouldExclude(element) {
  // Skip hidden elements
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return true;
  }

  // Skip form elements (we don't interact with forms)
  if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName)) {
    return true;
  }

  // Skip elements with sensitive class names
  const className = element.className?.toString() || '';
  if (/password|secret|private|auth/i.test(className)) {
    return true;
  }

  return false;
}

// ============================================================================
// CONTENT EXTRACTION
// ============================================================================

/**
 * Extract main text content from the page
 * @returns {string}
 */
function extractTextContent() {
  // Try to find main content area
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '#content',
    '#main'
  ];

  let contentElement = null;
  for (const selector of mainSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) break;
  }

  // Fallback to body
  if (!contentElement) {
    contentElement = document.body;
  }

  // Clone to avoid modifying the actual DOM
  const clone = contentElement.cloneNode(true);

  // Remove unwanted elements from clone
  const unwantedSelectors = [
    'script', 'style', 'nav', 'header', 'footer',
    '[role="navigation"]', '[role="banner"]',
    '.sidebar', '.advertisement', '.ad', '.ads',
    '.cookie-banner', '.popup'
  ];

  for (const selector of unwantedSelectors) {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  }

  return sanitizeText(clone.textContent);
}

/**
 * Extract all tables from the page
 * @returns {Array<{headers: string[], rows: string[][]}>}
 */
function extractTables() {
  const tables = [];
  const tableElements = document.querySelectorAll('table');

  for (const table of Array.from(tableElements).slice(0, CONFIG.maxTables)) {
    if (shouldExclude(table)) continue;

    const extractedTable = {
      headers: [],
      rows: []
    };

    // Extract headers
    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
    if (headerRow) {
      const headerCells = headerRow.querySelectorAll('th, td');
      extractedTable.headers = Array.from(headerCells)
        .map(cell => sanitizeText(cell.textContent));
    }

    // Extract rows
    const bodyRows = table.querySelectorAll('tbody tr') ||
                     table.querySelectorAll('tr:not(:first-child)');

    for (const row of Array.from(bodyRows).slice(0, 100)) { // Max 100 rows per table
      const cells = row.querySelectorAll('td, th');
      const rowData = Array.from(cells).map(cell => sanitizeText(cell.textContent));
      if (rowData.some(cell => cell.trim())) { // Skip empty rows
        extractedTable.rows.push(rowData);
      }
    }

    if (extractedTable.headers.length > 0 || extractedTable.rows.length > 0) {
      tables.push(extractedTable);
    }
  }

  return tables;
}

/**
 * Extract headings hierarchy
 * @returns {Array<{level: number, text: string}>}
 */
function extractHeadings() {
  const headings = [];
  const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

  for (const heading of Array.from(headingElements).slice(0, CONFIG.maxHeadings)) {
    if (shouldExclude(heading)) continue;

    const level = parseInt(heading.tagName.charAt(1));
    const text = sanitizeText(heading.textContent);

    if (text) {
      headings.push({ level, text });
    }
  }

  return headings;
}

/**
 * Extract links from the page
 * @returns {Array<{text: string, href: string}>}
 */
function extractLinks() {
  const links = [];
  const linkElements = document.querySelectorAll('a[href]');

  for (const link of Array.from(linkElements).slice(0, CONFIG.maxLinks)) {
    if (shouldExclude(link)) continue;

    const text = sanitizeText(link.textContent);
    const href = link.getAttribute('href');

    // Skip empty links, javascript:, and anchors
    if (!text || !href || href.startsWith('javascript:') || href === '#') {
      continue;
    }

    // Convert relative URLs to absolute
    let absoluteHref;
    try {
      absoluteHref = new URL(href, window.location.origin).href;
    } catch {
      absoluteHref = href;
    }

    links.push({ text, href: absoluteHref });
  }

  return links;
}

/**
 * Extract full page context
 * @returns {object}
 */
function extractPageContext() {
  return {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    extractedAt: new Date().toISOString(),

    textContent: extractTextContent(),
    tables: extractTables(),
    headings: extractHeadings(),
    links: extractLinks()
  };
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type } = message;

  console.log(`[OpenClaw Content] Message received: ${type}`);

  switch (type) {
    case 'EXTRACT_PAGE':
      try {
        const context = extractPageContext();
        sendResponse({ success: true, context });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'EXTRACT_TABLES':
      try {
        const tables = extractTables();
        sendResponse({ success: true, tables });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'EXTRACT_TEXT':
      try {
        const text = extractTextContent();
        sendResponse({ success: true, text });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    default:
      sendResponse({ success: false, error: `Unknown message type: ${type}` });
  }

  return true;
});

// ============================================================================
// INITIALIZATION
// ============================================================================

// Check if we're on an allowed domain (content script is only injected on allowed domains)
chrome.runtime.sendMessage({ type: 'CHECK_ALLOWLIST' }, (response) => {
  if (response?.allowed) {
    console.log(`[OpenClaw Content] Active on ${window.location.hostname}`);
    console.log(`[OpenClaw Content] Access: ${response.access.join(', ')}`);
  } else {
    console.log(`[OpenClaw Content] Not allowed: ${response?.reason}`);
  }
});
