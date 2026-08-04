import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { format, parse } from 'date-fns';
import { trackEventTimeSelected } from '@/services/analytics';

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

// Generate hourly start time slots from location hours for a given day
const generateHourlySlots = (locationHours, selectedDate) => {
    if (!locationHours || !selectedDate) return [];
    const datePart = selectedDate.split('T')[0];
    const [y, m, d] = datePart.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay(); // 0=Sunday, 6=Saturday

    const dayHours = locationHours[String(dayOfWeek)];
    if (!dayHours || !dayHours.open || !dayHours.close) return [];

    const [openH] = dayHours.open.split(':').map(Number);
    const [closeH] = dayHours.close.split(':').map(Number);

    const slots = [];
    for (let h = openH; h < closeH; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
    }
    return slots;
};

// Get the closing hour for a location on a given date
const getClosingHour = (locationHours, selectedDate) => {
    if (!locationHours || !selectedDate) return 24;
    const datePart = selectedDate.split('T')[0];
    const [y, m, d] = datePart.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const dayHours = locationHours[String(dayOfWeek)];
    if (!dayHours || !dayHours.close) return 24;
    return parseInt(dayHours.close.split(':')[0], 10);
};

export const TimePickerSection = ({ currentEvent, selectedDate, selectedTime, onTimeChange, onBack, onContinue, locations, selectedLocationId }) => {
    const isSpaceRental = currentEvent?.type === 'Space Rental';
    const [selectedStartTime, setSelectedStartTime] = useState(null);
    const [duration, setDuration] = useState(1);

    // Look up location hours for space-rental
    const location = useMemo(() => {
        if (!isSpaceRental || !locations || !selectedLocationId) return null;
        return locations.find(l => l.id === selectedLocationId);
    }, [isSpaceRental, locations, selectedLocationId]);

    const locationHours = location?.hours || {};

    // Generate hourly slots for space-rental, or use event times for regular events
    const hourlySlots = useMemo(() => {
        if (!isSpaceRental) return [];
        return generateHourlySlots(locationHours, selectedDate);
    }, [isSpaceRental, locationHours, selectedDate]);

    const closingHour = useMemo(() => {
        if (!isSpaceRental) return 24;
        return getClosingHour(locationHours, selectedDate);
    }, [isSpaceRental, locationHours, selectedDate]);

    // Parse event times for regular events
    const timeSlots = useMemo(() => {
        if (!currentEvent || isSpaceRental) return [];
        return Array.isArray(currentEvent.eventTimes)
            ? currentEvent.eventTimes
            : (currentEvent.eventTimes || '').split(',').map(t => t.trim()).filter(Boolean);
    }, [currentEvent?.eventTimes, isSpaceRental]);

    // Available durations for the selected start time
    const availableDurations = useMemo(() => {
        if (!selectedStartTime) return [1, 2, 3];
        const startH = parseInt(selectedStartTime.split(':')[0], 10);
        const maxDuration = closingHour - startH;
        return [1, 2, 3].filter(d => d <= maxDuration);
    }, [selectedStartTime, closingHour]);

    // When start time or duration changes for space-rental, emit the combined time
    useEffect(() => {
        if (!isSpaceRental || !selectedStartTime) return;
        const startH = parseInt(selectedStartTime.split(':')[0], 10);
        const endH = startH + duration;
        const endTime = `${String(endH).padStart(2, '0')}:00`;
        const combined = `${selectedStartTime} - ${endTime}`;
        onTimeChange(combined);
    }, [isSpaceRental, selectedStartTime, duration, onTimeChange]);

    // Clamp duration if it exceeds available after changing start time
    useEffect(() => {
        if (isSpaceRental && selectedStartTime && !availableDurations.includes(duration)) {
            setDuration(availableDurations[availableDurations.length - 1] || 1);
        }
    }, [availableDurations, duration, isSpaceRental, selectedStartTime]);

    // Auto-select if only one time slot and none selected (regular events only)
    useEffect(() => {
        if (!isSpaceRental && currentEvent && timeSlots.length === 1 && !selectedTime) {
            onTimeChange(timeSlots[0]);
        }
    }, [currentEvent, timeSlots, selectedTime, onTimeChange, isSpaceRental]);

    // Guard against undefined currentEvent - AFTER hooks
    if (!currentEvent) {
        console.error('TimePickerSection: currentEvent is undefined');
        return null;
    }

    return (
        <Box>
            <Typography variant="h2" component="h2" gutterBottom>
                {isSpaceRental ? 'Select a Start Time' : 'Select a Time'}
            </Typography>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h3" component="p" sx={{ fontWeight: 'bold' }}>
                    {currentEvent.title}
                </Typography>
                <Typography>
                    {format(parse(selectedDate.split('T')[0], 'yyyy-MM-dd', new Date()), 'EEEE, MMMM do, yyyy')}
                </Typography>
            </Box>

            {isSpaceRental ? (
                <>
                    {/* Hourly start time selection */}
                    <Stack spacing={1.5}>
                        {hourlySlots.length === 0 ? (
                            <Typography color="text.secondary">No available time slots for this date.</Typography>
                        ) : (
                            hourlySlots.map(slot => (
                                <Button
                                    key={slot}
                                    variant={selectedStartTime === slot ? "contained" : "outlined"}
                                    onClick={() => { trackEventTimeSelected(slot); setSelectedStartTime(slot); }}
                                    fullWidth
                                >
                                    {format(parse(slot, 'HH:mm', new Date()), 'h:mm aaa').toLowerCase()}
                                </Button>
                            ))
                        )}
                    </Stack>

                    {/* Duration selector — shown after picking a start time */}
                    {selectedStartTime && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                                Duration
                            </Typography>
                            <ToggleButtonGroup
                                value={duration}
                                exclusive
                                onChange={(_, val) => { if (val !== null) setDuration(val); }}
                                fullWidth
                            >
                                {[1, 2, 3].map(d => (
                                    <ToggleButton
                                        key={d}
                                        value={d}
                                        disabled={!availableDurations.includes(d)}
                                    >
                                        {d} hour{d > 1 ? 's' : ''}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                            {selectedTime && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    {formatTimeSlot(selectedTime)}
                                </Typography>
                            )}
                        </Box>
                    )}
                </>
            ) : (
                <Stack spacing={1.5}>
                    {timeSlots.map(timeSlot => (
                        <Button
                            key={timeSlot}
                            variant={selectedTime === timeSlot ? "contained" : "outlined"}
                            onClick={() => { trackEventTimeSelected(timeSlot); onTimeChange(timeSlot); }}
                            fullWidth
                        >
                            {formatTimeSlot(timeSlot)}
                        </Button>
                    ))}
                </Stack>
            )}

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
