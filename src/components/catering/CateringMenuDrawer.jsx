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

export const CateringMenuDrawer = ({ open, onClose, menu, sendToCatering }) => {
    const categories = Object.keys(menu || {});

    const handleCategoryClick = (categoryName) => {
        onClose();
        sendToCatering({ type: 'SELECT_CATEGORY', category: categoryName });
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

                {/* Category List */}
                <List sx={{ flex: 1, pt: 1 }}>
                    {categories.map((categoryName, index) => {
                        const category = menu[categoryName];
                        const itemCount = category?.items?.length || 0;

                        return (
                            <React.Fragment key={categoryName}>
                                <ListItem disablePadding>
                                    <ListItemButton
                                        onClick={() => handleCategoryClick(categoryName)}
                                        sx={{
                                            py: 2,
                                            px: 3,
                                            '&:hover': {
                                                backgroundColor: 'action.hover'
                                            }
                                        }}
                                    >
                                        <ListItemText
                                            primary={categoryName}
                                            secondary={`${itemCount} item${itemCount !== 1 ? 's' : ''}`}
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
                                {index < categories.length - 1 && <Divider />}
                            </React.Fragment>
                        );
                    })}
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
                        Surreal Creamery Catering
                    </Typography>
                </Box>
            </Box>
        </Drawer>
    );
};

export default CateringMenuDrawer;
