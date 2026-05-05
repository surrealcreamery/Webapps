import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Typography, Chip, Button, CircularProgress, useMediaQuery } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import PhoneIcon from '@mui/icons-material/Phone';
import DirectionsIcon from '@mui/icons-material/Directions';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '@/contexts/commerce/CatalogContext';
import { getLocationFromIP, calculateDistance } from '@/components/commerce/geolocation';
import JsonLd from '@/components/seo/JsonLd';
import { buildLocalBusinessSchema } from '@/components/seo/schemas';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBo0VtpHTnsl_iy68nHBt5hi6vPdBtcmpo';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isOpenNow(hours) {
    if (!hours || Object.keys(hours).length === 0) return null;
    const now = new Date();
    const day = now.getDay();
    const dayData = hours[day];
    if (!dayData) return false;
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const [openH, openM] = (dayData.open || '').split(':').map(Number);
    const [closeH, closeM] = (dayData.close || '').split(':').map(Number);
    const openTime = openH * 100 + openM;
    const closeTime = closeH * 100 + closeM;
    return currentTime >= openTime && currentTime < closeTime;
}

function formatHoursLine(hours, dayIdx) {
    const dayData = hours?.[dayIdx];
    if (!dayData) return 'Closed';
    return `${dayData.open} - ${dayData.close}`;
}

