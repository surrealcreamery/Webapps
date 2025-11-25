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

export const HeroSection = ({ 
    title, 
    imageUrl, 
    description, 
    bulletPoints, 
    onSelectLocationClick, 
    isSingleLocation,
    // ✅ NEW: Event details props
    eventDate,
    eventTime,
    locationAddress
}) => {
    // Format the date and time for display
    const formattedDate = formatEventDate(eventDate);
    const formattedTime = formatTimeSlot(eventTime);
    
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
            {(formattedDate || formattedTime || locationAddress) && (
                <Box sx={{ mb: 2 }}>
                    {formattedDate && (
                        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                            {formattedDate}
                        </Typography>
                    )}
                    {formattedTime && (
                        <Typography variant="body1" color="text.secondary">
                            {formattedTime}
                        </Typography>
                    )}
                    {locationAddress && (
                        <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                            {locationAddress}
                        </Typography>
                    )}
                </Box>
            )}
            
            {/* ✅ For single location, show button right after title */}
            {isSingleLocation && (
                <Stack spacing={1.5} sx={{ mt: 3, mb: 3 }}>
                    <Button variant="contained" fullWidth onClick={onSelectLocationClick}>
                        Register For Event
                    </Button>
                </Stack>
            )}
            
            {/* ✅ Show description */}
            {description && (
                <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    {description}
                </Typography>
            )}
            
            {/* ✅ Then show bullet points as formatted text (not as bullet list) */}
            {bulletPoints && (
                <Box sx={{ textAlign: 'left', my: 2 }}>
                    {/* Handle both string (with newlines) and array formats */}
                    {typeof bulletPoints === 'string' ? (
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                            {bulletPoints}
                        </Typography>
                    ) : Array.isArray(bulletPoints) && bulletPoints.length > 0 && (
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                            {bulletPoints.map(point => {
                                // Handle different formats
                                if (typeof point === 'string') return point;
                                if (point?.name) return point.name;
                                if (point?.text) return point.text;
                                if (point?.value) return point.value;
                                // Return empty string for line breaks (will preserve spacing)
                                return '';
                            }).join('\n')}
                        </Typography>
                    )}
                </Box>
            )}
            
            {/* ✅ For multiple locations, show anchor link to location section */}
            {!isSingleLocation && (
                <Stack spacing={1.5} sx={{ pt: 2 }}>
                    <Button 
                        variant="contained" 
                        fullWidth 
                        component="a"
                        href="#location-selection"
                        sx={{ textDecoration: 'none' }}
                    >
                        Select a Location
                    </Button>
                </Stack>
            )}
        </Box>
    );
};
