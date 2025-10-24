import React from 'react';
import { Box, Typography, Container, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';

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

                        {/* ✅ Render bullet points if they exist */}
                        {event.bulletPoints && event.bulletPoints.length > 0 && (
                            <Stack component="ul" sx={{ pl: 2.5, my: 0, color: 'text.secondary' }}>
                                {event.bulletPoints.slice(0, 3).map((point) => (
                                    <Typography component="li" variant="body1" key={point.id} sx={{ display: 'list-item', pl: 1 }}>
                                        {point.name}
                                    </Typography>
                                ))}
                            </Stack>
                        )}
                    </Box>
                </Box>
            ))}
        </Stack>
    </Container>
    );
};

