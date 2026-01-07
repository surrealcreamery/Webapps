import React, { useState, useRef, useEffect, useContext } from 'react';
import { Box, Typography, Container, ToggleButtonGroup, ToggleButton, Dialog, DialogContent, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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

// Availability Notification Component with Auto-Detection
const AvailabilityNotification = () => {
    const [availability, setAvailability] = useState(() => getNextAvailablePickup());
    const [selectedLocationId, setSelectedLocationId] = useState(null);
    const [sortedLocations, setSortedLocations] = useState(STORE_LOCATIONS);
    const [isDetecting, setIsDetecting] = useState(true);
    const [locationModalOpen, setLocationModalOpen] = useState(false);

    // Fetch user location and auto-select nearest store
    useEffect(() => {
        const detectLocation = async () => {
            try {
                const userLocation = await getLocationFromIP();

                if (userLocation?.latitude && userLocation?.longitude) {
                    // Calculate distances and sort by nearest
                    const withDistances = STORE_LOCATIONS.map(store => {
                        const distance = calculateDistance(
                            userLocation.latitude,
                            userLocation.longitude,
                            store.latitude,
                            store.longitude
                        );
                        return { ...store, distance };
                    }).sort((a, b) => a.distance - b.distance);

                    setSortedLocations(withDistances);
                    setSelectedLocationId(withDistances[0].id); // Auto-select nearest
                    console.log(`📍 Auto-selected nearest store: ${withDistances[0]?.name}`);
                } else {
                    // Fallback - select first store
                    setSelectedLocationId(STORE_LOCATIONS[0].id);
                }
            } catch (error) {
                console.error('Location detection failed:', error);
                setSelectedLocationId(STORE_LOCATIONS[0].id);
            } finally {
                setIsDetecting(false);
            }
        };

        detectLocation();
    }, []);

    // Update availability every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setAvailability(getNextAvailablePickup());
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    const selectedLocation = sortedLocations.find(loc => loc.id === selectedLocationId);

    // Build the status and time messages separately
    const getStatusMessage = () => {
        if (availability.isOpenNow) {
            return "is open now!";
        }
        // Extract just the "opens" part from the message
        if (availability.message.includes('later today')) {
            return "opens later today.";
        }
        if (availability.message.includes('Tomorrow')) {
            return "opens tomorrow.";
        }
        // Extract day from message like "Opens Monday, Jan 6..."
        const match = availability.message.match(/Opens ([^.]+)\./);
        return match ? `opens ${match[1].toLowerCase()}.` : "opens soon.";
    };

    const getTimeMessage = () => {
        if (!availability.pickupTime || !availability.deliveryTime) return '';

        const formatTime = (date) => {
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const period = hours >= 12 ? 'pm' : 'am';
            const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
            return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
        };

        const pickupStr = formatTime(availability.pickupTime);
        const deliveryStr = formatTime(availability.deliveryTime);

        if (pickupStr === deliveryStr) {
            return `Earliest pickup or delivery is ${pickupStr} for orders placed now.`;
        }
        return `Earliest pickup is ${pickupStr}, delivery for ${deliveryStr} for orders placed now.`;
    };

    return (
        <Box
            sx={{
                backgroundColor: availability.isOpenNow ? '#E8F5E9' : '#FFF8E1',
                borderRadius: 2,
                p: 2,
                mb: 3,
                border: '1px solid',
                borderColor: availability.isOpenNow ? '#A5D6A7' : '#FFE082',
            }}
        >
            {/* Line 1: Location selector + status */}
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
                <Box
                    component="button"
                    onClick={() => setLocationModalOpen(true)}
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        marginRight: '4px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                    }}
                >
                    <Typography
                        component="span"
                        sx={{
                            fontSize: '1.6rem',
                            fontWeight: 600,
                            color: availability.isOpenNow ? '#2E7D32' : '#F57F17',
                        }}
                    >
                        {selectedLocation?.name || 'Select Location'}
                    </Typography>
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill={availability.isOpenNow ? '#2E7D32' : '#F57F17'}
                        style={{ marginLeft: '2px' }}
                    >
                        <path d="M7 10l5 5 5-5z"/>
                    </svg>
                </Box>
                <LocationModal
                    open={locationModalOpen}
                    onClose={() => setLocationModalOpen(false)}
                    selectedLocationId={selectedLocationId}
                    onSelectLocation={(id) => setSelectedLocationId(id)}
                    locations={sortedLocations}
                />
                <Typography
                    component="span"
                    sx={{
                        fontSize: '1.6rem',
                        fontWeight: 600,
                        color: availability.isOpenNow ? '#2E7D32' : '#F57F17',
                    }}
                >
                    {getStatusMessage()}
                </Typography>
            </Box>

            {/* Line 2: Pickup/delivery times */}
            <Typography
                sx={{
                    fontSize: '1.6rem',
                    fontWeight: 500,
                    color: availability.isOpenNow ? '#2E7D32' : '#F57F17',
                }}
            >
                {getTimeMessage()}
            </Typography>
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
        { id: 'cake', label: 'Cake' },
        { id: 'cheesecake', label: 'Cheesecake' },
    ],
    'Cupcake Trays': [
        { id: 'cake', label: 'Cake' },
        { id: 'cheesecake', label: 'Cheesecake' },
        { id: 'cookie', label: 'Cookie' },
    ],
    'Cookies': [
        { id: 'cookie', label: 'Cookie' },
    ],
};

// Hardcoded flavors with colors, dietary info, and category
const FLAVORS = {
    cake: [
        { name: 'Make Your Own Cake Jar', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/make-your-own-mini-cake-jar.png', color: '#FFD700', glutenFree: false, vegan: false },
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
const CAKE_FLAVORS = ['Vanilla', 'Chocolate', 'Red Velvet', 'Strawberry', 'Taro', 'Espresso'];
const FROSTINGS = ['Marshmallow', 'Tres Leches', 'Chocolate', 'Blue Vanilla', 'Strawberry', 'Cream Cheese'];
const FROSTINGS_AMOUR_SMORE = ['Marshmallow & Chocolate']; // Only for A'mour S'more
const AVAILABLE_TOPPINGS = [
    'Chocolate Chips', 'Chocolate Crunch', 'Chocolate Sprinkles', 'Gummy Bears',
    'Lucky Charms Marshmallows', 'Marshmallows', "M&M's", 'Peanut Butter Chips',
    'Rainbow Sprinkles', 'Strawberry Crunch', 'Whipped Cream', 'White Chocolate Curls'
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
const JarPreviewModal = ({ open, onClose, jar, onCustomize, onAddToBox }) => {
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
                {/* Jar Image */}
                <Box
                    sx={{
                        width: '100%',
                        height: 300,
                        backgroundColor: jar.color || '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                    }}
                >
                    {jar.image ? (
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

                {/* Content */}
                <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
                    {/* Jar Name */}
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            mb: 1,
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

    // Initialize state when jar changes
    useEffect(() => {
        if (jar) {
            const defaults = DEFAULT_INGREDIENTS[jar.name] || {
                cake: 'Vanilla', frostings: [], toppings: [], cookies: [], syrups: []
            };
            setSelectedCake(jar.customizations?.cake || defaults.cake);
            setSelectedFrostings(jar.customizations?.frostings || [...defaults.frostings]);
            setSelectedToppings(jar.customizations?.toppings || [...defaults.toppings]);
            setSelectedCookies(jar.customizations?.cookies || [...(defaults.cookies || [])]);
            setSelectedSyrups(jar.customizations?.syrups || [...(defaults.syrups || [])]);
        }
    }, [jar]);

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
        setSelectedFrostings([frosting]);
    };

    const handleToppingToggle = (topping) => {
        setSelectedToppings(prev => {
            if (prev.includes(topping)) {
                return prev.filter(t => t !== topping);
            } else {
                return [...prev, topping];
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
                {/* Jar Image */}
                <Box
                    sx={{
                        width: '100%',
                        height: 300,
                        backgroundColor: jar.color || '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                    }}
                >
                    {jar.image ? (
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
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: '1.6rem',
                                mb: 1,
                            }}
                        >
                            Cake
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {CAKE_FLAVORS.map((cake) => (
                                <Box
                                    key={cake}
                                    component="button"
                                    onClick={() => setSelectedCake(cake)}
                                    sx={{
                                        px: 2,
                                        py: 1,
                                        borderRadius: 2,
                                        border: '2px solid',
                                        borderColor: selectedCake === cake ? 'black' : 'grey.300',
                                        backgroundColor: selectedCake === cake ? 'black' : 'white',
                                        color: selectedCake === cake ? 'white' : 'black',
                                        fontSize: '1.6rem',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            borderColor: 'black',
                                        }
                                    }}
                                >
                                    {cake}
                                </Box>
                            ))}
                        </Box>
                    </Box>

                    {/* Frostings */}
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: '1.6rem',
                                mb: 1,
                            }}
                        >
                            Frosting
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {getAvailableFrostings().map((frosting) => (
                                <Box
                                    key={frosting}
                                    component="button"
                                    onClick={() => handleFrostingSelect(frosting)}
                                    sx={{
                                        px: 2,
                                        py: 1,
                                        borderRadius: 2,
                                        border: '2px solid',
                                        borderColor: selectedFrostings.includes(frosting) ? 'black' : 'grey.300',
                                        backgroundColor: selectedFrostings.includes(frosting) ? 'black' : 'white',
                                        color: selectedFrostings.includes(frosting) ? 'white' : 'black',
                                        fontSize: '1.6rem',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            borderColor: 'black',
                                        }
                                    }}
                                >
                                    {frosting}
                                </Box>
                            ))}
                        </Box>
                    </Box>

                    {/* Toppings */}
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: '1.6rem',
                                mb: 1,
                            }}
                        >
                            Toppings <Typography component="span" sx={{ fontSize: '1.6rem', color: 'text.secondary', fontWeight: 400 }}>(max 3)</Typography>
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                            {AVAILABLE_TOPPINGS.map((topping) => {
                                const isSelected = selectedToppings.includes(topping);
                                const isDisabled = !isSelected && selectedToppings.length >= 3;
                                return (
                                    <Box
                                        key={topping}
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
                                        {topping}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>

                    {/* Cookies */}
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: '1.6rem',
                                mb: 1,
                            }}
                        >
                            Cookies
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
                    </Box>

                    {/* Syrups */}
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: '1.6rem',
                                mb: 1,
                            }}
                        >
                            Syrups
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
                        onClick={handleSave}
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
const AnimatedFlavorCircle = ({ flavor, onSelect, isPlaced }) => {
    const handleClick = () => {
        if (isPlaced) return;
        onSelect(flavor);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: isPlaced ? 'default' : 'pointer',
                opacity: isPlaced ? 0.4 : 1,
                transition: 'opacity 0.3s',
            }}
        >
            <Box
                onClick={handleClick}
                sx={{
                    position: 'relative',
                    width: 80,
                    height: 80,
                    cursor: isPlaced ? 'default' : 'pointer',
                }}
            >
                {/* The flavor circle */}
                <motion.div
                    whileHover={!isPlaced ? {
                        y: -4,
                        scale: 1.05,
                    } : {}}
                    whileTap={!isPlaced ? {
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
                            backgroundColor: flavor.color,
                            transition: 'box-shadow 0.3s',
                            '&:hover': {
                                boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                            }
                        }}
                    >
                        {flavor.image && (
                            <img
                                src={flavor.image}
                                alt={flavor.name}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
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

            <Typography
                variant="body2"
                sx={{ mt: 1, fontWeight: 500, textAlign: 'center', fontSize: '1.4rem' }}
            >
                {flavor.name}
            </Typography>
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
    const [selectedPackaging, setSelectedPackaging] = useState(
        initialPersistedState?.selectedPackaging || null
    );
    const [placedFlavors, setPlacedFlavors] = useState(
        initialPersistedState?.placedFlavors || []
    );
    const [selectedJarForModal, setSelectedJarForModal] = useState(null);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [customizeModalOpen, setCustomizeModalOpen] = useState(false);
    const [showDateTimeSelection, setShowDateTimeSelection] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
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

    const handlePackagingSelect = (packaging) => {
        setSelectedPackaging(packaging);
        // Clear placed flavors when changing packaging
        setPlacedFlavors([]);
        // Set default flavor category to first available for this packaging
        const categories = FLAVOR_CATEGORIES_BY_PACKAGING[packaging.name] || [];
        if (categories.length > 0) {
            setSelectedFlavorCategory(categories[0].id);
        }
    };

    const handleRemoveFromSlot = (id) => {
        setPlacedFlavors(prev => prev.filter(f => f.id !== id));
    };

    const handleOpenJarModal = (flavor) => {
        // Create a temporary jar object for the modal
        setSelectedJarForModal({
            ...flavor,
            id: `${flavor.name}-${Date.now()}`,
        });
        setPreviewModalOpen(true);
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

    // Show date/time selection when user clicks Continue
    const handleContinueToDateTime = () => {
        if (!isBoxComplete) return;
        setShowDateTimeSelection(true);
        setSelectedDate(null);
        setSelectedTime(null);
    };

    const handleBackFromDateTime = () => {
        setShowDateTimeSelection(false);
        setSelectedDate(null);
        setSelectedTime(null);
    };

    const handleDateChange = (newDate) => {
        setSelectedDate(newDate);
        setSelectedTime(null); // Reset time when date changes
    };

    const handleTimeSelect = (time) => {
        setSelectedTime(time);
    };

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

    // Handle adding completed box to cart with date/time
    const handleAddBoxToCart = () => {
        if (!isBoxComplete || !selectedDate || !selectedTime) return;

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
        setShowDateTimeSelection(false);
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
    };

    const currentFlavors = FLAVORS[selectedFlavorCategory] || [];

    // Check if the box is complete (6/6 for Cake Jar Boxes)
    const isBoxComplete = selectedPackaging?.name === 'Cake Jar Boxes' && placedFlavors.length === 6;

    // Check if a flavor is already placed
    const isFlavorPlaced = (flavorName) => {
        return placedFlavors.some(f => f.name === flavorName);
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

                    {/* Availability Notification */}
                    <AvailabilityNotification />

                    {/* Vertical stack of packaging cards */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {PACKAGING.map((item) => (
                            <motion.div
                                key={item.name}
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handlePackagingSelect(item)}
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

            {/* Sticky Bottom Box - Fixed at bottom for Cake Jar Boxes */}
            {selectedPackaging && selectedPackaging.name === 'Cake Jar Boxes' && (
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
                        {isBoxComplete && showDateTimeSelection ? (
                            /* Add to Cart button when date/time is being selected */
                            <Box
                                component="button"
                                onClick={handleAddBoxToCart}
                                disabled={!selectedDate || !selectedTime}
                                sx={{
                                    width: '100%',
                                    py: 2,
                                    px: 4,
                                    backgroundColor: (!selectedDate || !selectedTime) ? 'grey.300' : 'black',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 2,
                                    fontSize: '1.6rem',
                                    fontWeight: 700,
                                    cursor: (!selectedDate || !selectedTime) ? 'not-allowed' : 'pointer',
                                    '&:hover': {
                                        backgroundColor: (!selectedDate || !selectedTime) ? 'grey.300' : '#333',
                                    },
                                }}
                            >
                                Add to Cart
                            </Box>
                        ) : isBoxComplete ? (
                            /* Continue button when box is complete - opens date/time selection */
                            <Box
                                component="button"
                                onClick={handleContinueToDateTime}
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
                                Continue
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
                                                onClick={() => flavorInSlot && handleRemoveFromSlot(flavorInSlot.id)}
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
                                                            <Box
                                                                sx={{
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: flavorInSlot.color,
                                                                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    overflow: 'hidden',
                                                                }}
                                                            >
                                                                {flavorInSlot.image && (
                                                                    <img
                                                                        src={flavorInSlot.image}
                                                                        alt={flavorInSlot.name}
                                                                        style={{
                                                                            width: '100%',
                                                                            height: '100%',
                                                                            objectFit: 'cover',
                                                                        }}
                                                                    />
                                                                )}
                                                            </Box>
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
                    {/* Flavors Section OR Completed Box List OR Date/Time Selection */}
                    <Box sx={{
                        pt: 2,
                        pb: selectedPackaging?.name === 'Cake Jar Boxes' ? 12 : 4,
                        borderTop: '1px solid',
                        borderColor: 'divider'
                    }}>
                        {isBoxComplete && showDateTimeSelection ? (
                            /* Date/Time Selection View */
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
                                    {!selectedDate
                                        ? 'Select a Date'
                                        : `Select a Time for ${format(selectedDate, 'EEEE, MMMM do')}`}
                                </Typography>

                                {/* Step 1: Show calendar until date is selected */}
                                {!selectedDate && (
                                    <>
                                        <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', mb: 3, textAlign: 'center' }}>
                                            Orders must be placed at least 24 hours in advance.
                                        </Typography>

                                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
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
                                                        maxWidth: 400,
                                                        '& .MuiPickersDay-root': { fontSize: '1.6rem', width: '3.5rem', height: '3.5rem' },
                                                        '& .MuiDayCalendar-weekDayLabel': { fontSize: '1.6rem', fontWeight: 'bold', width: '3.5rem', height: '3.5rem' },
                                                        '& .MuiPickersCalendarHeader-root svg': { width: '2rem', height: '2rem' },
                                                        '& .MuiPickersCalendarHeader-label': { fontSize: '1.6rem' },
                                                    }}
                                                />
                                            </LocalizationProvider>
                                        </Box>

                                        {/* Back button */}
                                        <Box sx={{ mt: 3, textAlign: 'center' }}>
                                            <Box
                                                component="button"
                                                onClick={handleBackFromDateTime}
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
                                                ← Back to Box
                                            </Box>
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
                                                    onClick={() => handleTimeSelect(slot.value)}
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
                            </>
                        ) : isBoxComplete ? (
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
                                                        {flavor.name}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                                        {flavor.glutenFree && <GlutenFreeBadge size="small" />}
                                                        {flavor.vegan && <VeganBadge size="small" />}
                                                    </Box>
                                                </Box>

                                                {/* Remove button */}
                                                <Box
                                                    component="button"
                                                    onClick={() => handleRemoveFromSlot(flavor.id)}
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

                                {/* Category Toggle */}
                                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                                    <ToggleButtonGroup
                                        value={selectedFlavorCategory}
                                        exclusive
                                        onChange={handleFlavorCategoryChange}
                                        aria-label="flavor category"
                                        sx={{
                                            '& .MuiToggleButton-root': {
                                                px: 3,
                                                py: 1,
                                                textTransform: 'none',
                                                fontSize: '1.4rem',
                                                fontWeight: 500,
                                                border: '1px solid',
                                                borderColor: 'grey.300',
                                                '&.Mui-selected': {
                                                    backgroundColor: 'black',
                                                    color: 'white',
                                                    '&:hover': {
                                                        backgroundColor: '#333',
                                                    },
                                                },
                                            },
                                        }}
                                    >
                                        {(FLAVOR_CATEGORIES_BY_PACKAGING[selectedPackaging?.name] || []).map((category) => (
                                            <ToggleButton key={category.id} value={category.id}>
                                                {category.label}
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>
                                </Box>

                                {/* Flavors Grid - 3 columns */}
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: 3,
                                        maxWidth: '400px',
                                        margin: '0 auto'
                                    }}
                                >
                                    {currentFlavors.map((flavor) => (
                                        <AnimatedFlavorCircle
                                            key={flavor.name}
                                            flavor={flavor}
                                            onSelect={handleOpenJarModal}
                                            isPlaced={false}
                                        />
                                    ))}
                                </Box>
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
