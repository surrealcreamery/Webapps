import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Box, Typography, Container, Grid, Button, IconButton, Dialog, DialogTitle, DialogContent, Tabs, Tab } from '@mui/material';
import { format, parse } from 'date-fns';

// Visually hidden style for screen-reader-only text
const srOnly = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
};

// Format date like "Saturday, July 12th"
const formatCardDate = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString.replace(/-/g, '/'));
        return format(date, 'EEEE, MMMM do');
    } catch {
        return '';
    }
};

// Format time range like "12:00 PM - 3:00 PM"
const formatCardTime = (startTime, endTime) => {
    if (!startTime) return '';
    try {
        const start = parse(startTime, 'HH:mm', new Date());
        let label = format(start, 'h:mm a');
        if (endTime) {
            const end = parse(endTime, 'HH:mm', new Date());
            label += ` - ${format(end, 'h:mm a')}`;
        }
        return label;
    } catch {
        return '';
    }
};

// Build flat cards from events (same as V1 — each schedule stop becomes its own card)
const buildFlatCards = (events, locations) => {
    const today = new Date().toISOString().slice(0, 10);

    const resolveLocationName = (locationId, event) => {
        if (!locationId) return '';
        const idx = event.locationIds?.indexOf(locationId);
        if (idx >= 0 && event.locationNames?.[idx]) return event.locationNames[idx];
        const loc = locations?.find(l => l.id === locationId);
        return loc?.['Location Name'] || '';
    };

    return events.flatMap(event => {
        const schedule = event.schedule;
        if (Array.isArray(schedule) && schedule.length > 0) {
            return schedule
                .filter(stop => !stop.date || stop.date >= today)
                .map((stop, idx) => ({
                    ...event,
                    _stopIndex: idx,
                    _stop: stop,
                    _stopLocationId: stop.locationId,
                    _stopDate: stop.date,
                    _stopStartTime: stop.startTime || null,
                    _stopEndTime: stop.endTime || null,
                    _stopLocationName: stop.locationName || resolveLocationName(stop.locationId, event),
                    _stopAdmissionFeeCents: stop.admissionFeeCents || stop['Admission Fee Cents'] || event.admissionFeeCents || event['Admission Fee Cents'] || 0,
                    _stopPointsCost: stop.pointsCost || stop['Points Cost'] || event.pointsCost || event['Points Cost'] || 0,
                    _isSeries: !!event.seriesId,
                    _cardKey: `${event.id}-stop-${idx}`,
                }));
        }
        // Standalone event
        const startDate = event.startDate || event['Start Date'];
        const eventTimes = event.eventTimes || event['Event Times'];
        const timeStr = Array.isArray(eventTimes) ? eventTimes[0] : eventTimes;
        let startTime = null, endTime = null;
        if (timeStr && timeStr.includes(' - ')) {
            [startTime, endTime] = timeStr.split(' - ');
        }
        let locationName = '';
        if (event.locationIds?.length === 1 && event.locationNames?.length >= 1) {
            locationName = event.locationNames[0];
        } else if (event.locationIds?.length === 1) {
            locationName = resolveLocationName(event.locationIds[0], event);
        }

        return [{
            ...event,
            _stop: null,
            _stopIndex: null,
            _stopLocationId: event.locationIds?.[0] || null,
            _stopDate: startDate || null,
            _stopStartTime: startTime,
            _stopEndTime: endTime,
            _stopLocationName: locationName,
            _stopAdmissionFeeCents: event.admissionFeeCents || event['Admission Fee Cents'] || 0,
            _stopPointsCost: event.pointsCost || event['Points Cost'] || 0,
            _isSeries: false,
            _cardKey: event.id,
        }];
    });
};

// ============================================
// POKEMON CARD STYLES
// ============================================

const CARD_BORDER_COLOR = '#E0E0E0';
const CARD_BG = '#FFFFFF';
const CARD_FRAME_BG = '#F5F5F5';

// Extract tier word from series name (e.g. "Pokémon Beginner Tournament" -> "Beginner")
const extractTier = (seriesName) => {
    if (!seriesName) return 'Basic';
    const tiers = ['Beginner', 'Intermediate', 'Advanced', 'Elite', 'Master', 'Champion'];
    for (const tier of tiers) {
        if (seriesName.toLowerCase().includes(tier.toLowerCase())) return tier;
    }
    return 'Basic';
};

// ============================================
// SERIES LANDING — Pokemon card per series
// ============================================

// Format a list with commas and "and": ["A"] -> "A", ["A","B"] -> "A and B", ["A","B","C"] -> "A, B, and C"
const formatList = (items) => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
};

