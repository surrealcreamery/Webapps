import React from 'react';
import { Box, Typography, Container, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
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

export const DirectorySection = ({ events, onChooseFundraiser, view, handleViewChange }) => {
    const activeEvents = (events || []).filter(event => event.status === 'Active');

    const filteredEvents = activeEvents.filter(event => {
        if (view === 'All') return true;
        if (view === 'Events') return event.type === 'Event';
        if (view === 'Fundraisers') return event.type === 'Rolling Fundraiser' || event.type === 'Fundraiser';
        return false;
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

        <Stack spacing={4}>
            {filteredEvents.map((event) => (
                <Box
                    key={event.id}
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
                    {/* ✅ Wrapper box for all text content */}
                    <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
                        <Typography variant="h2" component="h2" sx={{ textAlign: 'left', mb: 1.5 }}>
                            {event.title}
                        </Typography>

                        {/* ✅ Show date and time */}
                        {(() => {
                            const startDate = event['Start Date'] || event.startDate;
                            const endDate = event['End Date'] || event.endDate;
                            const eventTimes = event['Event Times'] || event.eventTimes;
                            const eventType = event.type || event['Type'];
                            const eventRole = event.Role || event.role;

                            // Check if this is a fundraiser host (show date range)
                            const isFundraiserHost = (eventType === 'Fundraiser' || eventType === 'Rolling Fundraiser') && eventRole === 'Host';

                            if (isFundraiserHost && startDate && endDate) {
                                // Fundraiser host: show date range
                                return (
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mt: '8px !important', mb: 1.5 }}>
                                        {formatFundraiserDateRange(startDate, endDate)}
                                    </Typography>
                                );
                            }

                            // Regular event: show date and time
                            const timeStr = Array.isArray(eventTimes) ? eventTimes[0] : eventTimes;
                            const dateDisplay = startDate ? formatEventDate(startDate) : '';
                            const timeDisplay = timeStr ? formatTimeSlot(timeStr) : '';

                            if (dateDisplay || timeDisplay) {
                                return (
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mt: '8px !important', mb: 1.5 }}>
                                        {dateDisplay}{dateDisplay && timeDisplay && ' '}{timeDisplay}
                                    </Typography>
                                );
                            }
                            return null;
                        })()}

                        {/* ✅ Show description */}
                        {(event.description || event['Description']) && (
                            <Typography variant="body1" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                                {event.description || event['Description']}
                            </Typography>
                        )}
                    </Box>
                </Box>
            ))}
        </Stack>
    </Container>
    );
};
