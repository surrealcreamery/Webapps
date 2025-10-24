import React, { useContext } from 'react';
import { Box, Button, Typography, IconButton } from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountCircleIcon from '@mui/icons-material/AccountCircle'; // Import account icon
import Logo from '@/assets/images/svg/logo.svg';
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';

const Header = () => {
    const { cateringState, sendToCatering } = useContext(CateringLayoutContext);
    const { cart, isAuthenticated } = cateringState.context; // Get isAuthenticated from context

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    const handleLogoClick = (e) => {
        e.preventDefault();
        sendToCatering({ type: 'RESET' });
    };
    
    const handleCartClick = () => {
        sendToCatering({ type: 'VIEW_CART' });
    };

    const handleBackClick = () => {
        sendToCatering({ type: 'GO_BACK' });
    };

    const handleAccountClick = () => {
        if (!isAuthenticated) {
            sendToCatering({ type: 'TRIGGER_AUTH' });
        } else {
            // User is authenticated, future "My Account" action can go here.
            console.log("Account icon clicked by authenticated user.");
        }
    };

    // Determine if the back button should be visible
    const showBackButton = !cateringState.matches('browsing.browsingCategories') && !cateringState.matches('loadingMenu');
    // Determine if cart button should be visible
    // ✅ FIX: Added condition to hide button if cart is empty
    const showCartButton = !cateringState.matches('viewingCart') && totalItems > 0;

    return (
        <header className="header">
            <div className="shell">
                <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 24px' }}>
                    <div className="header__inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                        
                        {/* Left column for Back Button */}
                        <div style={{ justifySelf: 'start' }}>
                            {showBackButton && (
                                <IconButton onClick={handleBackClick} aria-label="Go back">
                                    <ArrowBackIcon sx={{ fontSize: '2rem' }} />
                                </IconButton>
                            )}
                        </div>

                        {/* Center column for the logo */}
                        <div className="header__logo" style={{ justifySelf: 'center' }}>
                            <a href="/" onClick={handleLogoClick}>
                                <img src={Logo} alt="Surreal Creamery Logo" style={{ display: 'block', height: '128px', width: 'auto' }} />
                            </a>
                        </div>
                        
                        {/* Right column for icons */}
                        <div className="header__actions" style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 1 }}>
                            
                            {/* Updated Account Icon */}
                            <IconButton color="inherit" onClick={handleAccountClick} aria-label="Account">
                                <AccountCircleIcon sx={{ fontSize: '40px', color: 'black' }} />
                            </IconButton>

                            {showCartButton && (
                                <Button
                                    variant="contained"
                                    onClick={handleCartClick}
                                    aria-label="View Cart"
                                    sx={{
                                        backgroundColor: 'black',
                                        color: 'white',
                                        borderRadius: '50px', // Pill shape
                                        textTransform: 'none',
                                        padding: '6px 16px',
                                        '&:hover': {
                                            backgroundColor: '#333', // Darken on hover
                                        }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ShoppingBagIcon sx={{ color: 'white' }} />
                                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                                            {totalItems}
                                        </Typography>
                                    </Box>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;

