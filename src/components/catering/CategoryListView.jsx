import React, { useState, useRef, useEffect, useContext } from 'react';
import { Box, Typography, Container, ToggleButtonGroup, ToggleButton, Dialog, DialogContent, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { LocationModal } from '@/components/commerce/LocationModal';
import { GiWheat } from 'react-icons/gi';
import { FaLeaf, FaRecycle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';
import { getLocationFromIP, calculateDistance } from '@/components/commerce/geolocation';
import { getDefaultLocations } from '@/components/commerce/shopifyLocations';
import { LocalizationProvider, DateCalendar, PickersDay } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { isBefore, startOfToday, isToday, isTomorrow, addDays, format } from 'date-fns';

const PLACEHOLDER_IMAGE = 'https://placehold.co/300x300/e0e0e0/666666?text=Category';

// Store hours by location ID (in EST)
// Hours format: { open: 'HH:MM', close: 'HH:MM' } in 24-hour format
// Use 25:00 for 1am next day, etc.
const STORE_HOURS = {
    'kips-bay': {
        0: { open: '14:00', close: '23:00' }, // Sunday 2pm-11pm
        1: { open: '14:00', close: '23:00' }, // Monday 2pm-11pm
        2: { open: '14:00', close: '23:00' }, // Tuesday 2pm-11pm
        3: { open: '14:00', close: '23:00' }, // Wednesday 2pm-11pm
        4: { open: '14:00', close: '23:00' }, // Thursday 2pm-11pm
        5: { open: '14:00', close: '25:00' }, // Friday 2pm-1am
        6: { open: '14:00', close: '25:00' }, // Saturday 2pm-1am
    },
    'new-brunswick': {
        0: { open: '14:00', close: '23:00' }, // Sunday 2pm-11pm
        1: { open: '14:00', close: '23:00' }, // Monday 2pm-11pm
        2: { open: '14:00', close: '23:00' }, // Tuesday 2pm-11pm
        3: { open: '14:00', close: '23:00' }, // Wednesday 2pm-11pm
        4: { open: '14:00', close: '23:00' }, // Thursday 2pm-11pm
        5: { open: '14:00', close: '25:00' }, // Friday 2pm-1am
        6: { open: '14:00', close: '25:00' }, // Saturday 2pm-1am
    },
};

// Merge locations from shared source with hours
const STORE_LOCATIONS = getDefaultLocations().map(loc => ({
    ...loc,
    hours: STORE_HOURS[loc.id] || STORE_HOURS['kips-bay'], // fallback to kips-bay hours
}));

// Lead times in minutes
const PICKUP_LEAD_TIME = 60; // 1 hour
const DELIVERY_LEAD_TIME = 90; // 1.5 hours

/**
 * Get the next available pickup/delivery time for catering orders
 * @returns {{ isOpenNow: boolean, message: string, pickupTime: Date, deliveryTime: Date }}
 */
const getNextAvailablePickup = () => {
    // Get current time in EST
    const now = new Date();
    const estOptions = { timeZone: 'America/New_York' };
    const estString = now.toLocaleString('en-US', estOptions);
    const estNow = new Date(estString);

    const currentDay = estNow.getDay();
    const currentHour = estNow.getHours();
    const currentMinute = estNow.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Format time for display (lowercase am/pm)
    const formatTime = (date) => {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const period = hours >= 12 ? 'pm' : 'am';
        const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
    };

    // Format date for display
    const formatDate = (date) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
    };

    // Helper to add minutes to a date
    const addMinutes = (date, mins) => {
        return new Date(date.getTime() + mins * 60000);
    };

    // Check if any store is open now (use first store's hours as reference)
    // Also check if we're in the "after midnight" period from previous day's hours
    const todayHours = STORE_LOCATIONS[0]?.hours[currentDay];
    const yesterdayDay = currentDay === 0 ? 6 : currentDay - 1;
    const yesterdayHours = STORE_LOCATIONS[0]?.hours[yesterdayDay];

    let isOpenNow = false;
    let storeOpenTime = null;
    let storeCloseTime = null;

    // Check if we're still in yesterday's late-night hours (e.g., it's 12:30am and store closed at 1am)
    if (yesterdayHours) {
        const [yCloseHour, yCloseMin] = yesterdayHours.close.split(':').map(Number);
        if (yCloseHour >= 24) {
            // Yesterday's store was open past midnight
            const actualCloseHour = yCloseHour - 24;
            const closeTimeMinutes = actualCloseHour * 60 + yCloseMin;
            if (currentTimeMinutes < closeTimeMinutes) {
                // We're still in yesterday's operating hours
                isOpenNow = true;
                storeCloseTime = new Date(estNow);
                storeCloseTime.setHours(actualCloseHour, yCloseMin, 0, 0);
            }
        }
    }

    // Check today's hours if not already open from yesterday
    if (!isOpenNow && todayHours) {
        const [openHour, openMin] = todayHours.open.split(':').map(Number);
        const [closeHour, closeMin] = todayHours.close.split(':').map(Number);
        const openTimeMinutes = openHour * 60 + openMin;

        // Handle closing time past midnight (e.g., 25:00 = 1am next day)
        const actualCloseHour = closeHour >= 24 ? closeHour - 24 : closeHour;
        const closeTimeMinutes = closeHour >= 24 ? (24 * 60) + (actualCloseHour * 60 + closeMin) : closeHour * 60 + closeMin;

        storeOpenTime = new Date(estNow);
        storeOpenTime.setHours(openHour, openMin, 0, 0);

        storeCloseTime = new Date(estNow);
        if (closeHour >= 24) {
            // Closing time is next day
            storeCloseTime.setDate(storeCloseTime.getDate() + 1);
            storeCloseTime.setHours(actualCloseHour, closeMin, 0, 0);
        } else {
            storeCloseTime.setHours(closeHour, closeMin, 0, 0);
        }

        // Check if currently open
        if (closeHour >= 24) {
            // Store closes after midnight - open if we're past opening time
            isOpenNow = currentTimeMinutes >= openTimeMinutes;
        } else {
            isOpenNow = currentTimeMinutes >= openTimeMinutes && currentTimeMinutes < closeTimeMinutes;
        }
    }

    let message = '';
    let pickupTime = null;
    let deliveryTime = null;

    if (isOpenNow) {
        // Store is open - calculate times based on lead times
        const rawPickupTime = addMinutes(estNow, PICKUP_LEAD_TIME);
        const rawDeliveryTime = addMinutes(estNow, DELIVERY_LEAD_TIME);

        // Ensure times are not before store opens (edge case)
        pickupTime = rawPickupTime < storeOpenTime ? storeOpenTime : rawPickupTime;
        deliveryTime = rawDeliveryTime < storeOpenTime ? storeOpenTime : rawDeliveryTime;

        // Check if pickup/delivery times are the same (within same minute)
        const pickupTimeStr = formatTime(pickupTime);
        const deliveryTimeStr = formatTime(deliveryTime);

        if (pickupTimeStr === deliveryTimeStr) {
            message = `We're open now! Earliest pickup or delivery is ${pickupTimeStr} for orders placed now`;
        } else {
            message = `We're open now! Earliest pickup is ${pickupTimeStr}, delivery for ${deliveryTimeStr} for orders placed now`;
        }
    } else {
        // Store is closed - find next opening time
        let nextOpenDate = null;

        // Check if store opens later today
        if (todayHours && storeOpenTime > estNow) {
            nextOpenDate = storeOpenTime;
        } else {
            // Find next open day
            for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
                const futureDay = (currentDay + daysAhead) % 7;
                const futureHours = STORE_LOCATIONS[0]?.hours[futureDay];

                if (futureHours) {
                    const [openHour, openMin] = futureHours.open.split(':').map(Number);
                    nextOpenDate = new Date(estNow);
                    nextOpenDate.setDate(nextOpenDate.getDate() + daysAhead);
                    nextOpenDate.setHours(openHour, openMin, 0, 0);
                    break;
                }
            }
        }

        if (nextOpenDate) {
            // Calculate pickup/delivery times from when store opens
            pickupTime = addMinutes(nextOpenDate, PICKUP_LEAD_TIME);
            deliveryTime = addMinutes(nextOpenDate, DELIVERY_LEAD_TIME);

            const isToday = nextOpenDate.getDate() === estNow.getDate();
            const isTomorrow = nextOpenDate.getDate() === estNow.getDate() + 1;

            const pickupTimeStr = formatTime(pickupTime);
            const deliveryTimeStr = formatTime(deliveryTime);

            let dayPrefix = '';
            if (isToday) {
                dayPrefix = 'Today';
            } else if (isTomorrow) {
                dayPrefix = 'Tomorrow';
            } else {
                dayPrefix = formatDate(nextOpenDate);
            }

            if (pickupTimeStr === deliveryTimeStr) {
                message = `Opens ${dayPrefix.toLowerCase() === 'today' ? 'later today' : dayPrefix}. Earliest pickup or delivery is ${pickupTimeStr}`;
            } else {
                message = `Opens ${dayPrefix.toLowerCase() === 'today' ? 'later today' : dayPrefix}. Earliest pickup is ${pickupTimeStr}, delivery for ${deliveryTimeStr}`;
            }
        }
    }

    return {
        isOpenNow,
        message,
        pickupTime,
        deliveryTime,
        locations: STORE_LOCATIONS
    };
};

// Flip Clock Digit Component - mimics old split-flap display
const FlipClockDigit = ({ value, small }) => {
    const size = small
        ? { width: 24, height: 32, fontSize: '1.6rem' }
        : { width: 50, height: 70, fontSize: '3.5rem' };

    // Simplified version for small size
    if (small) {
        return (
            <Box
                sx={{
                    width: size.width,
                    height: size.height,
                    backgroundColor: '#1a1a1a',
                    borderRadius: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
            >
                <Typography
                    sx={{
                        fontSize: size.fontSize,
                        fontWeight: 700,
                        color: 'white',
                        fontFamily: '"Courier New", monospace',
                        lineHeight: 1,
                    }}
                >
                    {value}
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                position: 'relative',
                width: size.width,
                height: size.height,
                backgroundColor: '#1a1a1a',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}
        >
            {/* Top half */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '50%',
                    backgroundColor: '#2a2a2a',
                    borderBottom: '1px solid #000',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    overflow: 'hidden',
                }}
            >
                <Typography
                    sx={{
                        fontSize: size.fontSize,
                        fontWeight: 700,
                        color: 'white',
                        fontFamily: '"Courier New", monospace',
                        lineHeight: 1,
                        transform: 'translateY(50%)',
                    }}
                >
                    {value}
                </Typography>
            </Box>
            {/* Bottom half */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '50%',
                    backgroundColor: '#1a1a1a',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    overflow: 'hidden',
                }}
            >
                <Typography
                    sx={{
                        fontSize: size.fontSize,
                        fontWeight: 700,
                        color: 'white',
                        fontFamily: '"Courier New", monospace',
                        lineHeight: 1,
                        transform: 'translateY(-50%)',
                    }}
                >
                    {value}
                </Typography>
            </Box>
            {/* Center line (flap edge) */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: 2,
                    backgroundColor: '#000',
                    transform: 'translateY(-50%)',
                }}
            />
        </Box>
    );
};

// Flip Clock Time Display Component
const FlipClockDisplay = ({ time, small }) => {
    // time is a Date object
    if (!time) return null;

    const hours = time.getHours();
    const minutes = time.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;

    const hourStr = displayHour.toString().padStart(2, '0');
    const minStr = minutes.toString().padStart(2, '0');

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: small ? 0.25 : 0.5 }}>
            <FlipClockDigit value={hourStr[0]} small={small} />
            <FlipClockDigit value={hourStr[1]} small={small} />
            <Typography sx={{ fontSize: small ? '1.8rem' : '3rem', fontWeight: 700, color: '#1a1a1a', mx: small ? 0.25 : 0.5 }}>:</Typography>
            <FlipClockDigit value={minStr[0]} small={small} />
            <FlipClockDigit value={minStr[1]} small={small} />
            <Box
                sx={{
                    ml: small ? 0.5 : 1,
                    px: small ? 0.5 : 1,
                    height: small ? 32 : 70,
                    backgroundColor: '#1a1a1a',
                    borderRadius: small ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography
                    sx={{
                        fontSize: '1.6rem',
                        fontWeight: 700,
                        color: 'white',
                        fontFamily: '"Courier New", monospace',
                    }}
                >
                    {period}
                </Typography>
            </Box>
        </Box>
    );
};

// Dietary Badge Components
export const GlutenFreeBadge = ({ size = 'medium' }) => {
    const sizes = {
        small: { width: 28, height: 28, iconSize: 18 },
        medium: { width: 36, height: 36, iconSize: 22 },
        large: { width: 44, height: 44, iconSize: 28 },
    };
    const s = sizes[size] || sizes.medium;

    return (
        <Box
            sx={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: s.width,
                height: s.height,
                borderRadius: '50%',
                backgroundColor: '#FFF8E1',
                border: '2px solid #F9A825',
            }}
            title="Gluten-Free"
        >
            {/* Wheat icon */}
            <GiWheat size={s.iconSize} color="#F9A825" />
            {/* Diagonal strikethrough line */}
            <Box
                sx={{
                    position: 'absolute',
                    width: '120%',
                    height: '3px',
                    backgroundColor: '#F9A825',
                    transform: 'rotate(-45deg)',
                    borderRadius: '2px',
                }}
            />
        </Box>
    );
};

export const VeganBadge = ({ size = 'medium' }) => {
    const sizes = {
        small: { width: 28, height: 28, iconSize: 16 },
        medium: { width: 36, height: 36, iconSize: 20 },
        large: { width: 44, height: 44, iconSize: 26 },
    };
    const s = sizes[size] || sizes.medium;

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: s.width,
                height: s.height,
                borderRadius: '50%',
                backgroundColor: '#E8F5E9',
                border: '2px solid #4CAF50',
            }}
            title="Vegan"
        >
            {/* Leaf icon */}
            <FaLeaf size={s.iconSize} color="#4CAF50" />
        </Box>
    );
};

export const SustainableBadge = ({ size = 'medium' }) => {
    const sizes = {
        small: { width: 28, height: 28, iconSize: 16 },
        medium: { width: 36, height: 36, iconSize: 20 },
        large: { width: 44, height: 44, iconSize: 26 },
    };
    const s = sizes[size] || sizes.medium;

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: s.width,
                height: s.height,
                borderRadius: '50%',
                backgroundColor: '#E3F2FD',
                border: '2px solid #2196F3',
            }}
            title="Sustainable"
        >
            {/* Recycle icon */}
            <FaRecycle size={s.iconSize} color="#2196F3" />
        </Box>
    );
};

// Combined badge display component
export const DietaryBadges = ({ glutenFree, vegan, size = 'small' }) => {
    if (!glutenFree && !vegan) return null;

    return (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {glutenFree && <GlutenFreeBadge size={size} />}
            {vegan && <VeganBadge size={size} />}
        </Box>
    );
};

// Flavor categories per packaging type
const FLAVOR_CATEGORIES_BY_PACKAGING = {
    'Cake Jar Boxes': [
        { id: 'cake', label: 'Cake Jars' },
        { id: 'cheesecake', label: 'Cheesecake' },
    ],
    'Cupcake Trays': [
        { id: 'cake', label: 'Cake Jars' },
        { id: 'cheesecake', label: 'Cheesecake' },
        { id: 'cookie', label: 'Cookie' },
    ],
    'Cookies': [
        { id: 'basecookie', label: 'Cookie' },
        { id: 'frosted', label: 'Frosted Cookie' },
    ],
    'Cookie Tray': [
        { id: 'basecookie', label: 'Cookie' },
        { id: 'frosted', label: 'Frosted Cookie' },
    ],
};