const Locations = () => {
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width:768px)');
    const { storeLocations } = useCatalog();
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const infoWindowRef = useRef(null);
    const [userCoords, setUserCoords] = useState(null);
    const [mapReady, setMapReady] = useState(false);

    // Filter to stores only
    const stores = useMemo(() => {
        const filtered = (storeLocations || []).filter(l => l.type === 'Store');
        if (!userCoords) return filtered;
        return filtered
            .map(loc => ({
                ...loc,
                distance: loc.latitude && loc.longitude
                    ? calculateDistance(userCoords.latitude, userCoords.longitude, loc.latitude, loc.longitude)
                    : Infinity,
            }))
            .sort((a, b) => a.distance - b.distance);
    }, [storeLocations, userCoords]);

    // Get user location for distance sorting
    useEffect(() => {
        getLocationFromIP().then(loc => {
            if (loc?.latitude && loc?.longitude) {
                setUserCoords({ latitude: loc.latitude, longitude: loc.longitude });
            }
        }).catch(() => {});
    }, []);

    // Load Google Maps script
    useEffect(() => {
        if (window.google?.maps) { setMapReady(true); return; }
        const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
        if (existing) { existing.addEventListener('load', () => setMapReady(true)); setMapReady(!!window.google?.maps); return; }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
        script.async = true;
        script.onload = () => setMapReady(true);
        document.head.appendChild(script);
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapReady || !mapContainerRef.current || !stores.length) return;
        if (mapInstanceRef.current) return;

        const bounds = new window.google.maps.LatLngBounds();
        const map = new window.google.maps.Map(mapContainerRef.current, {
            zoom: 10,
            center: { lat: stores[0].latitude || 40.7128, lng: stores[0].longitude || -73.9781 },
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
        });
        mapInstanceRef.current = map;
        infoWindowRef.current = new window.google.maps.InfoWindow();

        stores.forEach(location => {
            if (!location.latitude || !location.longitude) return;
            const marker = new window.google.maps.Marker({
                position: { lat: location.latitude, lng: location.longitude },
                map,
                title: location.name,
            });
            bounds.extend(marker.getPosition());

            marker.addListener('click', () => {
                const fullAddress = [location.address, location.city, location.state, location.zip].filter(Boolean).join(', ');
                const encodedAddress = encodeURIComponent(fullAddress);
                infoWindowRef.current.setContent(
                    `<div style="font-family:Outfit,sans-serif;padding:4px;">` +
                    `<strong style="font-size:14px;">${location.name}</strong><br/>` +
                    `<span style="font-size:12px;color:#666;">${fullAddress}</span><br/>` +
                    `<a href="https://www.google.com/maps/search/?api=1&query=${encodedAddress}" target="_blank" ` +
                    `style="font-size:12px;color:#1976d2;text-decoration:none;">Get Directions</a>` +
                    `</div>`
                );
                infoWindowRef.current.open(map, marker);
            });

            markersRef.current.push(marker);
        });

        if (markersRef.current.length > 1) {
            map.fitBounds(bounds, 50);
        }
    }, [mapReady, stores]);

    const handleGetDirections = (location) => {
        const fullAddress = [location.address, location.city, location.state, location.zip].filter(Boolean).join(', ');
        const encodedAddress = encodeURIComponent(fullAddress);
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    };

    // Keyboard-accessible way to trigger info window from sidebar (SC 2.1.1)
    const handleCardSelect = (location, idx) => {
        const map = mapInstanceRef.current;
        const marker = markersRef.current[idx];
        if (!map || !marker) return;

        const fullAddress = [location.address, location.city, location.state, location.zip].filter(Boolean).join(', ');
        const encodedAddress = encodeURIComponent(fullAddress);
        infoWindowRef.current.setContent(
            `<div style="font-family:Outfit,sans-serif;padding:4px;">` +
            `<strong style="font-size:14px;">${location.name}</strong><br/>` +
            `<span style="font-size:12px;color:#666;">${fullAddress}</span><br/>` +
            `<a href="https://www.google.com/maps/search/?api=1&query=${encodedAddress}" target="_blank" ` +
            `style="font-size:12px;color:#1976d2;text-decoration:none;">Get Directions</a>` +
            `</div>`
        );
        infoWindowRef.current.open(map, marker);
        map.panTo(marker.getPosition());
    };

    return (
        <>
            <Helmet>
                <title>Store Locations | Surreal Creamery</title>
                <meta name="description" content="Find a Surreal Creamery location near you. Visit us for ice cream, desserts, and tokidoki collectibles." />
            </Helmet>

            {stores.map(location => (
                <JsonLd key={location.id} data={buildLocalBusinessSchema(location)} />
            ))}

            <Box component="main" sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : 'calc(100vh - 200px)', minHeight: isMobile ? 'auto' : 500 }}>
                {/* Location Cards — keyboard-accessible alternative to map info windows (WCAG SC 2.1.1) */}
                <Box
                    component="nav"
                    aria-label="Store locations list"
                    sx={{
                        width: isMobile ? '100%' : 420,
                        flexShrink: 0,
                        overflowY: 'auto',
                        borderRight: isMobile ? 'none' : '1px solid #e0e0e0',
                        order: isMobile ? 2 : 1,
                    }}
                >
                    <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, fontSize: '2.4rem' }}>
                            Our Locations
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {stores.length} store{stores.length !== 1 ? 's' : ''}
                        </Typography>
                    </Box>

                    {stores.length === 0 ? (
                        <Box sx={{ p: 4, textAlign: 'center' }} role="status" aria-live="polite" aria-busy="true">
                            <CircularProgress size={24} aria-label="Loading" />
                            <Typography sx={{ mt: 2 }} color="text.secondary">Loading locations...</Typography>
                        </Box>
                    ) : (
                        stores.map((location, idx) => {
                            const open = isOpenNow(location.hours);
                            return (
                                <Box
                                    key={location.id}
                                    component="article"
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`${location.name}${location.address ? `, ${location.address}` : ''}${open !== null ? (open ? ', currently open' : ', currently closed') : ''}. Press Enter to show on map.`}
                                    onClick={() => handleCardSelect(location, idx)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardSelect(location, idx); } }}
                                    sx={{ p: 2, borderBottom: '1px solid #f0f0f0', cursor: 'pointer', '&:hover': { bgcolor: '#fafafa' }, '&:focus': { outline: '2px solid #1976d2', outlineOffset: -2 } }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Typography sx={{ fontWeight: 600, fontSize: '1.8rem' }}>{location.name}</Typography>
                                        {open !== null && (
                                            <Chip
                                                label={open ? 'Open Now' : 'Closed'}
                                                size="small"
                                                sx={{
                                                    bgcolor: open ? '#e8f5e9' : '#ffebee',
                                                    color: open ? '#2e7d32' : '#c62828',
                                                    fontWeight: 600,
                                                    fontSize: '1.2rem',
                                                }}
                                            />
                                        )}
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{[location.address, location.city, location.state, location.zip].filter(Boolean).join(', ')}</Typography>
                                    {location.phone && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{location.phone}</Typography>
                                    )}

                                    {/* Hours */}
                                    {location.hours && Object.keys(location.hours).length > 0 && (
                                        <Box sx={{ mb: 1.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} aria-hidden="true" />
                                                <Typography variant="body2" component="span" sx={{ fontWeight: 600, fontSize: '1.2rem' }}>Hours</Typography>
                                            </Box>
                                            <dl style={{ margin: 0, padding: 0 }}>
                                                {DAY_NAMES.map((day, idx) => (
                                                    <Box key={idx} component="div" sx={{ display: 'flex', justifyContent: 'space-between', px: 2 }}>
                                                        <Typography variant="body2" component="dt" color="text.secondary" sx={{ fontSize: '1.2rem', width: 32 }}>{day}</Typography>
                                                        <Typography variant="body2" component="dd" color="text.secondary" sx={{ fontSize: '1.2rem', m: 0 }}>{formatHoursLine(location.hours, idx)}</Typography>
                                                    </Box>
                                                ))}
                                            </dl>
                                        </Box>
                                    )}

                                    {/* Distance */}
                                    {location.distance && location.distance !== Infinity && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '1.2rem' }}>
                                            {location.distance < 0.1 ? '< 0.1' : location.distance.toFixed(1)} mi away
                                        </Typography>
                                    )}

                                    {/* Actions */}
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<DirectionsIcon />}
                                            onClick={() => handleGetDirections(location)}
                                            sx={{ textTransform: 'none', fontSize: '1.2rem', borderColor: '#ccc', color: '#333' }}
                                        >
                                            Get Directions
                                        </Button>
                                        {location.phone && (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<PhoneIcon />}
                                                href={`tel:${location.phone}`}
                                                sx={{ textTransform: 'none', fontSize: '1.2rem', borderColor: '#ccc', color: '#333' }}
                                            >
                                                Call
                                            </Button>
                                        )}
                                        <Button
                                            size="small"
                                            variant="contained"
                                            startIcon={<ShoppingBagIcon />}
                                            onClick={() => navigate('/desserts')}
                                            sx={{ textTransform: 'none', fontSize: '1.2rem', bgcolor: 'black', '&:hover': { bgcolor: '#333' } }}
                                        >
                                            Order Online
                                        </Button>
                                    </Box>
                                </Box>
                            );
                        })
                    )}
                </Box>

                {/* Map — supplementary visual; all location info is available in the sidebar list (WCAG SC 2.1.1) */}
                <Box
                    ref={mapContainerRef}
                    role="application"
                    aria-label="Store locations map — all location details are also available in the locations list"
                    aria-describedby="map-a11y-note"
                    sx={{
                        flex: 1,
                        minHeight: isMobile ? 300 : 'auto',
                        order: isMobile ? 1 : 2,
                        bgcolor: '#f5f5f5',
                    }}
                />
                {/* Visually hidden note for assistive tech */}
                <Box id="map-a11y-note" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                    All location information shown on the map (name, address, directions) is also available in the location cards list. Select a location card to highlight it on the map.
                </Box>
            </Box>
        </>
    );
};

export default Locations;
