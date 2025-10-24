import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Divider, IconButton, TextField, CircularProgress } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HeroImage from '@/assets/images/Surreal Creamery/Hero.png';

// A sub-component for displaying the main offer details.
const OfferDetails = ({ onViewAllDrinks }) => {
    const drinkCategories = [
        { name: 'Iced Milk Teas', id: 'iced-milk-teas' },
        { name: 'Iced Coffee', id: 'iced-coffee' },
        { name: 'Iced Fruit Black or Green Teas', id: 'iced-fruit-teas' }
    ];
    return (
        <Box>
            <Box component="img" 
                src={HeroImage}
                alt="A collection of colorful Bubble Teas"
                sx={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: 2,
                    mb: 2,
                }}
            />
            <Typography variant="h1" sx={{ mb: 2 }}>$1 Medium Bubble Tea Once a Day, Everyday.</Typography>
            <Box sx={{ textAlign: 'left', my: 1 }}>
                {drinkCategories.map((category) => (
                    <Box key={category.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                        <Typography variant="body1">{category.name}</Typography>
                        <IconButton 
                            aria-label={`More info about ${category.name}`} 
                            onClick={() => onViewAllDrinks(category.id)}
                            sx={{ p: 1 }}
                        >
                            <InfoOutlinedIcon sx={{ fontSize: '2.4rem' }} />
                        </IconButton>
                    </Box>
                ))}
            </Box>
            <Box sx={{ pt: 2 }}>
                <Button variant="grey-back" fullWidth onClick={() => onViewAllDrinks()}>View All Drinks</Button>
            </Box>
            <Divider sx={{ mt: 3 }} />
        </Box>
    );
};


const StepLocationSelection = ({ send, model, locationId, availableLocations, getPriceForModel, currentFlowType, onViewAllDrinks }) => {
    
    const showOfferSection = currentFlowType === 'explicitUtmModelOnly';
    const showBackButton = currentFlowType !== 'explicitUtmModelOnly';

    const [zipCode, setZipCode] = useState('');
    const [locationsWithDistance, setLocationsWithDistance] = useState(availableLocations);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const OPENCAGE_API_KEY = 'd980684690be46408cfd69b97e814158';

    useEffect(() => {
        setLocationsWithDistance(availableLocations);
    }, [availableLocations]);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 3959; // Radius of the Earth in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in miles
    };

// In stepLocationSelection.jsx

const handleSearch = async () => {
    if (!zipCode.match(/^\d{5}$/)) {
        setError('Please enter a valid 5-digit zip code.');
        return;
    }
    setError(null);
    setIsLoading(true);

    try {
        // 1. Get the user's coordinates from their zip code (ONLY ONE API CALL)
        const geoResponse = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${zipCode}&key=${OPENCAGE_API_KEY}&countrycode=us`);
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            throw new Error('Could not find location for that zip code.');
        }

        const userCoords = geoData.results[0].geometry;

        // 2. Use the EXISTING coordinates from your location data to calculate distance
        const updatedLocations = availableLocations.map(location => {
            if (location.coords && typeof location.coords.lat === 'number' && typeof location.coords.lng === 'number') {
                const distance = calculateDistance(userCoords.lat, userCoords.lng, location.coords.lat, location.coords.lng);
                return { ...location, distance: distance.toFixed(1) };
            }
            return { ...location, distance: null };
        });
        
        // 3. Sort the locations by the new distance property
        updatedLocations.sort((a, b) => {
            if (a.distance === null) return 1;
            if (b.distance === null) return -1;
            return a.distance - b.distance;
        });

        setLocationsWithDistance(updatedLocations);

    } catch (err) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
};

    const renderLocationList = () => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
            {(locationsWithDistance || availableLocations).map((location) => (
                <Button
                    key={location.id}
                    variant="outlined"
                    fullWidth
                    onClick={() => send({ type: 'SELECT_LOCATION', value: location.id })}
                    sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        py: 2, px: 2,
                        color: 'black',
                        borderColor: 'black',
                        textTransform: 'none',
                        textAlign: 'left',
                        '&:hover': { 
                            backgroundColor: 'rgba(0,0,0,0.04)',
                            borderColor: 'black',
                         },
                    }}
                >
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {location.name}
                        </Typography>
                        {location.address && (
                             <Typography variant="body2" color="text.secondary">
                                {location.address}
                            </Typography>
                        )}
                    </Box>
                    
                    {location.distance && (
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2, flexShrink: 0 }}>
                            {location.distance} mi
                        </Typography>
                    )}
                </Button>
            ))}
        </Box>
    );

    return (
        <>
            {showOfferSection && <OfferDetails onViewAllDrinks={onViewAllDrinks} />}
            <Box sx={{ mt: 3 }}>
                <Typography variant={showOfferSection ? "h2" : "h1"} gutterBottom>Select a Location</Typography>
                
                {model && (
                    <Typography variant="h2" color="text.secondary" sx={{ mb: 3 }}>
                        {model.name}
                    </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'flex-start' }}>
                    <TextField
                        label="Enter Zip Code"
                        variant="outlined"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        fullWidth
                        error={!!error}
                        helperText={error}
                    />
                    <Button 
                        variant="contained" 
                        onClick={handleSearch} 
                        disabled={isLoading}
                        sx={{ py: '15px', px: 3 }}
                    >
                        {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Search'}
                    </Button>
                </Box>

                {renderLocationList()}

                <Box sx={{ mt: 4, display: 'flex' }}>
                    {showBackButton && (
                        <Button variant="grey-back" onClick={() => send({ type: 'BACK' })}>
                            Back
                        </Button>
                    )}
                </Box>
            </Box>
        </>
    );
};

export default StepLocationSelection;