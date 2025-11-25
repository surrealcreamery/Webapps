import React from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';

export const SelectingMissingAccountType = ({ sendToCatering }) => {
    return (
        <Box>
            <Typography variant="h1" component="h1" gutterBottom>
                Complete Your Account
            </Typography>
            <Typography sx={{ mb: 3 }}>
                We found your account, but it's missing an account type. Please select the option that best describes you.
            </Typography>
            <Stack spacing={2}>
                <Button 
                    variant="outlined" 
                    onClick={() => sendToCatering({ type: 'SELECT_RETAIL' })}
                    sx={{ justifyContent: 'flex-start', py: 1.5, textTransform: 'none', color: 'black', borderColor: 'black' }}
                >
                    Retail
                </Button>
                <Button 
                    variant="outlined" 
                    onClick={() => sendToCatering({ type: 'SELECT_NONPROFIT' })}
                    sx={{ justifyContent: 'flex-start', py: 1.5, textTransform: 'none', color: 'black', borderColor: 'black' }}
                >
                    Non-Profit
                </Button>
                <Button 
                    variant="outlined" 
                    onClick={() => sendToCatering({ type: 'SELECT_COMPANY_MISSING' })}
                    sx={{ justifyContent: 'flex-start', py: 1.5, textTransform: 'none', color: 'black', borderColor: 'black' }}
                >
                    Company
                </Button>
            </Stack>
            <Button 
                sx={{ mt: 4 }} 
                onClick={() => sendToCatering({ type: 'BACK' })}
            >
                Back
            </Button>
        </Box>
    );
};