import React, { useContext } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';
import Logo from '@/assets/images/svg/logo.svg';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';

const isLightColor = (color) => {
    if (!color) return false;
    const c = color.toLowerCase().trim();
    if (c === 'white') return true;
    if (c.startsWith('#')) {
        let hex = c.slice(1);
        if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
        if (hex.length !== 6) return false;
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
    }
    return false;
};

const KioskHeader = () => {
    const {
        sendToCommerce,
        activeTextColor = 'black',
        kioskCartCount = 0,
        kioskViewMode = 'slideshow',
        setKioskViewMode,
    } = useContext(LayoutContext);

    const handleLogoClick = (e) => {
        e.preventDefault();
        // In kiosk, logo returns to the browse screen (close any open product/cart)
        sendToCommerce({ type: 'CLOSE_PRODUCT' });
        sendToCommerce({ type: 'CLOSE_CART' });
    };

    const handleCartClick = () => {
        sendToCommerce({ type: 'OPEN_CART' });
    };

    const handleToggleView = () => {
        setKioskViewMode(prev => prev === 'slideshow' ? 'grid' : 'slideshow');
    };

    return (
        <header
            role="banner"
            aria-label="Kiosk header"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 100,
                pointerEvents: 'auto',
            }}
        >
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                    {/* Left column - View toggle */}
                    <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', minWidth: '48px' }}>
                        <IconButton
                            onClick={handleToggleView}
                            aria-label={kioskViewMode === 'slideshow' ? 'Switch to grid view' : 'Switch to slideshow view'}
                            sx={{
                                color: activeTextColor,
                                transition: 'color 0.4s ease',
                            }}
                        >
                            {kioskViewMode === 'slideshow' ? <GridViewIcon /> : <ViewCarouselIcon />}
                        </IconButton>
                    </div>

                    {/* Center column - Logo */}
                    <div style={{ justifySelf: 'center' }}>
                        <a href="/kiosk" onClick={handleLogoClick}>
                            <img
                                src={Logo}
                                alt="Surreal Creamery Logo"
                                style={{
                                    display: 'block',
                                    height: '128px',
                                    width: 'auto',
                                    filter: isLightColor(activeTextColor) ? 'brightness(0) invert(1)' : 'none',
                                    transition: 'filter 0.4s ease',
                                }}
                            />
                        </a>
                    </div>

                    {/* Right column - Cart */}
                    <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', minWidth: '48px' }}>
                        {kioskCartCount > 0 && (
                            <Button
                                variant="contained"
                                onClick={handleCartClick}
                                aria-label="View Cart"
                                sx={{
                                    backgroundColor: 'black',
                                    color: 'white',
                                    borderRadius: '50px',
                                    textTransform: 'none',
                                    padding: '6px 16px',
                                    boxShadow: 'none',
                                    '&:hover': {
                                        backgroundColor: '#333',
                                        boxShadow: 'none',
                                    }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ShoppingBagIcon sx={{ color: 'white' }} />
                                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                                        {kioskCartCount}
                                    </Typography>
                                </Box>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default KioskHeader;
