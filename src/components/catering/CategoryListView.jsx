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
import { isBefore, startOfToday, isToday, addDays, format } from 'date-fns';

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
const FlipClockDigit = ({ value }) => {
    return (
        <Box
            sx={{
                position: 'relative',
                width: 50,
                height: 70,
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
                        fontSize: '3.5rem',
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
                        fontSize: '3.5rem',
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
const FlipClockDisplay = ({ time }) => {
    // time is a Date object
    if (!time) return null;

    const hours = time.getHours();
    const minutes = time.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;

    const hourStr = displayHour.toString().padStart(2, '0');
    const minStr = minutes.toString().padStart(2, '0');

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <FlipClockDigit value={hourStr[0]} />
            <FlipClockDigit value={hourStr[1]} />
            <Typography sx={{ fontSize: '3rem', fontWeight: 700, color: '#1a1a1a', mx: 0.5 }}>:</Typography>
            <FlipClockDigit value={minStr[0]} />
            <FlipClockDigit value={minStr[1]} />
            <Box
                sx={{
                    ml: 1,
                    px: 1,
                    py: 0.5,
                    backgroundColor: '#1a1a1a',
                    borderRadius: 1,
                }}
            >
                <Typography
                    sx={{
                        fontSize: '1.4rem',
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
        { id: 'cookie', label: 'Cookie' },
    ],
};

// Make Your Own Cake Jar - shown in Your Jars section
const MAKE_YOUR_OWN_JAR = { name: 'Make Your Own Cake Jar', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/make-your-own-mini-cake-jar.png', color: '#FFD700', glutenFree: false, vegan: false };

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
    cookie: [
        { name: "A'mour S'more", color: '#8B4513', glutenFree: false, vegan: false },
        { name: 'Chocolate Meltdown Overload', color: '#3D1C02', glutenFree: true, vegan: true },
        { name: 'Vanilla', color: '#F3E5AB', glutenFree: true, vegan: false },
        { name: 'All Very Strawberry', color: '#FF6B81', glutenFree: true, vegan: true },
        { name: 'Nom Nom Cookie', color: '#2C2C2C', glutenFree: false, vegan: false },
        { name: 'La La Red Velvet', color: '#C41E3A', glutenFree: false, vegan: false },
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
    { name: 'Tres Leches', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-tres-leches.png', color: '#FFF8E7' },
    { name: 'Chocolate', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-chocolate.png', color: '#3D1C02' },
    { name: 'Blue Vanilla', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-blue-vanilla.png', color: '#A7C7E7' },
    { name: 'Strawberry', image: 'https://images.surrealcreamery.com/catering/make-your-own/frosting-strawberry.png', color: '#FF6B81' },
    { name: 'Cream Cheese', image: null, color: '#FFFDD0' },
];
const FROSTINGS_AMOUR_SMORE = [{ name: 'Marshmallow & Chocolate', image: null, color: '#5C4033' }]; // Only for A'mour S'more
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
const JarPreviewModal = ({ open, onClose, jar, onCustomize, onAddToBox, onDelete }) => {
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
        onAddToBox({
            ...jar,
            customizations: {
                cake: displayCake,
                frostings: displayFrostings,
                toppings: displayToppings,
                cookies: displayCookies,
                syrups: displaySyrups,
            }
        });
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
                    // For custom jars, get frosting and topping images
                    let frostingImage = null;
                    let frostingColor = jar.color;
                    let toppingImages = [];

                    if (jar.isCustom && jar.customizations) {
                        const frostingName = jar.customizations.frostings?.[0];
                        const frostingObj = FROSTINGS.find(f => f.name === frostingName);
                        frostingImage = frostingObj?.image;
                        frostingColor = frostingObj?.color || jar.color;

                        toppingImages = (jar.customizations.toppings || [])
                            .map(t => AVAILABLE_TOPPINGS.find(top => top.name === t))
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
                                    {/* Base layer - frosting */}
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
                                                zIndex: 0,
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
                                                zIndex: index + 1,
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
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                fontSize: '2rem',
                            }}
                        >
                            {jar.displayName || jar.name}
                        </Typography>
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
                        {/* All jars are sustainable */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <SustainableBadge size="medium" />
                            <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Sustainable</Typography>
                        </Box>
                    </Box>

                    {/* Customize Button */}
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
                        Customize This Jar
                    </Box>

                    {/* Ingredients Display (Read-only) */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Cake */}
                        <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: '1.6rem', color: 'text.secondary', mb: 0.5 }}>
                                Cake
                            </Typography>
                            <Typography sx={{ fontSize: '1.6rem' }}>
                                {displayCake}
                            </Typography>
                        </Box>

                        {/* Frosting */}
                        <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: '1.6rem', color: 'text.secondary', mb: 0.5 }}>
                                Frosting
                            </Typography>
                            <Typography sx={{ fontSize: '1.6rem' }}>
                                {displayFrostings.length > 0 ? displayFrostings.join(', ') : 'None'}
                            </Typography>
                        </Box>

                        {/* Toppings */}
                        <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: '1.6rem', color: 'text.secondary', mb: 0.5 }}>
                                Toppings
                            </Typography>
                            <Typography sx={{ fontSize: '1.6rem' }}>
                                {displayToppings.length > 0 ? displayToppings.join(', ') : 'None'}
                            </Typography>
                        </Box>

                        {/* Cookies */}
                        <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: '1.6rem', color: 'text.secondary', mb: 0.5 }}>
                                Cookies
                            </Typography>
                            <Typography sx={{ fontSize: '1.6rem' }}>
                                {displayCookies.length > 0 ? displayCookies.join(', ') : 'None'}
                            </Typography>
                        </Box>

                        {/* Syrups */}
                        <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: '1.6rem', color: 'text.secondary', mb: 0.5 }}>
                                Syrups
                            </Typography>
                            <Typography sx={{ fontSize: '1.6rem' }}>
                                {displaySyrups.length > 0 ? displaySyrups.join(', ') : 'None'}
                            </Typography>
                        </Box>
                    </Box>
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
                        Add to Box
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

    // For custom jars, get frosting and topping images
    const getCustomJarImages = () => {
        if (!flavor.isCustom || !flavor.customizations) return { frostingImage: null, frostingColor: null, toppingImages: [] };

        const frostingName = flavor.customizations.frostings?.[0];
        const frostingObj = FROSTINGS.find(f => f.name === frostingName);

        const toppingImages = (flavor.customizations.toppings || [])
            .map(t => AVAILABLE_TOPPINGS.find(top => top.name === t))
            .filter(t => t && t.image)
            .map(t => t.image);

        return {
            frostingImage: frostingObj?.image,
            frostingColor: frostingObj?.color,
            toppingImages,
        };
    };

    const { frostingImage, frostingColor, toppingImages } = getCustomJarImages();

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
                                {/* Base layer - frosting */}
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
                                            zIndex: 0,
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
                                            zIndex: index + 1,
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

            {/* Ingredients list for custom jars */}
            {flavor.isCustom && flavor.customizations && (
                <Box sx={{ mt: 0.5, textAlign: 'center' }}>
                    {flavor.customizations.cake && (
                        <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', lineHeight: 1.3 }}>
                            {flavor.customizations.cake} Cake
                        </Typography>
                    )}
                    {flavor.customizations.frostings?.length > 0 && (
                        <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', lineHeight: 1.3 }}>
                            {flavor.customizations.frostings.map(f => `${f} Frosting`).join(', ')}
                        </Typography>
                    )}
                    {flavor.customizations.toppings?.length > 0 && (
                        <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', lineHeight: 1.3 }}>
                            {flavor.customizations.toppings.join(', ')}
                        </Typography>
                    )}
                    {flavor.customizations.cookies?.length > 0 && (
                        <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', lineHeight: 1.3 }}>
                            {flavor.customizations.cookies.join(', ')}
                        </Typography>
                    )}
                    {flavor.customizations.syrups?.length > 0 && (
                        <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', lineHeight: 1.3 }}>
                            {flavor.customizations.syrups.join(', ')}
                        </Typography>
                    )}
                </Box>
            )}
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

