import React, { useState } from 'react';
import { Box, Typography, Button, FormHelperText, CircularProgress } from '@mui/material';
import OtpInput from './OtpInput';

export const GuestOtpInputSection = ({ onBack, onSubmitOtp, contactInfo, error, isVerifying, otpChannel }) => {
    const [otp, setOtp] = useState('');
    const handleSubmit = () => { if (otp.length === 6) { onSubmitOtp(otp); } };

    return (
        <>
            <Typography variant="h5" gutterBottom>Enter Verification Code</Typography>
            {/* ✅ Updated to use mobileNumber */}
            <Typography sx={{ mb: 2 }}>A 6-digit code was sent to {otpChannel === 'email' ? contactInfo.email : contactInfo.mobileNumber}.</Typography>
            
            {isVerifying ? (
                <Box sx={{ textAlign: 'center', my: 2 }}><CircularProgress /><Typography>Verifying code...</Typography></Box>
            ) : (
                <OtpInput onCodeChange={setOtp} />
            )}
            
            {error && !isVerifying && <FormHelperText error sx={{ textAlign: 'center', mt: 1 }}>{error}</FormHelperText>}
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="text" onClick={onBack} disabled={isVerifying}>Change Method</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={otp.length !== 6 || isVerifying}>Verify & Complete</Button>
            </Box>
        </>
    );
};

