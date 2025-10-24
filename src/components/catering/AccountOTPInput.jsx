import React, { useState, useRef } from 'react';
import { Box, Typography, Button, FormHelperText, CircularProgress, TextField } from '@mui/material';

// This is the internal component for the 6-digit input
const OTPInputComponent = ({ onCodeChange }) => {
    const refs = useRef([]);
    const [code, setCode] = useState(new Array(6).fill(''));

    const handleChange = (e, index) => {
        const val = e.target.value;
        // Only allow a single digit
        if (!/^[0-9]$/.test(val) && val !== '') return;

        const newCode = [...code];
        newCode[index] = val;
        setCode(newCode);
        onCodeChange(newCode.join(''));

        // Focus next input if a digit was entered
        if (val !== '' && index < 5) {
            refs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e, index) => {
        // Focus previous input on backspace if current input is empty
        if (e.key === 'Backspace' && code[index] === '' && index > 0) {
            refs.current[index - 1]?.focus();
        }
    };

    return (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            {code.map((digit, i) => (
                <TextField 
                    key={i} 
                    inputRef={el => (refs.current[i] = el)} 
                    value={digit}
                    onChange={e => handleChange(e, i)} 
                    onKeyDown={e => handleKeyDown(e, i)}
                    inputProps={{ 
                        maxLength: 1, 
                        style: { textAlign: 'center' } 
                    }} 
                    sx={{ width: '45px' }}
                />
            ))}
        </Box>
    );
};


// ✅ FIX: Changed to a DEFAULT export to match what Catering.jsx is importing.
export default function AccountOTPInput({ onBack, onSubmitOtp, contactInfo, error, isVerifying, otpChannel }) {
    const [otp, setOtp] = useState('');
    const handleSubmit = () => { if (otp.length === 6) { onSubmitOtp(otp); } };

    return (
        <>
            <Typography variant="h5" gutterBottom>Enter Verification Code</Typography>
            <Typography sx={{ mb: 2 }}>A 6-digit code was sent to {otpChannel === 'email' ? contactInfo.email : contactInfo.mobileNumber}.</Typography>
            
            {isVerifying ? (
                <Box sx={{ textAlign: 'center', my: 2 }}><CircularProgress /><Typography>Verifying code...</Typography></Box>
            ) : (
                <OTPInputComponent onCodeChange={setOtp} />
            )}
            
            {error && !isVerifying && <FormHelperText error sx={{ textAlign: 'center', mt: 1 }}>{error}</FormHelperText>}
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="text" onClick={onBack} disabled={isVerifying}>Change Method</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={otp.length !== 6 || isVerifying}>Verify & Complete</Button>
            </Box>
        </>
    );
};

