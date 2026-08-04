import React from 'react';
import { Box, Typography, Container, Stack, ToggleButton, ToggleButtonGroup, Divider, Chip } from '@mui/material';
import { format, parse } from 'date-fns';

// Helper to format date like "Friday, November 28th, 2025"
const formatEventDate = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString.replace(/-/g, '/'));
        return format(date, 'EEEE, MMMM do, yyyy');
    } catch (e) {
        return '';
    }
};

// Helper to format date like "February 10th, 2026" (shorter, no day of week)
const formatShortDate = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString.replace(/-/g, '/'));
        return format(date, 'MMMM do, yyyy');
    } catch (e) {
        return '';
    }
};

// Helper to format time like "from 3:00pm to 7:00pm"
const formatTimeSlot = (slot) => {
    if (!slot || !slot.includes(' - ')) return '';
    try {
        const [startTime, endTime] = slot.split(' - ');
        const start = parse(startTime, 'HH:mm', new Date());
        const end = parse(endTime, 'HH:mm', new Date());
        return `from ${format(start, 'h:mmaaa')} to ${format(end, 'h:mmaaa')}`.toLowerCase();
    } catch (e) {
        return '';
    }
};

// Helper to format date range for fundraiser hosts
const formatFundraiserDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    return `Host a Fundraiser Between ${formatShortDate(startDate)} and ${formatShortDate(endDate)}`;
};

// Build date/time display for a single event
const getEventDateTimeLabel = (event) => {
    const startDate = event['Start Date'] || event.startDate;
    const endDate = event['End Date'] || event.endDate;
    const eventTimes = event['Event Times'] || event.eventTimes;
    const eventType = event.type || event['Type'];
    const eventRole = event.Role || event.role;

    const isFundraiserHost = (eventType === 'Fundraiser' || eventType === 'Rolling Fundraiser') && eventRole === 'Host';
    if (isFundraiserHost && startDate && endDate) {
        return formatFundraiserDateRange(startDate, endDate);
    }

    // Tentpole event: compact future stop dates
    const schedule = event.schedule;
    if (Array.isArray(schedule) && schedule.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const futureStops = schedule.filter(s => !s.date || s.date >= today).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        if (futureStops.length > 0) {
            const allSameTime = futureStops.every(s => s.startTime === futureStops[0].startTime);
            if (allSameTime && futureStops[0].startTime) {
                const dateParts = futureStops.map((s, i) => {
                    try { const d = new Date(s.date.replace(/-/g, '/')); return i === 0 ? format(d, 'MMMM do') : format(d, 'do'); } catch { return ''; }
                }).filter(Boolean);
                const timePart = (() => { try { return format(parse(futureStops[0].startTime, 'HH:mm', new Date()), 'h:mmaaa').toLowerCase(); } catch { return ''; } })();
                return dateParts.join(', ') + (timePart ? ` at ${timePart}` : '');
            } else {
                return futureStops.map((s, i) => {
                    try {
                        const d = new Date(s.date.replace(/-/g, '/'));
                        const datePart = i === 0 ? format(d, 'MMMM do') : format(d, 'do');
                        const timePart = s.startTime ? format(parse(s.startTime, 'HH:mm', new Date()), 'h:mmaaa').toLowerCase() : '';
                        return timePart ? `${datePart} at ${timePart}` : datePart;
                    } catch { return ''; }
                }).filter(Boolean).join(', ');
            }
        }
        return null;
    }

    // Regular event
    const timeStr = Array.isArray(eventTimes) ? eventTimes[0] : eventTimes;
    const dateDisplay = startDate ? formatEventDate(startDate) : '';
    const timeDisplay = timeStr ? formatTimeSlot(timeStr) : '';
    if (dateDisplay || timeDisplay) {
        return `${dateDisplay}${dateDisplay && timeDisplay ? ' ' : ''}${timeDisplay}`;
    }
    return null;
};