export const CategoryListView = ({ menu, sendToCatering }) => {
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
            // Migrate old jars that don't have displayName
            return parsed.map((jar, index) => ({
                ...jar,
                displayName: jar.displayName || `Custom Jar ${index + 1}`,
                isCustom: true,
            }));
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
            setPlacedFlavors([]);
            setSelectedFlavorCategory('cake');
            clearBoxState(); // Also clear localStorage
        }
    }, [packagingResetCounter]);

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
        setPendingPackagingItem(packaging);
        setAvailabilitySelectedOption('quickest'); // Pre-select quickest option
        setShowAvailabilityPage(true);
    };

    const handleCloseAvailabilityPage = () => {
        setShowAvailabilityPage(false);
        setPendingPackagingItem(null);
        setAvailabilitySelectedOption(null);
    };

    const handleAvailabilityContinue = () => {
        const availability = getNextAvailablePickup();
        if (availabilitySelectedOption === 'quickest') {
            // Quickest order - go directly to selecting cake jars with earliest time
            handlePackagingSelect(pendingPackagingItem, {
                date: availability.pickupTime,
                time: `${availability.pickupTime.getHours().toString().padStart(2, '0')}:${availability.pickupTime.getMinutes().toString().padStart(2, '0')}`
            });
            setShowAvailabilityPage(false);
            setPendingPackagingItem(null);
            setAvailabilitySelectedOption(null);
        } else if (availabilitySelectedOption === 'future') {
            // Future customizations - go to date/time selection page
            handleAdvancedCustomization(pendingPackagingItem);
            setShowAvailabilityPage(false);
            setPendingPackagingItem(null);
            setAvailabilitySelectedOption(null);
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
        setSelectedPackaging(packaging);
        // Store the selected date/time from the modal
        if (dateTimeInfo?.date) {
            setSelectedDate(dateTimeInfo.date);
        }
        if (dateTimeInfo?.time) {
            setSelectedTime(dateTimeInfo.time);
        }
        // Clear placed flavors when changing packaging
        setPlacedFlavors([]);
        // Set default flavor category to first available for this packaging
        const categories = FLAVOR_CATEGORIES_BY_PACKAGING[packaging.name] || [];
        if (categories.length > 0) {
            setSelectedFlavorCategory(categories[0].id);
        }
    };

    const handleRemoveFromSlot = (slotIndex) => {
        setPlacedFlavors(prev => prev.filter(f => f.slotIndex !== slotIndex));
    };

    const handleDeleteCustomJar = (jar) => {
        // Remove from customJars list
        setCustomJars(prev => prev.filter(j => j.id !== jar.id));
        // Remove from box if placed
        setPlacedFlavors(prev => prev.filter(f => f.id !== jar.id));
    };

    const handleOpenJarModal = (flavor) => {
        // Create a temporary jar object for the modal
        const jarObj = {
            ...flavor,
            id: flavor.id || `${flavor.name}-${Date.now()}`,
        };
        setSelectedJarForModal(jarObj);

        // Make Your Own goes to inline flow on page
        if (flavor.name === 'Make Your Own Cake Jar' && !flavor.isCustom) {
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
            // Custom jars (Custom Jar 1, etc.) - use staged flow with pre-filled values
            const jarCustomizations = flavor.customizations || {};
            setMakeYourOwnSelections({
                cake: jarCustomizations.cake || null,
                frosting: jarCustomizations.frostings?.[0] || null,
                topping: jarCustomizations.toppings?.[0] || null,
                cookie: jarCustomizations.cookies?.[0] || null,
                syrup: jarCustomizations.syrups?.[0] || null,
            });
            setMakeYourOwnStep(0);
            setEditingJar(flavor);
            setMakeYourOwnActive(true);
        } else {
            // Regular jars (A'mour S'more, etc.) - use staged flow with pre-filled defaults
            const jarDefaults = flavor.customizations || flavor.defaults || {};
            setMakeYourOwnSelections({
                cake: jarDefaults.cake || null,
                frosting: jarDefaults.frostings?.[0] || null,
                topping: jarDefaults.toppings?.[0] || null,
                cookie: jarDefaults.cookies?.[0] || null,
                syrup: jarDefaults.syrups?.[0] || null,
            });
            setMakeYourOwnStep(0);
            setEditingJar(flavor);
            setMakeYourOwnActive(true);
        }
    };

    const handleClosePreviewModal = () => {
        setPreviewModalOpen(false);
        setSelectedJarForModal(null);
    };

    const handleOpenCustomizeModal = () => {
        // Transition from preview to customize modal
        setPreviewModalOpen(false);
        setCustomizeModalOpen(true);
    };

    const handleCloseCustomizeModal = () => {
        setCustomizeModalOpen(false);
        setSelectedJarForModal(null);
    };

    // Inline Make Your Own handlers
    const handleMakeYourOwnSelect = (type, value) => {
        setMakeYourOwnSelections(prev => ({ ...prev, [type]: value }));
    };

    const handleMakeYourOwnContinue = () => {
        if (makeYourOwnStep < 4) {
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
                setPlacedFlavors(prev => {
                    if (prev.length >= 6) return prev;

                    const usedSlots = prev.map(f => f.slotIndex);
                    let nextSlot = 0;
                    for (let i = 0; i < 6; i++) {
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
                setPlacedFlavors(prev => {
                    if (prev.length >= 6) return prev;

                    const usedSlots = prev.map(f => f.slotIndex);
                    let nextSlot = 0;
                    for (let i = 0; i < 6; i++) {
                        if (!usedSlots.includes(i)) {
                            nextSlot = i;
                            break;
                        }
                    }

                    return [...prev, { ...customizedJar, slotIndex: nextSlot }];
                });
            }
        } else {
            // Make Your Own - create new custom jar
            const newCustomJar = {
                id: `custom-jar-${Date.now()}`,
                name: 'Make Your Own Cake Jar',
                image: null,
                color: FROSTINGS.find(f => f.name === makeYourOwnSelections.frosting)?.color || '#FFD700',
                glutenFree: false,
                vegan: false,
                isCustom: true,
                customizations: {
                    cake: makeYourOwnSelections.cake,
                    frostings: makeYourOwnSelections.frosting ? [makeYourOwnSelections.frosting] : [],
                    toppings: makeYourOwnSelections.topping ? [makeYourOwnSelections.topping] : [],
                    cookies: makeYourOwnSelections.cookie ? [makeYourOwnSelections.cookie] : [],
                    syrups: makeYourOwnSelections.syrup ? [makeYourOwnSelections.syrup] : [],
                },
            };

            // Add to custom jars list
            setCustomJars(prev => {
                const newNumber = prev.length + 1;
                const jarWithName = { ...newCustomJar, displayName: `Custom Jar ${newNumber}` };
                return [...prev, jarWithName];
            });

            // Add to box if there's room
            setPlacedFlavors(prev => {
                if (prev.length >= 6) return prev;

                const usedSlots = prev.map(f => f.slotIndex);
                let nextSlot = 0;
                for (let i = 0; i < 6; i++) {
                    if (!usedSlots.includes(i)) {
                        nextSlot = i;
                        break;
                    }
                }

                const customJarNumber = customJars.length + 1;
                const jarWithSlot = {
                    ...newCustomJar,
                    displayName: `Custom Jar ${customJarNumber}`,
                    slotIndex: nextSlot
                };
                return [...prev, jarWithSlot];
            });
        }

        // Exit Make Your Own mode and clear editing state
        setMakeYourOwnActive(false);
        setEditingJar(null);
    };

    // Handle adding completed box to cart with date/time (already selected from availability modal)
    const handleAddBoxToCart = () => {
        if (!isBoxComplete) return;

        // Create a cart item for the Cake Jar Box
        const boxItem = {
            'Item ID': `cake-jar-box-${Date.now()}`,
            'Item Name': 'Cake Jar Box (6 Jars)',
            'Item Price': 0, // Price will be calculated based on jars
            'Item Image': selectedPackaging?.heroImage,
            // Store the jars data for display and order processing
            jars: placedFlavors.map(jar => ({
                name: jar.name,
                image: jar.image,
                color: jar.color,
                glutenFree: jar.glutenFree,
                vegan: jar.vegan,
                customizations: jar.customizations,
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
        setSelectedFlavorCategory('cake');
        clearBoxState();

        // Open cart drawer to show the added item
        sendToCatering({ type: 'OPEN_CART_DRAWER' });
    };

    const handleSaveJarCustomizations = (updatedJar) => {
        // Check if this is an existing custom jar being edited
        if (updatedJar.isCustom) {
            // Update existing custom jar in the customJars list
            setCustomJars(prev => prev.map(jar =>
                jar.id === updatedJar.id
                    ? { ...updatedJar }
                    : jar
            ));

            // Always add another copy to the box (user can fill box with same custom jar)
            if (selectedPackaging?.name === 'Cake Jar Boxes') {
                setPlacedFlavors(prev => {
                    if (prev.length >= 6) return prev; // Box is full

                    const usedSlots = prev.map(f => f.slotIndex);
                    let nextSlot = 0;
                    for (let i = 0; i < 6; i++) {
                        if (!usedSlots.includes(i)) {
                            nextSlot = i;
                            break;
                        }
                    }

                    // Create a new placement with unique ID for each slot
                    const newPlacement = {
                        ...updatedJar,
                        placementId: `${updatedJar.id}-slot-${nextSlot}`,
                        slotIndex: nextSlot
                    };
                    return [...prev, newPlacement];
                });
            }
        } else if (updatedJar.name === 'Make Your Own Cake Jar') {
            // Creating a new custom jar from "Make Your Own"
            const customJarNumber = customJars.length + 1;
            const customJar = {
                ...updatedJar,
                id: `custom-jar-${Date.now()}`,
                displayName: `Custom Jar ${customJarNumber}`,
                isCustom: true,
            };

            // Add to custom jars list
            setCustomJars(prev => [...prev, customJar]);

            // For Cake Jar Boxes, add to slot
            if (selectedPackaging?.name === 'Cake Jar Boxes') {
                if (placedFlavors.length >= 6) return;

                const usedSlots = placedFlavors.map(f => f.slotIndex);
                let nextSlot = 0;
                for (let i = 0; i < 6; i++) {
                    if (!usedSlots.includes(i)) {
                        nextSlot = i;
                        break;
                    }
                }

                setPlacedFlavors(prev => [...prev, { ...customJar, slotIndex: nextSlot }]);
            }
        } else {
            // For Cake Jar Boxes, find the next empty slot and add the jar
            if (selectedPackaging?.name === 'Cake Jar Boxes') {
                // Max 6 slots
                if (placedFlavors.length >= 6) return;

                // Find first empty slot index
                const usedSlots = placedFlavors.map(f => f.slotIndex);
                let nextSlot = 0;
                for (let i = 0; i < 6; i++) {
                    if (!usedSlots.includes(i)) {
                        nextSlot = i;
                        break;
                    }
                }

                const newPlacement = {
                    ...updatedJar,
                    slotIndex: nextSlot,
                };
                setPlacedFlavors(prev => [...prev, newPlacement]);
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
    };

    const currentFlavors = FLAVORS[selectedFlavorCategory] || [];

    // Check if the box is complete (6/6 for Cake Jar Boxes)
    const isBoxComplete = selectedPackaging?.name === 'Cake Jar Boxes' && placedFlavors.length === 6;

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
            <Box sx={{ backgroundColor: 'white', minHeight: '100vh', pb: '100px' }}>
                {/* Location Selector Header */}
                <Box
                    sx={{
                        py: 2,
                        px: 3,
                        borderBottom: '1px solid',
                        borderColor: 'grey.200',
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
                    {/* Earliest Pickup & Delivery Times */}
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Typography
                            sx={{
                                fontSize: '1.6rem',
                                fontWeight: 600,
                                color: 'text.secondary',
                                mb: 1,
                            }}
                        >
                            Earliest Pickup Today
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                            <FlipClockDisplay time={availability.pickupTime} />
                        </Box>

                        <Typography
                            sx={{
                                fontSize: '1.6rem',
                                fontWeight: 600,
                                color: 'text.secondary',
                                mb: 1,
                            }}
                        >
                            Earliest Delivery Today
                        </Typography>
                        <Box>
                            <FlipClockDisplay time={availability.deliveryTime} />
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
                                Quickest Order Delivery Time
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: '1.6rem',
                                    color: 'text.secondary',
                                }}
                            >
                                Some customization options will not be available
                            </Typography>
                        </Box>
                    </Box>

                    {/* Option 2: Customizations for Future Orders */}
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
                                Customizations for Future Orders
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: '1.6rem',
                                    color: 'text.secondary',
                                }}
                            >
                                Custom options such as logos, jars, packaging, charms or accessories will be available based on selected date and time
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

            {/* Sticky Bottom Box - Fixed at bottom for Cake Jar Boxes (hidden during Make Your Own flow) */}
            {selectedPackaging && selectedPackaging.name === 'Cake Jar Boxes' && !makeYourOwnActive && (
                <Box
                    sx={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        borderTop: '1px solid',
                        borderColor: 'grey.300',
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        p: 2,
                    }}
                >
                    <Box sx={{ maxWidth: 600, margin: '0 auto' }}>
                        {isBoxComplete ? (
                            /* Add to Cart button when box is complete */
                            <Box
                                component="button"
                                onClick={handleAddBoxToCart}
                                sx={{
                                    width: '100%',
                                    py: 2,
                                    px: 4,
                                    backgroundColor: 'black',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 2,
                                    fontSize: '1.6rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        backgroundColor: '#333',
                                    },
                                }}
                            >
                                Add to Cart
                            </Box>
                        ) : (
                            <>
                                {/* Title and count row */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography
                                        variant="h6"
                                        sx={{ fontWeight: 700, fontSize: '1.4rem' }}
                                    >
                                        {selectedPackaging.name}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ fontSize: '1.4rem' }}
                                    >
                                        {placedFlavors.length}/6 filled
                                    </Typography>
                                </Box>

                                {/* 6-Slot Box - Compact horizontal layout */}
                                <Box
                                    sx={{
                                        position: 'relative',
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(6, 1fr)',
                                        gap: 1,
                                        p: 1.5,
                                        backgroundColor: '#f5f0e6',
                                        borderRadius: 2,
                                        border: '2px solid #d4c4a8',
                                    }}
                                >
                                    {[0, 1, 2, 3, 4, 5].map((slotIndex) => {
                                        const flavorInSlot = placedFlavors.find(f => f.slotIndex === slotIndex);
                                        return (
                                            <Box
                                                key={slotIndex}
                                                sx={{
                                                    position: 'relative',
                                                    aspectRatio: '1',
                                                    borderRadius: '50%',
                                                    backgroundColor: flavorInSlot ? 'transparent' : '#e8e0d0',
                                                    border: flavorInSlot ? 'none' : '2px dashed #c4b89c',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'visible',
                                                    cursor: flavorInSlot ? 'pointer' : 'default',
                                                }}
                                                onClick={() => flavorInSlot && handleRemoveFromSlot(flavorInSlot.slotIndex)}
                                            >
                                                {/* Slot number when empty */}
                                                {!flavorInSlot && (
                                                    <Typography
                                                        sx={{
                                                            fontSize: '1.2rem',
                                                            fontWeight: 600,
                                                            color: '#b8a88c',
                                                        }}
                                                    >
                                                        {slotIndex + 1}
                                                    </Typography>
                                                )}
                                                <AnimatePresence>
                                                    {flavorInSlot && (
                                                        <motion.div
                                                            key={flavorInSlot.id}
                                                            initial={{ scale: 0, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            exit={{ scale: 0, opacity: 0 }}
                                                            transition={{
                                                                type: 'spring',
                                                                stiffness: 400,
                                                                damping: 25
                                                            }}
                                                            style={{ width: '100%', height: '100%', position: 'relative' }}
                                                        >
                                                            {(() => {
                                                                // For custom jars, get frosting and topping images
                                                                let frostingImage = null;
                                                                let frostingColor = flavorInSlot.color;
                                                                let toppingImages = [];

                                                                if (flavorInSlot.isCustom && flavorInSlot.customizations) {
                                                                    const frostingName = flavorInSlot.customizations.frostings?.[0];
                                                                    const frostingObj = FROSTINGS.find(f => f.name === frostingName);
                                                                    frostingImage = frostingObj?.image;
                                                                    frostingColor = frostingObj?.color || flavorInSlot.color;

                                                                    toppingImages = (flavorInSlot.customizations.toppings || [])
                                                                        .map(t => AVAILABLE_TOPPINGS.find(top => top.name === t))
                                                                        .filter(t => t && t.image)
                                                                        .map(t => t.image);
                                                                }

                                                                return (
                                                                    <Box
                                                                        sx={{
                                                                            width: '100%',
                                                                            height: '100%',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: frostingColor || flavorInSlot.color,
                                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            overflow: 'hidden',
                                                                            position: 'relative',
                                                                        }}
                                                                    >
                                                                        {flavorInSlot.isCustom ? (
                                                                            <>
                                                                                {/* Base layer - frosting */}
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
                                                                                            zIndex: 0,
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
                                                                                            zIndex: index + 1,
                                                                                        }}
                                                                                    />
                                                                                ))}
                                                                            </>
                                                                        ) : (
                                                                            flavorInSlot.image && (
                                                                                <img
                                                                                    src={flavorInSlot.image}
                                                                                    alt={flavorInSlot.name}
                                                                                    style={{
                                                                                        width: '100%',
                                                                                        height: '100%',
                                                                                        objectFit: 'cover',
                                                                                    }}
                                                                                />
                                                                            )
                                                                        )}
                                                                    </Box>
                                                                );
                                                            })()}
                                                            {/* Dietary badges for this jar */}
                                                            {flavorInSlot.glutenFree && (
                                                                <Box sx={{ position: 'absolute', top: -6, right: -2, zIndex: 10 }}>
                                                                    <GlutenFreeBadge size="small" />
                                                                </Box>
                                                            )}
                                                            {flavorInSlot.vegan && (
                                                                <Box sx={{ position: 'absolute', top: -6, left: -2, zIndex: 10 }}>
                                                                    <VeganBadge size="small" />
                                                                </Box>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </>
                        )}
                    </Box>
                </Box>
            )}

            {/* Selected Packaging Header - for non-box packaging */}
            {selectedPackaging && selectedPackaging.name !== 'Cake Jar Boxes' && (
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
                    {/* Flavors Section OR Completed Box List */}
                    <Box sx={{
                        pt: 2,
                        pb: selectedPackaging?.name === 'Cake Jar Boxes' ? 12 : 4,
                        borderTop: '1px solid',
                        borderColor: 'divider'
                    }}>
                        {isBoxComplete ? (
                            /* Completed Box - Show list of selected jars */
                            <>
                                <Typography
                                    variant="h3"
                                    component="h2"
                                    sx={{
                                        fontWeight: 700,
                                        mb: 3,
                                        fontSize: { xs: '1.75rem', md: '2.25rem' },
                                        textAlign: 'center'
                                    }}
                                >
                                    Your Cake Jar Box
                                </Typography>

                                {/* List of selected jars */}
                                <Box sx={{ maxWidth: 400, margin: '0 auto' }}>
                                    {placedFlavors
                                        .sort((a, b) => a.slotIndex - b.slotIndex)
                                        .map((flavor, index) => (
                                            <Box
                                                key={flavor.id}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    py: 1.5,
                                                    borderBottom: index < 5 ? '1px solid' : 'none',
                                                    borderColor: 'divider',
                                                }}
                                            >
                                                {/* Jar image */}
                                                <Box
                                                    sx={{
                                                        width: 50,
                                                        height: 50,
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
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'cover',
                                                            }}
                                                        />
                                                    )}
                                                </Box>

                                                {/* Jar name and badges */}
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography
                                                        sx={{
                                                            fontSize: '1.4rem',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {flavor.isCustom ? flavor.displayName : flavor.name}
                                                    </Typography>
                                                    {/* Show ingredients for custom jars */}
                                                    {flavor.isCustom && flavor.customizations && (
                                                        <Typography
                                                            sx={{
                                                                fontSize: '1.2rem',
                                                                color: 'text.secondary',
                                                                mt: 0.25,
                                                            }}
                                                        >
                                                            {[
                                                                flavor.customizations.cake,
                                                                ...(flavor.customizations.frostings || []),
                                                                ...(flavor.customizations.toppings || []),
                                                                ...(flavor.customizations.cookies || []),
                                                                ...(flavor.customizations.syrups || []),
                                                            ].filter(Boolean).join(', ')}
                                                        </Typography>
                                                    )}
                                                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                                        {flavor.glutenFree && <GlutenFreeBadge size="small" />}
                                                        {flavor.vegan && <VeganBadge size="small" />}
                                                    </Box>
                                                </Box>

                                                {/* Remove button */}
                                                <Box
                                                    component="button"
                                                    onClick={() => handleRemoveFromSlot(flavor.slotIndex)}
                                                    sx={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'text.secondary',
                                                        fontSize: '1.2rem',
                                                        cursor: 'pointer',
                                                        padding: '4px 8px',
                                                        '&:hover': {
                                                            color: 'error.main',
                                                        },
                                                    }}
                                                >
                                                    Remove
                                                </Box>
                                            </Box>
                                        ))}
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
                                            {editingJar ? (editingJar.isCustom ? 'Update Your Custom Cake Jar' : editingJar.name) : 'Make Your Own Cake Jar'}
                                        </Typography>

                                        {/* Dynamic Preview Image - updates based on selections */}
                                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                                            {(() => {
                                                // Get selected items
                                                const selectedCake = CAKE_FLAVORS.find(c => c.name === makeYourOwnSelections.cake);
                                                const selectedFrosting = FROSTINGS.find(f => f.name === makeYourOwnSelections.frosting);
                                                const selectedTopping = AVAILABLE_TOPPINGS.find(t => t.name === makeYourOwnSelections.topping);

                                                // Determine what to show
                                                let bgColor = '#f5f0e6';
                                                let baseImage = editingJar?.image || MAKE_YOUR_OWN_JAR.image;
                                                let showFrosting = false;
                                                let showTopping = false;

                                                if (selectedCake) {
                                                    baseImage = selectedCake.image;
                                                    bgColor = selectedCake.color;
                                                }
                                                if (selectedFrosting) {
                                                    baseImage = selectedFrosting.image;
                                                    bgColor = selectedFrosting.color;
                                                    showFrosting = true;
                                                }
                                                if (selectedTopping && selectedTopping.image) {
                                                    showTopping = true;
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
                                                        {/* Base layer - cake or frosting */}
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
                                                                    zIndex: 1,
                                                                }}
                                                            />
                                                        )}
                                                    </Box>
                                                );
                                            })()}
                                        </Box>

                                        {/* Step 0: Select Cake */}
                                        {makeYourOwnStep === 0 && (
                                            <Box>
                                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 2, textAlign: 'center' }}>
                                                    Select Your Cake
                                                </Typography>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, maxWidth: '350px', margin: '0 auto' }}>
                                                    {CAKE_FLAVORS.map((cake) => (
                                                        <Box
                                                            key={cake.name}
                                                            onClick={() => handleMakeYourOwnSelect('cake', cake.name)}
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
                                                                    border: makeYourOwnSelections.cake === cake.name ? `3px solid ${cake.color}` : '3px solid white',
                                                                    boxShadow: makeYourOwnSelections.cake === cake.name ? `0 0 0 2px ${cake.color}` : '0 2px 8px rgba(0,0,0,0.15)',
                                                                    transition: 'all 0.2s',
                                                                }}
                                                            >
                                                                <img src={cake.image} alt={cake.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </Box>
                                                            <Typography sx={{ fontSize: '1.4rem', mt: 1, textAlign: 'center' }}>{cake.name}</Typography>
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
                                                    {FROSTINGS.map((frosting) => (
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
                                                                    backgroundColor: frosting.color,
                                                                    border: makeYourOwnSelections.frosting === frosting.name ? `3px solid ${frosting.color}` : '3px solid white',
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
                                                    {AVAILABLE_TOPPINGS.map((topping) => (
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
                                                {makeYourOwnStep < 4 ? (
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
                                                        {editingJar ? 'Update Cake Jar' : 'Add to Box'}
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
                                                mb: 2,
                                                fontSize: { xs: '1.75rem', md: '2.25rem' },
                                                textAlign: 'center'
                                            }}
                                        >
                                            Add a Cake Jar
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

                                {/* Category Anchor Links */}
                                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                                    {/* Your Jars link - only show when custom jars exist */}
                                    {customJars.length > 0 && (
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
                                            Your Jars
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

                                {/* Your Jars Section - only show when user has custom jars */}
                                {customJars.length > 0 && (
                                    <Box id="your-jars-section" sx={{ mb: 4 }}>
                                        <Typography
                                            sx={{
                                                fontSize: '1.6rem',
                                                fontWeight: 700,
                                                mb: 2,
                                                textAlign: 'center',
                                            }}
                                        >
                                            Your Jars
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: 3,
                                                maxWidth: '400px',
                                                margin: '0 auto'
                                            }}
                                        >
                                            {/* Make Your Own Cake Jar - moves here when custom jars exist */}
                                            <AnimatedFlavorCircle
                                                key="make-your-own"
                                                flavor={MAKE_YOUR_OWN_JAR}
                                                onSelect={handleOpenJarModal}
                                                isPlaced={false}
                                            />
                                            {/* User's custom jars */}
                                            {customJars.map((jar) => (
                                                <AnimatedFlavorCircle
                                                    key={jar.id}
                                                    flavor={jar}
                                                    onSelect={handleOpenJarModal}
                                                    isPlaced={isFlavorPlaced(jar.id)}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                )}

                                {/* All Flavor Sections */}
                                {(FLAVOR_CATEGORIES_BY_PACKAGING[selectedPackaging?.name] || []).map((category) => (
                                    <Box key={category.id} id={`${category.id}-section`} sx={{ mb: 4 }}>
                                        <Typography
                                            sx={{
                                                fontSize: '1.6rem',
                                                fontWeight: 700,
                                                mb: 2,
                                                textAlign: 'center',
                                            }}
                                        >
                                            {category.label}
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: 3,
                                                maxWidth: '400px',
                                                margin: '0 auto'
                                            }}
                                        >
                                            {/* Make Your Own - show in Cake Jars section when no custom jars yet */}
                                            {category.id === 'cake' && customJars.length === 0 && (
                                                <AnimatedFlavorCircle
                                                    key="make-your-own"
                                                    flavor={MAKE_YOUR_OWN_JAR}
                                                    onSelect={handleOpenJarModal}
                                                    isPlaced={false}
                                                />
                                            )}
                                            {(FLAVORS[category.id] || []).map((flavor) => (
                                                <AnimatedFlavorCircle
                                                    key={flavor.name}
                                                    flavor={flavor}
                                                    onSelect={handleOpenJarModal}
                                                    isPlaced={false}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                ))}
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
