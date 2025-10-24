import React from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import { isValidPhoneNumber } from 'react-phone-number-input/input';
import SmsIcon from '@mui/icons-material/Sms';
import EmailIcon from '@mui/icons-material/Email';

export const GuestOtpChoiceSection = ({ onBack, onChooseEmail, onChooseSms, contactInfo }) => {
    return (
        <Box>
            <Typography variant="h1" gutterBottom>Authentication Required</Typography>
            <Typography sx={{ mb: 2 }}>Please select a method to verify your identity.</Typography>
            <Stack spacing={2}>
                <Button 
                    variant="outlined" 
                    startIcon={<EmailIcon />} 
                    onClick={onChooseEmail}
                    sx={{ justifyContent: 'flex-start', py: 1.5, textTransform: 'none', color: 'black', borderColor: 'black', '& .MuiSvgIcon-root': { color: 'black' }, '&:hover': { borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.04)' } }}
                >
                    {contactInfo.email}
                </Button>
                <Button 
                    variant="outlined" 
                    startIcon={<SmsIcon />} 
                    onClick={onChooseSms}
                    // ✅ Updated to use mobileNumber for validation
                    disabled={!isValidPhoneNumber(contactInfo.mobileNumber || '')}
                    sx={{ justifyContent: 'flex-start', py: 1.5, textTransform: 'none', color: 'black', borderColor: 'black', '& .MuiSvgIcon-root': { color: 'black' }, '&:hover': { borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.04)' } }}
                >
                    {/* ✅ Updated to display mobileNumber */}
                    {contactInfo.mobileNumber}
                </Button>
            </Stack>
            <Button sx={{ mt: 4 }} variant="contained" onClick={onBack} style={{ backgroundColor: '#f0f0f0', color: '#1976d2' }}>
                Back
            </Button>
        </Box>
    );
};