// Make Your Own Cake Jar - shown in Your Jars section
const MAKE_YOUR_OWN_JAR = { name: 'Make Your Own Cake Jar', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/make-your-own-mini-cake-jar.png', color: '#FFD700', glutenFree: false, vegan: false };

// Make Your Own Cookie - shown in Your Cookies section
const MAKE_YOUR_OWN_COOKIE = { name: 'Make Your Own Cookie', image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-sugar-cookie.png', color: '#F5DEB3', glutenFree: false, vegan: false };

// Base cookie options for Make Your Own Cookie
const BASE_COOKIES = [
    { name: 'Sugar Cookie', image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-sugar-cookie.png', color: '#F5DEB3' },
    { name: "M&M Cookie", image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-M&M.png', color: '#FFD700' },
    { name: 'Red Velvet Cookie', image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-red-velvet.png', color: '#C41E3A' },
    { name: "S'mores Cookie", image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-smores.png', color: '#8B4513' },
    { name: 'Chocolate Chip Cookie', image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-chocolate-chip.png', color: '#D2691E' },
];

// Hardcoded flavors with colors, dietary info, and category
const FLAVORS = {
    cake: [
        { name: "A'mour S'more", image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/amour-smore-mini-cake-jar.png', color: '#8B4513', glutenFree: false, vegan: false },
        { name: 'Chocolate Meltdown Overload', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/chocolate-meltdown-overload-mini-cake-jar.png', color: '#3D1C02', glutenFree: true, vegan: true },
        { name: 'I Dream of Taro', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/i-dream-of-taro-mini-cake-jar.png', color: '#9370DB', glutenFree: true, vegan: false },
        { name: 'All Very Strawberry', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/all-very-strawberry-mini-cake-jar.png', color: '#FF6B81', glutenFree: true, vegan: true },
        { name: 'Nom Nom Cookie', color: '#2C2C2C', glutenFree: false, vegan: false },
        { name: 'La La Red Velvet', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/la-la-red-velvet-mini-cake-jar.png', color: '#C41E3A', glutenFree: false, vegan: false },
    ],
    cheesecake: [
        { name: 'Strawberry', color: '#FF6B81', glutenFree: true, vegan: false },
        { name: 'Cherry', color: '#C41E3A', glutenFree: true, vegan: false },
        { name: 'Apple', color: '#90EE90', glutenFree: true, vegan: false },
    ],
    basecookie: [
        {
            name: 'Sugar Cookie',
            image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-sugar-cookie.png',
            color: '#F5DEB3',
            glutenFree: false,
            vegan: false,
            isBaseCookie: true,
            ingredients: ['Flour', 'Butter', 'Sugar (Granulated)', 'Eggs', 'Vanilla Extract', 'Baking Soda', 'Salt'],
            allergens: ['Wheat', 'Dairy', 'Eggs'],
        },
        {
            name: "M&M Cookie",
            image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-M&M.png',
            color: '#FFD700',
            glutenFree: false,
            vegan: false,
            isBaseCookie: true,
            ingredients: ['Flour', 'Butter', 'Sugar (Brown & Granulated)', 'Eggs', 'Vanilla Extract', 'Baking Soda', 'Salt', "M&M's Candy"],
            allergens: ['Wheat', 'Dairy', 'Eggs', 'Soy'],
        },
        {
            name: 'Red Velvet Cookie',
            image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-red-velvet.png',
            color: '#C41E3A',
            glutenFree: false,
            vegan: false,
            isBaseCookie: true,
            ingredients: ['Flour', 'Butter', 'Sugar', 'Eggs', 'Cocoa Powder', 'Red Food Coloring', 'Vanilla Extract', 'Baking Soda', 'Salt', 'White Chocolate Chips'],
            allergens: ['Wheat', 'Dairy', 'Eggs', 'Soy'],
        },
        {
            name: "S'mores Cookie",
            image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-smores.png',
            color: '#8B4513',
            glutenFree: false,
            vegan: false,
            isBaseCookie: true,
            ingredients: ['Flour', 'Butter', 'Sugar (Brown & Granulated)', 'Eggs', 'Vanilla Extract', 'Baking Soda', 'Salt', 'Graham Cracker Pieces', 'Chocolate Chips', 'Marshmallows'],
            allergens: ['Wheat', 'Dairy', 'Eggs', 'Soy'],
        },
        {
            name: 'Chocolate Chip Cookie',
            image: 'https://images.surrealcreamery.com/catering/make-your-own/cookie-chocolate-chip.png',
            color: '#D2691E',
            glutenFree: false,
            vegan: false,
            isBaseCookie: true,
            ingredients: ['Flour', 'Butter', 'Sugar (Brown & Granulated)', 'Eggs', 'Vanilla Extract', 'Baking Soda', 'Salt', 'Chocolate Chips'],
            allergens: ['Wheat', 'Dairy', 'Eggs', 'Soy'],
        },
    ],
    frosted: [
        {
            name: "A'mour S'more Cookie",
            image: 'https://images.surrealcreamery.com/catering/cookies/amour-smore-cookie.png',
            color: '#8B4513',
            glutenFree: false,
            vegan: false,
            isFrostedCookie: true,
            ingredients: ["S'mores Cookie Base", 'Marshmallow Frosting', 'Chocolate Drizzle', 'Graham Cracker Crumbs'],
            allergens: ['Wheat', 'Dairy', 'Eggs', 'Soy'],
        },
        {
            name: 'All Very Strawberry Cookie',
            image: 'https://images.surrealcreamery.com/catering/cookies/all-very-strawberry-cookie.png',
            color: '#FF6B81',
            glutenFree: true,
            vegan: true,
            isFrostedCookie: true,
            ingredients: ['Gluten-Free Sugar Cookie Base', 'Strawberry Frosting', 'Freeze-Dried Strawberries'],
            allergens: [],
        },
        {
            name: 'Birthday Bash Cookie',
            image: 'https://images.surrealcreamery.com/catering/cookies/birthday-bash-cookie.png',
            color: '#FFD700',
            glutenFree: false,
            vegan: false,
            isFrostedCookie: true,
            ingredients: ['Sugar Cookie Base', 'Blue Vanilla Frosting', 'Rainbow Sprinkles'],
            allergens: ['Wheat', 'Dairy', 'Eggs', 'Soy'],
        },
        {
            name: 'La La Red Velvet Cookie',
            image: 'https://images.surrealcreamery.com/catering/cookies/la-la-red-velvet-cookie.png',
            color: '#C41E3A',
            glutenFree: false,
            vegan: false,
            isFrostedCookie: true,
            ingredients: ['Red Velvet Cookie Base', 'Cream Cheese Frosting', 'White Chocolate Chips'],
            allergens: ['Wheat', 'Dairy', 'Eggs', 'Soy'],
        },
        {
            name: 'Nom Nom Cookie',
            image: 'https://images.surrealcreamery.com/catering/cookies/nom-nom-cookie.png',
            color: '#2C2C2C',
            glutenFree: false,
            vegan: false,
            isFrostedCookie: true,
            ingredients: ['Chocolate Chip Cookie Base', 'Chocolate Frosting', 'Oreo Crumbles'],
            allergens: ['Wheat', 'Dairy', 'Eggs', 'Soy'],
        },
    ],
};

// Available customization options
const CAKE_FLAVORS = [
    { name: 'Vanilla', image: 'https://images.surrealcreamery.com/catering/make-your-own/cake-vanilla.png', color: '#FFF8E7' },
    { name: 'Chocolate', image: 'https://images.surrealcreamery.com/catering/make-your-own/cake-chocolate.png', color: '#3D1C02' },
    { name: 'Red Velvet', image: 'https://images.surrealcreamery.com/catering/make-your-own/cake-red-velvet.png', color: '#C41E3A' },
    { name: 'Strawberry', image: 'https://images.surrealcreamery.com/catering/make-your-own/cake-strawberry.png', color: '#FF6B81' },
    { name: 'Taro', image: 'https://images.surrealcreamery.com/catering/make-your-own/cake-taro.png', color: '#9370DB' },
    { name: 'Espresso', image: 'https://images.surrealcreamery.com/catering/make-your-own/cake-espresso.png', color: '#C4A77D' },
];
const FROSTINGS = [
    { name: 'Marshmallow', image: null, color: '#FFFFFF' },
    { name: 'Tres Leches', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-cake-tres-leches.png', color: '#FFF8E7' },
    { name: 'Chocolate', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-cake-chocolate.png', color: '#3D1C02' },
    { name: 'Blue Vanilla', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-cake-blue-vanilla.png', color: '#A7C7E7' },
    { name: 'Strawberry', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-cake-strawberry.png', color: '#FF6B81' },
    { name: 'Cream Cheese', image: null, color: '#FFFDD0' },
];
const FROSTINGS_AMOUR_SMORE = [{ name: 'Marshmallow & Chocolate', image: null, color: '#5C4033' }]; // Only for A'mour S'more
const COOKIE_FROSTINGS = [
    { name: 'Marshmallow', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-cookie-marshmallow.png', color: '#FFFFFF' },
    { name: 'Chocolate', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-cookie-chocolate.png', color: '#3D1C02' },
    { name: 'Blue Vanilla', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-cookie-blue-vanilla.png', color: '#A7C7E7' },
    { name: 'Strawberry', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-cookie-strawberry.png', color: '#FF6B81' },
    { name: 'Cream Cheese', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-cookie-cream-cheese.png', color: '#FFFDD0' },
];
const AVAILABLE_TOPPINGS = [
    { name: 'Chocolate Chips', image: null },
    { name: 'Chocolate Crunch', image: 'https://images.surrealcreamery.com/catering/make-your-own/topping-chocolate-crunch.png' },
    { name: 'Chocolate Sprinkles', image: null },
    { name: 'Gummy Bears', image: null },
    { name: 'Lucky Charms Marshmallows', image: null },
    { name: 'Marshmallows', image: null },
    { name: "M&M's", image: null },
    { name: 'Peanut Butter Chips', image: null },
    { name: 'Rainbow Sprinkles', image: null },
    { name: 'Strawberry Crunch', image: null },
    { name: 'Whipped Cream', image: null },
    { name: 'White Chocolate Curls', image: null },
];
const COOKIE_TOPPINGS = [
    { name: 'Rainbow Sprinkles', image: 'https://images.surrealcreamery.com/catering/make-your-own/topping-cookie-rainbow-sprinkles.png' },
    { name: 'Strawberry Crunch', image: 'https://images.surrealcreamery.com/catering/make-your-own/topping-cookie-strawberry-crunch.png' },
];
const AVAILABLE_COOKIES = [
    'Biscoff', 'Chocolate Straws', 'Graham Crackers', 'Ladyfingers',
    'Oreos', 'Stroopwafel', 'Waffle Cookie'
];
const AVAILABLE_SYRUPS = ['Brown Sugar', 'Caramel', 'Chocolate', 'Strawberry', 'Condensed Milk'];

// Default ingredients for each jar flavor
// Note: frostings is an array but should only contain one item (single-select)
const DEFAULT_INGREDIENTS = {
    "A'mour S'more": {
        cake: 'Vanilla',
        frostings: ['Marshmallow & Chocolate'],
        toppings: ['Marshmallows', 'Chocolate Chips'],
        cookies: ['Graham Crackers'],
        syrups: ['Chocolate'],
    },
    'Chocolate Meltdown Overload': {
        cake: 'Chocolate',
        frostings: ['Chocolate'],
        toppings: ['Chocolate Chips'],
        cookies: [],
        syrups: ['Chocolate'],
    },
    'I Dream of Taro': {
        cake: 'Taro',
        frostings: ['Cream Cheese'],
        toppings: [],
        cookies: [],
        syrups: [],
    },
    'All Very Strawberry': {
        cake: 'Strawberry',
        frostings: ['Strawberry'],
        toppings: ['Strawberry Crunch'],
        cookies: [],
        syrups: ['Strawberry'],
    },
    'La La Red Velvet': {
        cake: 'Red Velvet',
        frostings: ['Cream Cheese'],
        toppings: [],
        cookies: [],
        syrups: [],
    },
    'Nom Nom Cookie': {
        cake: 'Vanilla',
        frostings: ['Chocolate'],
        toppings: ['Chocolate Chips'],
        cookies: ['Oreos'],
        syrups: [],
    },
    'Make Your Own Cake Jar': {
        cake: 'Vanilla',
        frostings: ['Marshmallow'],
        toppings: [],
        cookies: [],
        syrups: [],
    },
};

// Jar Preview Modal Component - shows read-only view of jar with default ingredients
const JarPreviewModal = ({ open, onClose, jar, onCustomize, onAddToBox, onDelete, availableSlots = 6 }) => {
    const [quantity, setQuantity] = useState(1);

    // Reset quantity when jar changes
    useEffect(() => {
        if (jar) {
            setQuantity(1);
        }
    }, [jar]);

    if (!jar) return null;

    const defaults = DEFAULT_INGREDIENTS[jar.name] || {
        cake: 'Vanilla', frostings: ['Marshmallow'], toppings: [], cookies: [], syrups: []
    };

    // Use jar's current customizations if they exist, otherwise use defaults
    const displayCake = jar.customizations?.cake || defaults.cake;
    const displayFrostings = jar.customizations?.frostings || defaults.frostings;
    const displayToppings = jar.customizations?.toppings || defaults.toppings;
    const displayCookies = jar.customizations?.cookies || defaults.cookies || [];
    const displaySyrups = jar.customizations?.syrups || defaults.syrups || [];

    const handleAddToBox = () => {
        // Add with current/default customizations
        const itemToAdd = {
            ...jar,
            customizations: {
                cake: displayCake,
                frostings: displayFrostings,
                toppings: displayToppings,
                cookies: displayCookies,
                syrups: displaySyrups,
            }
        };

        // Always pass quantity to add multiple at once
        onAddToBox(itemToAdd, quantity);
        onClose();
    };

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDialog-paper': {
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '100vh',
                }
            }}
        >
            <DialogContent sx={{ p: 0, flexGrow: 1, overflow: 'auto', pb: '100px' }}>
                {/* Jar Image - show layered frosting + toppings for custom jars */}
                {(() => {
                    // For custom jars/cookies, get frosting and topping images
                    let baseImage = null;
                    let frostingImage = null;
                    let frostingColor = jar.color;
                    let toppingImages = [];
                    const isCustomCookie = jar.id?.startsWith('custom-cookie-');

                    if (jar.isCustom && jar.customizations) {
                        // For cookies, get the base cookie image
                        if (isCustomCookie) {
                            const baseName = jar.customizations.cake;
                            const baseObj = BASE_COOKIES.find(c => c.name === baseName);
                            baseImage = baseObj?.image;
                            frostingColor = baseObj?.color || jar.color;
                        }

                        const frostingName = jar.customizations.frostings?.[0];
                        // Use cookie frostings for custom cookies, jar frostings for jars
                        const frostingObj = isCustomCookie
                            ? COOKIE_FROSTINGS.find(f => f.name === frostingName)
                            : FROSTINGS.find(f => f.name === frostingName);
                        frostingImage = frostingObj?.image;
                        if (!isCustomCookie) {
                            frostingColor = frostingObj?.color || jar.color;
                        }

                        // Use cookie toppings for custom cookies, jar toppings for jars
                        const toppingsArray = isCustomCookie ? COOKIE_TOPPINGS : AVAILABLE_TOPPINGS;
                        toppingImages = (jar.customizations.toppings || [])
                            .map(t => toppingsArray.find(top => top.name === t))
                            .filter(t => t && t.image)
                            .map(t => t.image);
                    }

                    return (
                        <Box
                            sx={{
                                width: '100%',
                                height: 300,
                                backgroundColor: frostingColor || '#f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                position: 'relative',
                            }}
                        >
                            {jar.isCustom ? (
                                <>
                                    {/* Base layer - cookie base (for cookies) */}
                                    {isCustomCookie && baseImage && (
                                        <img
                                            src={baseImage}
                                            alt="cookie base"
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                zIndex: 0,
                                            }}
                                        />
                                    )}
                                    {/* Frosting layer */}
                                    {frostingImage && (
                                        <img
                                            src={frostingImage}
                                            alt="frosting"
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                zIndex: isCustomCookie ? 1 : 0,
                                            }}
                                        />
                                    )}
                                    {/* Topping layers */}
                                    {toppingImages.map((img, index) => (
                                        <img
                                            key={index}
                                            src={img}
                                            alt="topping"
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                zIndex: isCustomCookie ? index + 2 : index + 1,
                                            }}
                                        />
                                    ))}
                                </>
                            ) : jar.image ? (
                                <img
                                    src={jar.image}
                                    alt={jar.name}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                            ) : (
                                <Box
                                    sx={{
                                        width: 180,
                                        height: 180,
                                        borderRadius: '50%',
                                        backgroundColor: jar.color,
                                        border: '4px solid white',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                    }}
                                />
                            )}
                        </Box>
                    );
                })()}

                {/* Content */}
                <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
                    {/* Jar Name with Delete button for custom jars */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1, gap: 1 }}>
                        {/* Name */}
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                fontSize: '2rem',
                                flex: 1,
                                minWidth: 0,
                                wordWrap: 'break-word',
                            }}
                        >
                            {jar.displayName || jar.name}
                        </Typography>
                        {/* Delete Button */}
                        {jar.isCustom && onDelete && (
                            <Box
                                component="button"
                                onClick={() => {
                                    onDelete(jar);
                                    onClose();
                                }}
                                sx={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    color: '#1976d2',
                                    fontSize: '1.4rem',
                                    fontWeight: 600,
                                    flexShrink: 0,
                                    '&:hover': { opacity: 0.7 },
                                }}
                                aria-label="Delete custom jar"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                                DELETE
                            </Box>
                        )}
                    </Box>

                    {/* Dietary and sustainability badges with labels */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                        {jar.glutenFree && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <GlutenFreeBadge size="medium" />
                                <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Gluten-Free</Typography>
                            </Box>
                        )}
                        {jar.vegan && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <VeganBadge size="medium" />
                                <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Vegan</Typography>
                            </Box>
                        )}
                        {/* All jars are sustainable - only show for jars, not cookies */}
                        {!jar.isBaseCookie && !jar.isFrostedCookie && !jar.id?.startsWith('custom-cookie-') && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <SustainableBadge size="medium" />
                                <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Sustainable</Typography>
                            </Box>
                        )}
                    </Box>

                    {/* Quantity Selector for Custom Items (cookies and jars) - above Customize button */}
                    {(jar.id?.startsWith('custom-cookie-') || jar.id?.startsWith('custom-jar-')) && (
                        <Box sx={{ mb: 3 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '1.6rem', mb: 1.5 }}>
                                Quantity {availableSlots > 0 && <Typography component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '1.4rem' }}>({availableSlots} slots available)</Typography>}
                            </Typography>
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
                                <Box
                                    component="button"
                                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                                    disabled={quantity <= 1}
                                    sx={{
                                        minWidth: 44,
                                        height: 44,
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
                                        cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                                        opacity: quantity <= 1 ? 0.4 : 1,
                                        '&:hover': { backgroundColor: quantity <= 1 ? 'transparent' : '#f5f5f5' },
                                    }}
                                >
                                    −
                                </Box>
                                <Typography sx={{ px: 2, fontWeight: 700, minWidth: 30, textAlign: 'center', fontSize: '1.6rem' }}>
                                    {quantity}
                                </Typography>
                                <Box
                                    component="button"
                                    onClick={() => setQuantity(prev => Math.min(availableSlots, prev + 1))}
                                    disabled={quantity >= availableSlots || availableSlots <= 0}
                                    sx={{
                                        minWidth: 44,
                                        height: 44,
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
                                        cursor: (quantity >= availableSlots || availableSlots <= 0) ? 'not-allowed' : 'pointer',
                                        opacity: (quantity >= availableSlots || availableSlots <= 0) ? 0.4 : 1,
                                        '&:hover': { backgroundColor: (quantity >= availableSlots || availableSlots <= 0) ? 'transparent' : '#f5f5f5' },
                                    }}
                                >
                                    +
                                </Box>
                            </Box>
                        </Box>
                    )}

                    {/* Customize Button - only for custom jars */}
                    {jar.isCustom && (
                        <Box
                            component="button"
                            onClick={onCustomize}
                            sx={{
                                width: '100%',
                                py: 1.5,
                                px: 3,
                                mb: 3,
                                backgroundColor: 'white',
                                color: 'black',
                                border: '2px solid black',
                                borderRadius: 2,
                                fontSize: '1.6rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    backgroundColor: 'black',
                                    color: 'white',
                                },
                            }}
                        >
                            {jar.id?.startsWith('custom-cookie-') ? 'Customize This Cookie' : 'Customize This Jar'}
                        </Box>
                    )}

                    {/* Ingredients Display */}
                    {(jar.isBaseCookie || jar.isFrostedCookie) ? (
                        /* Base Cookie or Frosted Cookie - Show Quantity Selector, Ingredients and Allergens */
                        <Box>
                            {/* Quantity Selector - Cart Style */}
                            <Box sx={{ mb: 3 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: '1.6rem', mb: 1.5 }}>
                                    Quantity {availableSlots > 0 && <Typography component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '1.4rem' }}>({availableSlots} slots available)</Typography>}
                                </Typography>
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
                                    <Box
                                        component="button"
                                        onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                                        disabled={quantity <= 1}
                                        sx={{
                                            minWidth: 44,
                                            height: 44,
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            fontSize: '1.5rem',
                                            fontWeight: 700,
                                            cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                                            opacity: quantity <= 1 ? 0.4 : 1,
                                            '&:hover': { backgroundColor: quantity <= 1 ? 'transparent' : '#f5f5f5' },
                                        }}
                                    >
                                        −
                                    </Box>
                                    <Typography sx={{ px: 2, fontWeight: 700, minWidth: 30, textAlign: 'center', fontSize: '1.6rem' }}>
                                        {quantity}
                                    </Typography>
                                    <Box
                                        component="button"
                                        onClick={() => setQuantity(prev => Math.min(availableSlots, prev + 1))}
                                        disabled={quantity >= availableSlots || availableSlots <= 0}
                                        sx={{
                                            minWidth: 44,
                                            height: 44,
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            fontSize: '1.5rem',
                                            fontWeight: 700,
                                            cursor: (quantity >= availableSlots || availableSlots <= 0) ? 'not-allowed' : 'pointer',
                                            opacity: (quantity >= availableSlots || availableSlots <= 0) ? 0.4 : 1,
                                            '&:hover': { backgroundColor: (quantity >= availableSlots || availableSlots <= 0) ? 'transparent' : '#f5f5f5' },
                                        }}
                                    >
                                        +
                                    </Box>
                                </Box>
                            </Box>

                            {/* Ingredients Section */}
                            <Box sx={{ mb: 3 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: '1.6rem', mb: 1.5 }}>
                                    Ingredients
                                </Typography>
                                <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary', lineHeight: 1.6 }}>
                                    {jar.ingredients?.join(', ') || 'No ingredients listed'}
                                </Typography>
                            </Box>

                            {/* Allergens Section */}
                            {jar.allergens && jar.allergens.length > 0 && (
                                <Box sx={{ mb: 3 }}>
                                    <Typography sx={{ fontWeight: 700, fontSize: '1.6rem', mb: 1.5 }}>
                                        Allergens
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {jar.allergens.map((allergen) => (
                                            <Box
                                                key={allergen}
                                                sx={{
                                                    px: 2,
                                                    py: 0.5,
                                                    backgroundColor: '#fff3e0',
                                                    border: '1px solid #ffcc80',
                                                    borderRadius: 2,
                                                    fontSize: '1.3rem',
                                                    fontWeight: 500,
                                                    color: '#e65100',
                                                }}
                                            >
                                                {allergen}
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    ) : (
                        /* Cake Jars / Custom Cookies - Three columns with images */
                        (() => {
                            const isCustomCookie = jar.id?.startsWith('custom-cookie-');
                            // Use cookie arrays for custom cookies, jar arrays for jars
                            const baseObj = isCustomCookie
                                ? BASE_COOKIES.find(c => c.name === displayCake)
                                : CAKE_FLAVORS.find(c => c.name === displayCake);
                            const frostingObj = isCustomCookie
                                ? COOKIE_FROSTINGS.find(f => f.name === displayFrostings[0])
                                : FROSTINGS.find(f => f.name === displayFrostings[0]);
                            const toppingObj = isCustomCookie
                                ? COOKIE_TOPPINGS.find(t => t.name === displayToppings[0])
                                : AVAILABLE_TOPPINGS.find(t => t.name === displayToppings[0]);

                            return (
                                <>
                                    {/* Quantity Selector for Jars (not custom cookies - they have their own above) */}
                                    {!isCustomCookie && !jar.isCustom && (
                                        <Box sx={{ mb: 3 }}>
                                            <Typography sx={{ fontWeight: 700, fontSize: '1.6rem', mb: 1.5 }}>
                                                Quantity {availableSlots > 0 && <Typography component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '1.4rem' }}>({availableSlots} slots available)</Typography>}
                                            </Typography>
                                            <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
                                                <Box
                                                    component="button"
                                                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                                                    disabled={quantity <= 1}
                                                    sx={{
                                                        minWidth: 44,
                                                        height: 44,
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        fontSize: '1.5rem',
                                                        fontWeight: 700,
                                                        cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                                                        opacity: quantity <= 1 ? 0.4 : 1,
                                                        '&:hover': { backgroundColor: quantity <= 1 ? 'transparent' : '#f5f5f5' },
                                                    }}
                                                >
                                                    −
                                                </Box>
                                                <Typography sx={{ px: 2, fontWeight: 700, minWidth: 30, textAlign: 'center', fontSize: '1.6rem' }}>
                                                    {quantity}
                                                </Typography>
                                                <Box
                                                    component="button"
                                                    onClick={() => setQuantity(prev => Math.min(availableSlots, prev + 1))}
                                                    disabled={quantity >= availableSlots || availableSlots <= 0}
                                                    sx={{
                                                        minWidth: 44,
                                                        height: 44,
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        fontSize: '1.5rem',
                                                        fontWeight: 700,
                                                        cursor: (quantity >= availableSlots || availableSlots <= 0) ? 'not-allowed' : 'pointer',
                                                        opacity: (quantity >= availableSlots || availableSlots <= 0) ? 0.4 : 1,
                                                        '&:hover': { backgroundColor: (quantity >= availableSlots || availableSlots <= 0) ? 'transparent' : '#f5f5f5' },
                                                    }}
                                                >
                                                    +
                                                </Box>
                                            </Box>
                                        </Box>
                                    )}
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, textAlign: 'center' }}>
                                    {/* Cookie/Cake */}
                                    <Box>
                                        <Box
                                            sx={{
                                                width: 80,
                                                height: 80,
                                                borderRadius: '50%',
                                                overflow: 'hidden',
                                                margin: '0 auto',
                                                mb: 1,
                                                backgroundColor: baseObj?.color || '#f5f0e6',
                                                border: '2px solid white',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                            }}
                                        >
                                            {baseObj?.image && (
                                                <img
                                                    src={baseObj.image}
                                                    alt={displayCake}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            )}
                                        </Box>
                                        <Typography sx={{ fontWeight: 600, fontSize: '1.4rem', color: 'text.secondary' }}>
                                            {isCustomCookie ? 'Cookie' : 'Cake'}
                                        </Typography>
                                        <Typography sx={{ fontSize: '1.4rem' }}>
                                            {displayCake}
                                        </Typography>
                                    </Box>

                                    {/* Frosting */}
                                    <Box>
                                        <Box
                                            sx={{
                                                width: 80,
                                                height: 80,
                                                borderRadius: '50%',
                                                overflow: 'hidden',
                                                margin: '0 auto',
                                                mb: 1,
                                                backgroundColor: frostingObj?.color || '#f5f0e6',
                                                border: '2px solid white',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                            }}
                                        >
                                            {frostingObj?.image && (
                                                <img
                                                    src={frostingObj.image}
                                                    alt={displayFrostings[0]}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            )}
                                        </Box>
                                        <Typography sx={{ fontWeight: 600, fontSize: '1.4rem', color: 'text.secondary' }}>
                                            Frosting
                                        </Typography>
                                        <Typography sx={{ fontSize: '1.4rem' }}>
                                            {displayFrostings.length > 0 ? displayFrostings[0] : 'None'}
                                        </Typography>
                                    </Box>

                                    {/* Topping */}
                                    <Box>
                                        <Box
                                            sx={{
                                                width: 80,
                                                height: 80,
                                                borderRadius: '50%',
                                                overflow: 'hidden',
                                                margin: '0 auto',
                                                mb: 1,
                                                backgroundColor: '#f5f0e6',
                                                border: '2px solid white',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {toppingObj?.image ? (
                                                <img
                                                    src={toppingObj.image}
                                                    alt={displayToppings[0]}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <Typography sx={{ fontSize: '1.2rem', color: 'text.secondary' }}>—</Typography>
                                            )}
                                        </Box>
                                        <Typography sx={{ fontWeight: 600, fontSize: '1.4rem', color: 'text.secondary' }}>
                                            Topping
                                        </Typography>
                                        <Typography sx={{ fontSize: '1.4rem' }}>
                                            {displayToppings.length > 0 ? displayToppings[0] : 'None'}
                                        </Typography>
                                    </Box>
                                </Box>
                                </>
                            );
                        })()
                    )}
                </Box>
            </DialogContent>

            {/* Sticky Footer with Close and Add to Box Buttons */}
            <Box
                sx={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    p: 2,
                    borderTop: '1px solid',
                    borderColor: 'grey.300',
                    backgroundColor: 'white',
                    zIndex: 1300,
                    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                }}
            >
                <Box sx={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 1 }}>
                    {/* Close Button */}
                    <Box
                        component="button"
                        onClick={onClose}
                        sx={{
                            px: 2,
                            py: 1.5,
                            backgroundColor: 'white',
                            color: 'grey.700',
                            border: '1px solid',
                            borderColor: 'grey.300',
                            borderRadius: 1,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '&:hover': {
                                backgroundColor: 'grey.100',
                                borderColor: 'grey.400',
                            },
                        }}
                        aria-label="Close"
                    >
                        <CloseIcon />
                    </Box>

                    {/* Add to Box Button */}
                    <Box
                        component="button"
                        onClick={handleAddToBox}
                        sx={{
                            flex: 1,
                            py: 2,
                            px: 4,
                            backgroundColor: 'black',
                            color: 'white',
                            border: 'none',
                            borderRadius: 1,
                            fontSize: '1.6rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            '&:hover': {
                                backgroundColor: '#333',
                            },
                        }}
                    >
                        {`Add ${quantity} to Box`}
                    </Box>
                </Box>
            </Box>
        </Dialog>
    );
};

