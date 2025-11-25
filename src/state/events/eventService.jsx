// src/state/events/eventService.jsx

import { LIST_LOCATIONS_URL, LIST_EVENTS_URL } from '@/constants/events/eventsConstants';

/**
 * Fetches and normalizes the initial events and locations data, using cache-busting
 * to ensure fresh data is pulled on every load, bypassing browser/CDN/service worker caches.
 */
export const fetchInitialData = async () => {
    // Create a unique timestamp to force a network request
    const cacheBuster = `?t=${new Date().getTime()}`;

    const [locationsRes, eventsRes] = await Promise.all([
        // Append the cache buster to the URL
        fetch(`${LIST_LOCATIONS_URL}${cacheBuster}`),
        fetch(`${LIST_EVENTS_URL}${cacheBuster}`)
    ]);
    
    if (!locationsRes.ok) throw new Error(`Failed to fetch locations: ${locationsRes.statusText}`);
    if (!eventsRes.ok) throw new Error('Failed to fetch events');
    
    const locationsData = await locationsRes.json();
    const eventsData = await eventsRes.json();
    
    // Normalization logic
    const dayNameToNumber = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    
    const normalizedEvents = eventsData.map(event => ({
        id: event['Event ID'],
        title: event['Event Name'],
        imageUrl: event['Image URL'] || '/src/assets/images/placeholder.png',
        description: event['Description'],
        type: event['Event Type'] || 'Event',
        status: 'Active',
        Role: event['Role'],
        
        // ✅ Correctly maps the array of Location IDs from the API response
        locationIds: event['Location ID'] || [], 
        
        bulletPoints: event['Bullet Points']
            ? event['Bullet Points'].split('\n').map(point => ({ name: point.trim(), id: point.trim() }))
            : [],
        startDate: event['Start Date'],
        endDate: event['End Date'],
        daysOfWeek: (event['Days of Week'] || []).map(day => dayNameToNumber[day]),
        eventTimes: event['Event Times'] || [],
    }));
    
    return {
        // Maps the global list of available locations
        locations: locationsData.map(loc => ({
            id: loc['Location ID'],
            'Location Name': loc['Location Name'],
            Address: loc['Location Address']
        })),
        events: normalizedEvents
    };
};