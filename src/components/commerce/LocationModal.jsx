import React from 'react';
import { 
    Dialog, 
    DialogContent,
    IconButton,
    Button,
    Box, 
    Typography,
    useMediaQuery,
    useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PhoneIcon from '@mui/icons-material/Phone';
import DirectionsIcon from '@mui/icons-material/Directions';
import { trackLocationChanged } from '@/services/analytics';

export const LocationModal = ({ open, onClose, selectedLocationId, onSelectLocation, locations = [] }) => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));

    const handleSelectLocation = (locationId) => {
        trackLocationChanged(locationId, locations.find(l => l.id === locationId)?.name);
        onSelectLocation(locationId);
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={isSmallScreen}
            maxWidth="md"
            fullWidth
            scroll="body"
            aria-labelledby="location-modal-title"
            PaperProps={{
                sx: {
                    borderRadius: isSmallScreen ? 0 : 2,
                    maxHeight: isSmallScreen ? '100%' : '90vh',
                    margin: isSmallScreen ? 0 : 2,
                    maxWidth: isSmallScreen ? '100%' : '600px',
                },
            }}
            sx={{
                '& .MuiBackdrop-root': {
                    backgroundColor: isSmallScreen ? 'transparent' : 'rgba(0, 0, 0, 0.5)',
                }
            }}
        >
            {/* Close Button */}
            <IconButton
                aria-label="Close location selector"
                onClick={onClose}
                sx={{
                    position: 'absolute',
                    right: 12,
                    top: 12,
                    color: 'grey.700',
                    backgroundColor: 'white',
                    boxShadow: 1,
                    zIndex: 10,
                    '&:hover': {
                        backgroundColor: 'grey.100',
                    }
                }}
            >
                <CloseIcon />
            </IconButton>

            <DialogContent sx={{ p: 4 }}>
                {selectedLocationId ? (
                    <>
                        {/* Has Selected Location - Show current store */}
                        <Typography id="location-modal-title" variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                            Store You're Currently Shopping
                        </Typography>

                        {/* Currently Selected Location */}
                        {locations.filter(loc => loc.id === selectedLocationId).map((location) => (
                    <Box key={location.id}>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                py: 3,
                            }}
                        >
                            {/* Location Info - Left aligned */}
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                    {location.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {location.address}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {location.phone}
                                </Typography>
                            </Box>

                            {/* Action Icons and Selected Text - Right aligned */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, ml: 2 }}>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    {/* Call Icon */}
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <IconButton
                                            component="a"
                                            href={`tel:${location.phone}`}
                                            aria-label="Call store"
                                            sx={{
                                                backgroundColor: 'grey.100',
                                                '&:hover': {
                                                    backgroundColor: 'grey.200'
                                                }
                                            }}
                                        >
                                            <PhoneIcon aria-hidden="true" />
                                        </IconButton>
                                        <Typography variant="body2" sx={{ mt: 0.5 }} aria-hidden="true">
                                            Call
                                        </Typography>
                                    </Box>

                                    {/* Directions Icon */}
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <IconButton
                                            component="a"
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Get directions"
                                            sx={{
                                                backgroundColor: 'grey.100',
                                                '&:hover': {
                                                    backgroundColor: 'grey.200'
                                                }
                                            }}
                                        >
                                            <DirectionsIcon aria-hidden="true" />
                                        </IconButton>
                                        <Typography variant="body2" sx={{ mt: 0.5 }} aria-hidden="true">
                                            Directions
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* Selected Text */}
                                <Typography 
                                    variant="body1" 
                                    sx={{ 
                                        color: 'success.main',
                                        fontWeight: 600
                                    }}
                                >
                                    Selected
                                </Typography>
                            </Box>
                        </Box>
                        
                        {/* Divider after selected location */}
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }} />
                    </Box>
                ))}

                {/* Section Header for Other Locations */}
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                    {selectedLocationId ? 'Select a Different Location' : 'Select a Location'}
                </Typography>
                    </>
                ) : (
                    <>
                        {/* No Selected Location - Just show title */}
                        <Typography id="location-modal-title" variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                            Select a Location
                        </Typography>
                    </>
                )}

                {/* Locations List - Show all locations if none selected, or non-selected ones if one is selected */}
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {locations.filter(loc => loc.id !== selectedLocationId).map((location, index, filteredArray) => (
                        <React.Fragment key={location.id}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    py: 3,
                                }}
                            >
                                {/* Location Info - Left aligned */}
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                        {location.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {location.address}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {location.phone}
                                    </Typography>
                                    <Button
                                        variant="text"
                                        component="a"
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{
                                            mt: 0.5,
                                            p: 0,
                                            minWidth: 'auto',
                                            textDecoration: 'underline',
                                            fontSize: 'inherit',
                                            textTransform: 'none',
                                        }}
                                    >
                                        Get Directions
                                    </Button>
                                </Box>

                                {/* Select Button - Right aligned */}
                                <Button
                                    variant="contained"
                                    onClick={() => handleSelectLocation(location.id)}
                                    aria-label={`Select ${location.name}`}
                                    sx={{
                                        backgroundColor: '#000000',
                                        color: '#ffffff',
                                        '&:hover': {
                                            backgroundColor: '#333333'
                                        },
                                        ml: 2
                                    }}
                                >
                                    Select
                                </Button>
                            </Box>
                            
                            {/* Divider - Don't show after last item */}
                            {index < filteredArray.length - 1 && (
                                <Box sx={{ borderBottom: 1, borderColor: 'divider' }} />
                            )}
                        </React.Fragment>
                    ))}
                </Box>
            </DialogContent>
        </Dialog>
    );
};