// Spots remaining display for a single event
const SpotsRemaining = ({ event, regCounts }) => {
    const rc = regCounts[event.id];
    if (!rc) return null;

    const schedule = event.schedule;
    if (Array.isArray(schedule) && schedule.length > 0 && rc.capacityByDate) {
        const today = new Date().toISOString().slice(0, 10);
        const futureStops = schedule.filter(s => s.date && s.date >= today);
        const parts = futureStops.map(s => {
            const count = rc.byDate?.[s.date] || 0;
            const cap = rc.capacityByDate?.[s.date];
            if (!cap) return null;
            return { date: s.date, count, cap, remaining: cap - count };
        }).filter(Boolean);
        if (parts.length === 0) return null;
        if (parts.length === 1) {
            const p = parts[0];
            const isFull = p.remaining <= 0;
            return (
                <Typography variant="body2" sx={{ color: isFull ? 'error.main' : 'success.main', fontWeight: 600, mt: 0.5 }}>
                    {isFull ? 'Sold Out' : `${p.remaining} spot${p.remaining !== 1 ? 's' : ''} remaining`}
                </Typography>
            );
        }
        return parts.map(p => {
            const isFull = p.remaining <= 0;
            try {
                const d = new Date(p.date.replace(/-/g, '/'));
                const label = format(d, 'MMM do');
                return (
                    <Typography key={p.date} variant="body2" sx={{ color: isFull ? 'error.main' : 'success.main', fontWeight: 600, mt: 0.5 }}>
                        {label}: {isFull ? 'Sold Out' : `${p.remaining} spot${p.remaining !== 1 ? 's' : ''} remaining`}
                    </Typography>
                );
            } catch { return null; }
        });
    }

    if (rc.capacityByDate) {
        // Find the next upcoming date with capacity data
        const today = new Date().toISOString().slice(0, 10);
        const dateKey = Object.keys(rc.capacityByDate).filter(d => d >= today).sort()[0]
            || Object.keys(rc.capacityByDate)[0];
        if (dateKey) {
            const cap = rc.capacityByDate[dateKey];
            const count = rc.byDate?.[dateKey] || 0;
            const remaining = cap - count;
            const isFull = remaining <= 0;
            return (
                <Typography variant="body2" sx={{ color: isFull ? 'error.main' : 'success.main', fontWeight: 600, mt: 0.5 }}>
                    {isFull ? 'Sold Out' : `${remaining} spot${remaining !== 1 ? 's' : ''} remaining`}
                </Typography>
            );
        }
    }
    return null;
};

// Admission price display
const AdmissionPrice = ({ event }) => {
    const feeCents = event['Admission Fee Cents'] || event.admissionFeeCents || 0;
    const pts = event['Points Cost'] || event.pointsCost || 0;
    if (feeCents <= 0 && pts <= 0) return null;
    const parts = [];
    if (feeCents > 0) parts.push(`$${(feeCents / 100).toFixed(2)}`);
    if (pts > 0) parts.push(`${pts} points`);
    return (
        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600, mt: 1 }}>
            {parts.join(' or ')}
        </Typography>
    );
};

// Standalone event card (unchanged behavior from original)
const StandaloneEventCard = ({ event, onChooseFundraiser, regCounts }) => {
    const dateTimeLabel = getEventDateTimeLabel(event);
    return (
        <Box
            onClick={() => onChooseFundraiser(event.id)}
            sx={{
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'scale(1.02)', boxShadow: 6 },
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'grey.300'
            }}
        >
            {event.imageUrl && (
                <img
                    src={event.imageUrl}
                    alt={event.title}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                />
            )}
            <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
                <Typography variant="h2" component="h2" sx={{ textAlign: 'left', mb: 1.5 }}>
                    {event.title}
                </Typography>

                {dateTimeLabel && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mt: '8px !important', mb: 1.5 }}>
                        {dateTimeLabel}
                    </Typography>
                )}

                <SpotsRemaining event={event} regCounts={regCounts} />

                {(event.description || event['Description']) && (
                    <Typography variant="body1" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                        {event.description || event['Description']}
                    </Typography>
                )}

                <AdmissionPrice event={event} />
            </Box>
        </Box>
    );
};

// Build location label for a series stop row
const getStopLocationLabel = (event) => {
    const names = event.locationNames || [];
    if (names.length > 0) return names.join(', ');
    return null;
};

