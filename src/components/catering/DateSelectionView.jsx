import React, { useState, useMemo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { LocalizationProvider, DateCalendar, PickersDay } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { isBefore, startOfToday, isToday, addDays, format, addMinutes } from 'date-fns';

// Store hours by location (simplified - matches CategoryListView)
const STORE_HOURS = {
    'kips-bay': {
        0: { open: '14:00', close: '23:00' }, // Sunday
        1: { open: '14:00', close: '23:00' }, // Monday
        2: { open: '14:00', close: '23:00' }, // Tuesday
        3: { open: '14:00', close: '23:00' }, // Wednesday
        4: { open: '14:00', close: '23:00' }, // Thursday
        5: { open: '14:00', close: '25:00' }, // Friday (until 1am)
        6: { open: '14:00', close: '25:00' }, // Saturday (until 1am)
    },
    'flushing': {
        0: { open: '12:00', close: '22:00' },
        1: { open: '14:00', close: '22:00' },
        2: { open: '14:00', close: '22:00' },
        3: { open: '14:00', close: '22:00' },
        4: { open: '14:00', close: '22:00' },
        5: { open: '12:00', close: '23:00' },
        6: { open: '12:00', close: '23:00' },
    },
};

// Prep time in minutes for pickup orders
const PREP_TIME_MINUTES = 30;

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

    // Get store hours for the selected location
    const getStoreHoursForDate = (date, locId) => {
        const storeHours = STORE_HOURS[locId] || STORE_HOURS['kips-bay'];
        const dayOfWeek = date.getDay();
        return storeHours[dayOfWeek];
    };

    // Calculate earliest available time for a given date
    const getEarliestAvailableTime = (date) => {
        const hours = getStoreHoursForDate(date, locationId || 'kips-bay');
        if (!hours) return null;

        const [openHour, openMin] = hours.open.split(':').map(Number);
        const [closeHour] = hours.close.split(':').map(Number);

        const now = new Date();
        const isSelectedDateToday = isToday(date);

        if (isSelectedDateToday) {
            // For today, earliest is now + prep time, but not before store opens
            const earliestTime = addMinutes(now, PREP_TIME_MINUTES);
            const storeOpenTime = new Date(date);
            storeOpenTime.setHours(openHour, openMin, 0, 0);

            // Round up to next 30-minute slot
            const roundedTime = new Date(Math.max(earliestTime.getTime(), storeOpenTime.getTime()));
            const minutes = roundedTime.getMinutes();
            if (minutes > 0 && minutes <= 30) {
                roundedTime.setMinutes(30, 0, 0);
            } else if (minutes > 30) {
                roundedTime.setHours(roundedTime.getHours() + 1, 0, 0, 0);
            }

            return roundedTime;
        } else {
            // For future dates, start from store opening
            const openTime = new Date(date);
            openTime.setHours(openHour, openMin, 0, 0);
            return openTime;
        }
    };

    // Check if a date has any available time slots
    const hasAvailableSlots = (date) => {
        const hours = getStoreHoursForDate(date, locationId || 'kips-bay');
        if (!hours) return false;

        const [closeHour, closeMin] = hours.close.split(':').map(Number);
        const actualCloseHour = closeHour >= 24 ? closeHour - 24 : closeHour;

        const earliestTime = getEarliestAvailableTime(date);
        if (!earliestTime) return false;

        // Store close time (handle past midnight)
        const storeCloseTime = new Date(date);
        if (closeHour >= 24) {
            storeCloseTime.setDate(storeCloseTime.getDate() + 1);
        }
        storeCloseTime.setHours(actualCloseHour, closeMin || 0, 0, 0);

        // Last order must be at least 30 mins before close
        const lastOrderTime = addMinutes(storeCloseTime, -30);

        return earliestTime <= lastOrderTime;
    };

    // Generate time slots based on store hours and selected date
    const generateTimeSlots = useMemo(() => {
        if (!selectedDate) return [];

        const hours = getStoreHoursForDate(selectedDate, locationId || 'kips-bay');
        if (!hours) return [];

        const [openHour, openMin] = hours.open.split(':').map(Number);
        const [closeHour, closeMin] = hours.close.split(':').map(Number);

        const earliestTime = getEarliestAvailableTime(selectedDate);
        if (!earliestTime) return [];

        const slots = [];
        const startHour = earliestTime.getHours();
        const startMin = earliestTime.getMinutes();

        // Handle close time past midnight
        const effectiveCloseHour = closeHour >= 24 ? 24 : closeHour;

        for (let hour = startHour; hour < effectiveCloseHour; hour++) {
            for (let minute = (hour === startHour ? startMin : 0); minute < 60; minute += 30) {
                // Don't allow orders in last 30 mins before close
                if (hour === effectiveCloseHour - 1 && minute >= 30) continue;

                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const period = hour >= 12 ? 'pm' : 'am';
                const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                const displayMinute = minute.toString().padStart(2, '0');
                const displayTime = `${displayHour}:${displayMinute}${period}`;
                slots.push({ value: timeString, label: displayTime });
            }
        }
        return slots;
    }, [selectedDate, locationId]);

    const timeSlots = generateTimeSlots;

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
                        Select a date based on store availability.
                    </Typography>

                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DateCalendar
                            value={selectedDate}
                            onChange={handleDateChange}
                            referenceDate={new Date()}
                            disablePast
                            shouldDisableDate={(date) => {
                                // Disable today only if no available time slots remain
                                if (isToday(date) && !hasAvailableSlots(date)) return true;
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
