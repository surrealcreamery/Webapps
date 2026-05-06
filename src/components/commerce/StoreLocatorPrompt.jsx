import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    Button,
    IconButton,
    useMediaQuery,
    useTheme,
    Slide
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getLocationFromIP } from '@/components/commerce/geolocation';

const SlideUpTransition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const PLACEHOLDER_IMAGE = 'https://placehold.co/60x60/e0e0e0/666666?text=Item';

const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const StoreLocatorPrompt = ({
    open,
    onClose,
    onSelectStore,
    product,
    selectedVariant,
    storeLocations = [],
}) => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [userLocation, setUserLocation] = useState(null);

    useEffect(() => {
        if (open) {
            getLocationFromIP().then(loc => { if (loc?.latitude) setUserLocation(loc); }).catch(() => {});
        }
    }, [open]);

    const sortedLocations = useMemo(() => {
        const retail = storeLocations.filter(loc => loc.type !== 'Warehouse');
        if (!userLocation?.latitude) return retail;
        return [...retail].sort((a, b) => {
            const distA = (a.latitude && a.longitude) ? haversineDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude) : Infinity;
            const distB = (b.latitude && b.longitude) ? haversineDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude) : Infinity;
            return distA - distB;
        }).map(loc => ({
            ...loc,
            distance: (loc.latitude && loc.longitude) ? haversineDistance(userLocation.latitude, userLocation.longitude, loc.latitude, loc.longitude) : null,
        }));
    }, [storeLocations, userLocation]);

    if (!product) return null;

    const productName = product.name || product.title || 'Product';
    const variantTitle = selectedVariant?.title || '';
    const price = selectedVariant?.price
        ? `$${parseFloat(selectedVariant.price).toFixed(2)}`
        : product.price || '';
    const imageUrl = selectedVariant?.catalogImage?.url
        || selectedVariant?.image?.url
        || product.imageUrl
        || (product.images?.[0]?.url)
        || PLACEHOLDER_IMAGE;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={isSmallScreen}
            maxWidth="md"
            fullWidth
            aria-labelledby="store-locator-title"
            TransitionComponent={SlideUpTransition}
            PaperProps={{
                sx: {
                    borderRadius: isSmallScreen ? 0 : 2,
                    maxHeight: isSmallScreen ? '100%' : '90vh',
                    margin: isSmallScreen ? 0 : 2,
                    maxWidth: isSmallScreen ? '100%' : '600px',
                },
            }}
            sx={{
                zIndex: 1400,
                '& .MuiBackdrop-root': {
                    backgroundColor: isSmallScreen ? 'transparent' : 'rgba(0, 0, 0, 0.5)',
                },
            }}
        >
            <DialogContent sx={{ p: 0 }}>
                <IconButton
                    onClick={onClose}
                    aria-label="Close store selector"
                    sx={{ position: 'absolute', right: 12, top: 12, zIndex: 1 }}
                >
                    <CloseIcon />
                </IconButton>

                {/* Product header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box
                        component="img"
                        src={imageUrl}
                        alt={productName}
                        sx={{ width: 60, height: 60, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }} noWrap>
                            {productName}
                        </Typography>
                        {variantTitle && (
                            <Typography variant="body2" color="text.secondary" noWrap>
                                {variantTitle}
                            </Typography>
                        )}
                        {price && (
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {price}
                            </Typography>
                        )}
                    </Box>
                </Box>

                {/* Heading */}
                <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
                    <Typography id="store-locator-title" variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                        Select a store
                    </Typography>
                </Box>

                {/* Store list */}
                <Box sx={{ px: 3, pb: 3 }}>
                    {sortedLocations.map((location, index) => (
                        <Box
                            key={location.id}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                py: 2,
                                borderBottom: index < sortedLocations.length - 1 ? '1px solid' : 'none',
                                borderColor: 'divider',
                            }}
                        >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                    {location.name}
                                </Typography>
                                {location.address && (
                                    <Typography variant="body2" color="text.secondary">
                                        {location.address}
                                    </Typography>
                                )}
                                <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600, mt: 0.25 }}>
                                    Available
                                </Typography>
                                {location.distance != null && (
                                    <Typography variant="caption" color="text.secondary">
                                        {location.distance < 1 ? '< 1' : location.distance.toFixed(1)} mi away
                                    </Typography>
                                )}
                            </Box>
                            <Button
                                variant="contained"
                                size="small"
                                onClick={() => onSelectStore(location.id)}
                                sx={{
                                    backgroundColor: '#000000',
                                    color: '#ffffff',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    px: 2,
                                    flexShrink: 0,
                                    '&:hover': { backgroundColor: '#333333' },
                                }}
                            >
                                Select
                            </Button>
                        </Box>
                    ))}
                </Box>
            </DialogContent>
        </Dialog>
    );
};
