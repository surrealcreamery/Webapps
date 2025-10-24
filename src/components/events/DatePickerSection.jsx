import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { LocalizationProvider, DateCalendar, PickersDay } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { isBefore, startOfToday, isToday, format, parse, isValid } from 'date-fns';

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

// Helper component for custom styling of the calendar days
const CustomDay = (props) => {
    const { day, outsideCurrentMonth, disabled, selected, today, ...other } = props;
    const isFutureWeekday = !disabled && !outsideCurrentMonth && !selected && !isBefore(day, startOfToday());

    return (
        <PickersDay
            {...other}
            outsideCurrentMonth={outsideCurrentMonth}
            day={day}
            disabled={disabled}
            selected={selected}
            sx={{
                ...(isFutureWeekday && { borderRadius: '50%', backgroundColor: '#F1F4FF', color: '#3055DD', fontWeight: 'bold', '&:hover': { backgroundColor: '#E4E9FF' } }),
                ...(today && { border: '1px solid transparent !important' }),
                ...(selected && { borderRadius: '50%', backgroundColor: '#3055DD', color: 'white', fontWeight: 'bold', '&:hover': { backgroundColor: '#2545b2' } }),
            }}
        />
    );
};

export const DatePickerSection = ({ onBack, onDateChange, selectedDate, selectedLocation, onContinue, currentEvent, error }) => {
    
    console.log('--- DatePicker Diagnostics ---');
    console.log('1. Received currentEvent prop:', currentEvent);
    console.log('2. Received selectedDate prop:', selectedDate);
    console.log('3. Received error prop:', error);


    const shouldDisableDate = (date) => {
        // Prevent selection of today's date
        if (isToday(date)) return true;

        const startDate = parse(currentEvent.startDate, 'yyyy-MM-dd', new Date());
        const endDate = parse(currentEvent.endDate, 'yyyy-MM-dd', new Date());
        endDate.setHours(23, 59, 59, 999);

        if (!isValid(startDate) || !isValid(endDate)) return true;

        if (date < startDate || date > endDate) return true;

        const dayOfWeek = date.getDay();
        if (!currentEvent.daysOfWeek.includes(dayOfWeek)) return true;

        return false;
    };
    
    // If the event's start date is in the past, open the calendar to the current month.
    // Otherwise, open it to the event's start date.
    const eventStartDate = parse(currentEvent.startDate, 'yyyy-MM-dd', new Date());
    const initialMonth = isBefore(eventStartDate, new Date()) ? new Date() : eventStartDate;
    
    console.log('3. Calculated initialMonth for calendar:', initialMonth);
    
    const hasSingleTimeSlot = currentEvent.eventTimes?.length === 1;

    return (
        <Box>
            {/* ✅ Display the error message if it exists */}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Typography variant="h2" component="h2" gutterBottom>
                Select a Date
            </Typography>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h3" component="p" sx={{ fontWeight: 'bold' }}>
                    {currentEvent.title}
                </Typography>
                <Typography>{selectedLocation['Location Name']}</Typography>
                <Typography variant="body2" color="text.secondary">{selectedLocation.Address}</Typography>
                
                {hasSingleTimeSlot && (
                    <Typography sx={{ mt: 1 }}>
                        Time: {formatTimeSlot(currentEvent.eventTimes[0])}
                    </Typography>
                )}
            </Box>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateCalendar
                    key={currentEvent.id}
                    value={selectedDate ? new Date(selectedDate) : null}
                    onChange={onDateChange}
                    referenceDate={initialMonth}
                    disablePast
                    shouldDisableDate={shouldDisableDate}
                    slots={{ day: CustomDay }}
                    sx={{
                        width: '100%',
                        '& .MuiPickersDay-root': { fontSize: '2rem', width: '4rem', height: '4rem' },
                        '& .MuiDayCalendar-weekDayLabel': { fontSize: '2rem', fontWeight: 'bold', width: '4rem', height: '4rem' },
                        '& .MuiPickersCalendarHeader-root svg': { width: '2.5rem', height: '2.5rem' },
                    }}
                />
            </LocalizationProvider>
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
                    disabled={!selectedDate}
                    onClick={onContinue}
                >
                    Continue
                </Button>
            </Box>
        </Box>
    );
};

