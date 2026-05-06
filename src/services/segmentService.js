/**
 * Segment Service — API calls for real-time behavioral segmentation.
 * Calls the analytics-api Lambda (same as eventTracker) with no auth required.
 */

const ANALYTICS_API_URL = 'https://jkvxu5q42hr5obu5tezrn4jg6a0uyqms.lambda-url.us-east-1.on.aws';

/**
 * Fetch active segment definitions from analytics-api.
 * @returns {Promise<Array<{segmentId,name,priority,rules}>>}
 */
export async function fetchActiveSegments() {
  try {
    const res = await fetch(ANALYTICS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getActiveSegments' }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.segments || [];
  } catch (err) {
    console.error('[SegmentService] fetchActiveSegments error:', err);
    return [];
  }
}

/**
 * Fetch segment-aware cross-sell recommendations for a product.
 * Returns cached results instantly or triggers Claude generation (~1-3s).
 * @param {string} productSku - The product SKU being viewed
 * @param {string} segmentId - The detected behavioral segment
 * @param {Array<{sku,name,category,tags,price}>} catalogContext - Lightweight catalog for Claude
 * @returns {Promise<Array<{sku,reason,score}>>} Recommended products
 */
export async function fetchSegmentCrossSells(productSku, segmentId, catalogContext) {
  try {
    const res = await fetch(ANALYTICS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getSegmentCrossSells',
        productSku,
        segmentId,
        catalogContext,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.recommendations || [];
  } catch (err) {
    console.error('[SegmentService] fetchSegmentCrossSells error:', err);
    return [];
  }
}

/**
 * Report an unclassified user session for admin review.
 * Called when a user has 5+ product views but no segment scores above minScore.
 * @param {string} sessionId - Current session ID
 * @param {Object} behaviorSummary - Summary of user behavior signals
 * @param {Array<{segmentId,name,score}>} scores - All segment scores at time of report
 * @param {string} [visitorId] - Persistent visitor ID
 * @returns {Promise<boolean>} Whether the report was saved
 */
export async function reportUnknownSegment(sessionId, behaviorSummary, scores, visitorId) {
  try {
    const payload = {
      action: 'reportUnknownSegment',
      sessionId,
      behaviorSummary,
      scores,
    };
    if (visitorId) payload.visitorId = visitorId;
    const res = await fetch(ANALYTICS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('[SegmentService] reportUnknownSegment error:', err);
    return false;
  }
}

/**
 * Fetch persisted visitor segment from server (for warm-start on cleared localStorage).
 * @param {string} visitorId - Persistent visitor ID
 * @returns {Promise<Object|null>} Segment data or null
 */
export async function fetchVisitorSegment(visitorId) {
  try {
    const res = await fetch(ANALYTICS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getVisitorSegment', visitorId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.segment || null;
  } catch (err) {
    console.error('[SegmentService] fetchVisitorSegment error:', err);
    return null;
  }
}

/**
 * Persist visitor segment to server. Selectively updates only non-null fields.
 * @param {string} visitorId
 * @param {string|null} segmentId
 * @param {string|null} name
 * @param {number|null} score
 * @param {Object|null} signals
 * @param {string|null} customerId
 * @returns {Promise<boolean>}
 */
/**
 * Fetch full customer segment history across all sessions/visitorIds.
 * Requires auth — intended for admin use.
 * @param {string} customerId
 * @param {string} authToken - Firebase JWT
 * @returns {Promise<Object|null>} { customerId, visitorIds, sessions, segments, consolidatedSignals, qualifyingSegmentIds }
 */
export async function fetchCustomerSegmentHistory(customerId, authToken) {
  try {
    const res = await fetch(ANALYTICS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ action: 'getCustomerSegmentHistory', customerId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[SegmentService] fetchCustomerSegmentHistory error:', err);
    return null;
  }
}

export async function persistVisitorSegment(visitorId, segmentId, name, score, signals, customerId, environment, qualifyingSegments, geo) {
  try {
    const res = await fetch(ANALYTICS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'persistVisitorSegment',
        visitorId,
        segmentId,
        name,
        score,
        signals,
        customerId,
        environment,
        qualifyingSegments,
        geo,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[SegmentService] persistVisitorSegment error:', err);
    return null;
  }
}