// Format date like "July 18th"
const formatMonthDay = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString.replace(/-/g, '/'));
        return format(date, 'MMMM do');
    } catch {
        return '';
    }
};

const SeriesCard = ({ series, onClick, onRegister, scoped = false }) => {
    const feeCents = series.stops[0]?._stopAdmissionFeeCents || 0;
    const ptsCost = series.stops[0]?._stopPointsCost || 0;
    const priceLabel = feeCents > 0
        ? `$${(feeCents / 100).toFixed(feeCents % 100 === 0 ? 0 : 2)}`
        : ptsCost > 0 ? `${ptsCost} pts` : 'Free';

    // On a location-scoped page each series has a single stop, so surface its date/time under the title.
    const scopedDateTime = scoped
        ? (() => {
            const stop = [...series.stops].sort((a, b) => (a._stopDate || '').localeCompare(b._stopDate || ''))[0];
            return stop ? formatStopDateTime(stop._stopDate, stop._stopStartTime) : '';
        })()
        : '';

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <Box
            sx={{
                borderRadius: '8px',
                overflow: 'hidden',
            }}
        >
            {/* Image */}
            <Box
                role="button"
                tabIndex={0}
                onClick={onClick}
                onKeyDown={handleKeyDown}
                aria-label={`View details for ${series.name}, ${priceLabel}${series.prizesDescription ? `, prizes: ${series.prizesDescription}` : ''}${series.additionalInfo ? `, ${series.additionalInfo}` : ''}`}
                sx={{ aspectRatio: '4 / 3', backgroundColor: 'grey.200', overflow: 'hidden', borderRadius: '8px', position: 'relative', cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}
            >
                {series.imageUrl ? (
                    <img
                        src={series.imageUrl}
                        alt={series.imageAltText || series.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                ) : (
                    <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
                        <Typography component="div" sx={{ opacity: 0.3, fontSize: '1.5rem' }} aria-hidden="true">?</Typography>
                    </Box>
                )}
                {/* Price badge */}
                <Box aria-hidden="true" sx={{
                    position: 'absolute', top: 8, right: 8,
                    bgcolor: 'success.main', color: 'white',
                    px: 2, py: 0.75, borderRadius: '8px',
                    fontSize: '2rem', fontWeight: 700, lineHeight: 1,
                }}>
                    {priceLabel}
                </Box>
                {/* Prizes badge */}
                {series.prizesDescription && (
                    <Box aria-hidden="true" sx={{
                        position: 'absolute', top: 8, left: 8, right: 80,
                        bgcolor: 'rgba(0,0,0,0.7)', color: 'white',
                        px: 2, py: 0.75, borderRadius: '8px',
                        fontSize: '2rem', fontWeight: 700, lineHeight: 1.3,
                        width: 'fit-content', maxWidth: '100%',
                    }}>
                        {series.prizesDescription}
                    </Box>
                )}
                {/* Additional info overlay */}
                {series.additionalInfo && (
                    <Box aria-hidden="true" sx={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        bgcolor: 'rgba(0,0,0,0.7)', color: 'white',
                        py: 1, px: 2, textAlign: 'center',
                        fontSize: '1.6rem', fontWeight: 500, lineHeight: 1.3,
                    }}>
                        {series.additionalInfo}
                    </Box>
                )}
            </Box>

            {/* Name */}
            <Typography component="div" sx={{ fontWeight: 600, fontSize: '2.0rem', mt: 1.5, lineHeight: 1.3 }}>
                {series.name}
            </Typography>
            {scopedDateTime && (
                <Typography component="div" sx={{ fontWeight: 700, fontSize: '1.5rem', color: '#000', mt: 0.5, lineHeight: 1.4 }}>
                    {scopedDateTime}
                </Typography>
            )}
            <Typography component="div" sx={{ color: 'text.secondary', fontSize: '1.4rem', mt: 0.5, lineHeight: 1.4 }}>
                Includes Trainer Treat Pack: Choice of one bubble tea and one ice cream, frosted cupcake, or frosted cookies for $2 extra.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <Button variant="outlined" size="small" onClick={onClick} sx={{ fontSize: '1.4rem', textTransform: 'none', flex: 1 }}>
                    View Detail
                    <Box component="span" sx={srOnly}> for {series.name}</Box>
                </Button>
                <Button variant="contained" size="small" onClick={onRegister} sx={{ fontSize: '1.4rem', textTransform: 'none', flex: 1 }}>
                    Register – {priceLabel}
                    <Box component="span" sx={srOnly}> for {series.name}</Box>
                </Button>
            </Box>

        </Box>
    );
};

