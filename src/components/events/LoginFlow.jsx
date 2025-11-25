import React, { useState } from 'react';
import { Box, Typography, Button, TextField, FormHelperText, CircularProgress, Card, CardContent, Radio, Alert } from '@mui/material';
import OtpInput from './OtpInput';

export const LoginFlow = ({ send, context }) => {
    // Note: The `context` prop is the full state object from XState.
    // The actual context data is at `context.context`.
    const machineContext = context.context;

    const [identifier, setIdentifier] = useState(machineContext.loginIdentifier || '');
    const [otp, setOtp] = useState('');
    
    const error = machineContext.error;
    const isSending = context.matches('loginFlow.sendingOtp');
    const isVerifying = context.matches('loginFlow.verifyingOtp');

    const handleSendCode = () => {
        if (!identifier) return;
        send({ type: 'SUBMIT_IDENTIFIER', value: identifier });
    };

    const handleVerifyCode = () => {
        send({ type: 'SUBMIT_OTP', value: otp });
    };

    if (context.matches('loginFlow.selectingAccount')) {
        console.log("✅ Rendering 'selectingAccount' UI...");
        
        const { potentialAccounts, selectedAccountId, error, loginIdentifier, otpChannel } = machineContext;
        
        console.log("ACCOUNTS TO RENDER:", potentialAccounts);
        console.log("Login identifier:", loginIdentifier);
        console.log("OTP channel:", otpChannel);

        // ✅ Determine authentication method
        // Check if identifier looks like a phone number or email
        const authenticatedWithPhone = otpChannel === 'sms' || 
                                       (loginIdentifier && /^\+?[\d\s\-\(\)]+$/.test(loginIdentifier));
        const authenticatedWithEmail = otpChannel === 'email' || 
                                       (loginIdentifier && loginIdentifier.includes('@'));

        console.log("Authenticated with phone?", authenticatedWithPhone);
        console.log("Authenticated with email?", authenticatedWithEmail);

        // ✅ Check if we need to show organization names
        const showOrgNames = (potentialAccounts || []).some(acc => acc['Organization Name']);

        return (
            <>
                <Typography variant="h2" gutterBottom>Select Your Account</Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    We found multiple accounts. Please select which one you'd like to use.
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box component="fieldset" sx={{ border: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {(potentialAccounts || []).map((account) => {
                        console.log("Mapping account:", account);
                        
                        // Get contact info with fallback to login identifier
                        const email = account['Email'] || (authenticatedWithEmail ? loginIdentifier : '');
                        const phone = account['Mobile Number'] || (authenticatedWithPhone ? loginIdentifier : '');
                        const orgName = account['Organization Name'] || '';

                        return (
                            <Card key={account['Guest ID']} variant="outlined" sx={{ '&:has(input:checked)': { borderColor: 'primary.main', borderWidth: 2 } }}>
                                <CardContent 
                                    component="label" 
                                    sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%', p: '16px !important' }}
                                >
                                    <Radio 
                                        value={account['Guest ID']} 
                                        name="accountSelection" 
                                        checked={selectedAccountId === account['Guest ID']}
                                        onChange={(e) => send({ type: 'SELECT_ACCOUNT', accountId: e.target.value })}
                                        sx={{mr: 2}} 
                                    />
                                    <Box>
                                        {/* ✅ SMART DISPLAY ORDER based on authentication method */}
                                        
                                        {/* If authenticated with PHONE (SMS), show: Email → Org → Phone */}
                                        {authenticatedWithPhone && (
                                            <>
                                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                    {email}
                                                </Typography>
                                                {showOrgNames && orgName && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        {orgName}
                                                    </Typography>
                                                )}
                                                <Typography variant="body2" color="text.secondary">
                                                    {phone}
                                                </Typography>
                                            </>
                                        )}
                                        
                                        {/* If authenticated with EMAIL, show: Phone → Org → Email */}
                                        {authenticatedWithEmail && (
                                            <>
                                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                    {phone}
                                                </Typography>
                                                {showOrgNames && orgName && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        {orgName}
                                                    </Typography>
                                                )}
                                                <Typography variant="body2" color="text.secondary">
                                                    {email}
                                                </Typography>
                                            </>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <Button 
                        variant="contained" 
                        onClick={() => send({ type: 'BACK_TO_IDENTIFIER' })}
                        sx={{ backgroundColor: 'grey.200', color: 'primary.main', boxShadow: 'none', '&:hover': { backgroundColor: 'grey.300', boxShadow: 'none' } }}
                    >
                        Back
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={() => send({ type: 'CONFIRM_ACCOUNT_SELECTION' })}
                        disabled={!selectedAccountId} 
                    >
                        Continue
                    </Button>
                </Box>
            </>
        );
    }
    
    if (context.matches('loginFlow.enteringIdentifier') || isSending) {
        return (
            <Box>
                <Typography variant="h2" gutterBottom>Log In</Typography>
                <Typography sx={{ mb: 2 }}>Enter your email or phone number to get started.</Typography>
                
                {isSending ? (
                    <Box sx={{ textAlign: 'center', my: 2, height: '59px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2 }}>Sending code...</Typography>
                    </Box>
                ) : (
                    <TextField 
                        fullWidth 
                        margin="dense" 
                        label="Email or Phone Number" 
                        name="identifier" 
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        error={!!error}
                        helperText={error || ' '}
                    />
                )}
                
                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <Button 
                        variant="contained" 
                        onClick={() => send({ type: 'BACK' })} 
                        disabled={isSending}
                        sx={{ backgroundColor: 'grey.200', color: 'primary.main', boxShadow: 'none', '&:hover': { backgroundColor: 'grey.300', boxShadow: 'none' } }}
                    >
                        Back
                    </Button>
                    <Button variant="contained" onClick={handleSendCode} disabled={isSending || !identifier}>
                        Send Code
                    </Button>
                </Box>
            </Box>
        );
    }

    if (context.matches('loginFlow.enteringOtp') || context.matches('loginFlow.verifyingOtp')) {
        return (
            <>
                <Typography variant="h5" gutterBottom>Enter Verification Code</Typography>
                <Typography sx={{ mb: 2 }}>
                    A 6-digit code was sent to {machineContext.loginIdentifier}.
                </Typography>
                
                {isVerifying ? (
                    <Box sx={{ textAlign: 'center', my: 2 }}><CircularProgress /><Typography>Verifying code...</Typography></Box>
                ) : (
                    <OtpInput onCodeChange={setOtp} />
                )}
                
                {error && !isVerifying && <FormHelperText error sx={{ textAlign: 'center', mt: 1 }}>{error}</FormHelperText>}
                
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Button variant="text" onClick={() => send({ type: 'BACK_TO_IDENTIFIER' })} disabled={isVerifying}>Change Method</Button>
                    <Button variant="contained" onClick={handleVerifyCode} disabled={isVerifying || otp.length !== 6}>Verify Code</Button>
                </Box>
            </>
        );
    }
    
    return null;
};
