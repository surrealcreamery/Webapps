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
        fetch(`${LIST_LOCATIONS_URL}${cacheBuster}`).catch(() => null),
        fetch(`${LIST_EVENTS_URL}${cacheBuster}`)
    ]);

    if (!eventsRes.ok) throw new Error('Failed to fetch events');

    const locationsData = locationsRes?.ok ? await locationsRes.json() : [];
    const eventsData = await eventsRes.json();
    
    // Normalization logic
    const dayNameToNumber = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    
    const normalizedEvents = eventsData.map(event => ({
        id: event['Event ID'],
        title: event['Event Name'],
        imageUrl: event['Image URL'] || null,
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
        locationNames: event['Location Names'] || [],
        schedule: event['Schedule'] || null,
        admissionFeeCents: event['Admission Fee Cents'] || 0,
        pointsCost: event['Points Cost'] || 0,
        tournamentId: event['Tournament ID'] || null,
        termsPageSlug: event['Terms Page Slug'] || null,
        requireConsent: event['Require Consent'] || false,
        consentText: event['Consent Text'] || '',
        hideFromDirectory: event['Hide From Directory'] || false,
        seriesId: event['Series ID'] || null,
        seriesSlug: event['Series Slug'] || null,
        seriesName: event['Series Name'] || null,
        seriesCategory: event['Series Category'] || null,
        seriesCategoryOrder: event['Series Category Order'] ?? null,
        seriesBracketSize: event['Series Bracket Size'] || null,
        seriesImageUrl: event['Series Image URL'] || null,
        seriesImageAltText: event['Series Image Alt Text'] || null,
        seriesDescription: event['Series Description'] || null,
        seriesPrizesDescription: event['Series Prizes Description'] || null,
        seriesAdditionalInfo: event['Series Additional Info'] || null,
        seriesOrder: event['Series Order'] ?? null,
        seriesLinkedPages: event['Series Linked Pages'] || [],
        seriesBundleName: event['Series Bundle Name'] || null,
        seriesBundlePrice: event['Series Bundle Price'] || null,
        seriesBundleSlotNames: event['Series Bundle Slot Names'] || [],
        seriesBundleSlotData: event['Series Bundle Slot Data'] || [],
        seriesDisclaimer: event['Series Disclaimer'] || null,
    }));
    
    return {
        // Maps the global list of available locations
        locations: locationsData.map(loc => ({
            id: loc['Location ID'] || loc.id,
            type: loc.type || loc['Location Type'] || 'Store',
            'Location Name': loc['Location Name'] || loc.name,
            Address: loc['Location Address'] || [loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(', '),
            squareLocationId: loc['Square Location ID'] || loc.squareLocationId || null,
            hours: loc.hours || {},
            maxEventSize: loc.maxEventSize || null,
            imageUrl: loc.imageUrl || null,
        })),
        events: normalizedEvents
    };
};