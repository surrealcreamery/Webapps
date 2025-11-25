import React, { useRef, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import GooglePlacesAutocomplete, { geocodeByAddress } from 'react-google-places-autocomplete';
import { GOOGLE_MAPS_API_KEY } from '@/constants/catering/cateringConstants';

// Helper to parse the address components
const getAddressComponent = (place, type, useShortName = false) => {
    const component = place.address_components.find(c => c.types.includes(type));
    return component ? (useShortName ? component.short_name : component.long_name) : '';
};
const getStreet = (place) => {
    const streetNumber = getAddressComponent(place, 'street_number');
    const route = getAddressComponent(place, 'route');
    return `${streetNumber} ${route}`.trim();
};

export const GoogleAddressAutocomplete = ({ value, sendToCatering, onAddressSelected }) => {
    
    // The `defaultValue` is set by the `value` prop (the full address text)
    const initialValue = value ? { label: value, value } : null;
    console.log(`%c[Autocomplete] Rendering. Initial 'value' from prop:`, 'color: #gray', value);

    const selectRef = useRef(null);

    useEffect(() => {
        // When the component re-mounts with an empty value (because it was just cleared)
        // and the ref is attached, manually focus it.
        if (!value && selectRef.current) {
            selectRef.current.focus();
        }
    }, [value]); // This effect runs every time 'value' changes

    const handleFocus = () => {
        // This logic is correct: only clear if there's a value
        if (value) {
            sendToCatering({ type: 'CLEAR_DELIVERY_ADDRESS' });
        }
    };

    const handleSelect = (place) => {
        console.log('%c[Autocomplete] handleSelect triggered.', 'color: #00A86B');
        
        if (!place) {
            console.log('%c[Autocomplete] handleSelect: No place selected (clear).', 'color: #00A86B');
            onAddressSelected(false);
            sendToCatering({ type: 'CLEAR_DELIVERY_ADDRESS' });
            return;
        }
        
        console.log('%c[Autocomplete] handleSelect: Place selected:', 'color: #00A86B', place.label);

        geocodeByAddress(place.label)
            .then(results => {
                const placeResult = results[0];
                if (!placeResult || !placeResult.address_components) {
                    console.warn("[Autocomplete] Geocode found no components. Using raw input.");
                    sendToCatering({ type: 'UPDATE_DELIVERY_ADDRESS', field: 'street', value: place.label });
                    onAddressSelected(false); // Treat as manual entry
                    return;
                }
                
                const address = {
                    street: getStreet(placeResult),
                    city: getAddressComponent(placeResult, 'locality'),
                    state: getAddressComponent(placeResult, 'administrative_area_level_1', true), // 'NY'
                    zip: getAddressComponent(placeResult, 'postal_code'),
                    fullAddressText: place.label // The full text for re-populating
                };
                
                console.log('%c[Autocomplete] handleSelect: Geocode SUCCESS. Sending address to machine:', 'color: #00A86B', address);
                sendToCatering({ type: 'SET_FULL_DELIVERY_ADDRESS', address: address });
                onAddressSelected(true); // Report success
            })
            .catch(error => {
                 console.error('[Autocomplete] Geocode FAILED:', error);
                 sendToCatering({ type: 'UPDATE_DELIVERY_ADDRESS', field: 'street', value: place.label });
                 onAddressSelected(false); // Treat as manual entry
            });
    };
    
    // This is the custom component that will render instead of "No Options"
    const CustomNoOptionsMessage = (props) => {
        const { inputValue } = props.selectProps; 

        if (!inputValue) {
            return (
                <Typography variant="body2" sx={{ p: 2, textAlign: 'center', cursor: 'default' }}>
                    Please start typing an address.
                </Typography>
            );
        }

        return (
            <Box sx={{ p: 2, textAlign: 'center', cursor: 'default' }}>
                <Typography variant="body2" sx={{ mb: 1 }}>No address found.</Typography>
                <Button 
                    variant="outlined" 
                    onClick={() => onAddressSelected(false)} 
                >
                    Enter Address Manually
                </Button>
            </Box>
        );
    };

    return (
        <Box sx={{ position: 'relative', zIndex: 1301 }}> 
            <GooglePlacesAutocomplete
                key={value || 'empty'}
                apiKey={GOOGLE_MAPS_API_KEY}
                apiOptions={{ libraries: ['places'] }}
                selectProps={{
                    ref: selectRef,
                    defaultValue: initialValue,
                    onChange: handleSelect,
                    onFocus: handleFocus,
                    placeholder: 'Start typing your street address...',
                    styles: {
                        input: (provided) => ({
                            ...provided,
                            padding: '7.5px 14px',
                        }),
                        control: (provided, state) => ({
                            ...provided,
                            minHeight: '40px',
                            border: state.isFocused ? '1px solid #1976d2' : '1px solid rgba(0, 0, 0, 0.23)',
                            borderRadius: '4px',
                            boxShadow: state.isFocused ? '0 0 0 1px #1976d2' : 'none',
                            '&:hover': {
                                border: '1px solid #000',
                            }
                        }),
                        placeholder: (provided) => ({
                            ...provided,
                            color: 'rgba(0, 0, 0, 0.6)',
                            marginLeft: '15px' // ✅ UPDATED
                        }),
                        singleValue: (provided) => ({
                            ...provided,
                            marginLeft: '15px' // ✅ UPDATED
                        }),
                    },
                    components: {
                        NoOptionsMessage: CustomNoOptionsMessage
                    }
                }}
                autocompletionRequest={{
                    componentRestrictions: { country: ['us'] }
                }}
            />
        </Box>
    );
};