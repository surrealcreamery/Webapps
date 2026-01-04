import React from 'react';
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

const MENU_ITEMS = [
    {
        title: 'Desserts',
        path: '/desserts',
        description: 'Ice cream, milkshakes & more'
    },
    {
        title: 'Merchandise',
        path: '/merchandise',
        description: 'tokidoki collectibles'
    }
];

export const MenuDrawer = ({ open, onClose }) => {
    const navigate = useNavigate();

    const handleNavigate = (path) => {
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
                    <IconButton onClick={onClose} edge="end">
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

                {/* Footer */}
                <Box
                    sx={{
                        p: 2,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'grey.50'
                    }}
                >
                    <Typography variant="body2" color="text.secondary" align="center">
                        tokidoki x Surreal Creamery
                    </Typography>
                </Box>
            </Box>
        </Drawer>
    );
};

export default MenuDrawer;