const SeriesLanding = ({ seriesGroups, standaloneCards, categories = [], category = 'All', onCategory, onSelectSeries, onRegisterSeries, onSelectCard, regCounts, scopeLocationName = null, onExitLocation = null }) => (
    <Container maxWidth="md" sx={{ pt: 0, pb: 4 }}>
        <Typography variant="h1" component="h1" align="center" sx={{ mb: '24px !important' }}>
            Events
        </Typography>

        {categories.length > 0 && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs
                    value={category}
                    onChange={(_, v) => onCategory && onCategory(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    aria-label="Filter events by game category"
                    sx={{
                        '& .MuiTabs-flexContainer': { justifyContent: { xs: 'flex-start', sm: 'center' } },
                        '& .MuiTabs-indicator': { backgroundColor: '#000' },
                        // Inactive: #595959 on white ≈ 7:1 (passes WCAG AA & AAA). Active: black + bold + underline.
                        '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, color: '#595959' },
                        '& .MuiTab-root.Mui-selected': { color: '#000', fontWeight: 700 },
                    }}
                >
                    <Tab label="All Games" value="All" />
                    {categories.map(cat => (
                        <Tab key={cat} label={cat} value={cat} />
                    ))}
                </Tabs>
            </Box>
        )}

        {seriesGroups.length === 0 && standaloneCards.length === 0 && (
            <Typography variant="body1" align="center" color="text.secondary" sx={{ mt: 4 }}>
                {category === 'All' ? 'No upcoming events found.' : `No upcoming ${category} events.`}
            </Typography>
        )}

        <Grid container spacing={2} justifyContent="center">
            {seriesGroups.map(series => (
                <Grid size={{ xs: 12, sm: 6 }} key={series.seriesId}>
                    <SeriesCard
                        series={series}
                        scoped={!!scopeLocationName}
                        onClick={() => onSelectSeries(series.slug || series.seriesId)}
                        onRegister={() => {
                            // On a location page, register goes straight to that location's stop registration.
                            if (scopeLocationName) {
                                const stop = [...series.stops].sort((a, b) => (a._stopDate || '').localeCompare(b._stopDate || ''))[0];
                                if (stop) { onSelectCard(stop); return; }
                            }
                            onRegisterSeries(series.slug || series.seriesId);
                        }}
                    />
                </Grid>
            ))}

            {standaloneCards.map(card => (
                <Grid size={{ xs: 12, sm: 6 }} key={card._cardKey}>
                    <SeriesCard
                        series={{
                            seriesId: card._cardKey,
                            name: card.title,
                            imageUrl: card.imageUrl,
                            imageAltText: '',
                            description: card.description || '',
                            stops: [card],
                        }}
                        scoped={!!scopeLocationName}
                        onClick={() => onSelectCard(card)}
                        onRegister={() => onSelectCard(card)}
                    />
                </Grid>
            ))}
        </Grid>
    </Container>
);

// ============================================
// SERIES DETAIL — Date-grouped stops
// ============================================

const formatShortTime = (startTime) => {
    if (!startTime) return '';
    try {
        const start = parse(startTime, 'HH:mm', new Date());
        return format(start, 'h:mm a');
    } catch {
        return '';
    }
};

const formatStopDateTime = (dateString, startTime) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString.replace(/-/g, '/'));
        const datePart = format(date, 'EEEE, MMMM do');
        if (startTime) {
            const start = parse(startTime, 'HH:mm', new Date());
            const timePart = format(start, 'h:mma');
            return `${datePart} at ${timePart}`;
        }
        return datePart;
    } catch {
        return '';
    }
};

// Staged availability: reveal "spots left" in brackets of `step` (default 4) so a mostly-empty
// tournament shows a small, urgent number (e.g. "4 spots left") instead of the full open count,
// opening the next bracket as it fills. Display-only — real capacity and sold-out are unchanged.
// e.g. cap 18, step 4: count 0→4 left, 4→4 left, 12→4 left, 16→2 left, 18→sold out.
const bracketedSpots = (count, cap, step) => {
    const s = (Number.isFinite(step) && step > 0) ? step : 4;
    if (count >= cap) return 0;
    const nextBracket = Math.min(cap, Math.ceil((count + 1) / s) * s);
    return nextBracket - count;
};

