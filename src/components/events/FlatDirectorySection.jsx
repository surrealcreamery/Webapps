import React, { useState, useMemo, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Container, Grid, Button, IconButton, Dialog, DialogTitle, DialogContent, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { format, parse } from 'date-fns';
import { storeToday, isPreviewMode } from '@/utils/storeDate';
import { LayoutContext as EventsLayoutContext } from '@/contexts/events/EventsLayoutContext';

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
    const today = storeToday();

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
                .filter(stop => (!stop.date || stop.date >= today) && (!stop.hidden || isPreviewMode()))
                .map((stop, idx) => ({
                    ...event,
                    _stopIndex: idx,
                    _stop: stop,
                    _stopLocationId: stop.locationId,
                    _stopTournamentId: stop.tournamentId || null,
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
            _stopTournamentId: event.tournamentId || event['Tournament ID'] || null,
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

    // On a location-scoped page, surface all of this series' sessions at that location,
    // grouped by date (same-day times combined) — one line per date under the title.
    const scheduleLines = scoped ? formatSeriesSchedule(series.stops) : [];

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
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
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
            {scheduleLines.length > 0 && (
                <Box sx={{ mt: 0.5 }}>
                    {scheduleLines.map((line, i) => (
                        <Typography key={i} component="div" sx={{ fontWeight: 700, fontSize: '1.5rem', color: '#000', lineHeight: 1.4 }}>
                            {line}
                        </Typography>
                    ))}
                </Box>
            )}
            {series.description && (
                <Typography component="div" sx={{ color: 'text.secondary', fontSize: '1.4rem', mt: 0.5, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                    {series.description}
                </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1, mt: 'auto', pt: 1.5 }}>
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

// Full-width call-to-action banner promoting the Book-a-Space flow. The whole banner is one
// large accessible button (big tap target) that routes to /events/book-a-space.
const BookSpaceBanner = ({ onClick }) => (
    <Box
        component="button"
        type="button"
        onClick={onClick}
        aria-label="Book our space for your event or gathering"
        sx={{
            width: '100%', font: 'inherit', textAlign: 'left', cursor: 'pointer', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
            px: { xs: 2.5, sm: 4 }, py: { xs: 2.5, sm: 3 }, mb: 3, borderRadius: 3,
            color: '#fff',
            // Endpoints chosen so white text clears WCAG AA across the whole gradient: white on the
            // lightest point (#be185d) is ~6:1, comfortably above 4.5:1 for normal text.
            background: 'linear-gradient(135deg, #6d28d9 0%, #be185d 100%)',
            transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
            '&:focus-visible': { outline: '3px solid', outlineColor: 'text.primary', outlineOffset: 2 },
        }}
    >
        <Box sx={{ minWidth: 0 }}>
            <Typography component="span" sx={{ display: 'block', fontSize: { xs: '2rem', sm: '2.4rem' }, fontWeight: 800, lineHeight: 1.15 }}>
                Host your event with us
            </Typography>
            <Typography component="span" sx={{ display: 'block', fontSize: '1.5rem', mt: 0.5 }}>
                Book our space for parties, gatherings &amp; more
            </Typography>
        </Box>
        <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 0.5, bgcolor: '#fff', color: '#111', fontWeight: 700, fontSize: '1.5rem', px: 2.5, py: 1.25, borderRadius: 999, whiteSpace: 'nowrap' }}>
            Book a Space
            <Box component="span" aria-hidden="true" sx={{ fontSize: '1.7rem', lineHeight: 1 }}>&rarr;</Box>
        </Box>
    </Box>
);

// ============================================
// GAME LANDING — choose a game before seeing its events
// One tile per game category (image + name + count), plus an "All Games" tile.
// Shown only when there is more than one game to choose from.
// ============================================
// A game tile: the series flyer image on top (its own baked-in text stays legible), then a solid
// dark footer bar carrying the game name + upcoming count — so the label never fights the artwork.
const GameTile = ({ label, imageUrl, count, location = null, gradient = null, onClick }) => (
    <Box
        component="button"
        type="button"
        onClick={onClick}
        aria-label={`${label}${count != null ? `, ${count} upcoming` : ''}`}
        sx={{
            width: '100%', p: 0, border: 'none', cursor: 'pointer', font: 'inherit',
            display: 'flex', flexDirection: 'column', textAlign: 'left', borderRadius: '10px',
            overflow: 'hidden', backgroundColor: '#111', boxShadow: 1,
            transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
            '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        }}
    >
        <Box aria-hidden="true" sx={{ aspectRatio: '16 / 9', backgroundColor: 'grey.200', overflow: 'hidden' }}>
            {imageUrl ? (
                <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
                <Box sx={{ width: '100%', height: '100%', background: gradient || 'linear-gradient(135deg, #6d28d9 0%, #be185d 100%)' }} />
            )}
        </Box>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, py: { xs: 1.5, sm: 1.75 }, color: '#fff' }}>
            <Typography component="div" sx={{ fontWeight: 800, fontSize: { xs: '2rem', sm: '2.3rem' }, lineHeight: 1.2 }}>
                {label}
            </Typography>
            {(location || count != null) && (
                <Typography component="div" sx={{ fontWeight: 600, fontSize: '1.4rem', opacity: 0.82, mt: 0.25 }}>
                    {[location, count != null ? `${count} upcoming` : null].filter(Boolean).join(' · ')}
                </Typography>
            )}
        </Box>
    </Box>
);

const GameLanding = ({ categories = [], seriesGroups = [], standaloneCards = [], showLocation = false, onPick, scopeLocationName = null, onBookSpace = null }) => {
    // Derive a representative image, upcoming count, and location label for each game from its series.
    // Prefer the game's own tile image (Series Category image, set in admin → Assets/Games); fall
    // back to the first series' flyer only when no dedicated tile image exists.
    const games = categories.map(cat => {
        const inCat = seriesGroups.filter(s => s.category === cat);
        const tileImg = inCat.find(s => s.categoryImageUrl)?.categoryImageUrl;
        const withImg = inCat.find(s => s.imageUrl);
        const stopCount = inCat.reduce((n, s) => n + (s.stops?.length || 0), 0);
        const locNames = [...new Set(inCat.flatMap(s => (s.stops || []).map(st => st._stopLocationName).filter(Boolean)))];
        const location = !showLocation ? null : locNames.length === 1 ? locNames[0] : locNames.length > 1 ? `${locNames[0]} +${locNames.length - 1}` : null;
        return { name: cat, imageUrl: tileImg || withImg?.imageUrl || null, count: stopCount, location };
    });
    const totalCount = seriesGroups.reduce((n, s) => n + (s.stops?.length || 0), 0) + standaloneCards.length;

    return (
        <Container maxWidth="md" sx={{ pt: 0, pb: 4 }}>
            <Typography variant="h1" component="h1" align="center" sx={{ mb: '8px !important' }}>
                Events
            </Typography>
            <Typography component="p" align="center" color="text.secondary" sx={{ fontSize: '1.7rem', mb: '24px' }}>
                Choose a game to see its events
            </Typography>

            {onBookSpace && !scopeLocationName && <BookSpaceBanner onClick={onBookSpace} />}

            <Grid container spacing={2} justifyContent="center">
                {games.map(g => (
                    <Grid size={{ xs: 12, sm: 6 }} key={g.name} sx={{ display: 'flex' }}>
                        <GameTile label={g.name} imageUrl={g.imageUrl} count={g.count} location={g.location} onClick={() => onPick(g.name)} />
                    </Grid>
                ))}
                {/* See-everything option */}
                <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
                    <GameTile
                        label="All Games"
                        imageUrl={null}
                        count={totalCount}
                        gradient="linear-gradient(135deg, #111827 0%, #374151 100%)"
                        onClick={() => onPick('All')}
                    />
                </Grid>
            </Grid>
        </Container>
    );
};

const SeriesLanding = ({ seriesGroups, standaloneCards, activeGameLabel = null, onBackToGames = null, onSelectSeries, onRegisterSeries, onSelectCard, regCounts, scopeLocationName = null, onExitLocation = null, onBookSpace = null }) => (
    <Container maxWidth="md" sx={{ pt: 0, pb: 4 }}>
        <Typography variant="h1" component="h1" align="center" sx={{ mb: '24px !important' }}>
            {onBackToGames && activeGameLabel && activeGameLabel !== 'All' ? activeGameLabel : 'Events'}
        </Typography>

        {onBookSpace && !scopeLocationName && <BookSpaceBanner onClick={onBookSpace} />}

        {seriesGroups.length === 0 && standaloneCards.length === 0 && (
            <Typography variant="body1" align="center" color="text.secondary" sx={{ mt: 4 }}>
                {!activeGameLabel || activeGameLabel === 'All' ? 'No upcoming events found.' : `No upcoming ${activeGameLabel} events.`}
            </Typography>
        )}

        <Grid container spacing={2} justifyContent="center">
            {seriesGroups.map(series => (
                <Grid size={{ xs: 12, sm: 6 }} key={series.seriesId} sx={{ display: 'flex' }}>
                    <SeriesCard
                        series={series}
                        scoped={!!scopeLocationName}
                        onClick={() => onSelectSeries(series.slug || series.seriesId)}
                        onRegister={() => {
                            // On a location page with a single session, register straight into that stop.
                            // With multiple sessions at this location, open the series detail (scrolled to
                            // the stops list) so the user picks which session first.
                            if (scopeLocationName && series.stops.length === 1) {
                                onSelectCard(series.stops[0]); return;
                            }
                            onRegisterSeries(series.slug || series.seriesId);
                        }}
                    />
                </Grid>
            ))}

            {standaloneCards.map(card => (
                <Grid size={{ xs: 12, sm: 6 }} key={card._cardKey} sx={{ display: 'flex' }}>
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

// Build a per-date schedule for a series: group stops by date, combine same-day start
// times ("5:00PM and 7:00PM"), and return one formatted line per date, date-sorted.
// e.g. ["Tuesday, August 4th at 12:30PM", "Thursday, August 6th at 5:00PM and 7:00PM"]
const formatSeriesSchedule = (stops) => {
    const byDate = {};
    for (const s of stops || []) {
        const d = s._stopDate;
        if (!d) continue;
        (byDate[d] = byDate[d] || new Set());
        if (s._stopStartTime) byDate[d].add(s._stopStartTime);
    }
    return Object.keys(byDate).sort().map((dateString) => {
        let datePart = dateString;
        try { datePart = format(new Date(dateString.replace(/-/g, '/')), 'EEEE, MMMM do'); } catch {}
        const times = [...byDate[dateString]].sort().map((t) => {
            try { return format(parse(t, 'HH:mm', new Date()), 'h:mma'); } catch { return t; }
        });
        return times.length ? `${datePart} at ${times.join(' and ')}` : datePart;
    });
};

// Staged availability (dynamic-tabling aware). `cap` is the game's LIVE table/player limit — the
// shared-pool effective capacity (so e.g. Gundam shows 8 when One Piece holds 16 of a 24-seat room).
// Reveal capacity one bracket (`step` = series Edit-Series bracket size; the minimum needed to fire,
// default 4) at a time: the shown total is the next multiple of `step` ABOVE the current count, capped
// at `cap`. In the FIRST bracket (count < step) show only "{n} Spots Open" (hide the count) so early
// sign-ups read as almost-full; after that show "{count} of {revealed} Players Registered" (4 of 8,
// 8 of 12, …) until the table/player limit is hit. Sold out at cap. Display-only.
const STAGE_STEP_DEFAULT = 4;
const stageLabel = (count, cap, step) => {
    if (cap - count <= 0) return { isSoldOut: true, spotsLabel: null, registeredLabel: null };
    const inc = (Number.isFinite(step) && step > 0) ? step : STAGE_STEP_DEFAULT;
    const revealed = Math.min(cap, (Math.floor(count / inc) + 1) * inc); // next bracket above count, capped at cap
    const spots = revealed - count;
    const firstBracket = count < inc; // opening bracket → "Spots Open", hide the count
    return {
        isSoldOut: false,
        spotsLabel: firstBracket
            ? `${spots} ${spots === 1 ? 'Spot' : 'Spots'} Open`
            : `${spots} ${spots === 1 ? 'spot' : 'spots'} remaining`,
        registeredLabel: firstBracket ? null : `${count} of ${revealed} Players Registered`,
    };
};

// Resolve capacity + count for a stop from regCounts using the key precedence
// (per-tournament → per-stop date:location → per-date) and return its staged availability label.
const resolveSpots = (rc, { tid, stopKey, dateKey }, step) => {
    if (rc && tid && rc.capacityByTournament?.[tid]) return stageLabel(rc.byTournament?.[tid] || 0, rc.capacityByTournament[tid], step);
    if (rc && stopKey && rc.capacityByStop?.[stopKey]) return stageLabel(rc.byStop?.[stopKey] || 0, rc.capacityByStop[stopKey], step);
    if (rc && dateKey && rc.capacityByDate?.[dateKey]) return stageLabel(rc.byDate?.[dateKey] || 0, rc.capacityByDate[dateKey], step);
    return { isSoldOut: false, spotsLabel: null, registeredLabel: null };
};
const spotKeys = (card) => ({
    tid: card._stopTournamentId,
    dateKey: card._stopDate,
    stopKey: card._stopDate && card._stopLocationId ? `${card._stopDate}:${card._stopLocationId}` : null,
});

// Price + capacity/sold-out status for a single stop card.
const stopStatus = (card, regCounts) => {
    const feeCents = card._stopAdmissionFeeCents;
    const ptsCost = card._stopPointsCost;
    const { isSoldOut, spotsLabel, registeredLabel } = resolveSpots(regCounts?.[card.id], spotKeys(card), card.seriesBracketSize);
    const priceLabel = feeCents > 0
        ? `$${(feeCents / 100).toFixed(feeCents % 100 === 0 ? 0 : 2)}`
        : ptsCost > 0 ? `${ptsCost} pts` : 'Free';
    return { priceLabel, isSoldOut, spotsLabel, registeredLabel };
};

const StopCard = ({ card, onClick, regCounts }) => {
    const dateTimeLabel = formatStopDateTime(card._stopDate, card._stopStartTime);
    const feeCents = card._stopAdmissionFeeCents;
    const ptsCost = card._stopPointsCost;
    const imageUrl = card.imageUrl || card.seriesImageUrl;

    // Sold out check — prefer per-tournament (unique per session), then per-stop
    // (date:locationId aggregate), then per-date. Per-tournament is the only key that
    // is correct when one location runs multiple sessions on the same day.
    const { isSoldOut, spotsLabel, registeredLabel } = resolveSpots(regCounts[card.id], spotKeys(card), card.seriesBracketSize);

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
        isSoldOut ? 'Sold out' : spotsLabel,
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
            ) : spotsLabel && (
                <Typography component="div" sx={{ color: 'success.main', fontSize: '1.6rem', fontWeight: 600, mt: 0.15 }}>
                    {spotsLabel}
                </Typography>
            )}
            {registeredLabel && (
                <Typography component="div" sx={{ color: 'text.secondary', fontSize: '0.95rem', fontWeight: 500, mt: 0.1 }}>
                    {registeredLabel}
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
    // Only collapse to a single "next stop" summary when this location genuinely has one session.
    // A series with multiple sessions at the same location (e.g. recurring lessons) must still show
    // the full stops list so the user can pick which one to register for.
    const scopedSingle = scoped && series.stops.length === 1;
    const scopedStop = useMemo(
        () => (scopedSingle ? [...series.stops].sort((a, b) => (a._stopDate || '').localeCompare(b._stopDate || ''))[0] || null : null),
        [scopedSingle, series.stops]
    );
    const scopedInfo = useMemo(() => {
        if (!scopedStop) return null;
        const { isSoldOut, spotsLabel, registeredLabel } = resolveSpots(regCounts[scopedStop.id], spotKeys(scopedStop), scopedStop.seriesBracketSize);
        return { dateTimeLabel: formatStopDateTime(scopedStop._stopDate, scopedStop._stopStartTime), isSoldOut, spotsLabel, registeredLabel };
    }, [scopedStop, regCounts]);

    // Scoped: register straight for this location's stop. Otherwise: scroll to the stops list.
    const handleRegister = () => {
        if (scopedSingle) {
            if (scopedStop && !scopedInfo?.isSoldOut) onSelectCard(scopedStop);
            return;
        }
        stopsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const registerLabel = (scopedSingle && scopedInfo?.isSoldOut) ? 'Sold Out' : `Register – ${priceLabel}`;

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
                    ) : scopedInfo.spotsLabel && (
                        <Typography variant="body1" sx={{ color: 'success.main', fontWeight: 700 }}>
                            {scopedInfo.spotsLabel}
                        </Typography>
                    )}
                    {scopedInfo.registeredLabel && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            {scopedInfo.registeredLabel}
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
                            disabled={scopedSingle && !!scopedInfo?.isSoldOut}
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
                        disabled={scopedSingle && !!scopedInfo?.isSoldOut}
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

            {/* Prizes — auto pack-per-win line + curated product prizes (images + optional placement labels) */}
            {(series.packPerWin?.enabled || (series.prizes || []).length > 0) && (
                <Box sx={{ mb: 4 }}>
                    <Typography sx={{ fontSize: '1.8rem', fontWeight: 700, mb: 1.5 }}>Prizes</Typography>
                    {series.packPerWin?.enabled && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: (series.prizes || []).length > 0 ? 2 : 0 }}>
                            <Box component="span" aria-hidden="true" sx={{ fontSize: '1.8rem', lineHeight: 1 }}>⭐</Box>
                            <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }}>
                                Earn {series.packPerWin.packsPerWin > 1 ? `${series.packPerWin.packsPerWin} booster packs` : 'a booster pack'} per win
                                {series.packPerWin.participationFloor > 0 ? ` (${series.packPerWin.participationFloor} just for playing)` : ''}
                            </Typography>
                        </Box>
                    )}
                    {(series.prizes || []).length > 0 && (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                            {series.prizes.map((pz, i) => (
                                <Box key={pz.sku || i} sx={{ textAlign: 'center' }}>
                                    <Box sx={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'grey.100', aspectRatio: '1 / 1', mb: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {pz.imageUrl
                                            ? <img src={pz.imageUrl} alt={pz.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            : <Box aria-hidden="true" sx={{ fontSize: '3rem' }}>🎁</Box>}
                                        {pz.label && (
                                            <Box sx={{ position: 'absolute', top: 6, left: 6, bgcolor: 'primary.main', color: 'white', px: 1, py: 0.25, borderRadius: '6px', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.2 }}>
                                                {pz.label}
                                            </Box>
                                        )}
                                    </Box>
                                    <Typography sx={{ fontSize: '1.3rem', fontWeight: 600, lineHeight: 1.2 }}>
                                        {pz.name}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            )}

            {/* Trainer Treat Pack */}
            {series.bundleName && (
                <>
                    <Button
                        variant="text"
                        onClick={() => setBundleOpen(true)}
                        sx={{ color: 'text.secondary', fontSize: '1.4rem', mb: 2, textDecoration: 'underline', textTransform: 'none', p: 0, minWidth: 0, justifyContent: 'flex-start', '&:hover': { color: 'text.primary', textDecoration: 'underline' } }}
                    >
                        {series.bundleName}
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
            {/* A genuine single-stop location moves its date/time + spots up under the title, so the
                full stops list is hidden here. Multi-session locations still list every stop. */}
            {!scopedSingle && dateGroups.map(group => (
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

            {!scopedSingle && dateGroups.length === 0 && (
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

// ============================================
// SCHEDULE VIEW — all upcoming events, chronological (cross-game, "what's on")
// ============================================
const ScheduleRow = ({ card, onSelectCard, regCounts, showLocation = true }) => {
    const { priceLabel, isSoldOut, spotsLabel, registeredLabel } = stopStatus(card, regCounts);
    const time = formatShortTime(card._stopStartTime);
    const name = card.seriesName || card.title;
    const meta = [card.seriesCategory, time, showLocation ? card._stopLocationName : null].filter(Boolean).join(' · ');
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="div" sx={{ fontWeight: 700, fontSize: '1.7rem', lineHeight: 1.25 }}>{name}</Typography>
                {meta && <Typography component="div" sx={{ color: 'text.secondary', fontSize: '1.4rem', mt: 0.25 }}>{meta}</Typography>}
                {isSoldOut ? (
                    <Typography component="div" sx={{ color: 'error.main', fontWeight: 700, fontSize: '1.4rem', mt: 0.25 }}>Sold out</Typography>
                ) : spotsLabel && (
                    <Typography component="div" sx={{ color: 'success.main', fontWeight: 600, fontSize: '1.4rem', mt: 0.25 }}>{spotsLabel}</Typography>
                )}
                {registeredLabel && (
                    <Typography component="div" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '1.2rem', mt: 0.1 }}>{registeredLabel}</Typography>
                )}
            </Box>
            <Box sx={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.75 }}>
                <Typography component="div" sx={{ fontWeight: 700, fontSize: '1.6rem' }}>{priceLabel}</Typography>
                <Button variant={isSoldOut ? 'outlined' : 'contained'} size="small" disabled={isSoldOut}
                    onClick={() => onSelectCard(card)} sx={{ fontSize: '1.4rem', textTransform: 'none', whiteSpace: 'nowrap' }}>
                    {isSoldOut ? 'Sold out' : 'Register'}
                    <Box component="span" sx={srOnly}> for {name}</Box>
                </Button>
            </Box>
        </Box>
    );
};

const ScheduleView = ({ cards = [], regCounts = {}, onSelectCard, scopeLocationName = null, onBookSpace = null, showLocation = true }) => {
    const sorted = [...cards].sort((a, b) =>
        (a._stopDate || '9999').localeCompare(b._stopDate || '9999') ||
        (a._stopStartTime || '99').localeCompare(b._stopStartTime || '99'));
    const byDate = [];
    const idx = {};
    for (const c of sorted) {
        const d = c._stopDate || '';
        if (!(d in idx)) { idx[d] = byDate.length; byDate.push({ date: d, cards: [] }); }
        byDate[idx[d]].cards.push(c);
    }
    return (
        <Container maxWidth="md" sx={{ pt: 0, pb: 4 }}>
            <Typography variant="h1" component="h1" align="center" sx={{ mb: '24px !important' }}>Events</Typography>
            {onBookSpace && !scopeLocationName && <BookSpaceBanner onClick={onBookSpace} />}
            {byDate.length === 0 && (
                <Typography variant="body1" align="center" color="text.secondary" sx={{ mt: 4 }}>No upcoming events found.</Typography>
            )}
            {byDate.map(group => (
                <Box key={group.date || 'tbd'} sx={{ mb: 3 }}>
                    <Typography component="h2" sx={{ fontWeight: 800, fontSize: '1.9rem', mb: 1, pb: 0.5, borderBottom: '2px solid', borderColor: 'text.primary' }}>
                        {group.date ? formatCardDate(group.date) : 'Date TBD'}
                    </Typography>
                    {group.cards.map(c => (
                        <ScheduleRow key={c._cardKey} card={c} onSelectCard={onSelectCard} regCounts={regCounts} showLocation={showLocation} />
                    ))}
                </Box>
            ))}
        </Container>
    );
};

// Top control strip shared by the landing views: [ By game | Schedule ] toggle. The location
// filter lives in the header (under-logo selector + LocationModal), driven by the same
// events:locationFilter signal, so there's a single location control site-wide.
const EventsControls = ({ view, onView }) => (
    <Container maxWidth="md" sx={{ pt: { xs: 2, sm: 3 }, pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
            <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => v && onView(v)} aria-label="Browse events by"
                sx={{
                    '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, fontSize: '1.5rem', px: 2.5, py: 0.6, color: '#595959', borderColor: 'divider' },
                    '& .MuiToggleButton-root.Mui-selected': { color: '#fff', bgcolor: '#111', '&:hover': { bgcolor: '#111' } },
                }}>
                <ToggleButton value="games">By game</ToggleButton>
                <ToggleButton value="schedule">Schedule</ToggleButton>
            </ToggleButtonGroup>
        </Box>
    </Container>
);

export const FlatDirectorySection = ({ events, locations, onSelectCard, regCounts = {}, selectedSeriesId = null, onSeriesSelect, locationScope = null, onLocationScopeExit }) => {
    const navigate = useNavigate();
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

    const flatCards = useMemo(() => buildFlatCards(activeEvents, locations), [activeEvents, locations]);

    // Locations that actually have upcoming events (busiest first), for the location filter.
    const locationOptions = useMemo(() => {
        const m = new Map();
        for (const c of flatCards) {
            if (!c._stopLocationId) continue;
            const e = m.get(c._stopLocationId) || { id: c._stopLocationId, name: c._stopLocationName || 'Location', count: 0 };
            e.count += 1;
            m.set(c._stopLocationId, e);
        }
        return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }, [flatCards]);

    // View: 'games' (tile picker) | 'schedule' (chronological). Remembered across visits.
    const [view, setView] = useState(() => {
        try { return localStorage.getItem('events:view') || 'games'; } catch { return 'games'; }
    });
    useEffect(() => { try { localStorage.setItem('events:view', view); } catch { /* ignore */ } }, [view]);

    // Location filter: a store id or 'all'. Never silently applied — defaults to All, or to the
    // URL scope on a /events/<loc> page, or to the user's remembered choice. Only surfaced when
    // more than one store has events (so single-store shops see no filter clutter).
    const [locFilter, setLocFilter] = useState(() => {
        if (locationScope) return locationScope;
        try { return localStorage.getItem('events:locationFilter') || 'all'; } catch { return 'all'; }
    });
    // A /events/<loc> page locks the filter to its location. locationScope resolves asynchronously
    // (the URL resolver runs only after the locations feed loads), so it's null at first render and
    // the one-time useState initializer above misses it — re-apply it whenever the scope arrives or
    // changes, otherwise the scoped page falls back to showing every location.
    useEffect(() => {
        if (locationScope) setLocFilter(locationScope);
    }, [locationScope]);
    // Source of truth for the shared header control: persist + broadcast on every change so the
    // header's events location selector stays in sync (see utils/eventsLocationBridge).
    useEffect(() => {
        try { localStorage.setItem('events:locationFilter', locFilter); } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('events:locationFilter'));
    }, [locFilter]);
    // React to the header changing the location filter.
    useEffect(() => {
        const onFilter = () => { try { setLocFilter(localStorage.getItem('events:locationFilter') || 'all'); } catch { setLocFilter('all'); } };
        window.addEventListener('events:locationFilter', onFilter);
        return () => window.removeEventListener('events:locationFilter', onFilter);
    }, []);
    // Publish the stores that actually have events so the header can render the options.
    useEffect(() => {
        try { localStorage.setItem('events:locationOptions', JSON.stringify(locationOptions.map(o => ({ id: o.id, name: o.name })))); } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('events:locationOptions'));
    }, [locationOptions]);
    // Drop a remembered/scoped location that no longer has events.
    useEffect(() => {
        if (locFilter !== 'all' && locationOptions.length && !locationOptions.some(o => o.id === locFilter)) setLocFilter('all');
    }, [locationOptions, locFilter]);

    const locFilteredCards = useMemo(
        () => (locFilter === 'all' ? flatCards : flatCards.filter(c => c._stopLocationId === locFilter)),
        [flatCards, locFilter]
    );
    // Show location on tiles/rows only when there's more than one store to distinguish.
    const showLocation = locationOptions.length > 1;

    // Group cards by seriesId
    const { seriesGroups, standaloneCards } = useMemo(() => {
        const seriesMap = {};
        const standalone = [];

        for (const card of locFilteredCards) {
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
                        prizes: card.seriesPrizes || [],
                        packPerWin: card.packPerWin || null,
                        additionalInfo: card.seriesAdditionalInfo || '',
                        linkedPages: card.seriesLinkedPages || [],
                        bundleName: card.seriesBundleName || null,
                        bundlePrice: card.seriesBundlePrice || null,
                        bundleSlotNames: card.seriesBundleSlotNames || [],
                        bundleSlotData: card.seriesBundleSlotData || [],
                        disclaimer: card.seriesDisclaimer || null,
                        category: card.seriesCategory || null,
                        categoryOrder: card.seriesCategoryOrder ?? 999,
                        categoryImageUrl: card.seriesCategoryImageUrl || null,
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
        // Manual event order first (admin Reorder), then date as the tiebreak/fallback.
        standalone.sort((a, b) =>
            ((a.order ?? 9999) - (b.order ?? 9999)) ||
            (a._stopDate || '9999').localeCompare(b._stopDate || '9999'));

        return { seriesGroups: groups, standaloneCards: standalone };
    }, [locFilteredCards]);

    // Game gate (Pokemon, Magic, …) — options come from whatever categories the series carry.
    // `category` is null until the user picks a game (shows the game-tile landing first), then a
    // game name or 'All'. The gate only applies when there's more than one game to choose from.
    const [category, setCategory] = useState(null);
    // Order games by the category's configured display order (from admin), then alphabetically.
    const categories = useMemo(() => {
        const orderByName = {};
        for (const s of seriesGroups) {
            if (s.category && !(s.category in orderByName)) orderByName[s.category] = s.categoryOrder ?? 999;
        }
        return [...new Set(seriesGroups.map(s => s.category).filter(Boolean))]
            .sort((a, b) => (orderByName[a] - orderByName[b]) || a.localeCompare(b));
    }, [seriesGroups]);
    // Only gate when there are multiple games to choose between; otherwise go straight to events.
    const gateEnabled = categories.length > 1;
    // If a picked game vanishes (data refresh), fall back to the tiles (gated) or 'All' (ungated).
    useEffect(() => {
        if (category && category !== 'All' && !categories.includes(category)) setCategory(gateEnabled ? null : 'All');
    }, [categories, category, gateEnabled]);

    // Show the game tiles when gating is on and no game has been picked yet.
    const showGameTiles = gateEnabled && category === null && !activeSeriesId;
    // Effective filter: ungated events behave as 'All'; a picked game filters to that game.
    const effectiveCategory = !gateEnabled ? 'All' : (category || 'All');

    // Drive the shared header back button: while a game is drilled into (game selected, on the
    // games view, not inside a series detail), register a handler that returns to the game tiles.
    // Cleared otherwise (and on unmount) so the header falls back to its default events back logic.
    const { setCustomBackHandler } = useContext(EventsLayoutContext) || {};
    useEffect(() => {
        if (!setCustomBackHandler) return undefined;
        const showGamesBack = view === 'games' && gateEnabled && category !== null && !activeSeriesId;
        // useState setter: wrap in a thunk so the handler function is STORED, not treated as an updater.
        setCustomBackHandler(showGamesBack ? () => () => setCategory(null) : null);
        return () => setCustomBackHandler(null);
    }, [view, gateEnabled, category, activeSeriesId, setCustomBackHandler]);

    // Apply the filter: a specific game shows only that game's series (standalone cards have no
    // category, so they're hidden while a game is active).
    const visibleSeriesGroups = effectiveCategory === 'All' ? seriesGroups : seriesGroups.filter(s => s.category === effectiveCategory);
    const visibleStandaloneCards = effectiveCategory === 'All' ? standaloneCards : [];

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

    // Landing views share a top control strip (By game / Schedule toggle + location filter).
    const controls = flatCards.length > 0 ? (
        <EventsControls view={view} onView={setView} />
    ) : null;

    if (view === 'schedule') {
        return (
            <>
                {controls}
                <ScheduleView
                    cards={locFilteredCards}
                    regCounts={regCounts}
                    onSelectCard={onSelectCard}
                    scopeLocationName={scopeLocationName}
                    onBookSpace={() => navigate('/events/book-a-space')}
                    showLocation={showLocation}
                />
            </>
        );
    }

    if (showGameTiles) {
        return (
            <>
                {controls}
                <GameLanding
                    categories={categories}
                    seriesGroups={seriesGroups}
                    standaloneCards={standaloneCards}
                    showLocation={showLocation}
                    onPick={setCategory}
                    scopeLocationName={scopeLocationName}
                    onBookSpace={() => navigate('/events/book-a-space')}
                />
            </>
        );
    }

    return (
        <>
            {controls}
            <SeriesLanding
                seriesGroups={visibleSeriesGroups}
                standaloneCards={visibleStandaloneCards}
                activeGameLabel={effectiveCategory}
                onBackToGames={gateEnabled ? () => setCategory(null) : null}
                scopeLocationName={scopeLocationName}
                onExitLocation={locationScope ? () => { window.history.pushState(null, '', '/events'); window.dispatchEvent(new Event('events:nav')); onLocationScopeExit && onLocationScopeExit(); } : null}
                onSelectSeries={(slug) => { setScrollToStops(false); window.history.pushState(null, '', seriesUrl(slug)); window.dispatchEvent(new Event('events:nav')); setActiveSeriesId(slug); }}
                onRegisterSeries={(slug) => { setScrollToStops(true); window.history.pushState(null, '', seriesUrl(slug)); window.dispatchEvent(new Event('events:nav')); setActiveSeriesId(slug); }}
                onSelectCard={onSelectCard}
                regCounts={regCounts}
                onBookSpace={() => navigate('/events/book-a-space')}
            />
        </>
    );
};
