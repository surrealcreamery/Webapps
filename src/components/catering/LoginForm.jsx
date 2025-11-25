import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    CircularProgress,
    Alert,
    Stack
} from '@mui/material';
import { parsePhoneNumber } from 'react-phone-number-input';

export const LoginForm = ({ sendToCatering, onBack, error: machineError, cateringState }) => {
    
    const [identifier, setIdentifier] = useState('');
    const [localError, setLocalError] = useState('');
    
    // ✅ FIX: Determine loading state from machine state instead of local state
    const isLoading = cateringState?.matches('loginFlow.checkingLoginAccountStatus');

    // Display the error from the machine if it exists
    useEffect(() => {
        if (machineError) {
            setLocalError(machineError);
        }
    }, [machineError]);

    // ✅ FIX: Clear local error when machine returns to this state
    useEffect(() => {
        if (cateringState?.matches('loginFlow.enteringLoginContactInfo') && !machineError) {
            setLocalError('');
        }
    }, [cateringState, machineError]);

    const handleSubmit = () => {
        setLocalError('');

        const emailRegex = /^\S+@\S+\.\S+$/;
        let phoneNumber = null;
        
        // Try to parse as phone number
        try {
            phoneNumber = parsePhoneNumber(identifier, 'US');
        } catch (e) {
            // Not a phone number, might be email
        }

        let emailToSend = '';
        let phoneToSend = '';

        if (emailRegex.test(identifier)) {
            emailToSend = identifier;
        } else if (phoneNumber && phoneNumber.isValid()) {
            phoneToSend = phoneNumber.number; // E.164 format
        } else {
            setLocalError('Please enter a valid email or US phone number.');
            return;
        }

        // Send event with email and mobileNumber - state machine will handle assignment
        sendToCatering({
            type: 'SUBMIT_LOGIN_CONTACT',
            email: emailToSend,
            mobileNumber: phoneToSend
        });
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && identifier && !isLoading) {
            handleSubmit();
        }
    };

    return (
        <Box>
            <Typography variant="h1" component="h1" gutterBottom>
                Log In
            </Typography>
            <Typography sx={{ mb: 3 }}>
                Please enter your email or mobile number to access your account.
            </Typography>
            
            {localError && <Alert severity="error" sx={{ mb: 2 }}>{localError}</Alert>}
            
            <Stack component="form" noValidate sx={{ mt: 1 }} spacing={2}>
                 <TextField
                    fullWidth
                    label="Email or Phone Number"
                    name="identifier"
                    value={identifier}
                    onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (localError) setLocalError('');
                    }}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    autoFocus
                    helperText=" "
                 />
            </Stack>
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    variant="contained"
                    onClick={onBack}
                    disabled={isLoading}
                    sx={{ 
                        backgroundColor: 'grey.200', 
                        color: 'primary.main', 
                        boxShadow: 'none', 
                        '&:hover': { 
                            backgroundColor: 'grey.300', 
                            boxShadow: 'none' 
                        } 
                    }}
                >
                    Back
                </Button>
                <Button 
                    variant="contained" 
                    onClick={handleSubmit} 
                    disabled={isLoading || !identifier}
                >
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
                </Button>
            </Box>
        </Box>
    );
};