const StopCard = ({ card, onClick, regCounts }) => {
    const dateTimeLabel = formatStopDateTime(card._stopDate, card._stopStartTime);
    const feeCents = card._stopAdmissionFeeCents;
    const ptsCost = card._stopPointsCost;
    const imageUrl = card.imageUrl || card.seriesImageUrl;

    // Sold out check — prefer per-stop (date:locationId) data, fall back to per-date
    const rc = regCounts[card.id];
    const dateKey = card._stopDate;
    const stopKey = dateKey && card._stopLocationId ? `${dateKey}:${card._stopLocationId}` : null;
    let isSoldOut = false;
    let spotsRemaining = null;
    const bracketStep = card.seriesBracketSize; // per-series; bracketedSpots() falls back to 4
    if (rc && stopKey && rc.capacityByStop?.[stopKey]) {
        const cap = rc.capacityByStop[stopKey];
        const count = rc.byStop?.[stopKey] || 0;
        isSoldOut = (cap - count) <= 0;
        spotsRemaining = isSoldOut ? 0 : bracketedSpots(count, cap, bracketStep);
    } else if (rc && dateKey && rc.capacityByDate?.[dateKey]) {
        const cap = rc.capacityByDate[dateKey];
        const count = rc.byDate?.[dateKey] || 0;
        isSoldOut = (cap - count) <= 0;
        spotsRemaining = isSoldOut ? 0 : bracketedSpots(count, cap, bracketStep);
    }

    const priceLabel = feeCents > 0
        ? `$${(feeCents / 100).toFixed(feeCents % 100 === 0 ? 0 : 2)}`
        : ptsCost > 0 ? `${ptsCost} pts` : 'Free';

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isSoldOut) onClick();
        }
    };

    const cardLabel = [
        card._stopLocationName,
        dateTimeLabel,
        priceLabel,
        isSoldOut ? 'Sold out' : spotsRemaining !== null ? `${spotsRemaining} spots left` : null,
    ].filter(Boolean).join(', ');

    const imageBlock = (
        <Box sx={{
            width: 100,
            minWidth: 100,
            aspectRatio: '1',
            backgroundColor: 'grey.900',
            borderRadius: '8px',
            overflow: 'hidden',
        }}>
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt=""
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                    }}
                />
            ) : (
                <Box aria-hidden="true" sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'grey.200',
                }}>
                    <Typography component="div" sx={{ opacity: 0.3, fontSize: '1.6rem' }} aria-hidden="true">?</Typography>
                </Box>
            )}
        </Box>
    );

    const infoBlock = (
        <Box sx={{ px: 1, flex: 1, minWidth: 0 }}>
            {card._stopLocationName && (
                <Typography component="div" sx={{
                    fontWeight: 700,
                    fontSize: '1.6rem',
                    lineHeight: 1.3,
                }}>
                    {card._stopLocationName}
                </Typography>
            )}
            {dateTimeLabel && (
                <Typography component="div" sx={{ fontSize: '1.6rem', color: 'text.secondary', mt: 0.25 }}>
                    {dateTimeLabel}
                </Typography>
            )}
            <Typography component="div" sx={{ fontSize: '1.6rem', fontWeight: 700, mt: 0.25 }}>
                {priceLabel}
            </Typography>
            {isSoldOut ? (
                <Typography component="div" sx={{ color: 'error.main', fontSize: '1.6rem', fontWeight: 700, mt: 0.15 }}>
                    Sold Out
                </Typography>
            ) : spotsRemaining !== null && (
                <Typography component="div" sx={{ color: 'success.main', fontSize: '1.6rem', fontWeight: 600, mt: 0.15 }}>
                    {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} left
                </Typography>
            )}
        </Box>
    );

    return (
        <Box
            role="button"
            tabIndex={0}
            aria-label={cardLabel}
            aria-disabled={isSoldOut}
            onClick={isSoldOut ? undefined : onClick}
            onKeyDown={handleKeyDown}
            sx={{
                cursor: isSoldOut ? 'default' : 'pointer',
                borderRadius: '8px',
                overflow: 'hidden',
                transition: 'transform 0.15s, box-shadow 0.15s',
                '&:hover': isSoldOut ? {} : {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                },
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                opacity: isSoldOut ? 0.6 : 1,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1.5,
            }}
        >
            {imageBlock}
            {infoBlock}
        </Box>
    );
};

