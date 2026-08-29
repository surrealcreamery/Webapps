import React, { useState, useEffect, useMemo, useContext, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMachine } from '@xstate/react';
import {
    Box, Typography, Container, Button, Stack, CircularProgress,
    TextField, MenuItem, Select, FormControl, InputLabel, Alert,
    IconButton, Chip, Checkbox, FormControlLabel,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { LayoutContext as EventsLayoutContext } from '@/contexts/events/EventsLayoutContext';
import { LocalizationProvider, DateCalendar } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addDays, startOfWeek, format, parse } from 'date-fns';
import { storeToday } from '@/utils/storeDate';
import { bookASpaceMachine } from '@/state/events/bookASpaceMachine';
import { trackSpaceRequestSubmitted } from '@/services/analytics';

// Build bookable hours for a single location on a given date
const getLocationTimeRange = (loc, dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const dh = loc?.hours?.[String(dayOfWeek)];
    let earliest = 8, latest = 22;
    if (dh?.open && dh?.close) {
        earliest = parseInt(dh.open.split(':')[0], 10);
        latest = parseInt(dh.close.split(':')[0], 10);
        // Handle midnight/past-midnight closing (e.g. close "00:00" or "01:00")
        if (latest <= earliest) latest = 24;
    }
    const hours = [];
    for (let h = earliest; h < latest; h++) hours.push(h);
    return hours;
};

// Current hour (0–23) in the STORE's timezone — used to hide same-day start times that have passed.
const easternHourNow = () => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).formatToParts(new Date());
    return (parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)) % 24;
};

// Parse a time range string like "7:00 PM - 9:00 PM" or "19:00 - 20:00" into { startH, endH } (24h)
const parseTimeRange = (timeStr) => {
    // 12h format: "7:00 PM - 9:00 PM"
    const match12 = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match12) {
        let sH = parseInt(match12[1], 10);
        const sP = match12[3].toUpperCase();
        let eH = parseInt(match12[4], 10);
        const eP = match12[6].toUpperCase();
        if (sP === 'PM' && sH !== 12) sH += 12;
        if (sP === 'AM' && sH === 12) sH = 0;
        if (eP === 'PM' && eH !== 12) eH += 12;
        if (eP === 'AM' && eH === 12) eH = 0;
        return { startH: sH, endH: eH };
    }
    // 24h format: "19:00 - 20:00"
    const match24 = timeStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (match24) {
        return { startH: parseInt(match24[1], 10), endH: parseInt(match24[3], 10) };
    }
    return null;
};

const STORAGE_KEY = 'bookASpace:snapshot';
const STABLE_STEPS = ['eventType', 'location', 'schedule', 'partySize', 'review', 'contact'];

// Furthest week the ‹ › arrows page to (about a year out); the full calendar covers anything beyond.
const MAX_WEEK_OFFSET = 51;

// XState holds state in memory only, so a refresh normally resets the wizard. We persist the
// machine's snapshot to sessionStorage and rehydrate it — but ONLY for stable steps, never
// loading/submitting/submitted (those have live invocations we don't want to re-run on restore).
const loadSnapshot = () => {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        const snap = raw ? JSON.parse(raw) : null;
        return snap && typeof snap.value === 'string' && STABLE_STEPS.includes(snap.value) ? snap : undefined;
    } catch { return undefined; }
};

// Non-personal selections that are safe to put in a shareable URL. The contact form
// (name/email/phone) is intentionally NEVER written to the URL.
const readUrlSelections = () => {
    const p = new URLSearchParams(window.location.search);
    const keys = ['eventType', 'loc', 'date', 'start'];
    return {
        eventType: p.get('eventType') || '', loc: p.get('loc') || '', date: p.get('date') || '',
        start: p.get('start') || '',
        any: keys.some(k => p.has(k)),
    };
};

