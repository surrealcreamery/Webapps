import React, { useState, useEffect, useMemo, useContext, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMachine } from '@xstate/react';
import {
    Box, Typography, Container, Button, Stack, CircularProgress,
    TextField, MenuItem, Select, FormControl, InputLabel, Alert,
    IconButton, Chip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { LayoutContext as EventsLayoutContext } from '@/contexts/events/EventsLayoutContext';
import { LocalizationProvider, DateCalendar } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addDays, startOfToday, isToday, format, parse } from 'date-fns';
import { bookASpaceMachine } from '@/state/events/bookASpaceMachine';

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

const formatHour = (hour) => {
    const h = hour % 12 || 12;
    if (hour === 0 || hour === 24) return '12am';
    if (hour < 12) return `${h}am`;
    if (hour === 12) return '12pm';
    return `${h}pm`;
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

// Fewest free tables (largest-first) whose seats sum >= partySize. Mirrors the server for live preview;
// the server re-allocates authoritatively on submit. Returns { tables, totalSeats } or null.
const allocateFewestTables = (freeTables, partySize) => {
    const need = Math.max(1, parseInt(partySize, 10) || 0);
    if (!need || !Array.isArray(freeTables)) return null;
    const sorted = [...freeTables].sort((a, b) => (Number(b.seats) || 0) - (Number(a.seats) || 0));
    const picked = [];
    let seats = 0;
    for (const t of sorted) {
        if (seats >= need) break;
        picked.push(t);
        seats += Number(t.seats) || 0;
    }
    return seats >= need ? { tables: picked, totalSeats: seats } : null;
};

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
    const keys = ['eventType', 'loc', 'date', 'start', 'end'];
    return {
        eventType: p.get('eventType') || '', loc: p.get('loc') || '', date: p.get('date') || '',
        start: p.get('start') || '', end: p.get('end') || '',
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

    const {
        locations, events, eventTypes, selectedLocationId, selectedDate,
        startTime, endTime, selectedEventType, formData, error, partySize, availability,
    } = state.context;

    const isLoading = state.matches('loading');
    const isSubmitted = state.matches('submitted');
    const isSubmitting = state.matches('submitting');
    const onEventType = state.matches('eventType');
    const onLocation = state.matches('location');
    const onPartySize = state.matches('partySize');
    const onSchedule = state.matches('schedule');
    const isCheckingAvailability = state.matches('checkingAvailability');
    const onReview = state.matches('review');
    const onContact = state.matches('contact') || isSubmitting;

    const hasEventTypes = eventTypes.length > 0;
    const hasMultipleLocations = locations.length > 1;

    const selectedLocation = useMemo(
        () => locations.find(l => l.id === selectedLocationId) || null,
        [locations, selectedLocationId],
    );

    // Availability-derived helpers (available AFTER date/time is chosen).
    const freeSeats = availability?.freeSeats ?? null;
    const partyAllocation = useMemo(
        () => (availability?.configured ? allocateFewestTables(availability.freeTables || [], partySize) : null),
        [availability, partySize],
    );
    const partyOverCapacity = !!(availability?.configured && Number(partySize) > (availability?.freeSeats || 0));

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
        put('start', startTime); put('end', endTime);
        const qs = p.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    }, [isLoading, selectedEventType, selectedLocationId, selectedDate, startTime, endTime]);

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
        if (sel.end) send({ type: 'SELECT_END', time: sel.end });
    }, [isLoading, send]);

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

    const endTimeOptions = useMemo(() => {
        if (!startTime || !selectedLocation) return [];
        const startHour = parseInt(startTime.split(':')[0], 10);
        const [y, m, d] = selectedDate.split('-').map(Number);
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        const dh = selectedLocation.hours?.[String(dayOfWeek)];
        let closeHour = dh?.close ? parseInt(dh.close.split(':')[0], 10) : 22;
        if (closeHour <= startHour) closeHour = 24; // midnight/past-midnight
        const opts = [];
        for (let h = startHour + 1; h <= closeHour; h++) {
            // Stop at the first booked hour so bookings can't overlap existing events
            if (bookedSlots[h]) break;
            const value = `${String(h).padStart(2, '0')}:00`;
            // Use formatHour (handles hour 24 = midnight); date-fns parse('24:00','HH:mm') is an Invalid Date.
            opts.push({ value, label: formatHour(h) });
        }
        return opts;
    }, [startTime, selectedLocation, selectedDate, bookedSlots]);

    const isFormValid = selectedLocationId && selectedDate && startTime && endTime
        && (eventTypes.length === 0 || selectedEventType)
        && formData.firstName && formData.lastName && formData.email;

    // --- Date navigation ---
    const tomorrow = useMemo(() => addDays(startOfToday(), 1), []);
    const isPrevDisabled = useMemo(() => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        return new Date(y, m - 1, d).getTime() <= tomorrow.getTime();
    }, [selectedDate, tomorrow]);

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
                    <strong>{format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM do, yyyy')}</strong>.
                </Typography>
                {partyAllocation && (
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 1, fontSize: '1.6rem' }}>
                        Reserved <strong>{partyAllocation.tables.map(t => t.name).join(', ')}</strong> for {partySize} guests.
                    </Typography>
                )}
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontSize: '1.6rem' }}>
                    We'll review your request and get back to you at <strong>{formData.email}</strong>.
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
            {isCheckingAvailability && (
                <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(255,255,255,0.7)', zIndex: 1300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }} role="status" aria-live="polite">
                    <CircularProgress />
                    <Typography variant="body1" sx={{ fontSize: '1.6rem' }}>Checking table availability…</Typography>
                </Box>
            )}
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

            {/* Step: Party Size — availability-aware; capped to what the free tables can seat */}
            {onPartySize && (
                <Box>
                    <Typography variant="h2" component="h2" gutterBottom>How many guests?</Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 1, fontSize: '1.5rem' }}>
                        {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEE, MMM do')}
                        {startTime && `, ${format(parse(startTime, 'HH:mm', new Date()), 'h:mm a')}`}
                        {endTime && ` – ${format(parse(endTime, 'HH:mm', new Date()), 'h:mm a')}`}
                    </Typography>
                    {availability?.configured && (
                        <Typography variant="body1" sx={{ mb: 4, fontSize: '1.5rem', fontWeight: 600, color: freeSeats > 0 ? 'success.main' : 'error.main' }}>
                            {freeSeats > 0 ? `Up to ${freeSeats} seats available at this time` : 'Fully booked at this time — go back and choose another time'}
                        </Typography>
                    )}
                    {!availability?.configured && (
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontSize: '1.5rem' }}>
                            We'll confirm table arrangements with you after your request.
                        </Typography>
                    )}
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
                                let n = v ? parseInt(v, 10) : '';
                                if (n !== '' && availability?.configured && freeSeats > 0) n = Math.min(n, freeSeats);
                                send({ type: 'SET_PARTY_SIZE', value: n });
                            }}
                            inputProps={{ inputMode: 'numeric', style: { textAlign: 'center', fontSize: '2.4rem', width: '4ch' }, 'aria-label': 'Number of guests' }}
                            placeholder="0"
                        />
                        <IconButton
                            aria-label="Increase number of guests"
                            disabled={availability?.configured && freeSeats > 0 && Number(partySize) >= freeSeats}
                            onClick={() => send({ type: 'SET_PARTY_SIZE', value: (Number(partySize) || 0) + 1 })}
                            sx={{ border: '1px solid', borderColor: 'grey.500', width: 48, height: 48 }}
                        >
                            <Typography sx={{ fontSize: '2.4rem', lineHeight: 1 }}>+</Typography>
                        </IconButton>
                    </Stack>

                    {/* Live table preview */}
                    <Box sx={{ minHeight: 44, mb: 2, textAlign: 'center' }}>
                        {Number(partySize) >= 1 && partyAllocation ? (
                            <Typography sx={{ fontSize: '1.5rem', color: 'success.main', fontWeight: 600 }}>
                                Reserves {partyAllocation.tables.length} table{partyAllocation.tables.length === 1 ? '' : 's'}: {partyAllocation.tables.map(t => t.name).join(', ')}
                            </Typography>
                        ) : partyOverCapacity ? (
                            <Typography sx={{ fontSize: '1.5rem', color: 'error.main' }}>
                                Only {freeSeats} seats free at this time — reduce your party or pick another time.
                            </Typography>
                        ) : null}
                    </Box>

                    <Stack direction="row" spacing={2}>
                        <Button variant="outlined" onClick={() => send({ type: 'BACK' })} sx={{ fontSize: '1.5rem' }}>Back</Button>
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={!(Number(partySize) >= 1) || (availability?.configured && (partyOverCapacity || !partyAllocation))}
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

                    {/* Date heading + navigation */}
                    <Box sx={{ mt: 2, mb: 2 }}>
                        <Typography variant="h3" component="h3" sx={{ mb: 0.5, fontWeight: 600 }}>
                            {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d, yyyy')}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<CalendarMonthIcon />}
                                onClick={() => setDatePickerOpen(!datePickerOpen)}
                                sx={{ textTransform: 'none', fontSize: '1.6rem' }}
                            >
                                Go To Date
                            </Button>
                            <IconButton size="small" onClick={() => send({ type: 'CHANGE_DATE', dir: 'prev' })} disabled={isPrevDisabled}>
                                <ChevronLeftIcon />
                            </IconButton>
                            <IconButton size="small" onClick={() => send({ type: 'CHANGE_DATE', dir: 'next' })}>
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
                                        shouldDisableDate={(date) => isToday(date)}
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
                        Tap a start time below. You'll then pick an end time. Times that overlap an existing booking aren't available.
                    </Typography>

                    {/* Start-time chips — wrap to multiple rows, no horizontal scroll */}
                    <Typography sx={{ fontWeight: 500, fontSize: '1.6rem', mb: 1 }}>Start time</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {timeSlots.filter(hour => !bookedSlots[hour]).map(hour => {
                            const timeStr = `${String(hour).padStart(2, '0')}:00`;
                            const isSelected = startTime === timeStr;
                            const isInRange = startTime && endTime && timeStr > startTime && timeStr < endTime;
                            const active = isSelected || isInRange;
                            return (
                                <Button
                                    key={hour}
                                    onClick={() => send({ type: 'SELECT_START', hour })}
                                    aria-pressed={active}
                                    aria-label={`Start at ${formatHour(hour)}`}
                                    variant={active ? 'contained' : 'outlined'}
                                    color={active ? 'error' : 'inherit'}
                                    disableElevation
                                    sx={{
                                        fontSize: '1.6rem',
                                        textTransform: 'none',
                                        borderRadius: 999,
                                        px: 2,
                                        py: 0.75,
                                        minWidth: 0,
                                        lineHeight: 1.2,
                                        borderColor: active ? 'error.main' : 'grey.600',
                                        color: active ? '#fff' : 'text.primary',
                                    }}
                                >
                                    {formatHour(hour)}
                                </Button>
                            );
                        })}
                    </Box>

                    {/* End time — chips, appear after picking a start time */}
                    {startTime && (
                        <Box sx={{ mt: 3, p: 2.5, bgcolor: '#fafafa', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Typography sx={{ mb: 1.5, fontWeight: 500, fontSize: '1.6rem' }}>
                                Starting at {formatHour(parseInt(startTime, 10))} — pick an end time
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {endTimeOptions.map(opt => {
                                    const isSelected = endTime === opt.value;
                                    return (
                                        <Button
                                            key={opt.value}
                                            onClick={() => send({ type: 'SELECT_END', time: opt.value })}
                                            aria-pressed={isSelected}
                                            aria-label={`End at ${opt.label}`}
                                            variant={isSelected ? 'contained' : 'outlined'}
                                            color={isSelected ? 'error' : 'inherit'}
                                            disableElevation
                                            sx={{ fontSize: '1.6rem', textTransform: 'none', borderRadius: 999, px: 2, py: 0.75, minWidth: 0, lineHeight: 1.2, borderColor: isSelected ? 'error.main' : 'grey.600', color: isSelected ? '#fff' : 'text.primary' }}
                                        >
                                            {opt.label}
                                        </Button>
                                    );
                                })}
                            </Box>
                            {endTime && (
                                <Button
                                    variant="contained"
                                    fullWidth
                                    size="large"
                                    onClick={() => send({ type: 'CONTINUE' })}
                                    sx={{ mt: 2, py: 1.5, fontSize: '1.6rem', textTransform: 'none' }}
                                >
                                    Continue
                                </Button>
                            )}
                        </Box>
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
                            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: '1.5rem' }}>Time</Typography><Typography sx={{ fontSize: '1.5rem', fontWeight: 600 }}>{format(parse(startTime, 'HH:mm', new Date()), 'h:mm a')} &ndash; {format(parse(endTime, 'HH:mm', new Date()), 'h:mm a')}</Typography></Stack>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography color="text.secondary" sx={{ fontSize: '1.5rem' }}>Guests</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 600 }}>{partySize}</Typography>
                                    <Button size="small" onClick={() => send({ type: 'EDIT_PARTY' })} sx={{ textTransform: 'none', minWidth: 0, fontSize: '1.3rem' }}>Edit</Button>
                                </Stack>
                            </Stack>
                        </Stack>
                    </Box>

                    {availability?.configured && partyAllocation ? (
                        <Box sx={{ border: '1px solid', borderColor: 'success.main', bgcolor: 'rgba(46,125,50,0.08)', borderRadius: 2, p: 2, mb: 2 }}>
                            <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, mb: 0.5 }}>
                                We&apos;ll reserve {partyAllocation.tables.length} table{partyAllocation.tables.length === 1 ? '' : 's'} for you
                            </Typography>
                            <Typography sx={{ fontSize: '1.5rem', color: 'text.secondary' }}>
                                {partyAllocation.tables.map(t => t.name).join(', ')} &middot; {partyAllocation.totalSeats} seats
                            </Typography>
                        </Box>
                    ) : availability?.configured ? (
                        <Alert severity="warning" sx={{ mb: 2, fontSize: '1.4rem' }}>
                            Not enough tables are free at this time for {partySize} guest{Number(partySize) === 1 ? '' : 's'}
                            {typeof availability.freeSeats === 'number' ? ` (only ${availability.freeSeats} seats available)` : ''}. Please go back and choose a different time.
                        </Alert>
                    ) : (
                        <Alert severity="info" sx={{ mb: 2, fontSize: '1.4rem' }}>
                            We&apos;ll review your request for {partySize} guest{Number(partySize) === 1 ? '' : 's'} and confirm table arrangements with you.
                        </Alert>
                    )}

                    <Stack direction="row" spacing={2}>
                        <Button variant="outlined" onClick={() => send({ type: 'BACK' })} sx={{ fontSize: '1.5rem' }}>Back</Button>
                        <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            disabled={!!(availability?.configured && !partyAllocation)}
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
                        <TextField
                            label="Organization Name"
                            fullWidth
                            value={formData.organizationName}
                            onChange={(e) => send({ type: 'FIELD_CHANGE', field: 'organizationName', value: e.target.value })}
                            helperText="Optional"
                        />
                        <TextField
                            label="What is this event for?"
                            fullWidth
                            multiline
                            rows={3}
                            value={formData.description}
                            onChange={(e) => send({ type: 'FIELD_CHANGE', field: 'description', value: e.target.value })}
                            helperText="Tell us about your event or gathering"
                        />
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
