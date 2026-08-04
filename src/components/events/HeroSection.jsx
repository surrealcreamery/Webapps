import React from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
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

export const HeroSection = ({
    title,
    imageUrl,
    description,
    bulletPoints,
    onSelectLocationClick,
    isSingleLocation,
    selectLocationLabel,
    // ✅ NEW: Event details props
    eventDate,
    eventTime,
    locationAddress,
    // ✅ NEW: For fundraiser host date range display
    eventType,
    eventRole,
    eventEndDate,
    admissionFeeCents,
    pointsCost,
    regCount,
    regCountDate,
}) => {
    // Check if this is a fundraiser host (show date range instead of single date)
    const isFundraiserHost = (eventType === 'Fundraiser' || eventType === 'Rolling Fundraiser') && eventRole === 'Host';

    // Format the date and time for display
    const formattedDate = formatEventDate(eventDate);
    const formattedTime = formatTimeSlot(eventTime);

    // Format date range for fundraiser hosts
    const formattedDateRange = isFundraiserHost && eventDate && eventEndDate
        ? `Host a Fundraiser Between ${formatShortDate(eventDate)} and ${formatShortDate(eventEndDate)}`
        : null;
    
    return (
        <Box sx={{ mb: 4 }}>
            <Box sx={{ height: 250, backgroundColor: 'grey.200', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                <img
                    src={imageUrl}
                    alt={title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </Box>
            <Typography variant="h1" component="h1" sx={{ mb: 1 }}>
                {title}
            </Typography>
            
            {/* ✅ NEW: Show date, time, and location below title */}
            {(formattedDateRange || formattedDate || formattedTime || locationAddress) && (
                <Box sx={{ mb: 2 }}>
                    {formattedDateRange ? (
                        // Fundraiser host: show date range
                        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                            {formattedDateRange}
                        </Typography>
                    ) : (formattedDate || formattedTime) && (
                        // Regular event: show date and time
                        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                            {formattedDate}{formattedDate && formattedTime && ' '}{formattedTime}
                        </Typography>
                    )}
                    {locationAddress && (
                        <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                            {locationAddress}
                        </Typography>
                    )}
                </Box>
            )}
            
            {/* Admission pricing */}
            {(admissionFeeCents > 0 || pointsCost > 0) && (
                <Typography variant="body1" sx={{ color: 'primary.main', fontWeight: 600, mb: 1 }}>
                    {[
                        admissionFeeCents > 0 ? `$${(admissionFeeCents / 100).toFixed(2)}` : null,
                        pointsCost > 0 ? `${pointsCost} points` : null
                    ].filter(Boolean).join(' or ')}
                </Typography>
            )}

            {/* ✅ For single location, show button right after title */}
            {isSingleLocation && (
                <Stack spacing={1.5} sx={{ mt: 3, mb: 3 }}>
                    {regCount && (() => {
                        const count = regCountDate ? (regCount.byDate?.[regCountDate] || 0) : regCount.total;
                        const capacity = regCountDate
                            ? regCount.capacityByDate?.[regCountDate]
                            : (regCount.capacityByDate ? Object.values(regCount.capacityByDate)[0] : null);
                        const isFull = capacity && count >= capacity;
                        return (
                            <>
                                {count > 0 && (
                                    <Typography variant="body2" color={isFull ? 'error' : 'text.secondary'} sx={{ textAlign: 'center' }}>
                                        {isFull
                                            ? `Sold Out (${count}/${capacity})`
                                            : capacity
                                                ? `${count}/${capacity} spots filled`
                                                : `${count} ${count === 1 ? 'person' : 'people'} registered`}
                                    </Typography>
                                )}
                            </>
                        );
                    })()}
                    <Button variant="contained" fullWidth onClick={onSelectLocationClick}
                        disabled={regCount && (() => {
                            const count = regCountDate ? (regCount.byDate?.[regCountDate] || 0) : regCount.total;
                            const capacity = regCountDate
                                ? regCount.capacityByDate?.[regCountDate]
                                : (regCount.capacityByDate ? Object.values(regCount.capacityByDate)[0] : null);
                            return capacity && count >= capacity;
                        })()}
                    >
                        {(() => {
                            if (!regCount) return selectLocationLabel || 'Register For Event';
                            const count = regCountDate ? (regCount.byDate?.[regCountDate] || 0) : regCount.total;
                            const capacity = regCountDate
                                ? regCount.capacityByDate?.[regCountDate]
                                : (regCount.capacityByDate ? Object.values(regCount.capacityByDate)[0] : null);
                            return capacity && count >= capacity ? 'Sold Out' : (selectLocationLabel || 'Register For Event');
                        })()}
                    </Button>
                </Stack>
            )}
            
            {/* ✅ Show description */}
            {description && (
                <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    {description}
                </Typography>
            )}

            {/* ✅ Show bullet points as formatted text */}
            {bulletPoints && (
                <Box sx={{ textAlign: 'left', my: 2 }}>
                    {typeof bulletPoints === 'string' ? (
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                            {bulletPoints}
                        </Typography>
                    ) : Array.isArray(bulletPoints) && bulletPoints.length > 0 && (
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                            {bulletPoints.map(point => {
                                if (typeof point === 'string') return point;
                                if (point?.name) return point.name;
                                if (point?.text) return point.text;
                                if (point?.value) return point.value;
                                return '';
                            }).join('\n')}
                        </Typography>
                    )}
                </Box>
            )}

            {/* ✅ For multiple locations, show anchor link to location section */}
            {!isSingleLocation && (
                <Stack spacing={1.5} sx={{ pt: 2 }}>
                    {regCount && (() => {
                        const count = regCount.total || 0;
                        const caps = regCount.capacityByDate ? Object.values(regCount.capacityByDate) : [];
                        const totalCapacity = caps.length > 0 ? caps.reduce((s, c) => s + c, 0) : null;
                        const isFull = totalCapacity && count >= totalCapacity;
                        if (count > 0) {
                            return (
                                <Typography variant="body2" color={isFull ? 'error' : 'text.secondary'} sx={{ textAlign: 'center' }}>
                                    {isFull
                                        ? `Sold Out (${count}/${totalCapacity})`
                                        : totalCapacity
                                            ? `${count}/${totalCapacity} spots filled`
                                            : `${count} ${count === 1 ? 'person' : 'people'} registered`}
                                </Typography>
                            );
                        }
                        return null;
                    })()}
                    <Button
                        variant="contained"
                        fullWidth
                        component="a"
                        href="#location-selection"
                        sx={{ textDecoration: 'none' }}
                    >
                        {selectLocationLabel || 'Select a Location'}
                    </Button>
                </Stack>
            )}
        </Box>
    );
};
