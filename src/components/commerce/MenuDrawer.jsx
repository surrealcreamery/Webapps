import React, { useRef, useCallback } from 'react';
import {
    Drawer,
    Box,
    IconButton,
    Typography,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { trackNavItemClicked, trackMenuClosed } from '@/services/analytics';

const MENU_ITEMS = [
    {
        title: 'Desserts',
        path: '/desserts',
        description: 'Ice cream, milkshakes & more'
    },
    {
        title: 'Collectibles',
        path: '/collectibles',
        description: 'tokidoki collectibles'
    },
    {
        title: 'Events',
        path: '/events',
        description: 'Upcoming events & experiences'
    }
];

const isProduction = typeof window !== 'undefined' && window.location.hostname === 'www.surrealcreamery.com';

export const MenuDrawer = ({ open, onClose }) => {
    const navigate = useNavigate();
    const tapCountRef = useRef(0);
    const tapTimerRef = useRef(null);

    const handleTestModeTap = useCallback(() => {
        if (isProduction) return;
        tapCountRef.current += 1;
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 2000);
        if (tapCountRef.current >= 5) {
            tapCountRef.current = 0;
            const current = localStorage.getItem('testModeEnabled') === 'true';
            localStorage.setItem('testModeEnabled', String(!current));
            window.dispatchEvent(new Event('testModeChanged'));
            const message = !current ? 'Test mode enabled' : 'Test mode disabled';
            window.dispatchEvent(new CustomEvent('testModeToggled', { detail: { message } }));
            onClose();
        }
    }, [onClose]);

    const handleNavigate = (path) => {
        trackNavItemClicked(MENU_ITEMS.find(i => i.path === path)?.title || 'Kiosk Mode', path);
        // Clear AddedToCart state when navigating via menu
        sessionStorage.removeItem('addedToCart');
        // Dispatch custom event for Commerce.jsx to clear its React state
        window.dispatchEvent(new CustomEvent('clearAddedToCart'));
        onClose();
        navigate(path);
    };

    return (
        <Drawer
            anchor="left"
            open={open}
            onClose={onClose}
            aria-label="Menu"
            sx={{
                '& .MuiDrawer-paper': {
                    width: { xs: '85%', sm: 400 },
                    maxWidth: '100%'
                }
            }}
        >
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Box
                    sx={{
                        p: 2,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Menu
                    </Typography>
                    <IconButton aria-label="Close menu" onClick={() => { trackMenuClosed(); onClose(); }} edge="end">
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Menu Items */}
                <List sx={{ flex: 1, pt: 1 }}>
                    {MENU_ITEMS.map((item, index) => (
                        <React.Fragment key={item.path}>
                            <ListItem disablePadding>
                                <ListItemButton
                                    onClick={() => handleNavigate(item.path)}
                                    sx={{
                                        py: 2,
                                        px: 3,
                                        '&:hover': {
                                            backgroundColor: 'action.hover'
                                        }
                                    }}
                                >
                                    <ListItemText
                                        primary={item.title}
                                        secondary={item.description}
                                        primaryTypographyProps={{
                                            fontSize: '2.4rem',
                                            fontWeight: 500
                                        }}
                                        secondaryTypographyProps={{
                                            fontSize: '1.6rem',
                                            color: 'text.secondary'
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                            {index < MENU_ITEMS.length - 1 && <Divider />}
                        </React.Fragment>
                    ))}
                </List>

                {/* Hidden test mode tap zone (5 taps, non-production only) */}
                <Box
                    aria-hidden="true"
                    onClick={handleTestModeTap}
                    sx={{ minHeight: 60, userSelect: 'none' }}
                />
            </Box>
        </Drawer>
    );
};

export default MenuDrawer;