// Jar Customization Modal Component
const JarCustomizationModal = ({ open, onClose, jar, onSave }) => {
    const [selectedCake, setSelectedCake] = useState('');
    const [selectedFrostings, setSelectedFrostings] = useState([]);
    const [selectedToppings, setSelectedToppings] = useState([]);
    const [selectedCookies, setSelectedCookies] = useState([]);
    const [selectedSyrups, setSelectedSyrups] = useState([]);
    const [currentStep, setCurrentStep] = useState(0);

    // Steps for Make Your Own staged flow
    const STEPS = ['cake', 'frosting', 'toppings', 'cookies', 'syrups'];
    const isMakeYourOwn = jar?.name === 'Make Your Own Cake Jar' || jar?.isCustom;

    // Initialize state when jar changes
    useEffect(() => {
        if (jar) {
            // Reset step for Make Your Own
            setCurrentStep(0);

            // For "Make Your Own Cake Jar", don't pre-select anything - user must choose
            if (jar.name === 'Make Your Own Cake Jar' && !jar.isCustom) {
                setSelectedCake('');
                setSelectedFrostings([]);
                setSelectedToppings([]);
                setSelectedCookies([]);
                setSelectedSyrups([]);
            } else if (jar.isCustom) {
                // Editing existing custom jar - load its customizations
                setSelectedCake(jar.customizations?.cake || '');
                setSelectedFrostings(jar.customizations?.frostings || []);
                setSelectedToppings(jar.customizations?.toppings || []);
                setSelectedCookies(jar.customizations?.cookies || []);
                setSelectedSyrups(jar.customizations?.syrups || []);
            } else {
                const defaults = DEFAULT_INGREDIENTS[jar.name] || {
                    cake: 'Vanilla', frostings: [], toppings: [], cookies: [], syrups: []
                };
                setSelectedCake(jar.customizations?.cake || defaults.cake);
                setSelectedFrostings(jar.customizations?.frostings || [...defaults.frostings]);
                setSelectedToppings(jar.customizations?.toppings || [...defaults.toppings]);
                setSelectedCookies(jar.customizations?.cookies || [...(defaults.cookies || [])]);
                setSelectedSyrups(jar.customizations?.syrups || [...(defaults.syrups || [])]);
            }
        }
    }, [jar]);

    // Check if current step can proceed
    const canContinue = () => {
        switch (STEPS[currentStep]) {
            case 'cake': return !!selectedCake;
            case 'frosting': return selectedFrostings.length > 0;
            default: return true; // Toppings, cookies, syrups are optional
        }
    };

    const handleContinue = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleEditStep = (stepIndex) => {
        setCurrentStep(stepIndex);
    };

    // Get available frostings based on jar type
    // A'mour S'more gets all frostings PLUS "Marshmallow & Chocolate" combo
    // All other jars only get the regular frostings
    const getAvailableFrostings = () => {
        if (jar?.name === "A'mour S'more") {
            return [...FROSTINGS_AMOUR_SMORE, ...FROSTINGS];
        }
        return FROSTINGS;
    };

    const handleFrostingSelect = (frosting) => {
        // Single select - only one frosting at a time
        setSelectedFrostings([frosting.name]);
    };

    const handleToppingToggle = (topping) => {
        setSelectedToppings(prev => {
            if (prev.includes(topping.name)) {
                return prev.filter(t => t !== topping.name);
            } else {
                return [...prev, topping.name];
            }
        });
    };

    const handleCookieToggle = (cookie) => {
        setSelectedCookies(prev => {
            if (prev.includes(cookie)) {
                return prev.filter(c => c !== cookie);
            } else {
                return [...prev, cookie];
            }
        });
    };

    const handleSyrupToggle = (syrup) => {
        setSelectedSyrups(prev => {
            if (prev.includes(syrup)) {
                return prev.filter(s => s !== syrup);
            } else {
                return [...prev, syrup];
            }
        });
    };

    const handleSave = () => {
        onSave({
            ...jar,
            customizations: {
                cake: selectedCake,
                frostings: selectedFrostings,
                toppings: selectedToppings,
                cookies: selectedCookies,
                syrups: selectedSyrups,
            }
        });
        onClose();
    };

    if (!jar) return null;

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDialog-paper': {
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '100vh',
                }
            }}
        >
            <DialogContent sx={{ p: 0, flexGrow: 1, overflow: 'auto', pb: '100px' }}>
                {/* Jar Image - show selected frosting with topping overlay for Make Your Own */}
                {(() => {
                    const selectedCakeObj = CAKE_FLAVORS.find(c => c.name === selectedCake);
                    const selectedFrostingObj = FROSTINGS.find(f => f.name === selectedFrostings[0]);
                    // Get topping images for layering
                    const selectedToppingObjs = selectedToppings
                        .map(t => AVAILABLE_TOPPINGS.find(top => top.name === t))
                        .filter(t => t && t.image);

                    // Base layer: frosting if selected, otherwise cake
                    let baseImage = jar.image;
                    let displayColor = jar.color;
                    if (jar.name === 'Make Your Own Cake Jar') {
                        if (selectedFrostingObj) {
                            baseImage = selectedFrostingObj.image;
                            displayColor = selectedFrostingObj.color;
                        } else if (selectedCakeObj) {
                            baseImage = selectedCakeObj.image;
                            displayColor = selectedCakeObj.color;
                        }
                    }
                    return (
                        <Box
                            sx={{
                                width: '100%',
                                height: 300,
                                backgroundColor: displayColor || '#f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                position: 'relative',
                            }}
                        >
                            {/* Base layer - frosting or cake */}
                            {baseImage ? (
                                <img
                                    src={baseImage}
                                    alt={selectedFrostings[0] || selectedCake || jar.name}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                            ) : (
                                <Box
                                    sx={{
                                        width: 180,
                                        height: 180,
                                        borderRadius: '50%',
                                        backgroundColor: displayColor || jar.color,
                                        border: '4px solid white',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                    }}
                                />
                            )}
                            {/* Topping layers - overlay on top of frosting */}
                            {jar.name === 'Make Your Own Cake Jar' && selectedToppingObjs.map((topping, index) => (
                                <img
                                    key={topping.name}
                                    src={topping.image}
                                    alt={topping.name}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        zIndex: index + 1,
                                    }}
                                />
                            ))}
                        </Box>
                    );
                })()}

                {/* Content */}
                <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
                    {/* Title - only show for non-custom jars */}
                    {jar.name !== 'Make Your Own Cake Jar' && (
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 700,
                                mb: 2,
                                fontSize: '1.6rem',
                                color: 'black',
                            }}
                        >
                            Customize Your Jar
                        </Typography>
                    )}

                    {/* Jar Name */}
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            mb: 0.5,
                            fontSize: '2rem',
                        }}
                    >
                        {jar.name}
                    </Typography>

                    {/* Dietary and sustainability badges with labels */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                        {jar.glutenFree && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <GlutenFreeBadge size="medium" />
                                <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Gluten-Free</Typography>
                            </Box>
                        )}
                        {jar.vegan && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <VeganBadge size="medium" />
                                <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Vegan</Typography>
                            </Box>
                        )}
                        {/* All jars are sustainable */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <SustainableBadge size="medium" />
                            <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Sustainable</Typography>
                        </Box>
                    </Box>

                    {/* Cake Flavor */}
                    <Box sx={{ mb: 3 }}>
                        {/* Collapsed view for Make Your Own when past this step */}
                        {isMakeYourOwn && currentStep > 0 ? (
                            <Box
                                onClick={() => handleEditStep(0)}
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    p: 2,
                                    backgroundColor: 'grey.100',
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: 'grey.200' },
                                }}
                            >
                                <Box>
                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Cake</Typography>
                                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }}>{selectedCake}</Typography>
                                </Box>
                                <Typography sx={{ fontSize: '1.4rem', color: 'primary.main' }}>Edit</Typography>
                            </Box>
                        ) : (
                        <>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: '1.6rem',
                                mb: 2,
                            }}
                        >
                            {isMakeYourOwn ? 'Select Your Cake' : 'Cake'}
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: 2,
                                maxWidth: '320px',
                                margin: '0 auto',
                            }}
                        >
                            {CAKE_FLAVORS.map((cake) => (
                                <Box
                                    key={cake.name}
                                    component="button"
                                    onClick={() => setSelectedCake(cake.name)}
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 80,
                                            height: 80,
                                            borderRadius: '50%',
                                            overflow: 'hidden',
                                            border: '3px solid',
                                            borderColor: selectedCake === cake.name ? cake.color : 'transparent',
                                            outline: selectedCake === cake.name ? 'none' : '1px solid #e0e0e0',
                                            backgroundColor: '#f5f5f5',
                                            boxShadow: selectedCake === cake.name ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                                                transform: 'scale(1.05)',
                                            },
                                        }}
                                    >
                                        {cake.image && (
                                            <img
                                                src={cake.image}
                                                alt={cake.name}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        )}
                                    </Box>
                                    <Typography
                                        sx={{
                                            mt: 1,
                                            fontSize: '1.4rem',
                                            fontWeight: selectedCake === cake.name ? 600 : 500,
                                            textAlign: 'center',
                                            color: selectedCake === cake.name ? 'black' : 'text.secondary',
                                        }}
                                    >
                                        {cake.name}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                        {/* Continue button for Make Your Own */}
                        {isMakeYourOwn && currentStep === 0 && (
                            <Box
                                component="button"
                                onClick={handleContinue}
                                disabled={!selectedCake}
                                sx={{
                                    mt: 3,
                                    width: '100%',
                                    py: 1.5,
                                    backgroundColor: selectedCake ? 'black' : 'grey.300',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 1,
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    cursor: selectedCake ? 'pointer' : 'not-allowed',
                                    '&:hover': { backgroundColor: selectedCake ? '#333' : 'grey.300' },
                                }}
                            >
                                Continue
                            </Box>
                        )}
                        </>
                        )}
                    </Box>

                    {/* Frostings */}
                    {(!isMakeYourOwn || currentStep >= 1) && (
                    <Box sx={{ mb: 3 }}>
                        {/* Collapsed view for Make Your Own when past this step */}
                        {isMakeYourOwn && currentStep > 1 ? (
                            <Box
                                onClick={() => handleEditStep(1)}
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    p: 2,
                                    backgroundColor: 'grey.100',
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: 'grey.200' },
                                }}
                            >
                                <Box>
                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Frosting</Typography>
                                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }}>{selectedFrostings.join(', ')}</Typography>
                                </Box>
                                <Typography sx={{ fontSize: '1.4rem', color: 'primary.main' }}>Edit</Typography>
                            </Box>
                        ) : (
                        <>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: '1.6rem',
                                mb: 1,
                            }}
                        >
                            {isMakeYourOwn ? 'Select Your Frosting' : 'Frosting'}
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: 2,
                                maxWidth: '320px',
                                margin: '0 auto',
                            }}
                        >
                            {getAvailableFrostings().map((frosting) => (
                                <Box
                                    key={frosting.name}
                                    component="button"
                                    onClick={() => handleFrostingSelect(frosting)}
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 80,
                                            height: 80,
                                            borderRadius: '50%',
                                            overflow: 'hidden',
                                            border: '3px solid',
                                            borderColor: selectedFrostings.includes(frosting.name) ? frosting.color : 'transparent',
                                            outline: selectedFrostings.includes(frosting.name) ? 'none' : '1px solid #e0e0e0',
                                            backgroundColor: '#f5f5f5',
                                            boxShadow: selectedFrostings.includes(frosting.name) ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                                                transform: 'scale(1.05)',
                                            },
                                        }}
                                    >
                                        {frosting.image ? (
                                            <img
                                                src={frosting.image}
                                                alt={frosting.name}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        ) : (
                                            <Box
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    backgroundColor: frosting.color,
                                                }}
                                            />
                                        )}
                                    </Box>
                                    <Typography
                                        sx={{
                                            mt: 1,
                                            fontSize: '1.4rem',
                                            fontWeight: selectedFrostings.includes(frosting.name) ? 600 : 500,
                                            textAlign: 'center',
                                            color: selectedFrostings.includes(frosting.name) ? 'black' : 'text.secondary',
                                        }}
                                    >
                                        {frosting.name}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                        {/* Continue button for Make Your Own */}
                        {isMakeYourOwn && currentStep === 1 && (
                            <Box
                                component="button"
                                onClick={handleContinue}
                                disabled={selectedFrostings.length === 0}
                                sx={{
                                    mt: 3,
                                    width: '100%',
                                    py: 1.5,
                                    backgroundColor: selectedFrostings.length > 0 ? 'black' : 'grey.300',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 1,
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    cursor: selectedFrostings.length > 0 ? 'pointer' : 'not-allowed',
                                    '&:hover': { backgroundColor: selectedFrostings.length > 0 ? '#333' : 'grey.300' },
                                }}
                            >
                                Continue
                            </Box>
                        )}
                        </>
                        )}
                    </Box>
                    )}

                    {/* Toppings */}
                    {(!isMakeYourOwn || currentStep >= 2) && (
                    <Box sx={{ mb: 3 }}>
                        {/* Collapsed view for Make Your Own when past this step */}
                        {isMakeYourOwn && currentStep > 2 ? (
                            <Box
                                onClick={() => handleEditStep(2)}
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    p: 2,
                                    backgroundColor: 'grey.100',
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: 'grey.200' },
                                }}
                            >
                                <Box>
                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Toppings</Typography>
                                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }}>{selectedToppings.length > 0 ? selectedToppings.join(', ') : 'None'}</Typography>
                                </Box>
                                <Typography sx={{ fontSize: '1.4rem', color: 'primary.main' }}>Edit</Typography>
                            </Box>
                        ) : (
                        <>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: '1.6rem',
                                mb: 1,
                            }}
                        >
                            {isMakeYourOwn ? 'Add Topping (Optional)' : 'Topping'} <Typography component="span" sx={{ fontSize: '1.6rem', color: 'text.secondary', fontWeight: 400 }}>(max 1)</Typography>
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                            {AVAILABLE_TOPPINGS.map((topping) => {
                                const isSelected = selectedToppings.includes(topping.name);
                                const isDisabled = !isSelected && selectedToppings.length >= 1;
                                return (
                                    <Box
                                        key={topping.name}
                                        component="button"
                                        onClick={() => !isDisabled && handleToppingToggle(topping)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            px: 1.5,
                                            py: 1,
                                            borderRadius: 1,
                                            border: '1px solid',
                                            borderColor: isSelected ? 'black' : 'grey.300',
                                            backgroundColor: 'white',
                                            color: isDisabled ? 'grey.400' : 'black',
                                            fontSize: '1.6rem',
                                            fontWeight: 500,
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                            textAlign: 'left',
                                            opacity: isDisabled ? 0.5 : 1,
                                            '&:hover': {
                                                borderColor: isDisabled ? 'grey.300' : 'black',
                                            }
                                        }}
                                    >
                                        {/* Checkbox */}
                                        <Box
                                            sx={{
                                                width: 24,
                                                height: 24,
                                                borderRadius: '4px',
                                                border: '2px solid',
                                                borderColor: isSelected ? 'black' : 'grey.400',
                                                backgroundColor: isSelected ? 'black' : 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {isSelected && (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                                </svg>
                                            )}
                                        </Box>
                                        {topping.name}
                                    </Box>
                                );
                            })}
                        </Box>
                        {/* Continue button for Make Your Own */}
                        {isMakeYourOwn && currentStep === 2 && (
                            <Box
                                component="button"
                                onClick={handleContinue}
                                sx={{
                                    mt: 3,
                                    width: '100%',
                                    py: 1.5,
                                    backgroundColor: 'black',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 1,
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#333' },
                                }}
                            >
                                Continue
                            </Box>
                        )}
                        </>
                        )}
                    </Box>
                    )}

                    {/* Cookies */}
                    {(!isMakeYourOwn || currentStep >= 3) && (
                    <Box sx={{ mb: 3 }}>
                        {/* Collapsed view for Make Your Own when past this step */}
                        {isMakeYourOwn && currentStep > 3 ? (
                            <Box
                                onClick={() => handleEditStep(3)}
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    p: 2,
                                    backgroundColor: 'grey.100',
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: 'grey.200' },
                                }}
                            >
                                <Box>
                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Cookies</Typography>
                                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }}>{selectedCookies.length > 0 ? selectedCookies.join(', ') : 'None'}</Typography>
                                </Box>
                                <Typography sx={{ fontSize: '1.4rem', color: 'primary.main' }}>Edit</Typography>
                            </Box>
                        ) : (
                        <>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: '1.6rem',
                                mb: 1,
                            }}
                        >
                            {isMakeYourOwn ? 'Add Cookies (Optional)' : 'Cookies'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {AVAILABLE_COOKIES.map((cookie) => (
                                <Box
                                    key={cookie}
                                    component="button"
                                    onClick={() => handleCookieToggle(cookie)}
                                    sx={{
                                        px: 2,
                                        py: 1,
                                        borderRadius: 2,
                                        border: '2px solid',
                                        borderColor: selectedCookies.includes(cookie) ? 'black' : 'grey.300',
                                        backgroundColor: selectedCookies.includes(cookie) ? 'black' : 'white',
                                        color: selectedCookies.includes(cookie) ? 'white' : 'black',
                                        fontSize: '1.6rem',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            borderColor: 'black',
                                        }
                                    }}
                                >
                                    {cookie}
                                </Box>
                            ))}
                        </Box>
                        {/* Continue button for Make Your Own */}
                        {isMakeYourOwn && currentStep === 3 && (
                            <Box
                                component="button"
                                onClick={handleContinue}
                                sx={{
                                    mt: 3,
                                    width: '100%',
                                    py: 1.5,
                                    backgroundColor: 'black',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 1,
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#333' },
                                }}
                            >
                                Continue
                            </Box>
                        )}
                        </>
                        )}
                    </Box>
                    )}

                    {/* Syrups */}
                    {(!isMakeYourOwn || currentStep >= 4) && (
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: '1.6rem',
                                mb: 1,
                            }}
                        >
                            {isMakeYourOwn ? 'Add Syrups (Optional)' : 'Syrups'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {AVAILABLE_SYRUPS.map((syrup) => (
                                <Box
                                    key={syrup}
                                    component="button"
                                    onClick={() => handleSyrupToggle(syrup)}
                                    sx={{
                                        px: 2,
                                        py: 1,
                                        borderRadius: 2,
                                        border: '2px solid',
                                        borderColor: selectedSyrups.includes(syrup) ? 'black' : 'grey.300',
                                        backgroundColor: selectedSyrups.includes(syrup) ? 'black' : 'white',
                                        color: selectedSyrups.includes(syrup) ? 'white' : 'black',
                                        fontSize: '1.6rem',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            borderColor: 'black',
                                        }
                                    }}
                                >
                                    {syrup}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                    )}

                    </Box>
            </DialogContent>

            {/* Sticky Footer with Navigation and Add to Box Buttons */}
            <Box
                sx={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    p: 2,
                    borderTop: '1px solid',
                    borderColor: 'grey.300',
                    backgroundColor: 'white',
                    zIndex: 1300,
                    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                }}
            >
                <Box sx={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 1 }}>
                    {/* Close Button */}
                    <Box
                        component="button"
                        onClick={onClose}
                        sx={{
                            px: 2,
                            py: 1.5,
                            backgroundColor: 'white',
                            color: 'grey.700',
                            border: '1px solid',
                            borderColor: 'grey.300',
                            borderRadius: 1,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '&:hover': {
                                backgroundColor: 'grey.100',
                                borderColor: 'grey.400',
                            },
                        }}
                        aria-label="Close"
                    >
                        <CloseIcon />
                    </Box>

                    {/* Add to Box / Update Button - only show on last step for Make Your Own */}
                    {(!isMakeYourOwn || currentStep === 4) && (
                    (() => {
                        const isEditing = jar?.isCustom;
                        const isDisabled = isMakeYourOwn && (!selectedCake || selectedFrostings.length === 0);
                        const buttonText = isEditing ? 'Update Custom Cake Jar' : 'Add to Box';

                        return (
                            <Box
                                component="button"
                                onClick={handleSave}
                                disabled={isDisabled}
                                sx={{
                                    flex: 1,
                                    py: 2,
                                    px: 4,
                                    backgroundColor: isDisabled ? 'grey.300' : 'black',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 1,
                                    fontSize: '1.6rem',
                                    fontWeight: 700,
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    '&:hover': {
                                        backgroundColor: isDisabled ? 'grey.300' : '#333',
                                    },
                                }}
                            >
                                {buttonText}
                            </Box>
                        );
                    })()
                    )}
                </Box>
            </Box>
        </Dialog>
    );
};

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

