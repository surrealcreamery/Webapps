// The store operates on Eastern time. Compute "today" (YYYY-MM-DD) in that timezone.
//
// Do NOT use `new Date().toISOString().slice(0, 10)` for this — that is the UTC date, which
// rolls over to tomorrow around 8pm ET (midnight UTC). Filtering events on `stop.date >= today`
// with a UTC "today" therefore drops the current day's remaining events ~4 hours early.
export const STORE_TIMEZONE = 'America/New_York';

// Current calendar date at the store, as 'YYYY-MM-DD' (en-CA formats ISO-style).
export const storeToday = () => new Date().toLocaleDateString('en-CA', { timeZone: STORE_TIMEZONE });

// Preview mode: reveals "hidden" (URL-only) stops in every listing/picker so staff can see and
// register them like a normal customer. Activated by ?preview=1 on any events URL and latched to
// sessionStorage so it survives navigation (browse -> register). ?preview=0 turns it back off.
export const isPreviewMode = () => {
  try {
    const p = new URLSearchParams(window.location.search).get('preview');
    if (p === '1') { sessionStorage.setItem('events-preview', '1'); return true; }
    if (p === '0') { sessionStorage.removeItem('events-preview'); return false; }
    return sessionStorage.getItem('events-preview') === '1';
  } catch {
    return false;
  }
};
