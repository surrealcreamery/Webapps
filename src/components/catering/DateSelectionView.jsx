import React, { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { LocalizationProvider, DateCalendar, PickersDay } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { isBefore, startOfToday, isToday, addDays, format } from 'date-fns';

// Custom day styling for calendar
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
                ...(isFutureWeekday && { 
                    borderRadius: '50%', 
                    backgroundColor: '#F1F4FF', 
                    color: '#3055DD', 
                    fontWeight: 'bold', 
                    '&:hover': { backgroundColor: '#E4E9FF' } 
                }),
                ...(today && { border: '1px solid transparent !important' }),
                ...(selected && { 
                    borderRadius: '50%', 
                    backgroundColor: '#3055DD', 
                    color: 'white', 
                    fontWeight: 'bold', 
                    '&:hover': { backgroundColor: '#2545b2' } 
                }),
            }}
        />
    );
};

export const DateSelectionView = ({ sendToCatering, cateringState }) => {
    const { fulfillmentDetails, locations } = cateringState.context;
    const { type, locationId, address, selectedDate: contextDate, selectedTime: contextTime } = fulfillmentDetails;

    const [selectedDate, setSelectedDate] = useState(contextDate ? new Date(contextDate) : null);
    const [selectedTime, setSelectedTime] = useState(contextTime || null);

    // Generate time slots in 30-minute increments from 8am to 8pm
    const generateTimeSlots = () => {
        const slots = [];
        for (let hour = 8; hour <= 20; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                if (hour === 20 && minute > 0) break; // Stop at 8:00pm
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const period = hour >= 12 ? 'pm' : 'am';
                const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                const displayMinute = minute.toString().padStart(2, '0');
                const displayTime = `${displayHour}:${displayMinute}${period}`;
                slots.push({ value: timeString, label: displayTime });
            }
        }
        return slots;
    };

    const timeSlots = generateTimeSlots();

    const handleDateChange = (newDate) => {
        setSelectedDate(newDate);
        setSelectedTime(null); // Reset time when date changes
        sendToCatering({ type: 'SET_FULFILLMENT_DATE', date: newDate?.toISOString() });
    };

    const handleTimeSelect = (time) => {
        setSelectedTime(time);
        sendToCatering({ type: 'SET_FULFILLMENT_TIME', time });
        // Immediately proceed to next step (Order Contact Information)
        sendToCatering({ type: 'TRIGGER_AUTH' });
    };

    const handleBack = () => {
        sendToCatering({ type: 'GO_BACK' });
    };

    const handleContinue = () => {
        sendToCatering({ type: 'TRIGGER_AUTH' });
    };

    const isContinueDisabled = !selectedDate || !selectedTime;

    // Get location or address info for display
    const selectedLocation = locations?.find(loc => loc?.['Location ID'] === locationId);
    const fulfillmentInfo = type === 'pickup' 
        ? selectedLocation?.['Location Name'] 
        : `${address?.street}, ${address?.city}, ${address?.state} ${address?.zip}`;

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
                {!selectedDate 
                    ? `Select a ${type === 'pickup' ? 'Pickup' : 'Delivery'} Date`
                    : `Select a ${type === 'pickup' ? 'Pickup' : 'Delivery'} Time For ${format(selectedDate, 'EEEE, MMMM do yyyy')}`}
            </Typography>

            {/* Step 1: Show calendar until date is selected */}
            {!selectedDate && (
                <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Orders must be placed at least 24 hours in advance.
                    </Typography>
                    
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DateCalendar
                            value={selectedDate}
                            onChange={handleDateChange}
                            referenceDate={new Date()}
                            disablePast
                            shouldDisableDate={(date) => {
                                if (isToday(date)) return true;
                                const maxDate = addDays(new Date(), 90);
                                return date > maxDate;
                            }}
                            slots={{ day: CustomDay }}
                            sx={{
                                width: '100%',
                                '& .MuiPickersDay-root': { fontSize: '1.85rem', width: '3.75rem', height: '3.75rem' },
                                '& .MuiDayCalendar-weekDayLabel': { fontSize: '1.85rem', fontWeight: 'bold', width: '3.75rem', height: '3.75rem' },
                                '& .MuiPickersCalendarHeader-root svg': { width: '2.25rem', height: '2.25rem' },
                            }}
                        />
                    </LocalizationProvider>
                </>
            )}

            {/* Step 2: Show time slots after date is selected */}
            {selectedDate && (
                <>
                    <Box 
                        sx={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(3, 1fr)', 
                            gap: 1,
                            mt: 3, // 24px margin top
                        }}
                    >
                        {timeSlots.map((slot) => (
                            <Button
                                key={slot.value}
                                variant="outlined"
                                onClick={() => handleTimeSelect(slot.value)}
                                sx={{
                                    py: 1.5,
                                    borderColor: 'grey.300',
                                    color: 'text.primary',
                                    '&:hover': {
                                        borderColor: '#3055DD',
                                        backgroundColor: '#F1F4FF'
                                    }
                                }}
                            >
                                {slot.label}
                            </Button>
                        ))}
                    </Box>

                    {/* Back button for time selection step */}
                    <Box sx={{ mt: 3 }}>
                        <Button
                            variant="contained"
                            onClick={() => setSelectedDate(null)}
                            sx={{ 
                                backgroundColor: 'grey.200', 
                                color: 'primary.main', 
                                boxShadow: 'none', 
                                '&:hover': { 
                                    backgroundColor: 'grey.300', 
                                    boxShadow: 'none' 
                                }
                            }}
                        >
                            Back
                        </Button>
                    </Box>
                </>
            )}

            {/* Back button only shows on first step (date selection) */}
            {!selectedDate && (
                <Box sx={{ mt: 2 }}>
                    <Button
                        variant="contained"
                        onClick={handleBack}
                        sx={{ 
                            backgroundColor: 'grey.200', 
                            color: 'primary.main', 
                            boxShadow: 'none', 
                            '&:hover': { 
                                backgroundColor: 'grey.300', 
                                boxShadow: 'none' 
                            }
                        }}
                    >
                        Back
                    </Button>
                </Box>
            )}
        </Box>
    );
};
