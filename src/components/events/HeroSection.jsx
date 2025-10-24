import React from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';

export const HeroSection = ({ title, imageUrl, description, bulletPoints, onSelectLocationClick }) => {
    return (
        <Box sx={{ mb: 4 }}>
            <Box sx={{ height: 250, backgroundColor: 'grey.200', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                <img
                    src={imageUrl}
                    alt={title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </Box>
            <Typography variant="h1" component="h1" sx={{ mb: 2 }}>
                {title}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
                {description}
            </Typography>
            <Stack spacing={1.5} sx={{ pt: 2 }}>
                <Button variant="contained" fullWidth onClick={onSelectLocationClick}>
                    Select a Location to Schedule
                </Button>
            </Stack>
            <Box sx={{ textAlign: 'left', my: 1 }}>
                {(bulletPoints || []).map((point) => (
                    <Box key={point.id} sx={{ py: 1 }}>
                        {/* ✅ Bullet point symbol added here */}
                        <Typography variant="body1">{`• ${point.name}`}</Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};