// Build a simple "Saturday, July 11th at 12:00pm" label for a series stop row
const getStopDateTimeLabel = (event) => {
    const schedule = event.schedule;

    // Tentpole events: find the next upcoming stop from the schedule
    if (Array.isArray(schedule) && schedule.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const futureStops = schedule.filter(s => s.date && s.date >= today).sort((a, b) => a.date.localeCompare(b.date));
        const stop = futureStops[0] || schedule[schedule.length - 1]; // fallback to last stop
        if (stop?.date) {
            try {
                const d = new Date(stop.date.replace(/-/g, '/'));
                let label = format(d, 'EEEE, MMMM do');
                if (stop.startTime) {
                    try {
                        const timeFmt = format(parse(stop.startTime, 'HH:mm', new Date()), 'h:mmaaa').toLowerCase();
                        label += ` at ${timeFmt}`;
                    } catch {}
                }
                return label;
            } catch {}
        }
        return null;
    }

    // Regular events: use startDate + eventTimes
    const startDate = event.startDate;
    if (!startDate) return null;
    try {
        const d = new Date(startDate.replace(/-/g, '/'));
        let label = format(d, 'EEEE, MMMM do');
        const eventTimes = event.eventTimes;
        const timeStr = Array.isArray(eventTimes) ? eventTimes[0] : eventTimes;
        if (timeStr && timeStr.includes(' - ')) {
            const [start] = timeStr.split(' - ');
            try {
                const startFmt = format(parse(start, 'HH:mm', new Date()), 'h:mmaaa').toLowerCase();
                label += ` at ${startFmt}`;
            } catch {}
        }
        return label;
    } catch {
        return null;
    }
};

