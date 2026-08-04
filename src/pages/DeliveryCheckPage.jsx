import React, { useContext, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Box, Typography, Button, IconButton, TextField, CircularProgress, Alert, Divider, Stack
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import StoreIcon from '@mui/icons-material/Store';
import { useCart } from '@/hooks/useCart';
import { useCatalog } from '@/contexts/commerce/CatalogContext';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { trackDeliveryCheckStarted, trackDeliveryAddressEntered, trackDeliveryAddressValidated, trackDeliveryAddressFailed, trackDeliveryConfirmed, trackDeliverySwitchedToPickup } from '@/services/analytics';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBo0VtpHTnsl_iy68nHBt5hi6vPdBtcmpo';
const SHIPPING_API_URL = 'https://thugumzwi4445lq5q7qhnjfwoe0mrwjl.lambda-url.us-east-1.on.aws';

export default function DeliveryCheckPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { product, variant, quantity, modifiers, pickupLocation } = location.state || {};
    const localCart = useCart();
    const { storeLocations } = useCatalog();
    const { sendToCommerce, setIsProductDetail } = useContext(LayoutContext);

    // Address fields (populated by autocomplete or manual entry)
    const [address, setAddress] = useState({ address1: '', city: '', provinceCode: '', zip: '' });
    const [useManualEntry, setUseManualEntry] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);

    // Validation state
    const [validating, setValidating] = useState(false);
    const [result, setResult] = useState(null); // API response
    const [error, setError] = useState(null);

    // Google Maps refs
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const directionsRendererRef = useRef(null);
    const autocompleteServiceRef = useRef(null);
    const placesServiceRef = useRef(null);
    const sessionTokenRef = useRef(null);

    // If no product state, redirect back
    useEffect(() => {
        if (!product) navigate('/desserts', { replace: true });
    }, [product, navigate]);

    // Analytics: track delivery check started
    useEffect(() => {
        if (product) trackDeliveryCheckStarted(product?.id || product?.sku);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Load Google Maps script if not already loaded
    useEffect(() => {
        if (window.google?.maps) return;
        const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
        if (existing) return;
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        document.head.appendChild(script);
    }, []);

    // Initialize map with store location
    useEffect(() => {
        if (!mapContainerRef.current) return;
        const selectedLocationSlug = pickupLocation || localStorage.getItem('selectedLocation') || '';
        const storeLocation = storeLocations?.find(l => l.id === selectedLocationSlug) || storeLocations?.[0];
        if (!storeLocation?.latitude) return;

        const initMap = () => {
            if (!window.google?.maps || mapInstanceRef.current) return;
            const storeLat = storeLocation.latitude;
            const storeLng = storeLocation.longitude;
            const map = new window.google.maps.Map(mapContainerRef.current, {
                zoom: 13,
                center: { lat: storeLat, lng: storeLng },
                disableDefaultUI: true,
                zoomControl: true,
                gestureHandling: 'greedy',
            });
            // Store marker
            const storeMarker = new window.google.maps.Marker({
                position: { lat: storeLat, lng: storeLng },
                map,
                title: storeLocation.name || 'Store',
                icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                },
            });
            markersRef.current = [storeMarker];
            mapInstanceRef.current = map;
        };

        if (window.google?.maps) {
            initMap();
        } else {
            const checkInterval = setInterval(() => {
                if (window.google?.maps) {
                    clearInterval(checkInterval);
                    initMap();
                }
            }, 200);
            return () => clearInterval(checkInterval);
        }
    }, [storeLocations, pickupLocation]);

    // Hide Google's default pac-container dropdown
    useEffect(() => {
        let styleEl = document.getElementById('pac-container-hide');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'pac-container-hide';
            styleEl.textContent = '.pac-container { display: none !important; }';
            document.head.appendChild(styleEl);
        }
        return () => { styleEl?.remove(); };
    }, []);

    // Initialize AutocompleteService + PlacesService
    useEffect(() => {
        const init = () => {
            if (!window.google?.maps?.places) return;
            if (!autocompleteServiceRef.current) {
                autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
            }
            if (!placesServiceRef.current) {
                // PlacesService needs a DOM element or map
                const div = document.createElement('div');
                placesServiceRef.current = new window.google.maps.places.PlacesService(div);
            }
            if (!sessionTokenRef.current) {
                sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
            }
        };
        if (window.google?.maps?.places) {
            init();
        } else {
            const interval = setInterval(() => {
                if (window.google?.maps?.places) { init(); clearInterval(interval); }
            }, 300);
            return () => clearInterval(interval);
        }
    }, []);

    // Fetch suggestions as user types
    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        setResult(null);
        setError(null);
        setActiveIndex(-1);
        if (!val || val.length < 3 || !autocompleteServiceRef.current) {
            setSuggestions([]);
            return;
        }
        autocompleteServiceRef.current.getPlacePredictions(
            {
                input: val,
                componentRestrictions: { country: 'us' },
                types: ['address'],
                sessionToken: sessionTokenRef.current,
            },
            (predictions, status) => {
                if (status === 'OK' && predictions) {
                    setSuggestions(predictions);
                } else {
                    setSuggestions([]);
                }
            }
        );
    };

    // Keyboard navigation for address suggestions listbox
    const handleSuggestionKeyDown = (e) => {
        if (suggestions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            handleSelectSuggestion(suggestions[activeIndex].place_id);
        } else if (e.key === 'Escape') {
            setSuggestions([]);
            setActiveIndex(-1);
        }
    };

    // User selects a suggestion — get place details then validate
    const handleSelectSuggestion = (placeId) => {
        setSuggestions([]);
        setActiveIndex(-1);
        if (!placesServiceRef.current) return;
        placesServiceRef.current.getDetails(
            {
                placeId,
                fields: ['address_components', 'formatted_address'],
                sessionToken: sessionTokenRef.current,
            },
            (place, status) => {
                // Reset session token after getDetails
                sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
                if (status !== 'OK' || !place?.address_components) {
                    setUseManualEntry(true);
                    return;
                }
                const get = (type, short) => {
                    const c = place.address_components.find(c => c.types.includes(type));
                    return c ? (short ? c.short_name : c.long_name) : '';
                };
                const parsed = {
                    address1: `${get('street_number')} ${get('route')}`.trim(),
                    city: get('locality') || get('sublocality_level_1'),
                    provinceCode: get('administrative_area_level_1', true),
                    zip: get('postal_code'),
                };
                setInputValue(place.formatted_address || `${parsed.address1}, ${parsed.city}, ${parsed.provinceCode} ${parsed.zip}`);
                setAddress(parsed);
                trackDeliveryAddressEntered('autocomplete');
                validateAddress(parsed);
            }
        );
    };

    // Validate address with the API
    const validateAddress = async (addr) => {
        const a = addr || address;
        if (!a.address1 || !a.city || !a.provinceCode || !a.zip) {
            setError('Please fill in all address fields.');
            return;
        }
        setValidating(true);
        setError(null);
        setResult(null);
        try {
            const selectedLocationSlug = pickupLocation || localStorage.getItem('selectedLocation') || '';
            const res = await fetch(SHIPPING_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'checkDeliveryAvailability',
                    deliveryAddress: a,
                    pickupLocation: selectedLocationSlug,
                }),
            });
            const data = await res.json();
            const parsed = typeof data.body === 'string' ? JSON.parse(data.body) : data;
            if (parsed.error) {
                setError(parsed.error);
                trackDeliveryAddressFailed(parsed.error, parsed.distanceMiles);
                return;
            }
            // $0.00 delivery fee = invalid quote, treat as unavailable
            if (parsed.available && parsed.deliveryFee === 0) {
                setError('Delivery is not available for this address at this time.');
                trackDeliveryAddressFailed('zero_fee', parsed.distanceMiles);
                return;
            }
            trackDeliveryAddressValidated(parsed.available, parsed.distanceMiles, parsed.deliveryFee, parsed.estimatedMinutes);
            setResult(parsed);
            updateMapMarkers(parsed);
        } catch (err) {
            console.error('[DeliveryCheck] Error:', err);
            trackDeliveryAddressFailed(err.message, null);
            setError('Failed to validate address. Please try again.');
        } finally {
            setValidating(false);
        }
    };

    // Decode Google encoded polyline string into array of {lat, lng}
    const decodePolyline = (encoded) => {
        const points = [];
        let index = 0, lat = 0, lng = 0;
        while (index < encoded.length) {
            let shift = 0, result = 0, byte;
            do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);
            shift = 0; result = 0;
            do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);
            points.push({ lat: lat / 1e5, lng: lng / 1e5 });
        }
        return points;
    };

    // Fetch route from Routes API and draw polyline on map
    const fetchAndDrawRoute = async (map, data) => {
        try {
            const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                    'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
                },
                body: JSON.stringify({
                    origin: { location: { latLng: { latitude: data.storeLat, longitude: data.storeLng } } },
                    destination: { location: { latLng: { latitude: data.deliveryLat, longitude: data.deliveryLng } } },
                    travelMode: 'DRIVE',
                }),
            });
            const json = await res.json();
            const encoded = json?.routes?.[0]?.polyline?.encodedPolyline;
            if (encoded) {
                const path = decodePolyline(encoded);
                const polyline = new window.google.maps.Polyline({
                    path,
                    strokeColor: data.available ? '#1976d2' : '#d32f2f',
                    strokeOpacity: 0.8,
                    strokeWeight: 5,
                    map,
                });
                directionsRendererRef.current = polyline;
                // Fit bounds to route
                const bounds = new window.google.maps.LatLngBounds();
                path.forEach(p => bounds.extend(p));
                map.fitBounds(bounds, 60);
            } else {
                console.warn('[DeliveryCheck] No route returned:', json);
                fallbackFitBounds(map, data);
            }
        } catch (err) {
            console.warn('[DeliveryCheck] Routes API error:', err);
            fallbackFitBounds(map, data);
        }
    };

    const fallbackFitBounds = (map, data) => {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat: data.storeLat, lng: data.storeLng });
        bounds.extend({ lat: data.deliveryLat, lng: data.deliveryLng });
        map.fitBounds(bounds, 60);
    };

    // Update map with driving route between store and delivery address
    const updateMapMarkers = (data) => {
        const map = mapInstanceRef.current;
        if (!map || !window.google?.maps) return;
        if (!data?.storeLat || !data?.deliveryLat) return;

        // Remove old delivery marker (keep store marker at index 0)
        markersRef.current.slice(1).forEach(m => m.setMap(null));
        markersRef.current = markersRef.current.slice(0, 1);

        // Clear previous route polyline
        if (directionsRendererRef.current) {
            directionsRendererRef.current.setMap(null);
            directionsRendererRef.current = null;
        }

        // Update store marker position
        if (markersRef.current[0]) {
            markersRef.current[0].setPosition({ lat: data.storeLat, lng: data.storeLng });
        }

        // Add delivery marker
        const deliveryMarker = new window.google.maps.Marker({
            position: { lat: data.deliveryLat, lng: data.deliveryLng },
            map,
            title: 'Delivery Address',
            icon: data.available
                ? { url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' }
                : { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' },
        });
        markersRef.current.push(deliveryMarker);

        // Draw driving route via Routes API (REST)
        fetchAndDrawRoute(map, data);
    };

    // Add to cart and navigate back
    const handleAddToCart = () => {
        trackDeliveryConfirmed(result?.deliveryFee, pickupLocation || localStorage.getItem('selectedLocation') || '');
        localCart.addToCart(product, variant, quantity || 1, modifiers || [], { fulfillmentMethod: 'delivery' });
        // Store the delivery address + fee for CartDrawer
        localStorage.setItem('deliveryAddress', JSON.stringify({
            ...address,
            shipdayDeliveryFee: result?.deliveryFee || 0,
            estimatedMinutes: result?.estimatedMinutes || null,
        }));
        setIsProductDetail(false);
        sendToCommerce({ type: 'CLOSE_PRODUCT' });
        sendToCommerce({ type: 'SET_FEED_ACTIVE', active: false });
        navigate('/desserts', { replace: true });
        setTimeout(() => sendToCommerce({ type: 'ADDED_TO_CART' }), 100);
    };

    // Switch to pickup
    const handleSwitchToPickup = () => {
        trackDeliverySwitchedToPickup(product?.id);
        localCart.addToCart(product, variant, quantity || 1, modifiers || [], { fulfillmentMethod: 'pickup' });
        setIsProductDetail(false);
        sendToCommerce({ type: 'CLOSE_PRODUCT' });
        sendToCommerce({ type: 'SET_FEED_ACTIVE', active: false });
        navigate('/desserts', { replace: true });
        setTimeout(() => sendToCommerce({ type: 'ADDED_TO_CART' }), 100);
    };

    if (!product) return null;

    const productImage = variant?.image?.url || variant?.image?.src || product?.images?.[0]?.url || product?.imageUrl || '';
    const productName = product?.name || product?.title || '';
    const variantName = variant?.name || (variant?.title !== 'Default Title' ? variant?.title : '') || '';
    const price = parseFloat(variant?.price?.amount || variant?.price || 0);

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'white', pb: 4 }}>
            <Helmet><title>Delivery Check | Surreal Creamery</title></Helmet>
            {/* Header */}
            <Box sx={{
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', gap: 1,
                borderBottom: '1px solid #e0e0e0',
                position: 'sticky', top: 0, zIndex: 10, bgcolor: 'white',
            }}>
                <IconButton onClick={() => navigate(-1)} sx={{ color: 'text.primary' }} aria-label="Go back">
                    <ArrowBackIcon />
                </IconButton>
                <LocalShippingIcon color="action" aria-hidden="true" />
                <Typography variant="h6" component="h1">Check Delivery Availability</Typography>
            </Box>

            <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 3 }}>
                {/* Product Summary */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
                    {productImage && (
                        <Box
                            component="img"
                            src={productImage}
                            alt={productName}
                            sx={{ width: 64, height: 64, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                        />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }} noWrap>{productName}</Typography>
                        {variantName && <Typography sx={{ fontSize: '1.6rem', lineHeight: 1.3 }} noWrap>{variantName}</Typography>}
                        <Typography sx={{ fontSize: '1.6rem', lineHeight: 1.3 }}>
                            {quantity > 1 ? `${quantity} x ` : ''}${price.toFixed(2)}
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Address Input */}
                <Typography sx={{ fontSize: '1.6rem' }}>Enter your address to see if you're in our local delivery zone.</Typography>
                <Box sx={{ height: 16 }} />
                {!useManualEntry ? (
                    <Box sx={{ mb: 2 }}>
                        <TextField
                            fullWidth
                            placeholder="Start typing your address..."
                            label="Street address"
                            autoComplete="off"
                            autoFocus
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleSuggestionKeyDown}
                            inputProps={{
                                role: 'combobox',
                                'aria-expanded': suggestions.length > 0,
                                'aria-controls': 'address-suggestions-listbox',
                                'aria-activedescendant': activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined,
                                'aria-autocomplete': 'list',
                            }}
                        />
                        {suggestions.length > 0 && (
                            <Box role="listbox" id="address-suggestions-listbox" aria-label="Address suggestions">
                                {suggestions.map((s, index) => (
                                    <Box
                                        key={s.place_id}
                                        id={`suggestion-${index}`}
                                        role="option"
                                        aria-selected={index === activeIndex}
                                        tabIndex={-1}
                                        onClick={() => handleSelectSuggestion(s.place_id)}
                                        sx={{
                                            py: 1.5, px: 1,
                                            fontSize: '1.6rem',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #f0f0f0',
                                            bgcolor: index === activeIndex ? '#e3f2fd' : 'transparent',
                                            '&:hover': { bgcolor: '#f5f5f5' },
                                        }}
                                    >
                                        {s.description}
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Box>
                ) : (
                    <Stack spacing={2} sx={{ mb: 2 }}>
                        <TextField label="Street address" fullWidth required autoFocus
                            value={address.address1}
                            onChange={e => setAddress(prev => ({ ...prev, address1: e.target.value }))} />
                        <TextField label="City" fullWidth required
                            value={address.city}
                            onChange={e => setAddress(prev => ({ ...prev, city: e.target.value }))} />
                        <Stack direction="row" spacing={2}>
                            <TextField label="State" sx={{ width: 120 }} required
                                value={address.provinceCode}
                                onChange={e => setAddress(prev => ({ ...prev, provinceCode: e.target.value.toUpperCase().slice(0, 2) }))}
                                inputProps={{ maxLength: 2 }} />
                            <TextField label="ZIP code" sx={{ width: 160 }} required
                                value={address.zip}
                                onChange={e => setAddress(prev => ({ ...prev, zip: e.target.value.slice(0, 5) }))}
                                inputProps={{ maxLength: 5 }} />
                        </Stack>
                        <Button
                            variant="contained"
                            onClick={() => { trackDeliveryAddressEntered('manual'); validateAddress(); }}
                            disabled={validating || !address.address1 || !address.city || !address.provinceCode || !address.zip}
                            aria-label={validating ? 'Validating address' : 'Check Availability'}
                        >
                            {validating ? <CircularProgress size={20} aria-label="Loading" /> : 'Check Availability'}
                        </Button>
                    </Stack>
                )}

                {/* Error */}
                {error && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{error}</Alert>}

                {/* Validating spinner */}
                {validating && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }} role="status" aria-live="polite" aria-busy="true">
                        <CircularProgress aria-label="Loading" />
                    </Box>
                )}

                {/* Map (hidden for now) */}
                <Box ref={mapContainerRef} sx={{ display: 'none' }} />

                {/* Delivery Result */}
                {result && (
                    <Box aria-live="polite">
                        <Divider sx={{ mb: 2 }} />
                        {result.available ? (
                            <>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <LocalShippingIcon sx={{ color: 'success.main' }} aria-hidden="true" />
                                    <Typography sx={{ fontSize: '1.6rem', color: 'success.main' }}>
                                        Delivery Available
                                    </Typography>
                                </Box>
                                <Stack spacing={1.5}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography sx={{ fontSize: '1.6rem' }} >Distance</Typography>
                                        <Typography sx={{ fontSize: '1.6rem' }}>{result.distanceMiles} miles</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography sx={{ fontSize: '1.6rem' }} >Delivery Fee</Typography>
                                        <Typography sx={{ fontSize: '1.6rem' }}>${result.deliveryFee.toFixed(2)}</Typography>
                                    </Box>
                                    {result.estimatedMinutes != null && (
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography sx={{ fontSize: '1.6rem' }} >Estimated Time</Typography>
                                        <Typography sx={{ fontSize: '1.6rem' }}>~{result.estimatedMinutes} min</Typography>
                                    </Box>
                                    )}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography sx={{ fontSize: '1.6rem' }} >From</Typography>
                                        <Typography sx={{ fontSize: '1.6rem' }}>{result.storeName}</Typography>
                                    </Box>
                                </Stack>
                                <Button
                                    variant="contained"
                                    fullWidth
                                    onClick={handleAddToCart}
                                    sx={{
                                        mt: 3,
                                        py: 1.5,
                                        fontSize: '1.6rem',
                                        fontWeight: 600,
                                        textTransform: 'none',
                                        borderRadius: 3,
                                        bgcolor: 'black',
                                        '&:hover': { bgcolor: 'grey.800' },
                                    }}
                                >
                                    Add to Cart &mdash; Deliver for ${result.deliveryFee.toFixed(2)}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <LocalShippingIcon sx={{ color: 'error.main' }} aria-hidden="true" />
                                    <Typography sx={{ fontSize: '1.6rem', color: 'error.main' }}>
                                        Out of Delivery Range
                                    </Typography>
                                </Box>
                                <Typography sx={{ fontSize: '1.6rem', mb: 1.5 }} >
                                    {result.message}
                                </Typography>
                                {result.distanceMiles && (
                                    <Stack spacing={1.5} sx={{ mb: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography sx={{ fontSize: '1.6rem' }} >Distance</Typography>
                                            <Typography sx={{ fontSize: '1.6rem' }}>{result.distanceMiles} miles</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography sx={{ fontSize: '1.6rem' }} >Max Delivery Range</Typography>
                                            <Typography sx={{ fontSize: '1.6rem' }}>{result.maxDeliveryMiles} miles</Typography>
                                        </Box>
                                    </Stack>
                                )}
                                <Button
                                    variant="contained"
                                    fullWidth
                                    startIcon={<StoreIcon aria-hidden="true" />}
                                    onClick={handleSwitchToPickup}
                                    sx={{
                                        mt: 1,
                                        py: 1.5,
                                        fontSize: '1.6rem',
                                        fontWeight: 600,
                                        textTransform: 'none',
                                        borderRadius: 3,
                                        bgcolor: 'black',
                                        '&:hover': { bgcolor: 'grey.800' },
                                    }}
                                >
                                    Switch to Pickup Instead
                                </Button>
                            </>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}
