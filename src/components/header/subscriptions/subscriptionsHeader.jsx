import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Box, Typography } from '@mui/material';
import Logo from '@/assets/images/svg/dbc_logo.svg';
import { LayoutContext } from '@/contexts/subscriptions/SubscriptionsLayoutContext';
import { trackNavItemClicked, trackLogoClicked, trackRedeemButtonClicked } from '@/services/analytics';

// Navigation items
const NAV_ITEMS = [
    { label: 'Shop', path: '/', external: false },
    { label: 'Events', path: '/events', external: false },
    { label: 'Subscriptions', path: '/subscriptions', external: false, isCurrentApp: true },
];

const Header = () => {
    console.log('%c[Header] Component Rendering...', 'background: #4b5563; color: white');

    const { isAuthenticated, showRedeemButton, logout, resetWizardFlow } = useContext(LayoutContext);
    const navigate = useNavigate();
    const location = useLocation();

    const onRedeemPage = location.pathname === '/redeem' || location.pathname === '/subscriptions/redeem';

    console.log({
        source: '[Header] State received from context',
        isAuthenticated,
        showRedeemButton,
        onRedeemPage,
        currentPath: location.pathname
    });
    
    // Detect if embedded in Commerce app (path starts with /subscriptions)
    const isEmbedded = location.pathname.startsWith('/subscriptions');
    const basePath = isEmbedded ? '/subscriptions' : '';

    const handleLogoClick = (e) => {
        e.preventDefault();
        trackLogoClicked();
        if (resetWizardFlow) {
            resetWizardFlow();
        }
        navigate(basePath || '/');
    };

    const handleLogout = () => {
        if (logout) {
            logout();
        }
        navigate(basePath || '/');
    };

    const handleNavClick = (item) => {
        trackNavItemClicked(item.label, item.path);
        if (item.external) {
            window.location.href = item.path;
        } else if (item.isCurrentApp) {
            navigate(basePath || '/');
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
                                            <Button variant="outlined" href={`${basePath}/redeem`} onClick={() => trackRedeemButtonClicked()} sx={buttonStyles}>Redeem</Button>
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