// Packaging options
const PACKAGING = [
    {
        name: 'Cake Jar Boxes',
        heroImage: 'https://images.surrealcreamery.com/catering/packaging/cake-jar-box.png',
        sustainable: true,
        glutenFree: true,
        vegan: true,
        slotCount: 6,
        price: 50,
    },
    {
        name: 'Cupcake Trays',
        heroImage: 'https://images.surrealcreamery.com/catering/packaging/cake-tray.png',
        sustainable: false,
        glutenFree: true,
        vegan: true,
    },
    {
        name: 'Cookies',
        heroImage: 'https://images.surrealcreamery.com/catering/packaging/cake-tray.png',
        sustainable: false,
        glutenFree: true,
        vegan: true,
        slotCount: 6,
        price: 30,
    },
    {
        name: 'Cookie Tray',
        heroImage: 'https://images.surrealcreamery.com/catering/packaging/cake-tray.png',
        sustainable: false,
        glutenFree: true,
        vegan: true,
        slotCount: 12,
        price: 55,
    },
];

// Animated flavor circle component - opens customization modal on click
const AnimatedFlavorCircle = ({ flavor, onSelect, isPlaced, onDelete }) => {
    const handleClick = () => {
        // Custom jars can always be clicked (to edit them), regular jars are blocked when placed
        if (isPlaced && !flavor.isCustom) return;
        onSelect(flavor);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (onDelete) onDelete(flavor);
    };

    // For custom jars/cookies, get base, frosting, and topping images
    const getCustomJarImages = () => {
        if (!flavor.isCustom || !flavor.customizations) return { baseImage: null, frostingImage: null, frostingColor: null, toppingImages: [], isCustomCookie: false };

        // Detect if it's a cookie by checking if the base (cake) name is in BASE_COOKIES or by name/id
        const baseName = flavor.customizations.cake;
        const isCookieBase = BASE_COOKIES.some(c => c.name === baseName);
        const isCustomCookie = isCookieBase || flavor.name?.includes('Cookie') || flavor.id?.includes('cookie');

        // For cookies, get the base cookie image
        let baseImage = null;
        let baseColor = null;
        if (isCustomCookie) {
            const baseObj = BASE_COOKIES.find(c => c.name === baseName);
            baseImage = baseObj?.image;
            baseColor = baseObj?.color;
        }

        const frostingName = flavor.customizations.frostings?.[0];
        // Use cookie frostings for custom cookies, jar frostings for jars
        const frostingObj = isCustomCookie
            ? COOKIE_FROSTINGS.find(f => f.name === frostingName)
            : FROSTINGS.find(f => f.name === frostingName);

        // Use cookie toppings for custom cookies, jar toppings for jars
        const toppingsArray = isCustomCookie ? COOKIE_TOPPINGS : AVAILABLE_TOPPINGS;
        const toppingImages = (flavor.customizations.toppings || [])
            .map(t => toppingsArray.find(top => top.name === t))
            .filter(t => t && t.image)
            .map(t => t.image);

        return {
            baseImage,
            frostingImage: frostingObj?.image,
            frostingColor: isCustomCookie ? baseColor : frostingObj?.color,
            toppingImages,
            isCustomCookie,
        };
    };

    const { baseImage, frostingImage, frostingColor, toppingImages, isCustomCookie } = getCustomJarImages();

    // Custom jars can always be clicked, so they shouldn't look as disabled
    const showAsDisabled = isPlaced && !flavor.isCustom;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: showAsDisabled ? 'default' : 'pointer',
                opacity: showAsDisabled ? 0.4 : 1,
                transition: 'opacity 0.3s',
            }}
        >
            <Box
                onClick={handleClick}
                sx={{
                    position: 'relative',
                    width: 80,
                    height: 80,
                    cursor: showAsDisabled ? 'default' : 'pointer',
                }}
            >
                {/* The flavor circle */}
                <motion.div
                    whileHover={!showAsDisabled ? {
                        y: -4,
                        scale: 1.05,
                    } : {}}
                    whileTap={!showAsDisabled ? {
                        scale: 0.95,
                    } : {}}
                    transition={{
                        duration: 0.2,
                        ease: 'easeOut',
                    }}
                    style={{
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            border: '3px solid white',
                            outline: '1px solid #e0e0e0',
                            backgroundColor: flavor.isCustom ? (frostingColor || flavor.color) : flavor.color,
                            transition: 'box-shadow 0.3s',
                            position: 'relative',
                            '&:hover': {
                                boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                            }
                        }}
                    >
                        {/* For custom jars, show layered frosting + toppings */}
                        {flavor.isCustom ? (
                            <>
                                {/* Base layer - cookie base (for cookies) */}
                                {isCustomCookie && baseImage && (
                                    <img
                                        src={baseImage}
                                        alt="cookie base"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            zIndex: 0,
                                        }}
                                    />
                                )}
                                {/* Frosting layer */}
                                {frostingImage && (
                                    <img
                                        src={frostingImage}
                                        alt="frosting"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            zIndex: isCustomCookie ? 1 : 0,
                                        }}
                                    />
                                )}
                                {/* Topping layers */}
                                {toppingImages.map((img, index) => (
                                    <img
                                        key={index}
                                        src={img}
                                        alt="topping"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            zIndex: isCustomCookie ? index + 2 : index + 1,
                                        }}
                                    />
                                ))}
                            </>
                        ) : (
                            /* Regular jar - single image */
                            flavor.image && (
                                <img
                                    src={flavor.image}
                                    alt={flavor.name}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            )
                        )}
                    </Box>
                </motion.div>

                {/* Gluten-free badge - top right (1 o'clock) */}
                {flavor.glutenFree && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: -2,
                            right: 2,
                            zIndex: 10,
                        }}
                    >
                        <GlutenFreeBadge size="small" />
                    </Box>
                )}
                {/* Vegan badge - top left (11 o'clock) */}
                {flavor.vegan && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: -2,
                            left: 2,
                            zIndex: 10,
                        }}
                    >
                        <VeganBadge size="small" />
                    </Box>
                )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1 }}>
                <Typography
                    variant="body2"
                    sx={{ fontWeight: 500, textAlign: 'center', fontSize: '1.6rem' }}
                >
                    {flavor.displayName || flavor.name}
                </Typography>
                {/* Delete button for custom jars */}
                {flavor.isCustom && onDelete && (
                    <Box
                        component="button"
                        onClick={handleDelete}
                        sx={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'grey.500',
                            '&:hover': { color: 'error.main' },
                        }}
                        aria-label="Delete custom jar"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </Box>
                )}
            </Box>

        </Box>
    );
};

// Animated packaging component - smooth lift and fly
const AnimatedPackaging = ({ item, onSelect, isSelected, isHighlighted }) => {
    const [animationPhase, setAnimationPhase] = useState('idle'); // idle, lifting, flying

    const handleClick = () => {
        if (animationPhase !== 'idle' || isSelected) return;

        setAnimationPhase('lifting');

        setTimeout(() => {
            setAnimationPhase('flying');
        }, 400);

        setTimeout(() => {
            onSelect(item);
            setAnimationPhase('idle');
        }, 900);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: isSelected ? 'default' : 'pointer',
                opacity: isSelected ? 0.4 : 1,
                transition: 'all 0.3s',
                transform: isHighlighted ? 'scale(1.05)' : 'scale(1)',
            }}
        >
            <Box
                onClick={handleClick}
                sx={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: '100%',
                    cursor: isSelected ? 'default' : 'pointer',
                }}
            >
                {/* Shadow - grows as card lifts */}
                <motion.div
                    animate={{
                        opacity: animationPhase === 'lifting' ? 0.4 : 0,
                        scale: animationPhase === 'lifting' ? 1.05 : 0.95,
                    }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        width: '100%',
                        height: '100%',
                        borderRadius: 8,
                        background: 'rgba(0,0,0,0.25)',
                        filter: 'blur(12px)',
                        zIndex: 0,
                    }}
                />

                {/* The card */}
                <motion.div
                    animate={
                        animationPhase === 'lifting' ? {
                            y: -15,
                            scale: 1.05,
                        } :
                        animationPhase === 'flying' ? {
                            y: -350,
                            scale: 0.4,
                            opacity: 0,
                        } :
                        { y: 0, scale: 1, opacity: 1 }
                    }
                    whileHover={!isSelected && animationPhase === 'idle' ? {
                        y: -6,
                        scale: 1.02,
                    } : {}}
                    transition={{
                        duration: animationPhase === 'flying' ? 0.5 : 0.3,
                        ease: [0.34, 1.2, 0.64, 1],
                    }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: animationPhase !== 'idle' ? 1000 : 1,
                    }}
                >
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            borderRadius: 2,
                            overflow: 'hidden',
                            boxShadow: animationPhase === 'lifting'
                                ? '0 15px 30px rgba(0,0,0,0.25)'
                                : isHighlighted
                                ? '0 0 0 3px #000, 0 4px 20px rgba(0,0,0,0.25)'
                                : '0 2px 8px rgba(0,0,0,0.15)',
                            transition: 'box-shadow 0.3s',
                        }}
                    >
                        {item.image ? (
                            <img
                                src={item.image}
                                alt={item.name}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                        ) : (
                            <Box sx={{ width: '100%', height: '100%', backgroundColor: item.color }} />
                        )}
                    </Box>
                </motion.div>
            </Box>

            <Typography
                variant="body2"
                sx={{
                    mt: 1,
                    fontWeight: isHighlighted ? 700 : 500,
                    textAlign: 'center',
                    fontSize: '1.4rem',
                    transition: 'font-weight 0.3s',
                }}
            >
                {item.name}
            </Typography>
            {item.sustainable && (
                <Box sx={{ mt: 0.5 }}>
                    <SustainableBadge size="small" />
                </Box>
            )}
        </Box>
    );
};

const CATERING_BOX_STORAGE_KEY = 'cateringBoxState';

// Helper to load persisted state
const loadPersistedBoxState = () => {
    try {
        const saved = localStorage.getItem(CATERING_BOX_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                selectedPackaging: parsed.selectedPackaging || null,
                placedFlavors: parsed.placedFlavors || [],
                selectedFlavorCategory: parsed.selectedFlavorCategory || 'cake',
            };
        }
    } catch (error) {
        console.error('Error loading catering box state:', error);
    }
    return null;
};

