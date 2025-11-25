import React, { useContext, useEffect } from 'react';
import { Box, Button, Typography, IconButton, Avatar } from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import Logo from '@/assets/images/svg/logo.svg';
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';

// Helper function to get initials - First + Last
const getInitials = (contactInfo) => {
    if (!contactInfo) return '?';

    // Use camelCase keys
    const firstName = contactInfo?.firstName || '';
    const lastName = contactInfo?.lastName || '';
    
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();

    let finalInitials = '?'; // Default

    if (firstInitial && lastInitial) {
        finalInitials = `${firstInitial}${lastInitial}`;
    }
    else if (firstInitial) {
        finalInitials = firstInitial;
    }
    else if (contactInfo?.email) {
        finalInitials = contactInfo.email.charAt(0).toUpperCase();
    } else {
        // Fallback for any other case
    }

    return finalInitials;
};


const Header = () => {
    const { cateringState, sendToCatering } = useContext(CateringLayoutContext);
    const { cart, isAuthenticated, contactInfo } = cateringState.context;

    useEffect(() => {
        if (isAuthenticated) {
            // console.log("Header - Authenticated User Contact Info (from context):", JSON.stringify(contactInfo));
        }
    }, [isAuthenticated, contactInfo]);

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    const handleLogoClick = (e) => {
        e.preventDefault();
        // Navigate to browsing categories without resetting authentication
        sendToCatering({ type: 'GO_TO_BROWSING' });
    };

    const handleCartClick = () => {
        sendToCatering({ type: 'VIEW_CART' });
    };

    const handleBackClick = () => {
        sendToCatering({ type: 'GO_BACK' });
    };

    const handleAccountClick = () => {
        if (!isAuthenticated) {
            sendToCatering({ type: 'VIEW_ACCOUNT' }); 
        } else {
            console.log("Account icon clicked by authenticated user. Sending VIEW_ACCOUNT.");
            sendToCatering({ type: 'VIEW_ACCOUNT' });
        }
    };

    const handleLogOut = () => {
        sendToCatering({ type: 'RESET' });
    };

    // Check if we're on the orders view page
    const isOnOrdersPage = cateringState.matches('viewingOrders');

    // Determine if the back button should be visible
    const showBackButton = ![
        'booting',
        'loadingMenu',
        'browsing.browsingCategories',
        'checkoutPlaceholder',
        'viewingOrders', // Hide back button on orders page
        'guestCheckoutFlow.enteringContactInfo',
        'loginFlow.enteringLoginContactInfo',
    ].some(state => cateringState.matches(state));

    // Hide cart on cart, checkout, AND all auth flows
    const showCartButton =
        !cateringState.matches('viewingCart') &&
        !cateringState.matches('checkoutPlaceholder') &&
        !cateringState.matches('guestCheckoutFlow') &&
        !cateringState.matches('loginFlow') &&
        !cateringState.matches('viewingOrders') && // Hide cart on orders page
        totalItems > 0;

    // Hide account icon on cart, checkout, AND all auth flows
    const showAccountButton =
        !cateringState.matches('viewingCart') &&
        !cateringState.matches('checkoutPlaceholder') &&
        !cateringState.matches('guestCheckoutFlow') &&
        !cateringState.matches('loginFlow') &&
        !cateringState.matches('viewingOrders'); // Hide account on orders page


    const userInitials = isAuthenticated ? getInitials(contactInfo) : '';
    const avatarSize = 40; // Size for both icon and avatar

    return (
        <header className="header">
            <div className="shell">
                <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 24px' }}>
                    <div className="header__inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>

                        {/* Left column */}
                        <div style={{ justifySelf: 'start' }}>
                            {showBackButton && (
                                <IconButton onClick={handleBackClick} aria-label="Go back">
                                    <ArrowBackIcon sx={{ fontSize: '2rem', color: 'black' }} />
                                </IconButton>
                            )}
                        </div>

                        {/* Center column */}
                        <div className="header__logo" style={{ justifySelf: 'center' }}>
                            <a href="/" onClick={handleLogoClick}>
                                <img src={Logo} alt="Surreal Creamery Logo" style={{ display: 'block', height: '128px', width: 'auto' }} />
                            </a>
                        </div>

                        {/* Right column */}
                        <div className="header__actions" style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 1, minWidth: '48px' }}>

                            {/* Show Log Out button on orders page */}
                            {isOnOrdersPage && (
                                <Button
                                    variant="outlined"
                                    onClick={handleLogOut}
                                    sx={{
                                        color: 'black',
                                        borderColor: 'black',
                                        backgroundColor: 'white',
                                        textTransform: 'none',
                                        fontWeight: 'bold',
                                        padding: '6px 16px',
                                        '&:hover': {
                                            borderColor: 'black',
                                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                        }
                                    }}
                                >
                                    Log Out
                                </Button>
                            )}

                            {/* Conditionally render Account Icon/Avatar */}
                            {showAccountButton && (
                                <IconButton color="inherit" onClick={handleAccountClick} aria-label="Account">
                                    {isAuthenticated ? (
                                        <Avatar
                                            style={{
                                                backgroundColor: 'black',
                                                color: 'white',
                                                width: avatarSize,
                                                height: avatarSize,
                                                fontSize: '1.7rem',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                lineHeight: 1
                                            }}
                                        >
                                            {userInitials}
                                        </Avatar>
                                    ) : (
                                        <AccountCircleIcon sx={{ fontSize: `${avatarSize}px`, color: 'black' }} />
                                    )}
                                </IconButton>
                            )}

                            {/* Cart Button */}
                            {showCartButton && (
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
                                        '&:hover': {
                                            backgroundColor: '#333',
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
