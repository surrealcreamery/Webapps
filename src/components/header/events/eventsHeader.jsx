import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Box, Typography } from '@mui/material';
import Logo from '@/assets/images/svg/logo.svg';
import { LayoutContext } from '@/contexts/events/EventsLayoutContext';

// Navigation items - same as commerce header
const NAV_ITEMS = [
    { label: 'Shop', path: 'https://shop.surrealcreamery.com', external: true },
    { label: 'Events', path: '/', external: false, isCurrentApp: true },
    { label: 'Subscriptions', path: 'https://www.dollarbobaclub.com', external: true },
    { label: 'Catering', path: 'https://catering.surrealcreamery.com', external: true },
];

const Header = () => {
    const { 
        showLoginButton,
        showMyEventsButton,
        showLogoutButton,
        logout, 
        sendToFundraiser 
    } = useContext(LayoutContext);

    const navigate = useNavigate();
    
    const handleLogoClick = (e) => {
        e.preventDefault();
        sendToFundraiser({ type: 'RESET' });
        navigate('/');
    };
    
    const handleLoginClick = () => {
        sendToFundraiser({ type: 'LOGIN_START' });
    };

    const handleDashboardClick = () => {
        console.log("Attempting to go to dashboard...");
        sendToFundraiser({ type: 'GO_TO_DASHBOARD' });
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
                        <div className="header__inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                            
                            {/* Left column for spacing */}
                            <div style={{ justifySelf: 'start' }}></div>

                            {/* Center column - Logo */}
                            <div className="header__logo" style={{ justifySelf: 'center' }}>
                                <a href="/" onClick={handleLogoClick}>
                                    <img src={Logo} alt="Surreal Creamery" style={{ display: 'block', height: '128px', width: 'auto' }} />
                                </a>
                            </div>
                            
                            {/* Right column - Actions */}
                            <div className="header__actions" style={{ justifySelf: 'end' }}>
                                {showLoginButton && (
                                    <Button onClick={handleLoginClick} variant="outlined" sx={buttonStyles}>Log In</Button>
                                )}
                                {showMyEventsButton && (
                                    <Button onClick={handleDashboardClick} variant="outlined" sx={buttonStyles}>My Events</Button>
                                )}
                                {showLogoutButton && (
                                    <Button variant="outlined" onClick={logout} sx={buttonStyles}>Log Out</Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;
