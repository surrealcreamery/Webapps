import React from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import { isValidPhoneNumber } from 'react-phone-number-input/input';
import SmsIcon from '@mui/icons-material/Sms';
import EmailIcon from '@mui/icons-material/Email';

// ✅ Renamed component and export
export const AccountOTPChoice = ({ onBack, onChooseEmail, onChooseSms, contactInfo }) => {
    
    // --- STEP-BY-STEP DIAGNOSTIC LOGS ---
    console.log('%c[AccountOTPChoice] Component Rendering...', 'color: #7c3aed');
    console.log('%c[AccountOTPChoice] 1. Received contactInfo prop:', 'color: #7c3aed', contactInfo);
    
    const mobileNumber = contactInfo?.mobileNumber || '';
    console.log('%c[AccountOTPChoice] 2. Extracted mobile number:', 'color: #7c3aed', mobileNumber);
    
    const isSmsDisabled = !isValidPhoneNumber(mobileNumber, 'US');
    
    console.log(`%c[AccountOTPChoice] 3. Is phone number valid ('US')?`, 'color: #7c3aed', !isSmsDisabled);
    console.log(`%c[AccountOTPChoice] 4. SMS Button will be ${isSmsDisabled ? 'DISABLED' : 'ENABLED'}.`, isSmsDisabled ? 'color: #ef4444' : 'color: #22c55e');
    // --- END DIAGNOSTIC LOGS ---

    const buttonStyles = { 
        justifyContent: 'flex-start', 
        py: 1.5, 
        textTransform: 'none', 
        color: 'black', 
        borderColor: 'black', 
        '& .MuiSvgIcon-root': { color: 'black' }, 
        '&:hover': { borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.04)' } 
    };

    return (
        <Box>
            <Typography variant="h1" component="h1" gutterBottom>Authentication Required</Typography>
            <Typography sx={{ mb: 2 }}>An account was found. Please select a method to verify your identity.</Typography>
            <Stack spacing={2}>
                <Button 
                    variant="outlined" 
                    startIcon={<EmailIcon />} 
                    onClick={onChooseEmail}
                    sx={buttonStyles}
                >
                    {contactInfo.email}
                </Button>
                <Button 
                    variant="outlined" 
                    startIcon={<SmsIcon />} 
                    onClick={onChooseSms}
                    disabled={isSmsDisabled}
                    sx={buttonStyles}
                >
                    {contactInfo.mobileNumber}
                </Button>
            </Stack>
            <Button sx={{ mt: 4 }} onClick={onBack}>
                Back
            </Button>
        </Box>
    );
};
