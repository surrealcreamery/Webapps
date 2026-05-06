/**
 * Self-contained behavioral event tracker
 * Batches events and flushes to our own analytics-events DynamoDB table via Lambda.
 * No external analytics dependencies — works alongside PostHog/GA4.
 */

const ANALYTICS_API_URL = 'https://jkvxu5q42hr5obu5tezrn4jg6a0uyqms.lambda-url.us-east-1.on.aws';
const FLUSH_INTERVAL = 5000;
const FLUSH_SIZE = 20;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min idle timeout
const VISITOR_STORAGE_KEY = 'surreal_visitor_id';
const VISITOR_META_KEY = 'surreal_visitor_meta';

let sessionId = null;
let visitorId = null;
let queue = [];
let flushTimer = null;
let cartId = null;
let customerId = null;
let deviceInfo = null;
let attribution = null;
let attributionTouches = null;
let environment = null;
let _geoData = null;

function uuid() {
  return crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function getVisitorId() {
  if (visitorId) return visitorId;
  try {
    const stored = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (stored) {
      visitorId = stored;
      return visitorId;
    }
  } catch { /* localStorage unavailable */ }
  visitorId = uuid();
  try {
    localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  } catch { /* quota exceeded — non-critical */ }
  return visitorId;
}

function getSession() {
  const now = Date.now();
  const stored = sessionStorage.getItem('evt_session');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (now - parsed.lastActivity < SESSION_TIMEOUT) {
      parsed.lastActivity = now;
      sessionStorage.setItem('evt_session', JSON.stringify(parsed));
      return parsed.id;
    }
  }
  const id = uuid();
  sessionStorage.setItem('evt_session', JSON.stringify({ id, lastActivity: now }));
  return id;
}

function captureDevice() {
  if (deviceInfo) return;
  const w = window.innerWidth;
  const type = w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  deviceInfo = {
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: w,
    viewportHeight: window.innerHeight,
    deviceType: type,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    devicePixelRatio: window.devicePixelRatio || 1,
    userAgent: navigator.userAgent,
  };
}

function captureAttribution() {
  if (attribution) return;
  const raw = sessionStorage.getItem('attribution');
  if (raw) {
    attribution = JSON.parse(raw);
  } else {
    // sessionStorage may not be set yet (router useEffect hasn't fired) — read URL directly
    const params = new URLSearchParams(window.location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid', 'sclid', 'campaign_id', 'adset_id', 'ad_id'];
    const attr = {};
    keys.forEach(k => {
      // Support both underscore (utm_medium) and hyphen (utm-medium) formats
      const val = params.get(k) || params.get(k.replace(/_/g, '-'));
      if (val) attr[k] = val;
    });
    if (document.referrer) attr.referrer = document.referrer;
    attr.landingPage = window.location.pathname;
    attr.capturedAt = new Date().toISOString();
    attribution = Object.keys(attr).length > 2 ? attr : {};
  }
  try {
    const touchesRaw = localStorage.getItem('attributionTouches');
    attributionTouches = touchesRaw ? JSON.parse(touchesRaw) : null;
  } catch { /* localStorage unavailable */ }
}

function detectEnvironment() {
  if (environment) return;
  const host = window.location.hostname;
  if (host.startsWith('beta')) environment = 'beta';
  else if (host === 'localhost' || host === '127.0.0.1') environment = 'dev';
  else environment = 'production';
}

export function getEnvironment() {
  detectEnvironment();
  return environment;
}

function flush(useBeacon = false) {
  if (queue.length === 0) return;
  const events = queue.splice(0);
  sessionId = getSession();
  // Extract Meta click/browser IDs from cookies for server-side CAPI
  const fbc = document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] || undefined;
  const fbp = document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1] || undefined;
  // TikTok browser ID from _ttp cookie (set by TikTok Pixel)
  const ttp = document.cookie.match(/(?:^|;\s*)_ttp=([^;]*)/)?.[1] || undefined;
  // GA4 client_id from _ga cookie (format: GA1.1.<client_id> — take everything after second dot)
  const gaRaw = document.cookie.match(/(?:^|;\s*)_ga=([^;]*)/)?.[1];
  const gaClientId = gaRaw ? gaRaw.split('.').slice(2).join('.') : undefined;
  // LeadPipe cookie_id — grabbed at flush time since pixel loads async
  const leadPipeId = window.PixelSDK?.globalParams?.cookie_id || undefined;
  const payload = JSON.stringify({
    action: 'trackEvents',
    sessionId,
    visitorId,
    cartId,
    customerId,
    environment,
    device: deviceInfo,
    attribution,
    ...(attributionTouches?.length > 0 ? { attributionTouches } : {}),
    fbc,
    fbp,
    ttp,
    gaClientId,
    leadPipeId,
    geo: _geoData,
    events,
  });
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ANALYTICS_API_URL, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(ANALYTICS_API_URL, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Never block user
  }
}

export function init() {
  if (typeof window === 'undefined') return;
  sessionId = getSession();
  getVisitorId();
  captureDevice();
  captureAttribution();
  detectEnvironment();

  // Fire new_visitor / returning_visitor with session context
  let isReturning = false;
  let sessionCount = 1;
  let daysSinceLastVisit = null;
  try {
    const raw = localStorage.getItem(VISITOR_META_KEY);
    if (raw) {
      const meta = JSON.parse(raw);
      isReturning = true;
      sessionCount = (meta.sessionCount || 0) + 1;
      if (meta.lastVisit) {
        daysSinceLastVisit = Math.round((Date.now() - new Date(meta.lastVisit).getTime()) / 86400000);
      }
    } else if (localStorage.getItem(VISITOR_STORAGE_KEY)) {
      // Visitor ID exists but no meta — returning visitor from before meta tracking
      isReturning = true;
      sessionCount = 2;
    }
    localStorage.setItem(VISITOR_META_KEY, JSON.stringify({
      lastVisit: new Date().toISOString(),
      sessionCount,
    }));
  } catch { /* localStorage unavailable */ }
  // Build label with raw UTM params from URL
  let visitorLabel = isReturning ? `Visit #${sessionCount}${daysSinceLastVisit !== null ? `, ${daysSinceLastVisit}d ago` : ''}` : 'First visit';
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const rawUtm = utmKeys.filter(k => attribution?.[k]).map(k => `${k}=${attribution[k]}`).join('\n');
  if (rawUtm) visitorLabel += `\n${rawUtm}`;
  track(isReturning ? 'returning_visitor' : 'new_visitor', {
    sessionCount,
    ...(daysSinceLastVisit !== null ? { daysSinceLastVisit } : {}),
    referrer: document.referrer || null,
    landingPage: window.location.pathname,
    ...(attribution && Object.keys(attribution).length > 2 ? { attribution } : {}),
    label: visitorLabel,
  });

  flushTimer = setInterval(flush, FLUSH_INTERVAL);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('beforeunload', () => flush(true));
}

export function track(eventType, eventData = {}) {
  if (typeof window === 'undefined') return;
  sessionId = getSession();
  queue.push({
    eventType,
    eventData,
    eventId: uuid(),
    timestamp: new Date().toISOString(),
    page: window.location.pathname,
  });
  if (queue.length >= FLUSH_SIZE) flush();
}

export function setTrackerCartId(id) { cartId = id; }
export function setCustomerId(id) { customerId = id; }
export function setGeoData(data) { _geoData = data; }
export function refreshAttributionTouches() {
  try {
    const raw = localStorage.getItem('attributionTouches');
    attributionTouches = raw ? JSON.parse(raw) : null;
  } catch { /* localStorage unavailable */ }
}
