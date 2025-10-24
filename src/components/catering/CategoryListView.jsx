import React from 'react';
import { Box, Typography, Stack } from '@mui/material';

export const CategoryListView = ({ menu, sendToCatering }) => {
    return (
        <Box>
            <Typography variant="h1" component="h1" gutterBottom>Browse Our Catering Options</Typography>
            <Stack spacing={4} sx={{mt: 3}}>
                {Object.entries(menu).map(([categoryName, categoryData]) => {
                    // Use the image from the data, or a placeholder if not available.
                    const imageSrc = categoryData.image || `https://placehold.co/600x400/EEE/31343C?text=${encodeURIComponent(categoryName)}`;

                    return (
                        <Box
                            key={categoryName}
                            onClick={() => sendToCatering({ type: 'SELECT_CATEGORY', category: categoryName })}
                            sx={{
                                overflow: 'hidden',
                                cursor: 'pointer',
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'grey.300',
                            }}
                        >
                            <Box sx={{ height: 250, backgroundColor: 'grey.200' }}>
                                <img 
                                    src={imageSrc} 
                                    alt={categoryName} 
                                    style={{ 
                                        width: '100%', 
                                        height: '100%', 
                                        objectFit: 'cover',
                                        imageRendering: 'high-quality'
                                    }} 
                                />
                            </Box>
                            <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
                                <Typography variant="h4" component="h3" sx={{ textAlign: 'left' }}>{categoryName}</Typography>
                                
                                {categoryData.description && categoryData.description.length > 0 && (
                                    <Stack component="ul" sx={{ pl: 2.5, my: 1, color: 'text.secondary' }}>
                                        {categoryData.description.map((point, index) => {
                                            const parts = point.split(':');
                                            if (parts.length > 1) {
                                                const boldPart = parts[0];
                                                const restOfText = parts.slice(1).join(':').trim();
                                                return (
                                                    <Box component="li" key={index} sx={{ display: 'list-item', mb: 1, '&:last-child': { mb: 0 } }}>
                                                        <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.primary', display: 'block' }}>{boldPart}</Typography>
                                                        <Typography component="span" variant="body2" sx={{ display: 'block' }}>{restOfText}</Typography>
                                                    </Box>
                                                );
                                            }
                                            return (
                                                <Typography component="li" variant="body1" key={index} sx={{ display: 'list-item' }}>
                                                    {point}
                                                </Typography>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </Box>
                        </Box>
                    );
                })}
            </Stack>
        </Box>
    );
};