// Series card: one card with series image/title + individual event stop rows
const SeriesCard = ({ seriesName, seriesImageUrl, seriesImageAltText, seriesDescription, seriesEvents, onChooseFundraiser, regCounts }) => {
    // Sort events by startDate
    const sorted = [...seriesEvents].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

    return (
        <Box
            sx={{
                overflow: 'hidden',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'grey.300',
            }}
        >
            {seriesImageUrl && (
                <img
                    src={seriesImageUrl}
                    alt={seriesImageAltText || seriesName}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                />
            )}
            <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
                <Typography variant="h2" component="h2" sx={{ textAlign: 'left', mb: 1 }}>
                    {seriesName}
                </Typography>
                {seriesDescription && (
                    <Typography variant="body1" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', mb: 1 }}>
                        {seriesDescription}
                    </Typography>
                )}
            </Box>

            <Divider />

            {/* Event stop rows */}
            {sorted.map((event, idx) => {
                const locationLabel = getStopLocationLabel(event);
                const dateTimeLabel = getStopDateTimeLabel(event);
                const rc = regCounts[event.id];

                // Compute spots remaining — find the next upcoming date from the schedule
                let spotsLabel = null;
                let spotsColor = 'success.main';
                if (rc?.capacityByDate) {
                    const today = new Date().toISOString().slice(0, 10);
                    const schedule = event.schedule;
                    let dateKey = null;
                    if (Array.isArray(schedule) && schedule.length > 0) {
                        const futureStops = schedule.filter(s => s.date && s.date >= today).sort((a, b) => a.date.localeCompare(b.date));
                        dateKey = futureStops[0]?.date || null;
                    }
                    // Fall back to first capacity key if no schedule match
                    if (!dateKey) dateKey = Object.keys(rc.capacityByDate)[0];
                    if (dateKey && rc.capacityByDate[dateKey]) {
                        const cap = rc.capacityByDate[dateKey];
                        const count = rc.byDate?.[dateKey] || 0;
                        const remaining = cap - count;
                        if (remaining <= 0) {
                            spotsLabel = 'Sold Out';
                            spotsColor = 'error.main';
                        } else {
                            spotsLabel = `${remaining} spot${remaining !== 1 ? 's' : ''} remaining`;
                        }
                    }
                }

                return (
                    <React.Fragment key={event.id}>
                        {idx > 0 && <Divider />}
                        <Box
                            onClick={() => onChooseFundraiser(event.id)}
                            sx={{
                                px: 2,
                                py: 1.5,
                                cursor: 'pointer',
                                backgroundColor: 'background.paper',
                                transition: 'background-color 0.15s',
                                '&:hover': { backgroundColor: 'action.hover' },
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 2,
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                {locationLabel && (
                                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
                                        {locationLabel}
                                    </Typography>
                                )}
                                {dateTimeLabel && (
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                        {dateTimeLabel}
                                    </Typography>
                                )}
                            </Box>
                            {spotsLabel && (
                                <Typography variant="body2" sx={{ color: spotsColor, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, ml: 'auto', textAlign: 'right' }}>
                                    {spotsLabel}
                                </Typography>
                            )}
                        </Box>
                    </React.Fragment>
                );
            })}
        </Box>
    );
};

export const DirectorySection = ({ events, onChooseFundraiser, view, handleViewChange, regCounts = {} }) => {
    const activeEvents = (events || []).filter(event => event.status === 'Active' && !event.hideFromDirectory);

    // Category filter (Pokemon, Magic, …) — options are whatever categories are actually present.
    const [category, setCategory] = React.useState('All');
    const categories = React.useMemo(
        () => [...new Set(activeEvents.map(e => e.seriesCategory).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        [activeEvents]
    );
    // If the active category disappears (data changed), fall back to All.
    React.useEffect(() => {
        if (category !== 'All' && !categories.includes(category)) setCategory('All');
    }, [categories, category]);

    const filteredEvents = activeEvents.filter(event => {
        // View dimension (All / Events / Fundraisers)
        if (view === 'Events' && !(event.type === 'Event' || event.type === 'Tentpole')) return false;
        if (view === 'Fundraisers' && !(event.type === 'Rolling Fundraiser' || event.type === 'Fundraiser')) return false;
        // Category dimension — a specific category shows only that game's series events.
        if (category !== 'All' && event.seriesCategory !== category) return false;
        return true;
    });

    // Separate into series groups and standalone events
    const seriesGroups = new Map();
    const standaloneEvents = [];

    for (const event of filteredEvents) {
        if (event.seriesId) {
            if (!seriesGroups.has(event.seriesId)) {
                seriesGroups.set(event.seriesId, {
                    seriesId: event.seriesId,
                    seriesName: event.seriesName || 'Series',
                    seriesImageUrl: event.seriesImageUrl || null,
                    seriesImageAltText: event.seriesImageAltText || '',
                    seriesDescription: event.seriesDescription || '',
                    seriesOrder: event.seriesOrder ?? 999,
                    events: [],
                });
            }
            seriesGroups.get(event.seriesId).events.push(event);
        } else {
            standaloneEvents.push(event);
        }
    }

    // Build render list: interleave series cards and standalone events
    // Series use seriesOrder, standalone events use their startDate for sorting
    const renderItems = [];

    for (const [, group] of seriesGroups) {
        // Use earliest event start date for positioning
        const earliestDate = group.events.reduce((min, e) => {
            const d = e.startDate || '';
            return d < min ? d : min;
        }, group.events[0]?.startDate || '9999');
        renderItems.push({ type: 'series', sortKey: group.seriesOrder ?? 999, dateKey: earliestDate, data: group });
    }

    for (const event of standaloneEvents) {
        renderItems.push({ type: 'standalone', sortKey: 999, dateKey: event.startDate || '9999', data: event });
    }

    // Sort: by order first, then by date
    renderItems.sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
        return (a.dateKey || '').localeCompare(b.dateKey || '');
    });

    return (
    <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
        <Typography variant="h1" component="h1" align="center" sx={{ mb: 2 }}>
            Events and Fundraisers
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt:2, mb: 3 }}>
            <ToggleButtonGroup
                color="primary"
                value={view}
                exclusive
                onChange={handleViewChange}
                aria-label="View selection"
            >
                <ToggleButton value="All">All</ToggleButton>
                <ToggleButton value="Events">Events</ToggleButton>
                <ToggleButton value="Fundraisers">Fundraisers</ToggleButton>
            </ToggleButtonGroup>
        </Box>

        {categories.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mb: 3 }}>
                <Chip
                    label="All Games"
                    color={category === 'All' ? 'primary' : 'default'}
                    variant={category === 'All' ? 'filled' : 'outlined'}
                    onClick={() => setCategory('All')}
                />
                {categories.map(cat => (
                    <Chip
                        key={cat}
                        label={cat}
                        color={category === cat ? 'primary' : 'default'}
                        variant={category === cat ? 'filled' : 'outlined'}
                        onClick={() => setCategory(cat)}
                    />
                ))}
            </Box>
        )}

        <Stack spacing={4}>
            {renderItems.map((item) => {
                if (item.type === 'series') {
                    const group = item.data;
                    return (
                        <SeriesCard
                            key={`series-${group.seriesId}`}
                            seriesName={group.seriesName}
                            seriesImageUrl={group.seriesImageUrl}
                            seriesImageAltText={group.seriesImageAltText}
                            seriesDescription={group.seriesDescription}
                            seriesEvents={group.events}
                            onChooseFundraiser={onChooseFundraiser}
                            regCounts={regCounts}
                        />
                    );
                } else {
                    return (
                        <StandaloneEventCard
                            key={item.data.id}
                            event={item.data}
                            onChooseFundraiser={onChooseFundraiser}
                            regCounts={regCounts}
                        />
                    );
                }
            })}
        </Stack>
    </Container>
    );
};