export default function BookASpace() {
    const navigate = useNavigate();
    const { setCustomBackHandler } = useContext(EventsLayoutContext);
    // Restore a persisted snapshot (refresh survival). Captured once so it can't change mid-session.
    const restoredSnapshotRef = useRef(loadSnapshot());
    const [state, send, actorRef] = useMachine(
        bookASpaceMachine,
        restoredSnapshotRef.current ? { snapshot: restoredSnapshotRef.current } : undefined,
    );
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0); // which 7-day window the strip shows (0 = starts tomorrow)

    const {
        locations, events, eventTypes, selectedLocationId, selectedDate,
        startTime, selectedEventType, formData, error, partySize,
    } = state.context;

    const isLoading = state.matches('loading');
    const isSubmitted = state.matches('submitted');
    const isSubmitting = state.matches('submitting');
    const onEventType = state.matches('eventType');
    const onLocation = state.matches('location');
    const onPartySize = state.matches('partySize');
    const onSchedule = state.matches('schedule');
    const onReview = state.matches('review');
    const onContact = state.matches('contact') || isSubmitting;

    const hasEventTypes = eventTypes.length > 0;
    const hasMultipleLocations = locations.length > 1;

    const selectedLocation = useMemo(
        () => locations.find(l => l.id === selectedLocationId) || null,
        [locations, selectedLocationId],
    );

    // (1) Refresh survival — persist the machine snapshot on every stable step; drop it once
    // booked (or while loading/submitting) so we never rehydrate a live invocation or a stale booking.
    useEffect(() => {
        if (isSubmitted) { try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } return; }
        if (!STABLE_STEPS.some(s => state.matches(s))) return;
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(actorRef.getPersistedSnapshot())); } catch { /* ignore */ }
    }, [state, isSubmitted, actorRef]);

    // (3) Shareable/deep-link URL — mirror the NON-personal selections into the query string.
    // Contact fields are never written here.
    useEffect(() => {
        if (isLoading) return;
        const p = new URLSearchParams(window.location.search);
        const put = (k, v) => { if (v) p.set(k, v); else p.delete(k); };
        put('eventType', selectedEventType); put('loc', selectedLocationId); put('date', selectedDate);
        put('start', startTime);
        const qs = p.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    }, [isLoading, selectedEventType, selectedLocationId, selectedDate, startTime]);

    // (3) On a fresh load from a shared link (no restored snapshot), replay the URL selections
    // once the data has loaded. Unhandled events are safely ignored, so skipped steps don't matter.
    const urlHydratedRef = useRef(false);
    useEffect(() => {
        if (restoredSnapshotRef.current || isLoading || urlHydratedRef.current) return;
        urlHydratedRef.current = true;
        const sel = readUrlSelections();
        if (!sel.any) return;
        if (sel.eventType) send({ type: 'SELECT_EVENT_TYPE', name: sel.eventType });
        if (sel.loc) send({ type: 'SELECT_LOCATION', id: sel.loc });
        if (sel.date) send({ type: 'SELECT_DATE', date: sel.date });
        if (sel.start) send({ type: 'SELECT_START', hour: parseInt(sel.start.split(':')[0], 10) });
    }, [isLoading, send]);

    // Fire a conversion (Meta Lead / TikTok SubmitForm / GA4 generate_lead) once, when the request submits.
    const conversionFiredRef = useRef(false);
    useEffect(() => {
        if (!isSubmitted || conversionFiredRef.current) return;
        conversionFiredRef.current = true;
        trackSpaceRequestSubmitted({
            eventType: selectedEventType,
            locationId: selectedLocationId,
            locationName: selectedLocation?.['Location Name'],
            partySize,
            date: selectedDate,
        });
    }, [isSubmitted, selectedEventType, selectedLocationId, selectedLocation, partySize, selectedDate]);

    const timeSlots = useMemo(
        () => getLocationTimeRange(selectedLocation, selectedDate),
        [selectedLocation, selectedDate],
    );

    // Compute booked ranges (for merged cells) and a per-hour lookup
    const bookedRanges = useMemo(() => {
        if (!selectedLocationId || !selectedDate) return [];
        const [y, m, d] = selectedDate.split('-').map(Number);
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        const ranges = [];

        events.forEach(event => {
            if (!event.locationIds.includes(selectedLocationId)) return;

            if (event.schedule && event.schedule.length > 0) {
                event.schedule.forEach(s => {
                    if (s.date !== selectedDate || s.locationId !== selectedLocationId) return;
                    if (s.startTime && s.endTime) {
                        const sH = parseInt(s.startTime.split(':')[0], 10);
                        const eH = Math.ceil(parseInt(s.endTime.split(':')[0], 10) + parseInt(s.endTime.split(':')[1], 10) / 60);
                        ranges.push({ startH: sH, endH: eH, title: event.title });
                    }
                });
                return;
            }

            if (event.startDate && event.endDate) {
                const inRange = selectedDate >= event.startDate
                    && selectedDate <= event.endDate
                    && event.daysOfWeek.includes(dayOfWeek);
                if (!inRange) return;
                const times = Array.isArray(event.eventTimes) ? event.eventTimes
                    : (event.eventTimes ? [event.eventTimes] : []);
                times.forEach(t => {
                    const parsed = parseTimeRange(t);
                    if (parsed) ranges.push({ startH: parsed.startH, endH: parsed.endH, title: event.title });
                });
            }
        });

        return ranges;
    }, [events, selectedLocationId, selectedDate]);

    const bookedSlots = useMemo(() => {
        const slots = {};
        bookedRanges.forEach(r => {
            for (let h = r.startH; h < r.endH; h++) slots[h] = r.title;
        });
        return slots;
    }, [bookedRanges]);

    // Configured custom fields for the chosen event type (admin-defined per type).
    const selectedTypeFields = useMemo(
        () => (eventTypes.find(t => t.name === selectedEventType)?.fields) || [],
        [eventTypes, selectedEventType],
    );
    const requiredCustomFieldsFilled = useMemo(
        () => selectedTypeFields.every(f => {
            if (!f.required || f.type === 'checkbox') return true;
            const v = formData[f.id];
            return v != null && String(v).trim() !== '';
        }),
        [selectedTypeFields, formData],
    );

    const isFormValid = selectedLocationId && selectedDate && startTime
        && (eventTypes.length === 0 || selectedEventType)
        && formData.firstName && formData.lastName && formData.email
        && requiredCustomFieldsFilled;

    // --- Date navigation: a fixed Sunday–Saturday calendar week ---
    // Weekday columns stay put (Sun…Sat), so the layout reads like a normal calendar. Today is
    // selectable (same-day requests allowed) as long as the location still has an open hour left.
    // "Today"/"now" are in the STORE's timezone (Eastern), not the visitor's browser timezone.
    const today = useMemo(() => parse(storeToday(), 'yyyy-MM-dd', new Date()), []);
    const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);
    const nowHour = useMemo(() => easternHourNow(), []);
    const weekStart = useMemo(() => addDays(startOfWeek(today, { weekStartsOn: 0 }), weekOffset * 7), [today, weekOffset]);

    // Bookable hours for a date, dropping already-passed hours when the date is today.
    const bookableHoursFor = (dateStr) => {
        const hrs = getLocationTimeRange(selectedLocation, dateStr);
        return dateStr === todayStr ? hrs.filter(h => h > nowHour) : hrs;
    };

    // Selectable start-time hours for the chosen date: open, not overlapping a booking, not past.
    const availableSlots = useMemo(
        () => timeSlots.filter(hour => !bookedSlots[hour] && (selectedDate !== todayStr || hour > nowHour)),
        [timeSlots, bookedSlots, selectedDate, todayStr, nowHour],
    );

    const weekDays = useMemo(() => (
        Array.from({ length: 7 }, (_, i) => {
            const d = addDays(weekStart, i);
            const dateStr = format(d, 'yyyy-MM-dd');
            const notPast = d.getTime() >= today.getTime();
            return {
                dateStr,
                dow: format(d, 'EEE'),
                day: format(d, 'd'),
                isToday: dateStr === todayStr,
                // Bookable = today-or-later AND at least one open hour remains that day.
                isBookable: notPast && bookableHoursFor(dateStr).length > 0,
            };
        })
    ), [weekStart, today, todayStr, nowHour, selectedLocation]);

    // Header label: the month(s) the visible week spans.
    const weekLabel = useMemo(() => {
        const last = addDays(weekStart, 6);
        const fm = format(weekStart, 'MMM');
        const lm = format(last, 'MMM');
        return fm === lm ? format(weekStart, 'MMMM yyyy') : `${fm} – ${lm} ${format(last, 'yyyy')}`;
    }, [weekStart]);

    // Can't page into fully-past weeks — the current week (offset 0) is the earliest.
    const atCurrentWeek = weekOffset <= 0;

    // Keep the visible week in sync with the selected date (URL hydration, calendar jump, etc.).
    useEffect(() => {
        if (!selectedDate) return;
        const currentWeek = startOfWeek(today, { weekStartsOn: 0 });
        const selWeek = startOfWeek(parse(selectedDate, 'yyyy-MM-dd', new Date()), { weekStartsOn: 0 });
        const wk = Math.round((selWeek.getTime() - currentWeek.getTime()) / (7 * 86400000));
        setWeekOffset(Math.max(0, wk));
    }, [selectedDate, today]);

    // --- Back navigation ---
    // Each forward step pushes a browser-history entry (same URL) so the browser Back button and
    // the header back button both return to the previous step instead of leaving the page.
    const firstStepState = hasEventTypes ? 'eventType' : hasMultipleLocations ? 'location' : 'schedule';
    // Refs so the single popstate listener always reads the CURRENT machine state.
    const stateRef = useRef(state);
    stateRef.current = state;
    const firstStepRef = useRef(firstStepState);
    firstStepRef.current = firstStepState;

    // Browser Back steps the wizard back instead of leaving the page. We keep exactly ONE
    // sentinel history entry on top and re-arm it after each Back, so one always-current
    // listener handles every step. (The old per-step marker counting desynced with the router
    // and could fire an extra BACK — e.g. when a Select popover closed — bouncing users home.)
    useEffect(() => {
        if (isLoading) return;
        window.history.pushState({ __bookASpace: true }, '');
        const onPopState = () => {
            if (stateRef.current.matches(firstStepRef.current)) {
                navigate('/events'); // already at the first step → leave the wizard
                return;
            }
            send({ type: 'BACK' });
            window.history.pushState({ __bookASpace: true }, ''); // re-arm for the next Back
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [isLoading, navigate, send]);

    // Header back button — routes through the same mechanism as the browser Back button.
    const goBack = useCallback(() => {
        if (state.matches(firstStepState)) {
            navigate('/events');
            return;
        }
        window.history.back(); // → onPopState → send BACK + re-arm
    }, [state, firstStepState, navigate]);

    useEffect(() => {
        if (!isLoading) setCustomBackHandler(() => goBack);
        return () => setCustomBackHandler(null);
    }, [goBack, isLoading, setCustomBackHandler]);

    // --- Loading ---
    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    // --- Submitted ---
    if (isSubmitted) {
        return (
            <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="h1" component="h1" sx={{ mb: 2 }}>
                    Request Submitted
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1, fontSize: '1.6rem' }}>
                    Thank you! We've received your booking request for{' '}
                    <strong>{format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM do, yyyy')}</strong>
                    {startTime && <> at <strong>{format(parse(startTime, 'HH:mm', new Date()), 'h:mm a')}</strong></>}.
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontSize: '1.6rem' }}>
                    We'll review your request, confirm the details, and get back to you at <strong>{formData.email}</strong>.
                </Typography>
                <Stack spacing={2} direction="row" justifyContent="center">
                    <Button variant="contained" onClick={() => send({ type: 'RESET' })}>
                        Submit Another Request
                    </Button>
                    <Button variant="text" onClick={() => navigate('/events')} sx={{ textTransform: 'none' }}>
                        View Events
                    </Button>
                </Stack>
            </Container>
        );
    }

    // --- Main form ---
    return (
        <Container maxWidth={(onSchedule || onEventType || onLocation) ? 'md' : 'sm'} sx={{ py: 4 }}>
            <Typography variant="h1" component="h1" align="center" sx={{ mb: 1 }}>
                Book A Space
            </Typography>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3, fontSize: '1.6rem' }}>
                Submit a request to book our space for your event or gathering.
            </Typography>

            {/* Step 1: Event Type */}
            {onEventType && (
                <Box>
                    <Box role="group" aria-label="Type of event" sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                        {eventTypes.map(type => {
                            const name = typeof type === 'string' ? type : type.name;
                            const imageUrl = typeof type === 'string' ? '' : type.imageUrl;
                            return (
                                <Box
                                    key={name}
                                    onClick={() => send({ type: 'SELECT_EVENT_TYPE', name })}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Select event type: ${name}`}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); send({ type: 'SELECT_EVENT_TYPE', name }); } }}
                                    sx={{
                                        border: '2px solid',
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        '&:hover': { borderColor: 'text.secondary' },
                                        '&:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: '100%', aspectRatio: '4 / 3',
                                            bgcolor: imageUrl ? 'transparent' : '#e0e0e0',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {imageUrl ? (
                                            <Box
                                                component="img"
                                                src={imageUrl}
                                                alt={name}
                                                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                            />
                                        ) : (
                                            <Typography sx={{ fontSize: '2.4rem', color: '#9e9e9e', userSelect: 'none' }}>
                                                &#x1f389;
                                            </Typography>
                                        )}
                                    </Box>
                                    <Box sx={{ p: 1.5, textAlign: 'center' }}>
                                        <Typography sx={{ fontWeight: 500, fontSize: '1.6rem' }}>
                                            {name}
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            )}

            {/* Step 2: Location */}
            {onLocation && (
                <Box>
                    <Typography variant="h2" component="h2" gutterBottom>
                        Select a Location
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                        {locations.map(loc => (
                            <Box
                                key={loc.id}
                                onClick={() => send({ type: 'SELECT_LOCATION', id: loc.id })}
                                role="button"
                                tabIndex={0}
                                aria-label={`Select location: ${loc['Location Name']}`}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); send({ type: 'SELECT_LOCATION', id: loc.id }); } }}
                                sx={{
                                    border: '2px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    '&:hover': { borderColor: 'text.secondary' },
                                    '&:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: '100%', aspectRatio: '4 / 3',
                                        bgcolor: loc.imageUrl ? 'transparent' : '#e0e0e0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {loc.imageUrl ? (
                                        <Box
                                            component="img"
                                            src={loc.imageUrl}
                                            alt={loc['Location Name']}
                                            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                        />
                                    ) : (
                                        <Typography sx={{ fontSize: '2.4rem', color: '#9e9e9e', userSelect: 'none' }}>
                                            &#x1f3e2;
                                        </Typography>
                                    )}
                                </Box>
                                <Box sx={{ p: 1.5, textAlign: 'center' }}>
                                    <Typography sx={{ fontWeight: 500, fontSize: '1.6rem' }}>
                                        {loc['Location Name']}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Step: Party Size — informational for staff (no live availability; tables are set on approval) */}
            {onPartySize && (
                <Box>
                    <Typography variant="h2" component="h2" gutterBottom>How many guests?</Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontSize: '1.5rem' }}>
                        {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEE, MMM do')}
                        {startTime && `, ${format(parse(startTime, 'HH:mm', new Date()), 'h:mm a')}`}
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
                        <IconButton
                            aria-label="Decrease number of guests"
                            onClick={() => send({ type: 'SET_PARTY_SIZE', value: Math.max(1, (Number(partySize) || 1) - 1) })}
                            sx={{ border: '1px solid', borderColor: 'grey.500', width: 48, height: 48 }}
                        >
                            <Typography sx={{ fontSize: '2.4rem', lineHeight: 1 }}>&#8722;</Typography>
                        </IconButton>
                        <TextField
                            value={partySize}
                            onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9]/g, '');
                                send({ type: 'SET_PARTY_SIZE', value: v ? parseInt(v, 10) : '' });
                            }}
                            inputProps={{ inputMode: 'numeric', style: { textAlign: 'center', fontSize: '2.4rem', width: '4ch' }, 'aria-label': 'Number of guests' }}
                            placeholder="0"
                        />
                        <IconButton
                            aria-label="Increase number of guests"
                            onClick={() => send({ type: 'SET_PARTY_SIZE', value: (Number(partySize) || 0) + 1 })}
                            sx={{ border: '1px solid', borderColor: 'grey.500', width: 48, height: 48 }}
                        >
                            <Typography sx={{ fontSize: '2.4rem', lineHeight: 1 }}>+</Typography>
                        </IconButton>
                    </Stack>

                    <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                        <Button variant="outlined" onClick={() => send({ type: 'BACK' })} sx={{ fontSize: '1.5rem' }}>Back</Button>
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={!(Number(partySize) >= 1)}
                            onClick={() => send({ type: 'CONTINUE' })}
                            sx={{ fontSize: '1.6rem' }}
                        >
                            Continue
                        </Button>
                    </Stack>
                </Box>
            )}

            {/* Step 3: Schedule — date nav + single-location time grid */}
            {onSchedule && selectedLocation && (
                <Box>
                    {/* Location name + capacity */}
                    <Typography variant="h2" component="h2" sx={{ mb: 0.5 }}>
                        {selectedLocation['Location Name']}
                        {selectedLocation.maxEventSize && (
                            <Typography component="span" color="text.secondary" sx={{ fontSize: '1.6rem', ml: 1 }}>
                                Capacity: {selectedLocation.maxEventSize}
                            </Typography>
                        )}
                    </Typography>

                    {/* Date: one week at a time — page with ‹ › ; tap a day. Full calendar for far-out dates. */}
                    <Box sx={{ mt: 2, mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                            <Typography variant="h3" component="h3" sx={{ fontWeight: 600, fontSize: '1.9rem' }}>
                                {weekLabel}
                            </Typography>
                            <Button
                                size="small"
                                variant="text"
                                startIcon={<CalendarMonthIcon />}
                                onClick={() => setDatePickerOpen(!datePickerOpen)}
                                sx={{ textTransform: 'none', fontSize: '1.5rem', flexShrink: 0 }}
                                aria-expanded={datePickerOpen}
                            >
                                {datePickerOpen ? 'Close' : 'Calendar'}
                            </Button>
                        </Box>

                        {/* Fixed Sun–Sat week, paged by the ‹ › arrows. Today is marked; past & closed days are disabled. */}
                        <Box role="group" aria-label="Choose a date" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton
                                aria-label="Previous week"
                                disabled={atCurrentWeek}
                                onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
                                sx={{ flexShrink: 0, border: '1px solid', borderColor: 'grey.400', '&.Mui-disabled': { borderColor: 'grey.200' } }}
                            >
                                <ChevronLeftIcon />
                            </IconButton>
                            <Box sx={{ display: 'flex', gap: 0.75, flex: 1, minWidth: 0 }}>
                                {weekDays.map((dd) => {
                                    const selected = dd.dateStr === selectedDate;
                                    const label = `${format(parse(dd.dateStr, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d, yyyy')}`
                                        + (dd.isToday ? (dd.isBookable ? ' — today' : ' — today, no times left') : dd.isBookable ? '' : ' — unavailable');
                                    return (
                                        <Box
                                            key={dd.dateStr}
                                            component="button"
                                            type="button"
                                            aria-pressed={selected}
                                            aria-current={dd.isToday ? 'date' : undefined}
                                            disabled={!dd.isBookable}
                                            onClick={() => { if (dd.isBookable) send({ type: 'SELECT_DATE', date: dd.dateStr }); }}
                                            aria-label={label}
                                            sx={{
                                                position: 'relative',
                                                flex: '1 1 0', minWidth: 0, py: 1, borderRadius: 2, font: 'inherit',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25,
                                                border: '2px solid',
                                                borderColor: selected ? '#000' : dd.isToday ? 'text.primary' : 'grey.400',
                                                bgcolor: selected ? '#000' : 'background.paper',
                                                color: selected ? '#fff' : dd.isBookable ? 'text.primary' : 'text.disabled',
                                                opacity: dd.isBookable ? 1 : dd.isToday ? 0.75 : 0.4,
                                                cursor: dd.isBookable ? 'pointer' : 'not-allowed',
                                                transition: 'all 0.12s',
                                                '&:hover': dd.isBookable && !selected ? { borderColor: 'text.secondary' } : {},
                                                '&:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 },
                                            }}
                                        >
                                            <Typography component="span" sx={{ fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: 0.3, color: selected ? '#fff' : 'text.secondary' }}>
                                                {dd.dow}
                                            </Typography>
                                            <Typography component="span" sx={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1 }}>
                                                {dd.day}
                                            </Typography>
                                            {dd.isToday && !selected && (
                                                <Box aria-hidden="true" sx={{ position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: '50%', bgcolor: 'text.primary' }} />
                                            )}
                                        </Box>
                                    );
                                })}
                            </Box>
                            <IconButton
                                aria-label="Next week"
                                disabled={weekOffset >= MAX_WEEK_OFFSET}
                                onClick={() => setWeekOffset(w => Math.min(MAX_WEEK_OFFSET, w + 1))}
                                sx={{ flexShrink: 0, border: '1px solid', borderColor: 'grey.400', '&.Mui-disabled': { borderColor: 'grey.200' } }}
                            >
                                <ChevronRightIcon />
                            </IconButton>
                        </Box>

                        {datePickerOpen && (
                            <Box sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'inline-block' }}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <DateCalendar
                                        value={parse(selectedDate, 'yyyy-MM-dd', new Date())}
                                        onChange={(date) => {
                                            send({ type: 'SELECT_DATE', date: format(date, 'yyyy-MM-dd') });
                                            setDatePickerOpen(false);
                                        }}
                                        disablePast
                                        sx={{
                                            '& .MuiPickersDay-root': { fontSize: '1.6rem' },
                                            '& .MuiDayCalendar-weekDayLabel': { fontSize: '1.6rem', fontWeight: 'bold' },
                                            '& .MuiPickersCalendarHeader-root svg': { width: '2rem', height: '2rem' },
                                        }}
                                    />
                                </LocalizationProvider>
                            </Box>
                        )}
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '1.6rem' }}>
                        Tap a start time below. Times that overlap an existing booking aren't available. We&apos;ll confirm the exact duration with you.
                    </Typography>

                    {/* Start time — vertical list of available slots (time on the left, availability on the right) */}
                    <Typography sx={{ fontWeight: 500, fontSize: '1.6rem', mb: 1 }}>Start time</Typography>
                    {availableSlots.length === 0 ? (
                        <Typography color="text.secondary" sx={{ fontSize: '1.5rem', py: 2 }}>
                            No start times left for this day — please choose another date.
                        </Typography>
                    ) : (
                        <Stack role="group" aria-label="Start time" spacing={1}>
                            {availableSlots.map(hour => {
                                const timeStr = `${String(hour).padStart(2, '0')}:00`;
                                const timeLabel = format(parse(timeStr, 'HH:mm', new Date()), 'h:mm a');
                                return (
                                    <Box
                                        key={hour}
                                        component="button"
                                        type="button"
                                        onClick={() => { send({ type: 'SELECT_START', hour }); send({ type: 'CONTINUE' }); }}
                                        aria-label={`Select ${timeLabel} — available`}
                                        sx={{
                                            width: '100%', font: 'inherit', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                                            px: 2.5, py: 1.75, borderRadius: 2, border: '2px solid',
                                            borderColor: 'grey.400',
                                            bgcolor: 'background.paper',
                                            color: 'text.primary',
                                            transition: 'all 0.12s',
                                            '&:hover': { borderColor: 'text.secondary', bgcolor: 'grey.50' },
                                            '&:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 },
                                        }}
                                    >
                                        <Typography component="span" sx={{ fontSize: '1.7rem', fontWeight: 600 }}>{timeLabel}</Typography>
                                        <Typography component="span" sx={{ fontSize: '1.4rem', display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                            Available
                                            <Box component="span" aria-hidden="true" sx={{ fontSize: '1.6rem', lineHeight: 1 }}>&rsaquo;</Box>
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Stack>
                    )}
                </Box>
            )}

            {/* Step: Review — the tables we'll hold for this party/time */}
            {onReview && (
                <Box>
                    <Typography variant="h2" component="h2" gutterBottom>Review your booking</Typography>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2 }}>
                        <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: '1.5rem' }}>Location</Typography><Typography sx={{ fontSize: '1.5rem', fontWeight: 600 }}>{selectedLocation?.['Location Name']}</Typography></Stack>
                            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: '1.5rem' }}>Date</Typography><Typography sx={{ fontSize: '1.5rem', fontWeight: 600 }}>{format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEE, MMM do')}</Typography></Stack>
                            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: '1.5rem' }}>Start time</Typography><Typography sx={{ fontSize: '1.5rem', fontWeight: 600 }}>{format(parse(startTime, 'HH:mm', new Date()), 'h:mm a')}</Typography></Stack>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography color="text.secondary" sx={{ fontSize: '1.5rem' }}>Guests</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 600 }}>{partySize}</Typography>
                                    <Button size="small" onClick={() => send({ type: 'BACK' })} sx={{ textTransform: 'none', minWidth: 0, fontSize: '1.3rem' }}>Edit</Button>
                                </Stack>
                            </Stack>
                        </Stack>
                    </Box>

                    <Alert severity="info" sx={{ mb: 2, fontSize: '1.4rem' }}>
                        We&apos;ll review your request for {partySize} guest{Number(partySize) === 1 ? '' : 's'}, confirm the timing and table arrangements, and get back to you.
                    </Alert>

                    <Stack direction="row" spacing={2}>
                        <Button variant="outlined" onClick={() => send({ type: 'BACK' })} sx={{ fontSize: '1.5rem' }}>Back</Button>
                        <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            onClick={() => send({ type: 'CONTINUE' })}
                            sx={{ fontSize: '1.6rem' }}
                        >
                            Continue
                        </Button>
                    </Stack>
                </Box>
            )}

            {/* Step 4: Contact + Submit */}
            {onContact && (
                <Box>
                    <Typography variant="h2" component="h2" gutterBottom>
                        Your Information
                    </Typography>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="First Name"
                                required
                                fullWidth
                                value={formData.firstName}
                                onChange={(e) => send({ type: 'FIELD_CHANGE', field: 'firstName', value: e.target.value })}
                            />
                            <TextField
                                label="Last Name"
                                required
                                fullWidth
                                value={formData.lastName}
                                onChange={(e) => send({ type: 'FIELD_CHANGE', field: 'lastName', value: e.target.value })}
                            />
                        </Stack>
                        <TextField
                            label="Email"
                            type="email"
                            required
                            fullWidth
                            value={formData.email}
                            onChange={(e) => send({ type: 'FIELD_CHANGE', field: 'email', value: e.target.value })}
                        />
                        <TextField
                            label="Phone"
                            type="tel"
                            fullWidth
                            value={formData.phone}
                            onChange={(e) => send({ type: 'FIELD_CHANGE', field: 'phone', value: e.target.value })}
                        />
                        {/* Admin-configured custom fields for the selected event type */}
                        {selectedTypeFields.map(f => {
                            const val = formData[f.id];
                            if (f.type === 'checkbox') {
                                return (
                                    <FormControlLabel
                                        key={f.id}
                                        control={<Checkbox checked={!!val} onChange={(e) => send({ type: 'FIELD_CHANGE', field: f.id, value: e.target.checked })} />}
                                        label={f.label}
                                    />
                                );
                            }
                            if (f.type === 'select') {
                                return (
                                    <TextField
                                        key={f.id}
                                        select
                                        label={f.label}
                                        required={!!f.required}
                                        fullWidth
                                        value={val || ''}
                                        onChange={(e) => send({ type: 'FIELD_CHANGE', field: f.id, value: e.target.value })}
                                    >
                                        <MenuItem value=""><em>Choose…</em></MenuItem>
                                        {(f.options || []).map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                                    </TextField>
                                );
                            }
                            return (
                                <TextField
                                    key={f.id}
                                    label={f.label}
                                    required={!!f.required}
                                    fullWidth
                                    multiline={f.type === 'textarea'}
                                    rows={f.type === 'textarea' ? 3 : undefined}
                                    value={val || ''}
                                    onChange={(e) => send({ type: 'FIELD_CHANGE', field: f.id, value: e.target.value })}
                                    helperText={f.required ? undefined : 'Optional'}
                                />
                            );
                        })}
                        {(eventTypes.length === 0 || selectedEventType === 'Other') ? (
                            <TextField
                                label="What is this event for?"
                                fullWidth
                                multiline
                                rows={3}
                                value={formData.description}
                                onChange={(e) => send({ type: 'FIELD_CHANGE', field: 'description', value: e.target.value })}
                                helperText="Tell us about your event or gathering"
                            />
                        ) : (
                            <TextField
                                label="Anything else we should know?"
                                fullWidth
                                multiline
                                rows={2}
                                value={formData.description}
                                onChange={(e) => send({ type: 'FIELD_CHANGE', field: 'description', value: e.target.value })}
                                helperText="Optional — any details for our team"
                            />
                        )}
                    </Stack>

                    {error && (
                        <Alert severity="error" sx={{ mt: 3 }} onClose={() => send({ type: 'CLEAR_ERROR' })}>
                            {error}
                        </Alert>
                    )}

                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={() => send({ type: 'SUBMIT' })}
                        disabled={!isFormValid || isSubmitting}
                        sx={{ mt: 3, py: 1.5, fontSize: '1.6rem', textTransform: 'none' }}
                    >
                        {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Submit Booking Request'}
                    </Button>
                </Box>
            )}
        </Container>
    );
}
