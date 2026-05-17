import React, { useContext } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import Logo from '@/assets/images/svg/logo.svg';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { useNavigate } from 'react-router-dom';

const KioskHeader = () => {
    const {
        sendToCommerce,
        cartCount = 0,
    } = useContext(LayoutContext);
    const navigate = useNavigate();

    const handleLogoClick = (e) => {
        e.preventDefault();
        sendToCommerce({ type: 'CLOSE_PRODUCT' });
        sendToCommerce({ type: 'CLOSE_CART' });
        navigate('/kiosk', { replace: true });
    };

    const handleCartClick = () => {
        sendToCommerce({ type: 'OPEN_CART' });
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
                backgroundColor: 'white',
            }}
        >
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                    {/* Left column - spacer */}
                    <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', minWidth: '48px' }} />

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
                                }}
                            />
                        </a>
                    </div>

                    {/* Right column - Cart */}
                    <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', minWidth: '48px' }}>
                        {cartCount > 0 && (
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
                                        {cartCount}
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
