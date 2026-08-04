/**
 * Maps XState machine state + context to a URL path for the events wizard.
 * Returns null if no mapping applies (caller should skip navigation).
 */
export function stateToPath(state, context) {
    const { selectedEventId } = context;

    if (state.matches('directory')) return '/events';
    if (state.matches('loginFlow')) return '/events/login';
    if (state.matches('userDashboard')) return '/events/dashboard';
    if (state.matches('transactionDetails')) return '/events/dashboard';
    if (state.matches('marketingMaterials')) return '/events/dashboard';
    if (state.matches('payoutDetails')) return '/events/dashboard';

    if (!selectedEventId) return '/events';

    if (state.matches({ wizardFlow: 'eventLanding' })) return `/events/${selectedEventId}`;
    if (state.matches({ wizardFlow: 'selectingLocation' })) return `/events/${selectedEventId}/location`;
    if (state.matches({ wizardFlow: 'selectingStop' })) return `/events/${selectedEventId}/schedule`;
    if (state.matches({ wizardFlow: 'selectingDate' })) return `/events/${selectedEventId}/date`;
    if (state.matches({ wizardFlow: 'selectingTime' })) return `/events/${selectedEventId}/time`;
    if (state.matches({ wizardFlow: 'selectingContact' })) return `/events/${selectedEventId}/contact`;
    if (state.matches({ wizardFlow: 'selectingPayment' })) return `/events/${selectedEventId}/payment`;
    if (state.matches({ wizardFlow: 'submitting' })) return `/events/${selectedEventId}/verify`;
    if (state.matches({ wizardFlow: 'duplicateError' })) return `/events/${selectedEventId}/error`;
    if (state.matches({ wizardFlow: 'success' })) return `/events/${selectedEventId}/success`;

    // validating is a transient state — don't push a URL for it
    if (state.matches({ wizardFlow: 'validating' })) return null;

    return null;
}

/**
 * Parses a pathname into eventId and step segments.
 * E.g. "/events/abc123/contact" → { eventId: "abc123", step: "contact" }
 *      "/events" → { eventId: null, step: null }
 *      "/events/login" → { eventId: null, step: null, isLogin: true }
 *      "/events/dashboard" → { eventId: null, step: null, isDashboard: true }
 */
const isUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s);

export function parseEventUrl(pathname) {
    const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);

    // Expected: ["events"] or ["events", ...rest]
    const eventsIdx = segments.indexOf('events');
    if (eventsIdx === -1) return { eventId: null, step: null };

    const rest = segments.slice(eventsIdx + 1);

    if (rest.length === 0) return { eventId: null, step: null };
    if (rest[0] === 'login') return { eventId: null, step: null, isLogin: true };
    if (rest[0] === 'dashboard') return { eventId: null, step: null, isDashboard: true };

    // Non-UUID, non-reserved segment = series slug (supports multi-segment like pokemon/beginner-series)
    if (!isUUID(rest[0])) {
        return { eventId: null, step: null, isSeries: true, seriesSlug: rest.join('/') };
    }

    return {
        eventId: rest[0],
        step: rest[1] || null,
    };
}

/**
 * Data-aware resolution of an /events path. URL structure alone is ambiguous because series slugs are
 * multi-segment (e.g. "pokemon/beginner-series") and location ids are single-segment ("forest-hills"),
 * so we disambiguate against the REAL known series slugs + location ids from the feed.
 *
 * Returns one of:
 *   { kind: 'directory' }                                        → /events
 *   { kind: 'login' | 'dashboard' }
 *   { kind: 'wizard', eventId, step }                            → /events/<uuid>/<step>
 *   { kind: 'location', locationId }                             → /events/<locationId>
 *   { kind: 'series', seriesSlug }                               → /events/<seriesSlug>
 *   { kind: 'seriesLocation', seriesSlug, locationId }           → /events/<seriesSlug>/<locationId>
 */
export function resolveEventsPath(pathname, { seriesSlugs = [], locationIds = [] } = {}) {
    const base = parseEventUrl(pathname);
    if (base.isLogin) return { kind: 'login' };
    if (base.isDashboard) return { kind: 'dashboard' };
    if (base.eventId) return { kind: 'wizard', eventId: base.eventId, step: base.step };

    const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const eventsIdx = segments.indexOf('events');
    const rest = eventsIdx === -1 ? [] : segments.slice(eventsIdx + 1);
    if (rest.length === 0) return { kind: 'directory' };

    const slugSet = new Set(seriesSlugs);
    const locSet = new Set(locationIds);
    const full = rest.join('/');

    // Exact series slug (all locations)
    if (slugSet.has(full)) return { kind: 'series', seriesSlug: full };
    // Series + location: last segment is a known location id, the rest is a known series slug
    if (rest.length >= 2) {
        const last = rest[rest.length - 1];
        const head = rest.slice(0, -1).join('/');
        if (locSet.has(last) && slugSet.has(head)) return { kind: 'seriesLocation', seriesSlug: head, locationId: last };
    }
    // Single-segment location directory
    if (rest.length === 1 && locSet.has(rest[0])) return { kind: 'location', locationId: rest[0] };
    // Fallback: treat as a series slug (unknown / not yet loaded)
    return { kind: 'series', seriesSlug: full };
}

const STEP_ORDER = {
    null: 0,        // eventLanding (no step segment)
    location: 1,
    schedule: 1,
    date: 2,
    time: 3,
    contact: 4,
    payment: 5,
    verify: 6,
    error: 7,
    success: 7,
};

/**
 * Returns the numeric order for a step string (used to determine forward vs backward).
 */
export function getStepOrder(step) {
    return STEP_ORDER[step] ?? 0;
}

/**
 * Returns true if the current state is an auto-transition state
 * (validating, routing, etc.) that should use replace instead of push.
 */
export function isAutoTransitionState(state) {
    return (
        state.matches({ wizardFlow: 'validating' }) ||
        state.matches('booting') ||
        state.matches('routing')
    );
}
