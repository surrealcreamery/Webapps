import React from 'react';
import { Box, Typography, Stack, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export const ItemListView = ({ items, categoryName, sendToCatering }) => {
    
    const handleItemClick = (item) => {
        const hasConfigurableAddons = item.ModifierCategories.some(cat => 
            cat.ModifierCategoryMinimum !== null && 
            cat.ModifierCategoryMaximum !== null &&
            cat.Modifiers.some(mod => mod['Modifier Type'] === 'Add On')
        );

        if (hasConfigurableAddons) {
            sendToCatering({ type: 'EDIT_ITEM', item });
        } else {
            sendToCatering({ type: 'VIEW_ITEM', item });
        }
    };

    const actionButtonStyle = {
        backgroundColor: 'black',
        color: 'white',
        borderRadius: '50px',
        textTransform: 'none',
        py: 1,
        px: 2,
        mt: 1.5,
        '&:hover': {
            backgroundColor: '#333',
        }
    };

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>{categoryName}</Typography>
            <Stack spacing={4} sx={{ mt: 3 }}>
                {items.map(item => {
                    const hasConfigurableAddons = item.ModifierCategories.some(cat => 
                        cat.ModifierCategoryMinimum !== null && 
                        cat.ModifierCategoryMaximum !== null &&
                        cat.Modifiers.some(mod => mod['Modifier Type'] === 'Add On')
                    );

                    return (
                        <Box
                            key={item['Item ID']}
                            onClick={() => handleItemClick(item)}
                            sx={{
                                overflow: 'hidden',
                                cursor: 'pointer',
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'grey.300',
                            }}
                        >
                            <Box sx={{ height: 250, backgroundColor: 'grey.200' }}>
                                <img src={item['Item Category Image']?.[0] || `https://placehold.co/600x400/EEE/31343C?text=${encodeURIComponent(item['Item Name'])}`} alt={item['Item Name']} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </Box>
                            <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
                                <Typography variant="h5" component="h3">{item['Item Name']} - ${item['Item Price']}</Typography>
                                
                                {hasConfigurableAddons ? (
                                    <Button
                                        variant="contained"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleItemClick(item);
                                        }}
                                        sx={actionButtonStyle}
                                    >
                                        Customize
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            sendToCatering({ type: 'ADD_TO_CART', item, selectedModifiers: {} });
                                        }}
                                        sx={actionButtonStyle}
                                    >
                                        Add
                                    </Button>
                                )}
                            </Box>
                        </Box>
                    );
                })}
            </Stack>
        </Box>
    );
};

