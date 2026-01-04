import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Box, Typography } from '@mui/material';
import Logo from '@/assets/images/svg/dbc_logo.svg';
import { LayoutContext } from '@/contexts/subscriptions/SubscriptionsLayoutContext';

// Navigation items - same as other headers
const NAV_ITEMS = [
    { label: 'Shop', path: 'https://shop.surrealcreamery.com', external: true },
    { label: 'Events', path: 'https://events.surrealcreamery.com', external: true },
    { label: 'Subscriptions', path: '/', external: false, isCurrentApp: true },
    { label: 'Catering', path: 'https://catering.surrealcreamery.com', external: true },
];

const Header = () => {
    console.log('%c[Header] Component Rendering...', 'background: #4b5563; color: white');

    const { isAuthenticated, showRedeemButton, logout, resetWizardFlow } = useContext(LayoutContext);
    const navigate = useNavigate();
    const location = useLocation();

    const onRedeemPage = location.pathname === '/redeem';

    console.log({
        source: '[Header] State received from context',
        isAuthenticated,
        showRedeemButton,
        onRedeemPage,
        currentPath: location.pathname
    });
    
    const handleLogoClick = (e) => {
        e.preventDefault();
        console.log('[Header] Logo clicked.');
        if (resetWizardFlow) {
            resetWizardFlow();
        }
        navigate('/');
    };
    
    const handleLogout = () => {
        console.log('[Header] Logout button clicked.');
        if (logout) {
            logout();
        }
        navigate('/');
    };
    
    const handleNavClick = (item) => {
        if (item.external) {
            window.location.href = item.path;
        } else if (item.isCurrentApp) {
            // Already on this app, navigate to root
            navigate('/');
        } else {
            navigate(item.path);
        }
    };
    
    const buttonStyles = {
      color: 'black',
      borderColor: 'black',
      textTransform: 'none',
      py: '7px',
      px: '14px',
      '&:hover': {
        borderColor: 'black',
        backgroundColor: 'rgba(0,0,0,0.04)',
      },
    };

    const isRightButtonVisible = (isAuthenticated && onRedeemPage) || showRedeemButton;

    return (
        <>
            {/* CSS Override for header padding */}
            <style>{`
                .header { padding-top: 0 !important; padding-bottom: 0 !important; }
            `}</style>
            
            <header className="header" role="banner" aria-label="Site header">
                {/* Navigation Bar - REI Style */}
                <Box
                    component="nav"
                    role="navigation"
                    aria-label="Main navigation"
                    sx={{
                        backgroundColor: '#000',
                        width: '100vw',
                        marginLeft: 'calc(-50vw + 50%)',
                        py: 1,
                        px: 2,
                    }}
                >
                    <Box
                        sx={{
                            maxWidth: '600px',
                            margin: '0 auto',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 0.5,
                            flexWrap: 'wrap',
                        }}
                    >
                        {NAV_ITEMS.map((item) => {
                            const isActive = item.isCurrentApp;
                            return (
                                <Button
                                    key={item.path}
                                    onClick={() => handleNavClick(item)}
                                    sx={{
                                        color: isActive ? '#000' : '#fff',
                                        backgroundColor: isActive ? '#fff' : 'transparent',
                                        textTransform: 'none',
                                        px: 1.5,
                                        py: 0.5,
                                        minWidth: 'auto',
                                        fontWeight: isActive ? 600 : 400,
                                        borderRadius: 1,
                                        '&:hover': {
                                            backgroundColor: isActive ? '#fff' : 'rgba(255,255,255,0.1)',
                                        },
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: '1.6rem !important',
                                            fontWeight: 'inherit',
                                        }}
                                    >
                                        {item.label}
                                    </Typography>
                                </Button>
                            );
                        })}
                    </Box>
                </Box>
                
                {/* Logo and Actions Row */}
                <div className="shell">
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <div className="header__inner" style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                               {isRightButtonVisible && (
                                    <div style={{ visibility: 'hidden' }}>
                                        <Button variant="outlined" sx={buttonStyles}>Placeholder</Button>
                                    </div>
                               )}
                            </div>

                            <div className="header__logo" style={{ flexShrink: 0 }}>
                                <a href="/" onClick={handleLogoClick}>
                                    <img src={Logo} alt="Dollar Boba Club" style={{ display: 'block', height: '128px', width: 'auto' }} />
                                </a>
                            </div>
                            
                            <div className="header__actions" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                {(() => {
                                    if (isAuthenticated && onRedeemPage) {
                                        console.log('%c[Header] Decision: Rendering Logout Button', 'color: green');
                                        return (
                                            <Button variant="outlined" onClick={handleLogout} sx={buttonStyles}>Logout</Button>
                                        );
                                    } 
                                    if (showRedeemButton) {
                                        console.log('%c[Header] Decision: Rendering Redeem Button', 'color: green');
                                        return (
                                            <Button variant="outlined" href="/redeem" sx={buttonStyles}>Redeem</Button>
                                        );
                                    }
                                    console.log('%c[Header] Decision: Rendering NO button.', 'color: red');
                                    return null;
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;
