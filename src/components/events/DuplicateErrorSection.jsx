import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';

export const DuplicateErrorSection = ({ currentEvent, onViewOtherEvents }) => {
    return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
            <Alert severity="error" sx={{ mb: 4, textAlign: 'left' }}>
                <Typography variant="h6" gutterBottom>
                    Already Registered
                </Typography>
                <Typography>
                    You have already registered for this event. You cannot register for the same event multiple times.
                </Typography>
            </Alert>

            {currentEvent && (
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" component="p" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {currentEvent.title}
                    </Typography>
                    <Typography color="text.secondary">
                        This event only has one date available.
                    </Typography>
                </Box>
            )}

            <Button 
                variant="contained" 
                color="primary" 
                onClick={onViewOtherEvents}
                fullWidth
                sx={{ maxWidth: 400 }}
            >
                View Other Events
            </Button>
        </Box>
    );
};