// Helper to save state to localStorage
const saveBoxState = (state) => {
    try {
        localStorage.setItem(CATERING_BOX_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error('Error saving catering box state:', error);
    }
};

// Helper to clear persisted state
const clearBoxState = () => {
    try {
        localStorage.removeItem(CATERING_BOX_STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing catering box state:', error);
    }
};

// Load persisted state once at module level for initial render
const initialPersistedState = loadPersistedBoxState();

export const CategoryListView = ({ menu, sendToCatering, editingCakeJarBox, onClearEditingCakeJarBox }) => {
    const { cateringState } = useContext(CateringLayoutContext);
    const { packagingResetCounter } = cateringState.context;

    const categories = Object.entries(menu);

    // Initialize state from localStorage or defaults
    const [selectedFlavorCategory, setSelectedFlavorCategory] = useState(
        initialPersistedState?.selectedFlavorCategory || 'cake'
    );
    const [customJars, setCustomJars] = useState(() => {
        // Load custom jars from localStorage
        try {
            const saved = localStorage.getItem('cateringCustomJars');
            if (!saved) return [];
            const parsed = JSON.parse(saved);
            // Migrate old jars - generate composition name from customizations
            return parsed.map((jar) => {
                // Generate composition name if not already set or if it's an old "Custom Jar X" format
                let displayName = jar.displayName;
                const isCookie = jar.id?.startsWith('custom-cookie-');
                if (!displayName || displayName.startsWith('Custom Jar') || displayName.startsWith('Custom Cookie')) {
                    const customizations = jar.customizations;
                    if (customizations) {
                        const parts = [];
                        if (customizations.cake) parts.push(`${customizations.cake} ${isCookie ? 'Cookie' : 'Cake'}`);
                        if (customizations.frostings?.[0]) parts.push(`${customizations.frostings[0]} Frosting`);
                        if (customizations.toppings) parts.push(...customizations.toppings);

                        if (parts.length === 1) displayName = parts[0];
                        else if (parts.length === 2) displayName = `${parts[0]} and ${parts[1]}`;
                        else if (parts.length > 2) {
                            const lastPart = parts.pop();
                            displayName = `${parts.join(', ')}, and ${lastPart}`;
                        } else {
                            displayName = 'Custom Item';
                        }
                    } else {
                        displayName = 'Custom Item';
                    }
                }
                return { ...jar, displayName, isCustom: true };
            });
        } catch {
            return [];
        }
    });
    const [selectedPackaging, setSelectedPackaging] = useState(
        initialPersistedState?.selectedPackaging || null
    );
    const [placedFlavors, setPlacedFlavors] = useState(
        initialPersistedState?.placedFlavors || []
    );
    const [selectedJarForModal, setSelectedJarForModal] = useState(null);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [customizeModalOpen, setCustomizeModalOpen] = useState(false);
    // Inline Make Your Own / Edit Jar state
    const [makeYourOwnActive, setMakeYourOwnActive] = useState(false);
    const [makeYourOwnStep, setMakeYourOwnStep] = useState(0); // 0=cake, 1=frosting, 2=topping, 3=cookie, 4=syrup
    const [makeYourOwnSelections, setMakeYourOwnSelections] = useState({
        cake: null,
        frosting: null,
        topping: null,
        cookie: null,
        syrup: null,
    });
    const [editingJar, setEditingJar] = useState(null); // The jar being customized (null = Make Your Own)
    const [editingCartItemId, setEditingCartItemId] = useState(null); // Cart item ID when editing from cart
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [showAvailabilityPage, setShowAvailabilityPage] = useState(false);
    const [pendingPackagingItem, setPendingPackagingItem] = useState(null);
    const [availabilitySelectedOption, setAvailabilitySelectedOption] = useState(null); // 'browsing' or 'earliest'
    const [showAdvancedDateSelection, setShowAdvancedDateSelection] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(() => {
        return localStorage.getItem('selectedLocation') || 'kips-bay';
    });
    const [locationModalOpen, setLocationModalOpen] = useState(false);
    const [advancedPackagingItem, setAdvancedPackagingItem] = useState(null);
    const [slotPage, setSlotPage] = useState(0); // 0 = slots 1-6, 1 = slots 7-12 (for Cookie Tray)
    const [showListView, setShowListView] = useState(false); // Toggle to full page list view
    const [addingFromListView, setAddingFromListView] = useState(false); // Track when adding cookie from list view
    const heroRef = useRef(null);
    const isInitialMount = useRef(true);
    const prevResetCounter = useRef(packagingResetCounter);

    // Persist state to localStorage whenever it changes
    useEffect(() => {
        saveBoxState({
            selectedPackaging,
            placedFlavors,
            selectedFlavorCategory,
        });
    }, [selectedPackaging, placedFlavors, selectedFlavorCategory]);

    // Sync selectedPackaging to catering machine context whenever it changes
    // This controls footer visibility in CommerceLayout
    useEffect(() => {
        console.log('[CategoryListView] useEffect syncing selectedPackaging to context:', selectedPackaging?.name || 'null');
        sendToCatering({ type: 'SET_SELECTED_PACKAGING', packaging: selectedPackaging });
    }, [selectedPackaging, sendToCatering]);

    // Persist custom jars to localStorage
    useEffect(() => {
        localStorage.setItem('cateringCustomJars', JSON.stringify(customJars));
    }, [customJars]);

    // Reset packaging selection when logo is clicked (counter increments)
    // Skip initial mount to preserve loaded state
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        // Only reset when counter actually changes
        if (prevResetCounter.current !== packagingResetCounter) {
            prevResetCounter.current = packagingResetCounter;
            setSelectedPackaging(null);
            sendToCatering({ type: 'SET_SELECTED_PACKAGING', packaging: null });
            setPlacedFlavors([]);
            setSelectedFlavorCategory('cake');
            setSlotPage(0); // Reset to first page for paginated trays
            clearBoxState(); // Also clear localStorage
            // Also close availability page and advanced date selection if open
            setShowAvailabilityPage(false);
            setPendingPackagingItem(null);
            setAvailabilitySelectedOption(null);
            setShowAdvancedDateSelection(false);
            setAdvancedPackagingItem(null);
        }
    }, [packagingResetCounter, sendToCatering]);

    // Handle editing cake jar box from cart
    useEffect(() => {
        if (editingCakeJarBox && editingCakeJarBox.jars) {
            // Find the appropriate packaging based on the first jar type
            const firstJar = editingCakeJarBox.jars[0];
            const isCookieItem = firstJar?.id?.includes('cookie') || firstJar?.isBaseCookie || firstJar?.isFrostedCookie;

            let targetPackaging;
            if (isCookieItem) {
                // Check if it's a Cookie Tray (12 items) or Cookies box (6 items)
                targetPackaging = editingCakeJarBox.jars.length === 12
                    ? PACKAGING.find(p => p.name === 'Cookie Tray')
                    : PACKAGING.find(p => p.name === 'Cookies');
            } else {
                targetPackaging = PACKAGING.find(p => p.name === 'Cake Jar Boxes');
            }

            if (targetPackaging) {
                setSelectedPackaging(targetPackaging);
                sendToCatering({ type: 'SET_SELECTED_PACKAGING', packaging: targetPackaging });
                // Store the cart item ID for updating later
                setEditingCartItemId(editingCakeJarBox.cartItemId);
                // Restore the jars with slot indices
                const restoredJars = editingCakeJarBox.jars.map((jar, index) => ({
                    ...jar,
                    slotIndex: index,
                    id: jar.id || `restored-${index}-${Date.now()}`,
                }));
                setPlacedFlavors(restoredJars);
                setSelectedFlavorCategory('cake');
                // Show the list view so user can see their items
                setShowListView(true);
            }
            // Clear the editing state after restoring
            if (onClearEditingCakeJarBox) {
                onClearEditingCakeJarBox();
            }
        }
    }, [editingCakeJarBox, onClearEditingCakeJarBox, sendToCatering]);

    const handleFlavorCategoryChange = (event, newCategory) => {
        if (newCategory !== null) {
            setSelectedFlavorCategory(newCategory);
        }
    };

    // Handle location change
    const handleLocationChange = (locationId) => {
        setSelectedLocation(locationId);
        localStorage.setItem('selectedLocation', locationId);
    };

    // Open the availability page when clicking Explore
    const handleExploreClick = (packaging) => {
        console.log('[CategoryListView] handleExploreClick called:', packaging?.name);
        setPendingPackagingItem(packaging);
        setAvailabilitySelectedOption('quickest'); // Pre-select quickest option
        setShowAvailabilityPage(true);
        // Set selectedPackaging immediately to hide footer on availability page
        setSelectedPackaging(packaging);
        sendToCatering({ type: 'SET_SELECTED_PACKAGING', packaging });
    };

    const handleCloseAvailabilityPage = () => {
        setShowAvailabilityPage(false);
        setPendingPackagingItem(null);
        setAvailabilitySelectedOption(null);
        // Clear selectedPackaging when closing without continuing (restore footer)
        setSelectedPackaging(null);
        sendToCatering({ type: 'SET_SELECTED_PACKAGING', packaging: null });
    };

    const handleAvailabilityContinue = () => {
        console.log('[CategoryListView] handleAvailabilityContinue called, option:', availabilitySelectedOption, 'pendingItem:', pendingPackagingItem?.name);
        const availability = getNextAvailablePickup();
        if (availabilitySelectedOption === 'quickest') {
            console.log('[CategoryListView] Quickest option selected, calling handlePackagingSelect');
            // Quickest order - go directly to selecting cake jars with earliest time
            handlePackagingSelect(pendingPackagingItem, {
                date: availability.pickupTime,
                time: `${availability.pickupTime.getHours().toString().padStart(2, '0')}:${availability.pickupTime.getMinutes().toString().padStart(2, '0')}`
            });
            setShowAvailabilityPage(false);
            setPendingPackagingItem(null);
            setAvailabilitySelectedOption(null);
        } else if (availabilitySelectedOption === 'future') {
            console.log('[CategoryListView] Future option selected, calling handleAdvancedCustomization');
            // Future customizations - go to date/time selection page
            handleAdvancedCustomization(pendingPackagingItem);
            setShowAvailabilityPage(false);
            setPendingPackagingItem(null);
            setAvailabilitySelectedOption(null);
        } else {
            console.log('[CategoryListView] No option selected! availabilitySelectedOption is:', availabilitySelectedOption);
        }
    };

    // Handle advanced customization - show date/time selection page
    const handleAdvancedCustomization = (packaging) => {
        setAdvancedPackagingItem(packaging);
        setShowAdvancedDateSelection(true);
        setSelectedDate(null);
        setSelectedTime(null);
    };

    const handleBackFromAdvancedDateSelection = () => {
        setShowAdvancedDateSelection(false);
        setAdvancedPackagingItem(null);
        setSelectedDate(null);
        setSelectedTime(null);
    };

    const handleAdvancedDateChange = (newDate) => {
        setSelectedDate(newDate);
        setSelectedTime(null);
    };

    const handleAdvancedTimeSelect = (time) => {
        setSelectedTime(time);
    };

    const handleAdvancedContinue = () => {
        if (advancedPackagingItem && selectedDate && selectedTime) {
            handlePackagingSelect(advancedPackagingItem, { date: selectedDate, time: selectedTime });
            setShowAdvancedDateSelection(false);
            setAdvancedPackagingItem(null);
        }
    };

    // Generate time slots for advanced selection
    const generateTimeSlots = () => {
        const slots = [];
        for (let hour = 8; hour <= 20; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                if (hour === 20 && minute > 0) break;
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

    const handlePackagingSelect = (packaging, dateTimeInfo) => {
        console.log('[CategoryListView] Selecting packaging:', packaging?.name, packaging?.slotCount);
        setSelectedPackaging(packaging);
        sendToCatering({ type: 'SET_SELECTED_PACKAGING', packaging });
        console.log('[CategoryListView] Sent SET_SELECTED_PACKAGING to context');
        // Store the selected date/time from the modal
        if (dateTimeInfo?.date) {
            setSelectedDate(dateTimeInfo.date);
        }
        if (dateTimeInfo?.time) {
            setSelectedTime(dateTimeInfo.time);
        }
        // Clear placed flavors when changing packaging
        setPlacedFlavors([]);
        // Scroll to top when entering packaging flow
        window.scrollTo(0, 0);
        // Set default flavor category to first available for this packaging
        const categories = FLAVOR_CATEGORIES_BY_PACKAGING[packaging.name] || [];
        if (categories.length > 0) {
            setSelectedFlavorCategory(categories[0].id);
        }
    };

    const handleRemoveFromSlot = (slotIndex) => {
        setPlacedFlavors(prev => {
            // Remove the item at the slot
            const filtered = prev.filter(f => f.slotIndex !== slotIndex);
            // Re-index remaining items to fill gaps (shift down)
            return filtered
                .sort((a, b) => a.slotIndex - b.slotIndex)
                .map((f, index) => ({ ...f, slotIndex: index }));
        });
        // Keep the user in list view so they can continue removing items
        setShowListView(true);
    };

    const handleDeleteCustomJar = (jar) => {
        // Remove from customJars list
        setCustomJars(prev => prev.filter(j => j.id !== jar.id));
        // Remove from box if placed
        setPlacedFlavors(prev => prev.filter(f => f.id !== jar.id));
    };

    // Generate composition name from customizations (e.g., "Vanilla Cake, Tres Leches Frosting, and Chocolate Crunch")
    const getCompositionName = (customizations, isCookie = false) => {
        if (!customizations) return 'Custom Item';

        const parts = [];

        // Add base (cake for jars, cookie for cookies) with label
        if (customizations.cake) {
            parts.push(`${customizations.cake} ${isCookie ? 'Cookie' : 'Cake'}`);
        }

        // Add frosting with label
        if (customizations.frostings && customizations.frostings.length > 0) {
            parts.push(`${customizations.frostings[0]} Frosting`);
        }

        // Add toppings (no label needed)
        if (customizations.toppings && customizations.toppings.length > 0) {
            parts.push(...customizations.toppings);
        }

        // Format with commas and "and"
        if (parts.length === 0) return 'Custom Item';
        if (parts.length === 1) return parts[0];
        if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;

        const lastPart = parts.pop();
        return `${parts.join(', ')}, and ${lastPart}`;
    };

    const handleOpenJarModal = (flavor) => {
        // Create a temporary jar object for the modal
        const jarObj = {
            ...flavor,
            id: flavor.id || `${flavor.name}-${Date.now()}`,
        };
        setSelectedJarForModal(jarObj);

        // Make Your Own goes to inline flow on page
        if ((flavor.name === 'Make Your Own Cake Jar' || flavor.name === 'Make Your Own Cookie') && !flavor.isCustom) {
            // Reset selections and activate inline Make Your Own
            setMakeYourOwnSelections({
                cake: null,
                frosting: null,
                topping: null,
                cookie: null,
                syrup: null,
            });
            setMakeYourOwnStep(0);
            setEditingJar(null);
            setMakeYourOwnActive(true);
        } else if (flavor.isCustom) {
            // Custom jars (Custom Jar 1, etc.) - open preview modal first
            setPreviewModalOpen(true);
        } else {
            // Regular/pre-canned jars (Chocolate Meltdown, etc.) - open preview modal (no customization)
            setPreviewModalOpen(true);
        }
    };

    const handleClosePreviewModal = () => {
        setPreviewModalOpen(false);
        setSelectedJarForModal(null);
    };

    const handleOpenCustomizeModal = () => {
        // Check if this is a custom jar - use inline flow
        if (selectedJarForModal?.isCustom) {
            const jarCustomizations = selectedJarForModal.customizations || {};
            setMakeYourOwnSelections({
                cake: jarCustomizations.cake || null,
                frosting: jarCustomizations.frostings?.[0] || null,
                topping: jarCustomizations.toppings?.[0] || null,
                cookie: jarCustomizations.cookies?.[0] || null,
                syrup: jarCustomizations.syrups?.[0] || null,
            });
            setMakeYourOwnStep(0);
            setEditingJar(selectedJarForModal);
            setPreviewModalOpen(false);
            setMakeYourOwnActive(true);
        } else {
            // Transition from preview to customize modal for regular jars
            setPreviewModalOpen(false);
            setCustomizeModalOpen(true);
        }
    };

    const handleCloseCustomizeModal = () => {
        setCustomizeModalOpen(false);
        setSelectedJarForModal(null);
    };

    // Inline Make Your Own handlers
    const handleMakeYourOwnSelect = (type, value) => {
        setMakeYourOwnSelections(prev => ({ ...prev, [type]: value }));
    };

    // For cookies: 3 steps (cookie base, frosting, topping)
    // For cake jars: 5 steps (cake, frosting, topping, cookies, syrup)
    const isCookiePackaging = selectedPackaging?.name === 'Cookies' || selectedPackaging?.name === 'Cookie Tray';
    const maxMakeYourOwnStep = isCookiePackaging ? 2 : 4;

    // For cookie packaging, show list view only after at least one cookie is added
    // This way, selecting Cookie Tray goes directly to cookie selection (better UX)
    useEffect(() => {
        if (isCookiePackaging && placedFlavors.length > 0) {
            setShowListView(true);
        } else if (isCookiePackaging && placedFlavors.length === 0) {
            setShowListView(false);
        }
    }, [isCookiePackaging, placedFlavors.length]);

    const handleMakeYourOwnContinue = () => {
        if (makeYourOwnStep < maxMakeYourOwnStep) {
            setMakeYourOwnStep(prev => prev + 1);
        }
    };

    const handleMakeYourOwnBack = () => {
        if (makeYourOwnStep > 0) {
            setMakeYourOwnStep(prev => prev - 1);
        } else {
            // Exit Make Your Own mode
            setMakeYourOwnActive(false);
        }
    };

    const handleMakeYourOwnAddToBox = () => {
        if (editingJar) {
            const newCustomizations = {
                cake: makeYourOwnSelections.cake,
                frostings: makeYourOwnSelections.frosting ? [makeYourOwnSelections.frosting] : [],
                toppings: makeYourOwnSelections.topping ? [makeYourOwnSelections.topping] : [],
                cookies: makeYourOwnSelections.cookie ? [makeYourOwnSelections.cookie] : [],
                syrups: makeYourOwnSelections.syrup ? [makeYourOwnSelections.syrup] : [],
            };
            const newColor = FROSTINGS.find(f => f.name === makeYourOwnSelections.frosting)?.color || editingJar.color;

            // If editing a custom jar, update the original jar in customJars
            if (editingJar.isCustom) {
                const updatedJar = {
                    ...editingJar,
                    color: newColor,
                    customizations: newCustomizations,
                };

                // Update the original custom jar
                setCustomJars(prev => prev.map(jar =>
                    jar.id === editingJar.id ? updatedJar : jar
                ));

                // Also update any existing placements of this jar in the box
                setPlacedFlavors(prev => prev.map(f =>
                    f.id === editingJar.id ? { ...f, color: newColor, customizations: newCustomizations } : f
                ));

                // Add another copy to the box if there's room
                const maxSlots = selectedPackaging?.slotCount || 6;
                setPlacedFlavors(prev => {
                    if (prev.length >= maxSlots) return prev;

                    const usedSlots = prev.map(f => f.slotIndex);
                    let nextSlot = 0;
                    for (let i = 0; i < maxSlots; i++) {
                        if (!usedSlots.includes(i)) {
                            nextSlot = i;
                            break;
                        }
                    }

                    return [...prev, { ...updatedJar, placementId: `${updatedJar.id}-slot-${nextSlot}`, slotIndex: nextSlot }];
                });
            } else {
                // Editing a regular jar (A'mour S'more, etc.) - add customized version to box
                const customizedJar = {
                    ...editingJar,
                    id: `${editingJar.name}-${Date.now()}`,
                    color: newColor,
                    customizations: newCustomizations,
                };

                // Add to box if there's room
                const maxSlots = selectedPackaging?.slotCount || 6;
                setPlacedFlavors(prev => {
                    if (prev.length >= maxSlots) return prev;

                    const usedSlots = prev.map(f => f.slotIndex);
                    let nextSlot = 0;
                    for (let i = 0; i < maxSlots; i++) {
                        if (!usedSlots.includes(i)) {
                            nextSlot = i;
                            break;
                        }
                    }

                    return [...prev, { ...customizedJar, slotIndex: nextSlot }];
                });
            }
        } else {
            // Make Your Own - create new custom jar or cookie
            const newCustomizations = {
                cake: makeYourOwnSelections.cake,
                frostings: makeYourOwnSelections.frosting ? [makeYourOwnSelections.frosting] : [],
                toppings: makeYourOwnSelections.topping ? [makeYourOwnSelections.topping] : [],
                cookies: makeYourOwnSelections.cookie ? [makeYourOwnSelections.cookie] : [],
                syrups: makeYourOwnSelections.syrup ? [makeYourOwnSelections.syrup] : [],
            };

            // Check if a custom item with the same customizations already exists
            const existingItem = customJars.find(jar => {
                if (!jar.customizations) return false;
                return (
                    jar.customizations.cake === newCustomizations.cake &&
                    JSON.stringify(jar.customizations.frostings) === JSON.stringify(newCustomizations.frostings) &&
                    JSON.stringify(jar.customizations.toppings) === JSON.stringify(newCustomizations.toppings) &&
                    JSON.stringify(jar.customizations.cookies) === JSON.stringify(newCustomizations.cookies) &&
                    JSON.stringify(jar.customizations.syrups) === JSON.stringify(newCustomizations.syrups)
                );
            });

            let itemToAdd;

            if (existingItem) {
                // Use the existing item instead of creating a duplicate
                itemToAdd = existingItem;
            } else {
                // Create new custom item
                const frostingColor = isCookiePackaging
                    ? COOKIE_FROSTINGS.find(f => f.name === makeYourOwnSelections.frosting)?.color
                    : FROSTINGS.find(f => f.name === makeYourOwnSelections.frosting)?.color;

                const newCustomItem = {
                    id: isCookiePackaging ? `custom-cookie-${Date.now()}` : `custom-jar-${Date.now()}`,
                    name: isCookiePackaging ? 'Make Your Own Cookie' : 'Make Your Own Cake Jar',
                    image: null,
                    color: frostingColor || '#FFD700',
                    glutenFree: false,
                    vegan: false,
                    isCustom: true,
                    customizations: newCustomizations,
                };

                // Generate composition name from customizations
                const compositionName = getCompositionName(newCustomItem.customizations, isCookiePackaging);
                itemToAdd = { ...newCustomItem, displayName: compositionName };

                // Add to custom jars/cookies list (only if new)
                setCustomJars(prev => [...prev, itemToAdd]);
            }

            // Add to box if there's room
            const maxSlots = selectedPackaging?.slotCount || 6;
            setPlacedFlavors(prev => {
                if (prev.length >= maxSlots) return prev;

                const usedSlots = prev.map(f => f.slotIndex);
                let nextSlot = 0;
                for (let i = 0; i < maxSlots; i++) {
                    if (!usedSlots.includes(i)) {
                        nextSlot = i;
                        break;
                    }
                }

                return [...prev, { ...itemToAdd, slotIndex: nextSlot }];
            });
        }

        // Exit Make Your Own mode and clear editing state
        setMakeYourOwnActive(false);
        setEditingJar(null);
        // Navigate to list view to show the box contents
        setShowListView(true);
    };

    // Handle adding completed box to cart with date/time (already selected from availability modal)
    const handleAddBoxToCart = () => {
        if (!isBoxComplete) return;

        // If editing an existing cart item, remove it first
        if (editingCartItemId) {
            sendToCatering({
                type: 'REMOVE_ITEM',
                cartItemId: editingCartItemId,
            });
        }

        // Determine item details based on packaging type
        const slotCount = selectedPackaging?.slotCount || 6;
        const packagingPrice = selectedPackaging?.price || 50;
        let itemId, itemName;

        if (selectedPackaging?.name === 'Cookie Tray') {
            itemId = `cookie-tray-${Date.now()}`;
            itemName = `Cookie Tray (${slotCount} Cookies)`;
        } else if (isCookiePackaging) {
            itemId = `cookie-box-${Date.now()}`;
            itemName = `Cookie Box (${slotCount} Cookies)`;
        } else {
            itemId = `cake-jar-box-${Date.now()}`;
            itemName = `Cake Jar Box (${slotCount} Jars)`;
        }

        // Create a cart item for the Box
        const boxItem = {
            'Item ID': itemId,
            'Item Name': itemName,
            'Item Price': packagingPrice,
            'Item Image': selectedPackaging?.heroImage,
            // Store the items data for display and order processing
            jars: placedFlavors.map(item => ({
                name: item.name,
                displayName: item.displayName,
                image: item.image,
                color: item.color,
                glutenFree: item.glutenFree,
                vegan: item.vegan,
                customizations: item.customizations,
                isCustom: item.isCustom,
            })),
            // Store fulfillment date/time
            fulfillmentDate: selectedDate?.toISOString(),
            fulfillmentTime: selectedTime,
        };

        // Send to cart via XState
        sendToCatering({
            type: 'ADD_TO_CART',
            item: boxItem,
            selectedModifiers: {},
            quantity: 1,
        });

        // Reset everything
        setSelectedDate(null);
        setSelectedTime(null);
        setPlacedFlavors([]);
        setSelectedPackaging(null);
        sendToCatering({ type: 'SET_SELECTED_PACKAGING', packaging: null });
        setSelectedFlavorCategory('cake');
        setEditingCartItemId(null); // Clear editing state
        clearBoxState();

        // Open cart drawer to show the added item
        sendToCatering({ type: 'OPEN_CART_DRAWER' });
    };

    const handleSaveJarCustomizations = (updatedJar, quantity = 1) => {
        // Check if this is an existing custom jar being edited
        if (updatedJar.isCustom) {
            // Update existing custom jar in the customJars list
            setCustomJars(prev => prev.map(jar =>
                jar.id === updatedJar.id
                    ? { ...updatedJar }
                    : jar
            ));

            // Always add copies to the box based on quantity (user can fill box with same custom item)
            const isSlotBasedPkg = selectedPackaging?.name === 'Cake Jar Boxes' || isCookiePackaging;
            if (isSlotBasedPkg) {
                const maxSlots = selectedPackaging?.slotCount || 6;
                setPlacedFlavors(prev => {
                    if (prev.length >= maxSlots) return prev; // Box/Tray is full

                    const newPlacements = [];
                    const usedSlots = [...prev.map(f => f.slotIndex)];

                    for (let q = 0; q < quantity && (prev.length + newPlacements.length) < maxSlots; q++) {
                        // Find next empty slot
                        let nextSlot = 0;
                        for (let i = 0; i < maxSlots; i++) {
                            if (!usedSlots.includes(i)) {
                                nextSlot = i;
                                usedSlots.push(i); // Mark as used for next iteration
                                break;
                            }
                        }

                        // Create a new placement with unique ID for each slot
                        newPlacements.push({
                            ...updatedJar,
                            placementId: `${updatedJar.id}-slot-${nextSlot}-${Date.now()}-${q}`,
                            slotIndex: nextSlot
                        });
                    }

                    return [...prev, ...newPlacements];
                });
            }
        } else if (updatedJar.name === 'Make Your Own Cake Jar' || updatedJar.name === 'Make Your Own Cookie') {
            // Creating a new custom item from "Make Your Own"
            const isCookie = updatedJar.name === 'Make Your Own Cookie';
            const compositionName = getCompositionName(updatedJar.customizations, isCookie);
            const customItem = {
                ...updatedJar,
                id: `custom-${isCookie ? 'cookie' : 'jar'}-${Date.now()}`,
                displayName: compositionName,
                isCustom: true,
            };

            // Add to custom items list
            setCustomJars(prev => [...prev, customItem]);

            // For slot-based packaging (Cake Jar Boxes, Cookies, Cookie Tray), add to slot
            const isSlotBased = selectedPackaging?.name === 'Cake Jar Boxes' || isCookiePackaging;
            if (isSlotBased) {
                const maxSlots = selectedPackaging?.slotCount || 6;
                if (placedFlavors.length >= maxSlots) return;

                const usedSlots = placedFlavors.map(f => f.slotIndex);
                let nextSlot = 0;
                for (let i = 0; i < maxSlots; i++) {
                    if (!usedSlots.includes(i)) {
                        nextSlot = i;
                        break;
                    }
                }

                setPlacedFlavors(prev => [...prev, { ...customItem, slotIndex: nextSlot }]);
            }
        } else {
            // For slot-based packaging (Cake Jar Boxes, Cookies, Cookie Tray), find empty slots and add items
            const isSlotBased = selectedPackaging?.name === 'Cake Jar Boxes' || isCookiePackaging;
            if (isSlotBased) {
                const maxSlots = selectedPackaging?.slotCount || 6;

                setPlacedFlavors(prev => {
                    if (prev.length >= maxSlots) return prev; // Box/Tray is full

                    const newPlacements = [];
                    const usedSlots = [...prev.map(f => f.slotIndex)];

                    for (let q = 0; q < quantity && (prev.length + newPlacements.length) < maxSlots; q++) {
                        // Find next empty slot
                        let nextSlot = 0;
                        for (let i = 0; i < maxSlots; i++) {
                            if (!usedSlots.includes(i)) {
                                nextSlot = i;
                                usedSlots.push(i); // Mark as used for next iteration
                                break;
                            }
                        }

                        newPlacements.push({
                            ...updatedJar,
                            placementId: `${updatedJar.id}-slot-${nextSlot}-${Date.now()}-${q}`,
                            slotIndex: nextSlot,
                        });
                    }

                    return [...prev, ...newPlacements];
                });
            } else {
                // For other packaging types, use random positioning
                const newPlacement = {
                    ...updatedJar,
                    x: Math.random() * 60 + 20,
                    y: Math.random() * 40 + 30,
                    rotation: Math.random() * 20 - 10,
                };
                setPlacedFlavors(prev => [...prev, newPlacement]);
            }
        }

        // If we were adding from list view, return to list view
        if (addingFromListView) {
            setShowListView(true);
            setAddingFromListView(false);
        }
    };

    const currentFlavors = FLAVORS[selectedFlavorCategory] || [];

    // Filter custom items based on packaging type (cookies vs jars)
    const filteredCustomItems = customJars.filter(item => {
        if (isCookiePackaging) {
            return item.id?.startsWith('custom-cookie-');
        } else {
            return item.id?.startsWith('custom-jar-');
        }
    });

    // Check if the box/tray is complete (based on slotCount)
    const isSlotBasedPackaging = selectedPackaging?.name === 'Cake Jar Boxes' || isCookiePackaging;
    const totalSlots = selectedPackaging?.slotCount || 6;
    const isBoxComplete = isSlotBasedPackaging && placedFlavors.length === totalSlots;

    // Check if a flavor is already placed
    const isFlavorPlaced = (flavorId) => {
        return placedFlavors.some(f => f.id === flavorId);
    };

    // Get all products from all categories for featured section
    const allProducts = categories.flatMap(([categoryName, categoryData]) =>
        (categoryData.items || []).map(item => ({ ...item, categoryName }))
    );

    // Featured products - first 6 items (or however many exist)
    const featuredProducts = allProducts.slice(0, 6);

    const handleProductClick = (item) => {
        // First select the category
        sendToCatering({ type: 'SELECT_CATEGORY', category: item.categoryName });

        // Then view the item
        setTimeout(() => {
            const hasModifiers = item.ModifierCategories && item.ModifierCategories.length > 0;
            if (hasModifiers) {
                sendToCatering({ type: 'EDIT_ITEM', item });
            } else {
                sendToCatering({ type: 'VIEW_ITEM', item });
            }
        }, 50);
    };

    // Show Availability Page (earliest pickup/delivery selection)
    if (showAvailabilityPage) {
        const availability = getNextAvailablePickup();
        const currentLocationName = STORE_LOCATIONS.find(loc => loc.id === selectedLocation)?.name || 'Select Location';

        return (
            <Box sx={{ backgroundColor: 'white' }}>
                {/* Location Selector - only on availability page */}
                <Box
                    sx={{
                        py: 2,
                        px: 3,
                        display: 'flex',
                        justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                    onClick={() => setLocationModalOpen(true)}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }}>
                            {currentLocationName}
                        </Typography>
                        <KeyboardArrowDownIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
                    </Box>
                </Box>

                <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
                    {/* Earliest Pickup & Delivery Times - Two Column */}
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 2,
                            mb: 3,
                        }}
                    >
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography
                                sx={{
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    color: 'text.secondary',
                                    mb: 1,
                                }}
                            >
                                Earliest Pickup {isToday(availability.pickupTime) ? 'Today' : isTomorrow(availability.pickupTime) ? 'Tomorrow' : format(availability.pickupTime, 'EEE')}
                            </Typography>
                            <FlipClockDisplay time={availability.pickupTime} small />
                        </Box>

                        <Box sx={{ textAlign: 'center' }}>
                            <Typography
                                sx={{
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    color: 'text.secondary',
                                    mb: 1,
                                }}
                            >
                                Earliest Delivery {isToday(availability.deliveryTime) ? 'Today' : isTomorrow(availability.deliveryTime) ? 'Tomorrow' : format(availability.deliveryTime, 'EEE')}
                            </Typography>
                            <FlipClockDisplay time={availability.deliveryTime} small />
                        </Box>
                    </Box>

                    {/* Option 1: Quickest Order Delivery Time (pre-selected) */}
                    <Box
                        component="button"
                        onClick={() => setAvailabilitySelectedOption('quickest')}
                        sx={{
                            width: '100%',
                            p: 2,
                            mb: 2,
                            backgroundColor: 'white',
                            border: '2px solid',
                            borderColor: availabilitySelectedOption === 'quickest' ? 'black' : 'grey.300',
                            borderRadius: 2,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 2,
                            textAlign: 'left',
                            transition: 'all 0.2s',
                            '&:hover': {
                                borderColor: availabilitySelectedOption === 'quickest' ? 'black' : 'grey.500',
                            },
                        }}
                    >
                        {/* Radio Button */}
                        <Box
                            sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                border: '2px solid',
                                borderColor: availabilitySelectedOption === 'quickest' ? 'black' : 'grey.400',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                mt: 0.5,
                            }}
                        >
                            {availabilitySelectedOption === 'quickest' && (
                                <Box
                                    sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        backgroundColor: 'black',
                                    }}
                                />
                            )}
                        </Box>
                        {/* Content */}
                        <Box sx={{ flex: 1 }}>
                            <Typography
                                sx={{
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    color: 'text.primary',
                                    mb: 0.5,
                                }}
                            >
                                Ready Today
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: '1.6rem',
                                    color: 'text.secondary',
                                }}
                            >
                                Perfect for last-minute meetings, parties, and more! (Up to 50 people)
                            </Typography>
                        </Box>
                    </Box>

                    {/* Option 2: Make Your Next Large Event So Surreal */}
                    <Box
                        component="button"
                        onClick={() => setAvailabilitySelectedOption('future')}
                        sx={{
                            width: '100%',
                            p: 2,
                            backgroundColor: 'white',
                            border: '2px solid',
                            borderColor: availabilitySelectedOption === 'future' ? 'black' : 'grey.300',
                            borderRadius: 2,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 2,
                            textAlign: 'left',
                            transition: 'all 0.2s',
                            '&:hover': {
                                borderColor: availabilitySelectedOption === 'future' ? 'black' : 'grey.500',
                            },
                        }}
                    >
                        {/* Radio Button */}
                        <Box
                            sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                border: '2px solid',
                                borderColor: availabilitySelectedOption === 'future' ? 'black' : 'grey.400',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                mt: 0.5,
                            }}
                        >
                            {availabilitySelectedOption === 'future' && (
                                <Box
                                    sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        backgroundColor: 'black',
                                    }}
                                />
                            )}
                        </Box>
                        {/* Content */}
                        <Box sx={{ flex: 1 }}>
                            <Typography
                                sx={{
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    color: 'text.primary',
                                    mb: 0.5,
                                }}
                            >
                                Make Your Next Large Event So Surreal
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: '1.6rem',
                                    color: 'text.secondary',
                                }}
                            >
                                Personalized for your large event, our events team can help you create custom packaging for your {pendingPackagingItem?.name?.toLowerCase() || 'order'} and make sure your next event will be So Surreal!
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                {/* Sticky Footer */}
                <Box
                    sx={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 2,
                        borderTop: '1px solid',
                        borderColor: 'grey.300',
                        backgroundColor: 'white',
                        zIndex: 1300,
                        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                    }}
                >
                    <Box sx={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 1 }}>
                        {/* Close Button */}
                        <Box
                            component="button"
                            onClick={handleCloseAvailabilityPage}
                            sx={{
                                px: 2,
                                py: 1.5,
                                backgroundColor: 'white',
                                color: 'grey.700',
                                border: '1px solid',
                                borderColor: 'grey.300',
                                borderRadius: 1,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                '&:hover': {
                                    backgroundColor: 'grey.100',
                                    borderColor: 'grey.400',
                                },
                            }}
                            aria-label="Close"
                        >
                            <CloseIcon />
                        </Box>

                        {/* Continue Button */}
                        <Box
                            component="button"
                            onClick={handleAvailabilityContinue}
                            disabled={!availabilitySelectedOption}
                            sx={{
                                flex: 1,
                                py: 2,
                                px: 4,
                                backgroundColor: !availabilitySelectedOption ? 'grey.300' : 'black',
                                color: 'white',
                                border: 'none',
                                borderRadius: 1,
                                fontSize: '1.6rem',
                                fontWeight: 700,
                                cursor: !availabilitySelectedOption ? 'not-allowed' : 'pointer',
                                '&:hover': {
                                    backgroundColor: !availabilitySelectedOption ? 'grey.300' : '#333',
                                },
                            }}
                        >
                            Continue
                        </Box>
                    </Box>
                </Box>

                {/* Location Modal */}
                <LocationModal
                    open={locationModalOpen}
                    onClose={() => setLocationModalOpen(false)}
                    selectedLocationId={selectedLocation}
                    onSelectLocation={handleLocationChange}
                    locations={STORE_LOCATIONS}
                />
            </Box>
        );
    }

    // Show Advanced Date/Time Selection Page (not modal)
    if (showAdvancedDateSelection) {
        return (
            <Box sx={{ backgroundColor: 'white', minHeight: '100vh', pb: '100px' }}>
                <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
                    {/* Title */}
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            mb: 2,
                            fontSize: '2rem',
                            textAlign: 'center',
                        }}
                    >
                        {!selectedDate
                            ? 'Select a Date'
                            : `Select a Time for ${format(selectedDate, 'EEEE, MMMM do')}`}
                    </Typography>

                    {/* Step 1: Show calendar until date is selected */}
                    {!selectedDate && (
                        <>
                            <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', mb: 3, textAlign: 'center' }}>
                                Choose your preferred pickup or delivery date for advanced customizations.
                            </Typography>

                            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <DateCalendar
                                        value={selectedDate}
                                        onChange={handleAdvancedDateChange}
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
                                            maxWidth: 400,
                                            '& .MuiPickersDay-root': { fontSize: '1.6rem', width: '3.5rem', height: '3.5rem' },
                                            '& .MuiDayCalendar-weekDayLabel': { fontSize: '1.6rem', fontWeight: 'bold', width: '3.5rem', height: '3.5rem' },
                                            '& .MuiPickersCalendarHeader-root svg': { width: '2rem', height: '2rem' },
                                            '& .MuiPickersCalendarHeader-label': { fontSize: '1.6rem' },
                                        }}
                                    />
                                </LocalizationProvider>
                            </Box>
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
                                    maxWidth: 400,
                                    margin: '0 auto',
                                }}
                            >
                                {generateTimeSlots().map((slot) => (
                                    <Box
                                        key={slot.value}
                                        component="button"
                                        onClick={() => handleAdvancedTimeSelect(slot.value)}
                                        sx={{
                                            py: 1.5,
                                            px: 1,
                                            border: '2px solid',
                                            borderColor: selectedTime === slot.value ? 'black' : 'grey.300',
                                            borderRadius: 2,
                                            backgroundColor: selectedTime === slot.value ? 'black' : 'white',
                                            color: selectedTime === slot.value ? 'white' : 'text.primary',
                                            fontSize: '1.6rem',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                borderColor: 'black',
                                            }
                                        }}
                                    >
                                        {slot.label}
                                    </Box>
                                ))}
                            </Box>

                            {/* Back to date selection */}
                            <Box sx={{ mt: 3, textAlign: 'center' }}>
                                <Box
                                    component="button"
                                    onClick={() => setSelectedDate(null)}
                                    sx={{
                                        py: 1.5,
                                        px: 3,
                                        backgroundColor: 'grey.100',
                                        color: 'text.primary',
                                        border: 'none',
                                        borderRadius: 2,
                                        fontSize: '1.6rem',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        '&:hover': {
                                            backgroundColor: 'grey.200',
                                        }
                                    }}
                                >
                                    ← Change Date
                                </Box>
                            </Box>
                        </>
                    )}
                </Box>

                {/* Sticky Footer */}
                <Box
                    sx={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 2,
                        borderTop: '1px solid',
                        borderColor: 'grey.300',
                        backgroundColor: 'white',
                        zIndex: 1000,
                        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                    }}
                >
                    <Box sx={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 1 }}>
                        {/* Back Button */}
                        <Box
                            component="button"
                            onClick={handleBackFromAdvancedDateSelection}
                            sx={{
                                px: 2,
                                py: 1.5,
                                backgroundColor: 'white',
                                color: 'grey.700',
                                border: '1px solid',
                                borderColor: 'grey.300',
                                borderRadius: 1,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                '&:hover': {
                                    backgroundColor: 'grey.100',
                                    borderColor: 'grey.400',
                                },
                            }}
                            aria-label="Back"
                        >
                            <CloseIcon />
                        </Box>

                        {/* Continue Button */}
                        <Box
                            component="button"
                            onClick={handleAdvancedContinue}
                            disabled={!selectedDate || !selectedTime}
                            sx={{
                                flex: 1,
                                py: 2,
                                px: 4,
                                backgroundColor: (!selectedDate || !selectedTime) ? 'grey.300' : 'black',
                                color: 'white',
                                border: 'none',
                                borderRadius: 1,
                                fontSize: '1.6rem',
                                fontWeight: 700,
                                cursor: (!selectedDate || !selectedTime) ? 'not-allowed' : 'pointer',
                                '&:hover': {
                                    backgroundColor: (!selectedDate || !selectedTime) ? 'grey.300' : '#333',
                                },
                            }}
                        >
                            Continue
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ backgroundColor: 'white' }}>

            {/* Packaging Selection - Vertical Cards */}
            {!selectedPackaging && (
                <Box sx={{ pt: 2, pb: 4 }}>
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            color: 'black',
                            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
                            textAlign: 'center',
                            mb: 1,
                        }}
                    >
                        Looking to make your next event So Surreal?
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            color: 'text.secondary',
                            textAlign: 'center',
                            mb: 2,
                            fontSize: '1.6rem',
                        }}
                    >
                        Proudly diverse, minority, veteran, and women-owned. Let us bring your unique style to life.
                    </Typography>

                    {/* Vertical stack of packaging cards */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {PACKAGING.map((item) => (
                            <motion.div
                                key={item.name}
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleExploreClick(item)}
                                style={{ cursor: 'pointer' }}
                            >
                                <Box
                                    sx={{
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                        backgroundColor: '#f8f8f8',
                                        transition: 'box-shadow 0.3s',
                                        '&:hover': {
                                            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                                        },
                                    }}
                                >
                                    {/* Hero Image */}
                                    <Box
                                        sx={{
                                            width: '100%',
                                            height: { xs: 200, sm: 250, md: 300 },
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: 'white',
                                            p: 2,
                                        }}
                                    >
                                        {item.heroImage && (
                                            <img
                                                src={item.heroImage}
                                                alt={item.name}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain',
                                                }}
                                            />
                                        )}
                                    </Box>

                                    {/* Card Footer */}
                                    <Box
                                        sx={{
                                            p: 2,
                                            backgroundColor: 'white',
                                            borderTop: '1px solid',
                                            borderColor: 'grey.100',
                                        }}
                                    >
                                        {/* Title and Modify row */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography
                                                variant="h6"
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: '1.6rem',
                                                }}
                                            >
                                                {item.name}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    fontWeight: 600,
                                                    color: 'primary.main',
                                                    fontSize: '1.6rem',
                                                }}
                                            >
                                                Explore →
                                            </Typography>
                                        </Box>

                                        {/* Dietary badges with labels */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                            {item.sustainable && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <SustainableBadge size="small" />
                                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                                                        Sustainable
                                                    </Typography>
                                                </Box>
                                            )}
                                            {item.glutenFree && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <GlutenFreeBadge size="small" />
                                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                                                        Gluten Free
                                                    </Typography>
                                                </Box>
                                            )}
                                            {item.vegan && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <VeganBadge size="small" />
                                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                                                        Vegan
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                </Box>
                            </motion.div>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Selected Packaging Header - for non-slot-based packaging */}
            {selectedPackaging && !isSlotBasedPackaging && (
                <Box sx={{ py: 2, mb: 2 }}>
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 700,
                            textAlign: 'center',
                            fontSize: '1.6rem',
                        }}
                    >
                        {selectedPackaging.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 0.5 }}>
                        Choose your flavors
                    </Typography>
                </Box>
            )}

            {/* Show Toggle and Flavors only after packaging is selected */}
            {selectedPackaging && (
                <>
                    {/* Flavors Section OR Completed Box List OR Full Page List View */}
                    <Box sx={{
                        pt: 2,
                        pb: 4,
                        borderTop: '1px solid',
                        borderColor: 'divider'
                    }}>
                        {/* FULL PAGE LIST VIEW - shows all slots with Add Cookie CTA for empty ones */}
                        {(showListView || isBoxComplete) ? (
                            <>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                    <Typography
                                        variant="h3"
                                        component="h2"
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: { xs: '1.75rem', md: '2.25rem' },
                                        }}
                                    >
                                        {selectedPackaging?.name === 'Cookie Tray' ? 'Your Cookie Tray' :
                                         isCookiePackaging ? 'Your Cookie Box' :
                                         'Your Cake Jar Box'}
                                    </Typography>
                                </Box>

                                <Typography sx={{ mb: 3, color: 'text.secondary', fontSize: '1.4rem' }}>
                                    {placedFlavors.length}/{totalSlots} filled
                                </Typography>

                                {/* All slots list */}
                                <Box sx={{ maxWidth: 500, margin: '0 auto', pb: isBoxComplete ? 10 : 0 }}>
                                    {Array.from({ length: totalSlots }, (_, i) => i).map((slotIndex) => {
                                        const flavorInSlot = placedFlavors.find(f => f.slotIndex === slotIndex);
                                        return (
                                            <Box
                                                key={slotIndex}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    py: 2,
                                                    borderBottom: slotIndex < totalSlots - 1 ? '1px solid' : 'none',
                                                    borderColor: 'divider',
                                                }}
                                            >
                                                {/* Slot number */}
                                                <Typography sx={{ fontSize: '1.4rem', fontWeight: 600, color: 'text.secondary', minWidth: 30 }}>
                                                    {slotIndex + 1}.
                                                </Typography>

                                                {flavorInSlot ? (
                                                    /* Filled slot */
                                                    <>
                                                        {(() => {
                                                            // For custom items, render layered images
                                                            // Detect cookie vs jar by checking if base name is in BASE_COOKIES
                                                            const baseName = flavorInSlot.customizations?.cake;
                                                            const isCookieBase = baseName && BASE_COOKIES.some(c => c.name === baseName);
                                                            const isCustomCookie = flavorInSlot.isCustom && (isCookieBase || flavorInSlot.name?.includes('Cookie') || flavorInSlot.id?.includes('cookie'));
                                                            const isCustomJar = flavorInSlot.isCustom && !isCustomCookie;

                                                            if (isCustomCookie && flavorInSlot.customizations) {
                                                                const baseObj = BASE_COOKIES.find(c => c.name === baseName);
                                                                const frostingName = flavorInSlot.customizations.frostings?.[0];
                                                                const frostingObj = COOKIE_FROSTINGS.find(f => f.name === frostingName);
                                                                const toppingImages = (flavorInSlot.customizations.toppings || [])
                                                                    .map(t => COOKIE_TOPPINGS.find(top => top.name === t))
                                                                    .filter(t => t && t.image)
                                                                    .map(t => t.image);

                                                                return (
                                                                    <Box
                                                                        sx={{
                                                                            width: 50,
                                                                            height: 50,
                                                                            borderRadius: '50%',
                                                                            backgroundColor: baseObj?.color || flavorInSlot.color,
                                                                            overflow: 'hidden',
                                                                            flexShrink: 0,
                                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                                                            position: 'relative',
                                                                        }}
                                                                    >
                                                                        {/* Base cookie layer */}
                                                                        {baseObj?.image && (
                                                                            <img src={baseObj.image} alt="base" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
                                                                        )}
                                                                        {/* Frosting layer */}
                                                                        {frostingObj?.image && (
                                                                            <img src={frostingObj.image} alt="frosting" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} />
                                                                        )}
                                                                        {/* Topping layers */}
                                                                        {toppingImages.map((img, idx) => (
                                                                            <img key={idx} src={img} alt="topping" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: idx + 2 }} />
                                                                        ))}
                                                                    </Box>
                                                                );
                                                            }

                                                            // For custom cake jars, render frosting + toppings (frosting covers the cake)
                                                            if (isCustomJar && flavorInSlot.customizations) {
                                                                const frostingName = flavorInSlot.customizations.frostings?.[0];
                                                                const frostingObj = FROSTINGS.find(f => f.name === frostingName);
                                                                const toppingImages = (flavorInSlot.customizations.toppings || [])
                                                                    .map(t => AVAILABLE_TOPPINGS.find(top => top.name === t))
                                                                    .filter(t => t && t.image)
                                                                    .map(t => t.image);

                                                                return (
                                                                    <Box
                                                                        sx={{
                                                                            width: 50,
                                                                            height: 50,
                                                                            borderRadius: '50%',
                                                                            backgroundColor: frostingObj?.color || flavorInSlot.color || '#f5f0e6',
                                                                            overflow: 'hidden',
                                                                            flexShrink: 0,
                                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                                                            position: 'relative',
                                                                        }}
                                                                    >
                                                                        {/* Frosting layer (base layer for jars) */}
                                                                        {frostingObj?.image && (
                                                                            <img src={frostingObj.image} alt="frosting" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
                                                                        )}
                                                                        {/* Topping layers */}
                                                                        {toppingImages.map((img, idx) => (
                                                                            <img key={idx} src={img} alt="topping" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: idx + 1 }} />
                                                                        ))}
                                                                    </Box>
                                                                );
                                                            }

                                                            // Regular items (base cookies, frosted cookies, jars)
                                                            return (
                                                                <Box
                                                                    sx={{
                                                                        width: 50,
                                                                        height: 50,
                                                                        borderRadius: '50%',
                                                                        backgroundColor: flavorInSlot.color,
                                                                        overflow: 'hidden',
                                                                        flexShrink: 0,
                                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                                                    }}
                                                                >
                                                                    {flavorInSlot.image && (
                                                                        <img src={flavorInSlot.image} alt={flavorInSlot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    )}
                                                                </Box>
                                                            );
                                                        })()}
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
                                                                {flavorInSlot.displayName || flavorInSlot.name}
                                                            </Typography>
                                                        </Box>
                                                        <Box
                                                            component="button"
                                                            onClick={() => handleRemoveFromSlot(slotIndex)}
                                                            sx={{
                                                                width: 36,
                                                                height: 36,
                                                                borderRadius: '50%',
                                                                border: '1px solid',
                                                                borderColor: 'grey.400',
                                                                backgroundColor: 'white',
                                                                fontSize: '1.4rem',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0,
                                                                '&:hover': { backgroundColor: '#fee', borderColor: 'error.main' },
                                                            }}
                                                        >
                                                            ×
                                                        </Box>
                                                    </>
                                                ) : slotIndex === placedFlavors.length ? (
                                                    /* First empty slot - Add Cookie CTA */
                                                    <Box
                                                        component="button"
                                                        onClick={() => {
                                                            // Go to cookie selection page without sticky footer
                                                            setShowListView(false);
                                                            setAddingFromListView(true);
                                                        }}
                                                        sx={{
                                                            flex: 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 2,
                                                            py: 1.5,
                                                            px: 2,
                                                            backgroundColor: '#f9f9f9',
                                                            border: '2px dashed #ccc',
                                                            borderRadius: 2,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            '&:hover': {
                                                                backgroundColor: '#f0f0f0',
                                                                borderColor: '#999',
                                                            },
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: 40,
                                                                height: 40,
                                                                borderRadius: '50%',
                                                                backgroundColor: '#e0e0e0',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '1.5rem',
                                                                color: '#666',
                                                            }}
                                                        >
                                                            +
                                                        </Box>
                                                        <Typography sx={{ fontSize: '1.4rem', fontWeight: 600, color: '#666' }}>
                                                            {isCookiePackaging ? 'Add a Cookie' : 'Add a Cake Jar'}
                                                        </Typography>
                                                    </Box>
                                                ) : (
                                                    /* Remaining empty slots - just show as empty */
                                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.disabled', py: 1.5 }}>
                                                        —
                                                    </Typography>
                                                )}
                                            </Box>
                                        );
                                    })}
                                </Box>

                                {/* Sticky Add to Cart Button - always visible */}
                                <Box
                                    sx={{
                                        position: 'fixed',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        p: 2,
                                        backgroundColor: 'white',
                                        borderTop: '1px solid',
                                        borderColor: 'grey.300',
                                        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                                        zIndex: 1000,
                                    }}
                                >
                                    <Box sx={{ maxWidth: 500, margin: '0 auto' }}>
                                        <Box
                                            component="button"
                                            onClick={isBoxComplete ? handleAddBoxToCart : undefined}
                                            disabled={!isBoxComplete}
                                            sx={{
                                                width: '100%',
                                                py: 2,
                                                px: 4,
                                                backgroundColor: isBoxComplete ? 'black' : 'grey.300',
                                                color: isBoxComplete ? 'white' : 'grey.500',
                                                border: 'none',
                                                borderRadius: 2,
                                                fontSize: '1.6rem',
                                                fontWeight: 700,
                                                cursor: isBoxComplete ? 'pointer' : 'not-allowed',
                                                '&:hover': {
                                                    backgroundColor: isBoxComplete ? '#333' : 'grey.300',
                                                },
                                            }}
                                        >
                                            {isBoxComplete
                                                ? (editingCartItemId ? 'Update Cart' : 'Add to Cart')
                                                : `Add ${totalSlots - placedFlavors.length} More ${isCookiePackaging ? 'Cookie' : 'Jar'}${totalSlots - placedFlavors.length !== 1 ? 's' : ''}`
                                            }
                                        </Box>
                                    </Box>
                                </Box>
                            </>
                        ) : (
                            /* Flavor picker when box is not complete */
                            <>
                                {makeYourOwnActive ? (
                                    /* Inline Make Your Own UI */
                                    <Box sx={{ pb: '80px' }}>
                                        <Typography
                                            variant="h3"
                                            component="h2"
                                            sx={{
                                                fontWeight: 700,
                                                mb: 4,
                                                fontSize: { xs: '1.75rem', md: '2.25rem' },
                                                textAlign: 'center'
                                            }}
                                        >
                                            {editingJar
                                                ? (editingJar.isCustom
                                                    ? (isCookiePackaging ? 'Update Your Custom Cookie' : 'Update Your Custom Cake Jar')
                                                    : editingJar.name)
                                                : (isCookiePackaging ? 'Make Your Own Cookie' : 'Make Your Own Cake Jar')}
                                        </Typography>

                                        {/* Dynamic Preview Image - updates based on current step and selections */}
                                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                                            {(() => {
                                                // Get selected items from appropriate arrays based on packaging type
                                                const selectedBase = isCookiePackaging
                                                    ? BASE_COOKIES.find(c => c.name === makeYourOwnSelections.cake)
                                                    : CAKE_FLAVORS.find(c => c.name === makeYourOwnSelections.cake);
                                                const selectedFrosting = isCookiePackaging
                                                    ? COOKIE_FROSTINGS.find(f => f.name === makeYourOwnSelections.frosting)
                                                    : FROSTINGS.find(f => f.name === makeYourOwnSelections.frosting);
                                                const selectedTopping = isCookiePackaging
                                                    ? COOKIE_TOPPINGS.find(t => t.name === makeYourOwnSelections.topping)
                                                    : AVAILABLE_TOPPINGS.find(t => t.name === makeYourOwnSelections.topping);

                                                // For cookies: layer frosting on top of cookie
                                                // For cake jars: frosting replaces the base image
                                                let bgColor = '#f5f0e6';
                                                let baseImage = null;
                                                let frostingOverlay = null;
                                                let showTopping = false;

                                                if (isCookiePackaging) {
                                                    // Cookies: Show nothing until cookie is selected
                                                    if (selectedBase) {
                                                        baseImage = selectedBase.image;
                                                        bgColor = selectedBase.color;
                                                    }
                                                    // Layer frosting on top of cookie
                                                    if (selectedFrosting && makeYourOwnStep >= 1) {
                                                        frostingOverlay = selectedFrosting.image;
                                                    }
                                                    // Layer topping on top
                                                    if (selectedTopping?.image && makeYourOwnStep >= 2) {
                                                        showTopping = true;
                                                    }
                                                } else {
                                                    // Cake jars: Original behavior
                                                    baseImage = editingJar?.image || MAKE_YOUR_OWN_JAR.image;

                                                    if (makeYourOwnStep === 0) {
                                                        if (selectedBase) {
                                                            baseImage = selectedBase.image;
                                                            bgColor = selectedBase.color;
                                                        }
                                                    } else if (makeYourOwnStep === 1) {
                                                        if (selectedFrosting) {
                                                            baseImage = selectedFrosting.image;
                                                            bgColor = selectedFrosting.color;
                                                        } else if (selectedBase) {
                                                            baseImage = selectedBase.image;
                                                            bgColor = selectedBase.color;
                                                        }
                                                    } else {
                                                        if (selectedFrosting) {
                                                            baseImage = selectedFrosting.image;
                                                            bgColor = selectedFrosting.color;
                                                        } else if (selectedBase) {
                                                            baseImage = selectedBase.image;
                                                            bgColor = selectedBase.color;
                                                        }
                                                        if (selectedTopping?.image) {
                                                            showTopping = true;
                                                        }
                                                    }
                                                }

                                                return (
                                                    <Box
                                                        sx={{
                                                            width: 180,
                                                            height: 180,
                                                            borderRadius: '50%',
                                                            overflow: 'hidden',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                            border: '3px solid white',
                                                            backgroundColor: bgColor,
                                                            position: 'relative',
                                                        }}
                                                    >
                                                        {/* Base layer - cookie or cake/frosting */}
                                                        {baseImage && (
                                                            <img
                                                                src={baseImage}
                                                                alt="Preview"
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: 'cover',
                                                                    zIndex: 0,
                                                                }}
                                                            />
                                                        )}
                                                        {/* Frosting overlay - for cookies only */}
                                                        {frostingOverlay && (
                                                            <img
                                                                src={frostingOverlay}
                                                                alt="Frosting"
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: 'cover',
                                                                    zIndex: 1,
                                                                }}
                                                            />
                                                        )}
                                                        {/* Topping overlay */}
                                                        {showTopping && selectedTopping?.image && (
                                                            <img
                                                                src={selectedTopping.image}
                                                                alt="Topping"
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: 'cover',
                                                                    zIndex: 2,
                                                                }}
                                                            />
                                                        )}
                                                    </Box>
                                                );
                                            })()}
                                        </Box>

                                        {/* Step 0: Select Cake/Cookie Base */}
                                        {makeYourOwnStep === 0 && (
                                            <Box>
                                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 2, textAlign: 'center' }}>
                                                    {isCookiePackaging ? 'Select Your Cookie' : 'Select Your Cake'}
                                                </Typography>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, maxWidth: '350px', margin: '0 auto' }}>
                                                    {(isCookiePackaging ? BASE_COOKIES : CAKE_FLAVORS).map((item) => (
                                                        <Box
                                                            key={item.name}
                                                            onClick={() => handleMakeYourOwnSelect('cake', item.name)}
                                                            sx={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    width: 80,
                                                                    height: 80,
                                                                    borderRadius: '50%',
                                                                    overflow: 'hidden',
                                                                    border: makeYourOwnSelections.cake === item.name ? `3px solid ${item.color}` : '3px solid white',
                                                                    boxShadow: makeYourOwnSelections.cake === item.name ? `0 0 0 2px ${item.color}` : '0 2px 8px rgba(0,0,0,0.15)',
                                                                    transition: 'all 0.2s',
                                                                }}
                                                            >
                                                                <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </Box>
                                                            <Typography sx={{ fontSize: '1.4rem', mt: 1, textAlign: 'center' }}>{item.name}</Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

                                        {/* Step 1: Select Frosting */}
                                        {makeYourOwnStep === 1 && (
                                            <Box>
                                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 2, textAlign: 'center' }}>
                                                    Select Your Frosting
                                                </Typography>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, maxWidth: '350px', margin: '0 auto' }}>
                                                    {(isCookiePackaging ? COOKIE_FROSTINGS : FROSTINGS).map((frosting) => (
                                                        <Box
                                                            key={frosting.name}
                                                            onClick={() => handleMakeYourOwnSelect('frosting', frosting.name)}
                                                            sx={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    width: 80,
                                                                    height: 80,
                                                                    borderRadius: '50%',
                                                                    overflow: 'hidden',
                                                                    backgroundColor: 'white',
                                                                    border: `3px solid ${frosting.color}`,
                                                                    boxShadow: makeYourOwnSelections.frosting === frosting.name ? `0 0 0 2px ${frosting.color}` : '0 2px 8px rgba(0,0,0,0.15)',
                                                                    transition: 'all 0.2s',
                                                                }}
                                                            >
                                                                {frosting.image && <img src={frosting.image} alt={frosting.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                            </Box>
                                                            <Typography sx={{ fontSize: '1.4rem', mt: 1, textAlign: 'center' }}>{frosting.name}</Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

                                        {/* Step 2: Select Topping (Optional) */}
                                        {makeYourOwnStep === 2 && (
                                            <Box>
                                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 2, textAlign: 'center' }}>
                                                    Add Topping <Typography component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>(Optional)</Typography>
                                                </Typography>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, maxWidth: '350px', margin: '0 auto' }}>
                                                    {(isCookiePackaging ? COOKIE_TOPPINGS : AVAILABLE_TOPPINGS).map((topping) => (
                                                        <Box
                                                            key={topping.name}
                                                            component="button"
                                                            onClick={() => handleMakeYourOwnSelect('topping', makeYourOwnSelections.topping === topping.name ? null : topping.name)}
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1,
                                                                px: 1.5,
                                                                py: 1,
                                                                border: makeYourOwnSelections.topping === topping.name ? '2px solid black' : '1px solid #e0e0e0',
                                                                borderRadius: 2,
                                                                backgroundColor: makeYourOwnSelections.topping === topping.name ? '#f5f5f5' : 'white',
                                                                cursor: 'pointer',
                                                                fontSize: '1.4rem',
                                                                textAlign: 'left',
                                                            }}
                                                        >
                                                            {topping.name}
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

                                        {/* Step 3: Select Cookie (Optional) */}
                                        {makeYourOwnStep === 3 && (
                                            <Box>
                                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 2, textAlign: 'center' }}>
                                                    Add Cookie <Typography component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>(Optional)</Typography>
                                                </Typography>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, maxWidth: '350px', margin: '0 auto' }}>
                                                    {AVAILABLE_COOKIES.map((cookie) => (
                                                        <Box
                                                            key={cookie}
                                                            component="button"
                                                            onClick={() => handleMakeYourOwnSelect('cookie', makeYourOwnSelections.cookie === cookie ? null : cookie)}
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1,
                                                                px: 1.5,
                                                                py: 1,
                                                                border: makeYourOwnSelections.cookie === cookie ? '2px solid black' : '1px solid #e0e0e0',
                                                                borderRadius: 2,
                                                                backgroundColor: makeYourOwnSelections.cookie === cookie ? '#f5f5f5' : 'white',
                                                                cursor: 'pointer',
                                                                fontSize: '1.4rem',
                                                                textAlign: 'left',
                                                            }}
                                                        >
                                                            {cookie}
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

                                        {/* Step 4: Select Syrup (Optional) */}
                                        {makeYourOwnStep === 4 && (
                                            <Box>
                                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 2, textAlign: 'center' }}>
                                                    Add Syrup <Typography component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>(Optional)</Typography>
                                                </Typography>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, maxWidth: '350px', margin: '0 auto' }}>
                                                    {AVAILABLE_SYRUPS.map((syrup) => (
                                                        <Box
                                                            key={syrup}
                                                            component="button"
                                                            onClick={() => handleMakeYourOwnSelect('syrup', makeYourOwnSelections.syrup === syrup ? null : syrup)}
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1,
                                                                px: 1.5,
                                                                py: 1,
                                                                border: makeYourOwnSelections.syrup === syrup ? '2px solid black' : '1px solid #e0e0e0',
                                                                borderRadius: 2,
                                                                backgroundColor: makeYourOwnSelections.syrup === syrup ? '#f5f5f5' : 'white',
                                                                cursor: 'pointer',
                                                                fontSize: '1.4rem',
                                                                textAlign: 'left',
                                                            }}
                                                        >
                                                            {syrup}
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

                                        {/* Sticky Continue/Add to Box Button */}
                                        <Box
                                            sx={{
                                                position: 'fixed',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                p: 2,
                                                backgroundColor: 'white',
                                                borderTop: '1px solid #e0e0e0',
                                                zIndex: 100,
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', gap: 1.5, maxWidth: '400px', margin: '0 auto' }}>
                                                {/* X button to exit */}
                                                <Box
                                                    component="button"
                                                    onClick={() => { setMakeYourOwnActive(false); setEditingJar(null); }}
                                                    sx={{
                                                        py: 1.5,
                                                        px: 2,
                                                        backgroundColor: 'white',
                                                        color: 'black',
                                                        border: '2px solid #e0e0e0',
                                                        borderRadius: 2,
                                                        fontSize: '1.6rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        '&:hover': {
                                                            borderColor: '#999',
                                                        },
                                                    }}
                                                    aria-label="Exit Make Your Own"
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                                    </svg>
                                                </Box>
                                                {makeYourOwnStep < maxMakeYourOwnStep ? (
                                                    <Box
                                                        component="button"
                                                        onClick={handleMakeYourOwnContinue}
                                                        disabled={(makeYourOwnStep === 0 && !makeYourOwnSelections.cake) || (makeYourOwnStep === 1 && !makeYourOwnSelections.frosting)}
                                                        sx={{
                                                            flex: 1,
                                                            py: 1.5,
                                                            px: 3,
                                                            backgroundColor: ((makeYourOwnStep === 0 && !makeYourOwnSelections.cake) || (makeYourOwnStep === 1 && !makeYourOwnSelections.frosting)) ? '#ccc' : 'black',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 2,
                                                            fontSize: '1.6rem',
                                                            fontWeight: 600,
                                                            cursor: ((makeYourOwnStep === 0 && !makeYourOwnSelections.cake) || (makeYourOwnStep === 1 && !makeYourOwnSelections.frosting)) ? 'not-allowed' : 'pointer',
                                                        }}
                                                    >
                                                        Continue
                                                    </Box>
                                                ) : (
                                                    <Box
                                                        component="button"
                                                        onClick={handleMakeYourOwnAddToBox}
                                                        sx={{
                                                            flex: 1,
                                                            py: 1.5,
                                                            px: 3,
                                                            backgroundColor: 'black',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 2,
                                                            fontSize: '1.6rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        {editingJar ? (isCookiePackaging ? 'Update Cookie' : 'Update Cake Jar') : 'Add to Box'}
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    </Box>
                                ) : (
                                    /* Normal flavor picker */
                                    <>
                                        <Typography
                                            variant="h3"
                                            component="h2"
                                            sx={{
                                                fontWeight: 700,
                                                marginBottom: '.8rem !important',
                                                fontSize: { xs: '1.75rem', md: '2.25rem' },
                                                textAlign: 'center'
                                            }}
                                        >
                                            {isCookiePackaging ? 'Add a Cookie' : 'Add a Cake Jar'}
                                        </Typography>

                                        {/* Legend */}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        gap: 3,
                                        mb: 2
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <GlutenFreeBadge size="small" />
                                        <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                                            Gluten Free
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <VeganBadge size="small" />
                                        <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                                            Vegan
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* Category Anchor Links - only show if more than one category or custom items exist */}
                                {((FLAVOR_CATEGORIES_BY_PACKAGING[selectedPackaging?.name] || []).length > 1 || filteredCustomItems.length > 0) && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                                    {/* Your Jars/Cookies link - only show when custom items exist */}
                                    {filteredCustomItems.length > 0 && (
                                        <Box
                                            component="a"
                                            href="#your-jars-section"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                document.getElementById('your-jars-section')?.scrollIntoView({ behavior: 'smooth' });
                                            }}
                                            sx={{
                                                px: 3,
                                                py: 1,
                                                textTransform: 'none',
                                                fontSize: '1.4rem',
                                                fontWeight: 500,
                                                border: '1px solid',
                                                borderColor: 'grey.300',
                                                borderRadius: 1,
                                                textDecoration: 'none',
                                                color: 'black',
                                                backgroundColor: 'white',
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    backgroundColor: 'grey.100',
                                                },
                                            }}
                                        >
                                            {isCookiePackaging ? 'Your Cookies' : 'Your Jars'}
                                        </Box>
                                    )}
                                    {(FLAVOR_CATEGORIES_BY_PACKAGING[selectedPackaging?.name] || []).map((category) => (
                                        <Box
                                            key={category.id}
                                            component="a"
                                            href={`#${category.id}-section`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                document.getElementById(`${category.id}-section`)?.scrollIntoView({ behavior: 'smooth' });
                                            }}
                                            sx={{
                                                px: 3,
                                                py: 1,
                                                textTransform: 'none',
                                                fontSize: '1.4rem',
                                                fontWeight: 500,
                                                border: '1px solid',
                                                borderColor: 'grey.300',
                                                borderRadius: 1,
                                                textDecoration: 'none',
                                                color: 'black',
                                                backgroundColor: 'white',
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    backgroundColor: 'grey.100',
                                                },
                                            }}
                                        >
                                            {category.label}
                                        </Box>
                                    ))}
                                </Box>
                                )}

                                {/* Your Jars/Cookies Section - only show when user has custom items */}
                                {filteredCustomItems.length > 0 && (
                                    <Box id="your-jars-section" sx={{ mb: 0 }}>
                                        <Typography
                                            sx={{
                                                fontSize: '1.6rem',
                                                fontWeight: 700,
                                                mb: 0,
                                                textAlign: 'left',
                                                maxWidth: 500,
                                                margin: '0 auto',
                                            }}
                                        >
                                            {isCookiePackaging ? 'Your Cookies' : 'Your Jars'}
                                        </Typography>
                                        <Box sx={{ maxWidth: 500, margin: '0 auto' }}>
                                            {/* Make Your Own - moves here when custom items exist */}
                                            <Box
                                                onClick={() => handleOpenJarModal(isCookiePackaging ? MAKE_YOUR_OWN_COOKIE : MAKE_YOUR_OWN_JAR)}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    py: 2,
                                                    borderBottom: '1px solid',
                                                    borderColor: 'divider',
                                                    cursor: 'pointer',
                                                    '&:hover': { backgroundColor: 'grey.50' },
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 80,
                                                        height: 80,
                                                        borderRadius: '50%',
                                                        backgroundColor: isCookiePackaging ? MAKE_YOUR_OWN_COOKIE.color : MAKE_YOUR_OWN_JAR.color,
                                                        overflow: 'hidden',
                                                        flexShrink: 0,
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                                    }}
                                                >
                                                    <img
                                                        src={isCookiePackaging ? MAKE_YOUR_OWN_COOKIE.image : MAKE_YOUR_OWN_JAR.image}
                                                        alt={isCookiePackaging ? 'Make Your Own Cookie' : 'Make Your Own Cake Jar'}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                </Box>
                                                <Typography sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
                                                    {isCookiePackaging ? 'Make Your Own Cookie' : 'Make Your Own Cake Jar'}
                                                </Typography>
                                            </Box>
                                            {/* User's custom jars/cookies */}
                                            {filteredCustomItems.map((item, index) => {
                                                const isCustomCookie = item.isCustom && (item.name?.includes('Cookie') || item.id?.includes('cookie'));
                                                const isCustomJar = item.isCustom && !isCustomCookie;

                                                return (
                                                    <Box
                                                        key={item.id}
                                                        onClick={() => handleOpenJarModal(item)}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 2,
                                                            py: 2,
                                                            borderBottom: index < filteredCustomItems.length - 1 ? '1px solid' : 'none',
                                                            borderColor: 'divider',
                                                            cursor: 'pointer',
                                                            '&:hover': { backgroundColor: 'grey.50' },
                                                        }}
                                                    >
                                                        {/* Layered image */}
                                                        {(() => {
                                                            if (isCustomCookie && item.customizations) {
                                                                const baseName = item.customizations?.cake;
                                                                const baseObj = BASE_COOKIES.find(c => c.name === baseName);
                                                                const frostingName = item.customizations.frostings?.[0];
                                                                const frostingObj = COOKIE_FROSTINGS.find(f => f.name === frostingName);
                                                                const toppingImages = (item.customizations.toppings || [])
                                                                    .map(t => COOKIE_TOPPINGS.find(top => top.name === t))
                                                                    .filter(t => t && t.image)
                                                                    .map(t => t.image);

                                                                return (
                                                                    <Box
                                                                        sx={{
                                                                            width: 80,
                                                                            height: 80,
                                                                            borderRadius: '50%',
                                                                            backgroundColor: baseObj?.color || item.color,
                                                                            overflow: 'hidden',
                                                                            flexShrink: 0,
                                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                                                            position: 'relative',
                                                                        }}
                                                                    >
                                                                        {baseObj?.image && (
                                                                            <img src={baseObj.image} alt="base" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
                                                                        )}
                                                                        {frostingObj?.image && (
                                                                            <img src={frostingObj.image} alt="frosting" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} />
                                                                        )}
                                                                        {toppingImages.map((img, idx) => (
                                                                            <img key={idx} src={img} alt="topping" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: idx + 2 }} />
                                                                        ))}
                                                                    </Box>
                                                                );
                                                            }

                                                            if (isCustomJar && item.customizations) {
                                                                const frostingName = item.customizations.frostings?.[0];
                                                                const frostingObj = FROSTINGS.find(f => f.name === frostingName);
                                                                const toppingImages = (item.customizations.toppings || [])
                                                                    .map(t => AVAILABLE_TOPPINGS.find(top => top.name === t))
                                                                    .filter(t => t && t.image)
                                                                    .map(t => t.image);

                                                                return (
                                                                    <Box
                                                                        sx={{
                                                                            width: 80,
                                                                            height: 80,
                                                                            borderRadius: '50%',
                                                                            backgroundColor: frostingObj?.color || item.color || '#f5f0e6',
                                                                            overflow: 'hidden',
                                                                            flexShrink: 0,
                                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                                                            position: 'relative',
                                                                        }}
                                                                    >
                                                                        {frostingObj?.image && (
                                                                            <img src={frostingObj.image} alt="frosting" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
                                                                        )}
                                                                        {toppingImages.map((img, idx) => (
                                                                            <img key={idx} src={img} alt="topping" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: idx + 1 }} />
                                                                        ))}
                                                                    </Box>
                                                                );
                                                            }

                                                            return (
                                                                <Box
                                                                    sx={{
                                                                        width: 80,
                                                                        height: 80,
                                                                        borderRadius: '50%',
                                                                        backgroundColor: item.color,
                                                                        overflow: 'hidden',
                                                                        flexShrink: 0,
                                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                                                    }}
                                                                >
                                                                    {item.image && (
                                                                        <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    )}
                                                                </Box>
                                                            );
                                                        })()}
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
                                                                {item.displayName || item.name}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    </Box>
                                )}

                                {/* All Flavor Sections */}
                                {(FLAVOR_CATEGORIES_BY_PACKAGING[selectedPackaging?.name] || []).map((category) => {
                                    // Helper to generate ingredient description for jars
                                    const getIngredientDescription = (flavor) => {
                                        const defaults = DEFAULT_INGREDIENTS[flavor.name];
                                        if (!defaults) return null;

                                        const parts = [];
                                        if (defaults.cake) parts.push(`${defaults.cake} Cake`);
                                        if (defaults.frostings?.length > 0) parts.push(`${defaults.frostings[0]} Frosting`);
                                        if (defaults.toppings?.length > 0) parts.push(defaults.toppings.join(', '));
                                        if (defaults.cookies?.length > 0) parts.push(defaults.cookies.join(', '));

                                        if (parts.length === 0) return null;
                                        if (parts.length === 1) return parts[0];
                                        if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
                                        return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
                                    };

                                    const allFlavors = [
                                        // Make Your Own - show first when no custom items yet
                                        ...(category.id === 'cake' && filteredCustomItems.length === 0 && selectedPackaging?.name === 'Cake Jar Boxes'
                                            ? [{ ...MAKE_YOUR_OWN_JAR, isMakeYourOwn: true }]
                                            : []),
                                        ...(category.id === 'frosted' && filteredCustomItems.length === 0 && isCookiePackaging
                                            ? [{ ...MAKE_YOUR_OWN_COOKIE, isMakeYourOwn: true }]
                                            : []),
                                        ...(FLAVORS[category.id] || [])
                                    ];

                                    return (
                                        <Box key={category.id} id={`${category.id}-section`} sx={{ mb: 0 }}>
                                            <Typography
                                                sx={{
                                                    fontSize: '1.6rem',
                                                    fontWeight: 700,
                                                    mb: 0,
                                                    textAlign: 'left',
                                                    maxWidth: 500,
                                                    margin: '0 auto',
                                                }}
                                            >
                                                {category.label}
                                            </Typography>
                                            <Box sx={{ maxWidth: 500, margin: '0 auto' }}>
                                                {allFlavors.map((flavor, index) => {
                                                    const ingredientDesc = getIngredientDescription(flavor);

                                                    return (
                                                        <Box
                                                            key={flavor.name}
                                                            onClick={() => handleOpenJarModal(flavor)}
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 2,
                                                                py: 2,
                                                                borderBottom: index < allFlavors.length - 1 ? '1px solid' : 'none',
                                                                borderColor: 'divider',
                                                                cursor: 'pointer',
                                                                '&:hover': { backgroundColor: 'grey.50' },
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    width: 80,
                                                                    height: 80,
                                                                    borderRadius: '50%',
                                                                    backgroundColor: flavor.color,
                                                                    overflow: 'hidden',
                                                                    flexShrink: 0,
                                                                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                                                }}
                                                            >
                                                                {flavor.image && (
                                                                    <img
                                                                        src={flavor.image}
                                                                        alt={flavor.name}
                                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                    />
                                                                )}
                                                            </Box>
                                                            <Box sx={{ flex: 1 }}>
                                                                <Typography sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
                                                                    {flavor.name}
                                                                </Typography>
                                                                {ingredientDesc && (
                                                                    <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', mt: 0.5 }}>
                                                                        {ingredientDesc}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                            {/* Dietary badges */}
                                                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                                                {flavor.glutenFree && <GlutenFreeBadge size="small" />}
                                                                {flavor.vegan && <VeganBadge size="small" />}
                                                            </Box>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                    );
                                })}
                                    </>
                                )}
                            </>
                        )}
                    </Box>
                </>
            )}

            {/*
            ===========================================
            CATEGORY GRID - Currently disabled
            ===========================================
            This section displays categories from the JSON menu data.
            Each category shows an image and name, clicking navigates to that category.

            <Box sx={{ pt: 1, pb: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 2,
                        maxWidth: '500px',
                        margin: '0 auto',
                        justifyContent: 'center'
                    }}
                >
                    {categories.map(([categoryName, categoryData]) => {
                        const imageSrc = categoryData.image || PLACEHOLDER_IMAGE;

                        return (
                            <Box
                                key={categoryName}
                                onClick={() => sendToCatering({ type: 'SELECT_CATEGORY', category: categoryName })}
                                sx={{
                                    cursor: 'pointer',
                                    width: 'calc(50% - 8px)',
                                    '&:hover': { opacity: 0.8 }
                                }}
                            >
                                <Box
                                    sx={{
                                        position: 'relative',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        paddingTop: '100%',
                                        backgroundColor: 'grey.200'
                                    }}
                                >
                                    <img
                                        src={imageSrc}
                                        alt={categoryName}
                                        onError={(e) => {
                                            e.target.src = PLACEHOLDER_IMAGE;
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                </Box>
                                <Typography variant="body1" align="center" sx={{ mt: 1, fontWeight: 600 }}>
                                    {categoryName}
                                </Typography>
                                {categoryData.description && categoryData.description.length > 0 && (
                                    <Typography
                                        variant="body2"
                                        align="center"
                                        color="text.secondary"
                                        sx={{ mt: 0.5, px: 1 }}
                                    >
                                        {categoryData.description[0]}
                                    </Typography>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            </Box>
            */}

            {/*
            ===========================================
            FEATURED PRODUCTS SECTION - Currently disabled
            ===========================================
            This section displays featured products from the menu.
            Uses the ProductCard component defined below.

            {featuredProducts.length > 0 && (
                <Box sx={{ py: 4, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography
                        variant="h3"
                        component="h2"
                        sx={{
                            fontWeight: 700,
                            mb: 1,
                            fontSize: { xs: '1.75rem', md: '2.25rem' }
                        }}
                    >
                        Featured Products
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ mb: 3 }}
                    >
                        Popular catering options
                    </Typography>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr 1fr',
                                sm: '1fr 1fr',
                                md: '1fr 1fr 1fr'
                            },
                            gap: 3
                        }}
                    >
                        {featuredProducts.map((item) => (
                            <ProductCard
                                key={item['Item ID']}
                                item={item}
                                onClick={() => handleProductClick(item)}
                            />
                        ))}
                    </Box>
                </Box>
            )}
            */}

            {/* Jar Preview Modal - shows jar details with default ingredients */}
            <JarPreviewModal
                open={previewModalOpen}
                onClose={handleClosePreviewModal}
                jar={selectedJarForModal}
                onCustomize={handleOpenCustomizeModal}
                onAddToBox={handleSaveJarCustomizations}
                onDelete={handleDeleteCustomJar}
                availableSlots={totalSlots - placedFlavors.length}
            />

            {/* Jar Customization Modal - editable ingredients */}
            <JarCustomizationModal
                open={customizeModalOpen}
                onClose={handleCloseCustomizeModal}
                jar={selectedJarForModal}
                onSave={handleSaveJarCustomizations}
            />

        </Box>
    );
};

/*
===========================================
PRODUCT CARD COMPONENT - Currently disabled
===========================================
Used by the Featured Products section to display individual product cards.

const ProductCard = ({ item, onClick }) => {
    const imageUrl = item['Item Image'] || 'https://placehold.co/300x300/e0e0e0/666666?text=Product';
    const price = item['Item Price'] || 0;

    return (
        <Box
            onClick={onClick}
            sx={{
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                    transform: 'scale(1.02)'
                }
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    paddingTop: '100%',
                    borderRadius: 2,
                    overflow: 'hidden',
                    backgroundColor: 'grey.200',
                    mb: 1
                }}
            >
                <img
                    src={imageUrl}
                    alt={item['Item Name']}
                    onError={(e) => {
                        e.target.src = 'https://placehold.co/300x300/e0e0e0/666666?text=Product';
                    }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                />
            </Box>

            <Typography
                variant="body1"
                sx={{
                    fontWeight: 600,
                    mb: 0.5
                }}
            >
                {item['Item Name']}
            </Typography>

            <Typography
                variant="body2"
                color="text.secondary"
            >
                ${price.toFixed(2)}
            </Typography>
        </Box>
    );
};
*/

export default CategoryListView;
