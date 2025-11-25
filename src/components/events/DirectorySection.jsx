import React from 'react';
import { Box, Typography, Container, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { format, parse } from 'date-fns';

// Helper to format date like "Friday, November 28th, 2025"
const formatEventDate = (dateString) => {
    try {
        const date = new Date(dateString.replace(/-/g, '/'));
        return format(date, 'EEEE, MMMM do, yyyy');
    } catch (e) {
        return '';
    }
};

// Helper to format time like "3:00pm - 7:00pm"
const formatTimeSlot = (slot) => {
    if (!slot || !slot.includes(' - ')) return '';
    try {
        const [startTime, endTime] = slot.split(' - ');
        const start = parse(startTime, 'HH:mm', new Date());
        const end = parse(endTime, 'HH:mm', new Date());
        return `${format(start, 'h:mmaaa')} - ${format(end, 'h:mmaaa')}`.toLowerCase();
    } catch (e) {
        return '';
    }
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
                    <Box sx={{ height: 250, backgroundColor: 'grey.200' }}>
                        <img
                            src={event.imageUrl}
                            alt={event.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </Box>
                    {/* ✅ Wrapper box for all text content */}
                    <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
                        <Typography variant="h2" component="h2" sx={{ textAlign: 'left', mb: 1.5 }}>
                            {event.title}
                        </Typography>

                        {/* ✅ Show date and time if single date event */}
                        {(() => {
                            // Check if event has single date (start date equals end date and only one day of week)
                            const daysOfWeek = event['Days of Week'] || event.daysOfWeek || [];
                            const startDate = event['Start Date'] || event.startDate;
                            const endDate = event['End Date'] || event.endDate;
                            const eventTimes = event['Event Times'] || event.eventTimes || [];
                            
                            const isSingleDate = daysOfWeek.length === 1 && startDate === endDate;
                            
                            if (isSingleDate && startDate) {
                                const dateDisplay = formatEventDate(startDate);
                                const timeDisplay = eventTimes.length > 0 ? formatTimeSlot(eventTimes[0]) : '';
                                
                                return (
                                    <Box sx={{ mb: 1.5 }}>
                                        {dateDisplay && (
                                            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                                {dateDisplay}
                                            </Typography>
                                        )}
                                        {timeDisplay && (
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {timeDisplay}
                                            </Typography>
                                        )}
                                    </Box>
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
