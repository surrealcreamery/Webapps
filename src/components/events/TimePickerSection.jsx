import React from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import { format, parse } from 'date-fns';

// Helper function to format time slots like "15:00 - 19:00" to "3:00pm - 7:00pm"
const formatTimeSlot = (slot) => {
    if (!slot || !slot.includes(' - ')) return 'Invalid Time';
    try {
        const [startTime, endTime] = slot.split(' - ');
        const start = parse(startTime, 'HH:mm', new Date());
        const end = parse(endTime, 'HH:mm', new Date());
        return `${format(start, 'h:mmaaa')} - ${format(end, 'h:mmaaa')}`.toLowerCase();
    } catch (e) {
        return 'Invalid Time Format';
    }
};

export const TimePickerSection = ({ currentEvent, selectedDate, selectedTime, onTimeChange, onBack, onContinue }) => {
    return (
        <Box>
            <Typography variant="h2" component="h2" gutterBottom>
                Select a Time
            </Typography>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h3" component="p" sx={{ fontWeight: 'bold' }}>
                    {currentEvent.title}
                </Typography>
                <Typography>
                    {format(new Date(selectedDate), 'EEEE, MMMM do, yyyy')}
                </Typography>
            </Box>

            <Stack spacing={1.5}>
                {(currentEvent.eventTimes || []).map(timeSlot => (
                    <Button
                        key={timeSlot}
                        variant={selectedTime === timeSlot ? "contained" : "outlined"}
                        onClick={() => onTimeChange(timeSlot)}
                        fullWidth
                    >
                        {formatTimeSlot(timeSlot)}
                    </Button>
                ))}
            </Stack>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    variant="contained"
                    onClick={onBack}
                    sx={{ backgroundColor: 'grey.200', color: 'primary.main', boxShadow: 'none', '&:hover': { backgroundColor: 'grey.300', boxShadow: 'none' } }}
                >
                    Back
                </Button>
                <Button
                    variant="contained"
                    disabled={!selectedTime}
                    onClick={onContinue}
                >
                    Continue
                </Button>
            </Box>
        </Box>
    );
};