const SeriesDetail = ({ series, onBack, onSelectCard, regCounts, scrollToStops = false, scopeLocationName = null }) => {
    const stopsRef = useRef(null);
    const [bundleOpen, setBundleOpen] = useState(false);
    const bundleTitleId = 'bundle-dialog-title';

    useEffect(() => {
        if (scrollToStops && stopsRef.current) {
            // Small delay to let the DOM render
            setTimeout(() => stopsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }, [scrollToStops]);

    const feeCents = series.stops[0]?._stopAdmissionFeeCents || 0;
    const ptsCost = series.stops[0]?._stopPointsCost || 0;
    const priceLabel = feeCents > 0
        ? `$${(feeCents / 100).toFixed(feeCents % 100 === 0 ? 0 : 2)}`
        : ptsCost > 0 ? `${ptsCost} pts` : 'Free';

    // Group stops by date
    const dateGroups = useMemo(() => {
        const groups = {};
        for (const stop of series.stops) {
            const key = stop._stopDate || 'undated';
            if (!groups[key]) groups[key] = [];
            groups[key].push(stop);
        }
        return Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, stops]) => ({
                date,
                dateLabel: date !== 'undated' ? formatCardDate(date) : 'Date TBD',
                stops: stops.sort((a, b) => (a._stopStartTime || '').localeCompare(b._stopStartTime || '')),
            }));
    }, [series.stops]);

    // Location-scoped detail: register goes straight to this location's (next) stop, and its date/time
    // + spots-remaining are shown under the title instead of a stops list at the bottom.
    const scoped = !!scopeLocationName;
    const scopedStop = useMemo(
        () => (scoped ? [...series.stops].sort((a, b) => (a._stopDate || '').localeCompare(b._stopDate || ''))[0] || null : null),
        [scoped, series.stops]
    );
    const scopedInfo = useMemo(() => {
        if (!scopedStop) return null;
        const rc = regCounts[scopedStop.id];
        const dateKey = scopedStop._stopDate;
        const stopKey = dateKey && scopedStop._stopLocationId ? `${dateKey}:${scopedStop._stopLocationId}` : null;
        let isSoldOut = false, spotsRemaining = null;
        if (rc && stopKey && rc.capacityByStop?.[stopKey]) {
            const cap = rc.capacityByStop[stopKey]; const count = rc.byStop?.[stopKey] || 0;
            isSoldOut = (cap - count) <= 0; spotsRemaining = isSoldOut ? 0 : bracketedSpots(count, cap, scopedStop.seriesBracketSize);
        } else if (rc && dateKey && rc.capacityByDate?.[dateKey]) {
            const cap = rc.capacityByDate[dateKey]; const count = rc.byDate?.[dateKey] || 0;
            isSoldOut = (cap - count) <= 0; spotsRemaining = isSoldOut ? 0 : bracketedSpots(count, cap, scopedStop.seriesBracketSize);
        }
        return { dateTimeLabel: formatStopDateTime(scopedStop._stopDate, scopedStop._stopStartTime), isSoldOut, spotsRemaining };
    }, [scopedStop, regCounts]);

    // Scoped: register straight for this location's stop. Otherwise: scroll to the stops list.
    const handleRegister = () => {
        if (scoped) {
            if (scopedStop && !scopedInfo?.isSoldOut) onSelectCard(scopedStop);
            return;
        }
        stopsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const registerLabel = (scoped && scopedInfo?.isSoldOut) ? 'Sold Out' : `Register – ${priceLabel}`;

    return (
        <Container maxWidth="md" sx={{ pt: 0, pb: 4 }}>
            <Typography variant="h1" component="h1" align="center" sx={{ mb: scopedInfo ? '8px !important' : '24px !important' }}>
                {series.name}
            </Typography>
            {scopedInfo && (
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    {scopedInfo.dateTimeLabel && (
                        <Typography variant="h6" component="p" fontWeight={700}>{scopedInfo.dateTimeLabel}</Typography>
                    )}
                    {scopedInfo.isSoldOut ? (
                        <Typography variant="body1" sx={{ color: 'error.main', fontWeight: 700 }}>Sold Out</Typography>
                    ) : scopedInfo.spotsRemaining !== null && (
                        <Typography variant="body1" sx={{ color: 'success.main', fontWeight: 700 }}>
                            {scopedInfo.spotsRemaining} {scopedInfo.spotsRemaining === 1 ? 'spot' : 'spots'} left
                        </Typography>
                    )}
                </Box>
            )}

            {/* Desktop: two-column — image left, info right */}
            <Grid container spacing={3} sx={{ mb: 4, display: { xs: 'none', sm: 'flex' } }}>
                <Grid size={{ sm: 6 }}>
                    <Box sx={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'grey.900' }}>
                        {series.imageUrl && (
                            <img
                                src={series.imageUrl}
                                alt={series.imageAltText || series.name}
                                style={{ width: '100%', display: 'block', aspectRatio: '4 / 3', objectFit: 'cover' }}
                            />
                        )}
                        <Box aria-hidden="true" sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'success.main', color: 'white', px: 2, py: 0.75, borderRadius: '8px', fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
                            {priceLabel}
                        </Box>
                        {series.prizesDescription && (
                            <Box aria-hidden="true" sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'rgba(0,0,0,0.7)', color: 'white', px: 2, py: 0.75, borderRadius: '8px', fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
                                {series.prizesDescription}
                            </Box>
                        )}
                        {series.additionalInfo && (
                            <Box aria-hidden="true" sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: 'rgba(0,0,0,0.7)', color: 'white', py: 1, px: 2, textAlign: 'center', fontSize: '1.6rem', fontWeight: 500, lineHeight: 1.3 }}>
                                {series.additionalInfo}
                            </Box>
                        )}
                        {/* SR-only text for badge info */}
                        <Box sx={srOnly}>
                            Price: {priceLabel}.
                            {series.prizesDescription && ` Prizes: ${series.prizesDescription}.`}
                            {series.additionalInfo && ` ${series.additionalInfo}.`}
                        </Box>
                    </Box>
                </Grid>
                <Grid size={{ sm: 6 }} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {series.description && (
                        <Typography sx={{ color: 'text.secondary', fontSize: '1.6rem', whiteSpace: 'pre-line', mb: 1 }}>
                            {series.description}
                        </Typography>
                    )}
                    {dateGroups.length > 0 && (
                        <Button
                            variant="contained"
                            size="large"
                            sx={{ fontWeight: 700, fontSize: '1.6rem', mt: 0.5, maxWidth: 'fit-content' }}
                            onClick={handleRegister}
                            disabled={scoped && !!scopedInfo?.isSoldOut}
                        >
                            {registerLabel}
                        </Button>
                    )}
                </Grid>
            </Grid>

            {/* Mobile: stacked — image with badges, then CTA, then info */}
            <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 4 }}>
                <Box sx={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'grey.900', mb: 2 }}>
                    {series.imageUrl && (
                        <img
                            src={series.imageUrl}
                            alt={series.imageAltText || series.name}
                            style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                        />
                    )}
                    <Box aria-hidden="true" sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'success.main', color: 'white', px: 2, py: 0.75, borderRadius: '8px', fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
                        {priceLabel}
                    </Box>
                    {series.prizesDescription && (
                        <Box aria-hidden="true" sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'rgba(0,0,0,0.7)', color: 'white', px: 2, py: 0.75, borderRadius: '8px', fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
                            {series.prizesDescription}
                        </Box>
                    )}
                    {series.additionalInfo && (
                        <Box aria-hidden="true" sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: 'rgba(0,0,0,0.7)', color: 'white', py: 1, px: 2, textAlign: 'center', fontSize: '1.6rem', fontWeight: 500, lineHeight: 1.3 }}>
                            {series.additionalInfo}
                        </Box>
                    )}
                    {/* SR-only text for badge info */}
                    <Box sx={srOnly}>
                        Price: {priceLabel}.
                        {series.prizesDescription && ` Prizes: ${series.prizesDescription}.`}
                        {series.additionalInfo && ` ${series.additionalInfo}.`}
                    </Box>
                </Box>
                {dateGroups.length > 0 && (
                    <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        sx={{ fontWeight: 700, fontSize: '1.6rem', mb: 2 }}
                        onClick={handleRegister}
                        disabled={scoped && !!scopedInfo?.isSoldOut}
                    >
                        {registerLabel}
                    </Button>
                )}
                {series.description && (
                    <Typography sx={{ color: 'text.secondary', fontSize: '1.6rem', whiteSpace: 'pre-line', mb: 1 }}>
                        {series.description}
                    </Typography>
                )}
            </Box>

            {/* Trainer Treat Pack */}
            {series.bundleName && (
                <>
                    <Button
                        variant="text"
                        onClick={() => setBundleOpen(true)}
                        sx={{ color: 'text.secondary', fontSize: '1.4rem', mb: 2, textDecoration: 'underline', textTransform: 'none', p: 0, minWidth: 0, justifyContent: 'flex-start', '&:hover': { color: 'text.primary', textDecoration: 'underline' } }}
                    >
                        {series.bundleName}
                        {series.bundlePrice > 0 && ` — $${(series.bundlePrice / 100).toFixed(series.bundlePrice % 100 === 0 ? 0 : 2)}`}
                    </Button>
                    <Dialog open={bundleOpen} onClose={() => setBundleOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { maxHeight: '80vh' } }} aria-labelledby={bundleTitleId}>
                        <DialogTitle id={bundleTitleId} sx={{ fontWeight: 700, fontSize: '2rem', pb: 0 }}>
                            {series.bundleName}
                        </DialogTitle>
                        <DialogContent sx={{ pt: 1, pb: 3, overflowY: 'auto' }}>
                            {series.bundlePrice > 0 && (
                                <Typography component="div" sx={{ fontSize: '1.6rem', color: 'text.secondary', mb: 2 }}>
                                    ${(series.bundlePrice / 100).toFixed(series.bundlePrice % 100 === 0 ? 0 : 2)}
                                </Typography>
                            )}
                            {(() => {
                                const slotData = (series.bundleSlotData || []).length > 0
                                    ? series.bundleSlotData
                                    : (series.bundleSlotNames || []).map(name => ({ name, products: [] }));
                                return slotData.length > 0 && (
                                    <Box>
                                        {slotData.map((slot, i) => (
                                            <Box key={i} sx={{ mb: 2 }} role="group" aria-label={`${slot.name} options`}>
                                                <Typography component="h3" sx={{ fontWeight: 600, fontSize: '1.5rem', mb: 1 }}>
                                                    {slot.name}
                                                </Typography>
                                                {(slot.products || []).length > 0 && slot.products.map((product, j) => {
                                                    const pName = typeof product === 'string' ? product : product.name;
                                                    const pImg = typeof product === 'string' ? '' : product.imageUrl;
                                                    return (
                                                        <Box key={j} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                                                            <Box
                                                                component="img"
                                                                src={pImg || undefined}
                                                                alt=""
                                                                role={pImg ? undefined : 'presentation'}
                                                                sx={{ width: 48, height: 48, borderRadius: 1, objectFit: 'cover', flexShrink: 0, bgcolor: 'grey.100', display: pImg ? 'block' : 'block' }}
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                            <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                                                                {pName}
                                                            </Typography>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        ))}
                                    </Box>
                                );
                            })()}
                            <Button fullWidth variant="outlined" onClick={() => setBundleOpen(false)} sx={{ mt: 2, textTransform: 'none', fontSize: '1.4rem' }}>
                                Close
                            </Button>
                        </DialogContent>
                    </Dialog>
                </>
            )}

            {/* Linked pages */}
            {series.linkedPages?.length > 0 && (
                <Box component="nav" aria-label="Related pages" sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {series.linkedPages.map(lp => (
                        <Typography
                            key={lp.slug}
                            component="a"
                            href={lp.slug.startsWith('/') ? lp.slug : `/${lp.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: '1.6rem', color: 'text.secondary', textDecoration: 'underline', '&:hover': { color: 'text.primary' } }}
                        >
                            {lp.title || lp.slug}
                            <Box component="span" sx={srOnly}> (opens in new tab)</Box>
                        </Typography>
                    ))}
                </Box>
            )}

            {/* Disclaimer */}
            {series.disclaimer && (
                <Typography sx={{ color: 'text.secondary', fontSize: '1.3rem', fontStyle: 'italic', whiteSpace: 'pre-line', mb: 3 }}>
                    {series.disclaimer}
                </Typography>
            )}

            {/* Date-grouped stops */}
            <Box ref={stopsRef} />
            {/* Location-scoped detail moves the single date/time + spots up under the title, so the
                full stops list is hidden here. */}
            {!scoped && dateGroups.map(group => (
                <Box key={group.date} sx={{ mb: 2 }}>
                    <Typography component="h2" sx={{
                        fontWeight: 700,
                        fontSize: '1.6rem',
                        mb: 1,
                        pb: 0.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                    }}>
                        {group.dateLabel}
                    </Typography>
                    <Grid container spacing={1.5}>
                        {group.stops.map(card => (
                            <Grid size={{ xs: 12, sm: 6 }} key={card._cardKey}>
                                <StopCard
                                    card={card}
                                    onClick={() => onSelectCard(card)}
                                    regCounts={regCounts}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            ))}

            {!scoped && dateGroups.length === 0 && (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                    No upcoming dates for this series.
                </Typography>
            )}
        </Container>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const FlatDirectorySection = ({ events, locations, onSelectCard, regCounts = {}, selectedSeriesId = null, onSeriesSelect, locationScope = null, onLocationScopeExit }) => {
    // Use lifted state from parent if provided, otherwise fall back to local state
    const [localSeriesId, setLocalSeriesId] = useState(null);
    const [scrollToStops, setScrollToStops] = useState(false);
    const activeSeriesId = onSeriesSelect ? selectedSeriesId : localSeriesId;
    const setActiveSeriesId = onSeriesSelect || setLocalSeriesId;

    // Location-scoped page (/events/<loc> and /events/<slug>/<loc>): only show stops at this location.
    const scopeLocationName = locationScope
        ? ((locations?.find(l => l.id === locationScope) || {})['Location Name'] || locationScope)
        : null;

    const activeEvents = useMemo(
        () => (events || []).filter(event => event.status === 'Active' && !event.hideFromDirectory),
        [events]
    );

    const flatCards = useMemo(() => {
        const all = buildFlatCards(activeEvents, locations);
        return locationScope ? all.filter(c => c._stopLocationId === locationScope) : all;
    }, [activeEvents, locations, locationScope]);

    // Group cards by seriesId
    const { seriesGroups, standaloneCards } = useMemo(() => {
        const seriesMap = {};
        const standalone = [];

        for (const card of flatCards) {
            if (card.seriesId) {
                if (!seriesMap[card.seriesId]) {
                    seriesMap[card.seriesId] = {
                        seriesId: card.seriesId,
                        slug: card.seriesSlug || null,
                        name: card.seriesName || card.title,
                        imageUrl: card.seriesImageUrl || card.imageUrl,
                        imageAltText: card.seriesImageAltText || '',
                        description: card.seriesDescription || '',
                        prizesDescription: card.seriesPrizesDescription || '',
                        additionalInfo: card.seriesAdditionalInfo || '',
                        linkedPages: card.seriesLinkedPages || [],
                        bundleName: card.seriesBundleName || null,
                        bundlePrice: card.seriesBundlePrice || null,
                        bundleSlotNames: card.seriesBundleSlotNames || [],
                        bundleSlotData: card.seriesBundleSlotData || [],
                        disclaimer: card.seriesDisclaimer || null,
                        category: card.seriesCategory || null,
                        categoryOrder: card.seriesCategoryOrder ?? 999,
                        order: card.seriesOrder ?? 999,
                        stops: [],
                    };
                }
                seriesMap[card.seriesId].stops.push(card);
            } else {
                standalone.push(card);
            }
        }

        const groups = Object.values(seriesMap).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        // Sort standalone by date
        standalone.sort((a, b) => (a._stopDate || '9999').localeCompare(b._stopDate || '9999'));

        return { seriesGroups: groups, standaloneCards: standalone };
    }, [flatCards]);

    // Category filter (Pokemon, Magic, …) — options come from whatever categories the series carry.
    const [category, setCategory] = useState('All');
    // Order tabs by the category's configured display order (from admin), then alphabetically as a tiebreaker.
    const categories = useMemo(() => {
        const orderByName = {};
        for (const s of seriesGroups) {
            if (s.category && !(s.category in orderByName)) orderByName[s.category] = s.categoryOrder ?? 999;
        }
        return [...new Set(seriesGroups.map(s => s.category).filter(Boolean))]
            .sort((a, b) => (orderByName[a] - orderByName[b]) || a.localeCompare(b));
    }, [seriesGroups]);
    useEffect(() => {
        if (category !== 'All' && !categories.includes(category)) setCategory('All');
    }, [categories, category]);

    // Apply the filter: a specific category shows only that game's series (standalone cards have no
    // category, so they're hidden while a category is active).
    const visibleSeriesGroups = category === 'All' ? seriesGroups : seriesGroups.filter(s => s.category === category);
    const visibleStandaloneCards = category === 'All' ? standaloneCards : [];

    // Find selected series
    const selectedSeries = activeSeriesId
        ? seriesGroups.find(s => s.slug === activeSeriesId || s.seriesId === activeSeriesId)
        : null;

    // In a location scope, series URLs carry the location so refresh/share/back stay scoped.
    const seriesUrl = (slug) => locationScope ? `/events/${slug}/${locationScope}` : `/events/${slug}`;

    if (selectedSeries) {
        return (
            <SeriesDetail
                series={selectedSeries}
                scopeLocationName={scopeLocationName}
                onBack={() => {
                    window.history.pushState(null, '', locationScope ? `/events/${locationScope}` : '/events');
                    window.dispatchEvent(new Event('events:nav'));
                    setActiveSeriesId(null);
                    setScrollToStops(false);
                }}
                onSelectCard={onSelectCard}
                regCounts={regCounts}
                scrollToStops={scrollToStops}
            />
        );
    }

    return (
        <SeriesLanding
            seriesGroups={visibleSeriesGroups}
            standaloneCards={visibleStandaloneCards}
            categories={categories}
            category={category}
            onCategory={setCategory}
            scopeLocationName={scopeLocationName}
            onExitLocation={locationScope ? () => { window.history.pushState(null, '', '/events'); window.dispatchEvent(new Event('events:nav')); onLocationScopeExit && onLocationScopeExit(); } : null}
            onSelectSeries={(slug) => { setScrollToStops(false); window.history.pushState(null, '', seriesUrl(slug)); window.dispatchEvent(new Event('events:nav')); setActiveSeriesId(slug); }}
            onRegisterSeries={(slug) => { setScrollToStops(true); window.history.pushState(null, '', seriesUrl(slug)); window.dispatchEvent(new Event('events:nav')); setActiveSeriesId(slug); }}
            onSelectCard={onSelectCard}
            regCounts={regCounts}
        />
    );
};
