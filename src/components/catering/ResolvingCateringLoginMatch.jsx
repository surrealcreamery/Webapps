import React from 'react';
import { Box, Typography, Button, Card, CardContent, Radio } from '@mui/material';

// This is the component for the LOGIN flow
// It does NOT have a "Create New Account" option
export const ResolvingCateringLoginMatch = ({ send, context }) => {
    const machineContext = context.context;
    
    // Get the accounts list, selected ID, and login contact info (to fill gaps)
    const { potentialAccounts, selectedAccountId, loginContactInfo } = machineContext; 

    console.log('%c[ResolvingCateringLoginMatch] Rendering', 'color: #0066cc;');
    console.log('%c[ResolvingCateringLoginMatch] potentialAccounts:', 'color: #0066cc;', potentialAccounts);
    console.log('%c[ResolvingCateringLoginMatch] selectedAccountId:', 'color: #0066cc;', selectedAccountId);
    console.log('%c[ResolvingCateringLoginMatch] loginContactInfo:', 'color: #0066cc;', loginContactInfo);
    
    // DEBUG: Log the first account's keys
    if (potentialAccounts && potentialAccounts.length > 0) {
        console.log('%c[ResolvingCateringLoginMatch] First account keys:', 'color: #ff6600;', Object.keys(potentialAccounts[0]));
        console.log('%c[ResolvingCateringLoginMatch] First account data:', 'color: #ff6600;', potentialAccounts[0]);
    }

    const handleSelect = (accountId) => {
        console.log('%c[ResolvingCateringLoginMatch] SELECT_ACCOUNT event sent with accountId:', 'color: #0066cc;', accountId);
        send({ type: 'SELECT_ACCOUNT', accountId });
    };

    const handleConfirm = () => {
        console.log('%c[ResolvingCateringLoginMatch] CONFIRM_LOGIN_ACCOUNT event sent', 'color: #0066cc;');
        send({ type: 'CONFIRM_LOGIN_ACCOUNT' });
    };

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom>Select Your Account</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We found multiple accounts. Please select the one you'd like to log into.
            </Typography>

            <Box component="fieldset" sx={{ border: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                
                {/* Loop over the potentialAccounts from the catering machine context */}
                {(potentialAccounts || []).map((alt, index) => {
                    // Use Account ID as the identifier
                    const accountId = alt['Account ID'];
                    const isSelected = selectedAccountId === accountId;
                    
                    // Fill in missing data from loginContactInfo
                    const firstName = alt['First Name'] || loginContactInfo?.firstName || '';
                    const lastName = alt['Last Name'] || loginContactInfo?.lastName || '';
                    const email = alt['Email'] || loginContactInfo?.email || '';
                    const mobileNumber = alt['Mobile Number'] || loginContactInfo?.mobileNumber || '';
                    const organizationName = alt['Organization Name'] || '';
                    
                    const fullName = `${firstName} ${lastName}`.trim() || 'Account';
                    
                    console.log(`[ResolvingCateringLoginMatch] Account #${index}:`, alt);
                    console.log(`[ResolvingCateringLoginMatch] Account ID:`, accountId);
                    console.log(`[ResolvingCateringLoginMatch] Filled name:`, fullName);
                    console.log(`[ResolvingCateringLoginMatch] isSelected:`, isSelected);
                    
                    return (
                        <Card 
                            key={accountId || `account-${index}`} 
                            variant="outlined" 
                            sx={{ 
                                border: isSelected ? '2px solid' : '1px solid',
                                borderColor: isSelected ? 'primary.main' : 'grey.300'
                            }}
                        >
                            <CardContent 
                                onClick={() => handleSelect(accountId)}
                                sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    cursor: 'pointer', 
                                    width: '100%', 
                                    p: '16px !important' 
                                }}
                            >
                                <Radio 
                                    value={accountId}
                                    name="loginAccountSelection" 
                                    checked={isSelected}
                                    onChange={() => handleSelect(accountId)}
                                    sx={{ mr: 2 }} 
                                />
                                <Box sx={{ flex: 1 }}>
                                    {/* Name */}
                                    <Typography variant="h4" component="h3" sx={{ fontWeight: 600 }}>
                                        {fullName}
                                    </Typography>
                                    
                                    {/* Organization Name - only if it exists */}
                                    {organizationName && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {organizationName}
                                        </Typography>
                                    )}
                                    
                                    {/* Mobile Number */}
                                    {mobileNumber && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {mobileNumber}
                                        </Typography>
                                    )}
                                    
                                    {/* Email */}
                                    {email && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {email}
                                        </Typography>
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
                    onClick={() => send({ type: 'BACK' })}
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
                    onClick={handleConfirm}
                    disabled={!selectedAccountId}
                >
                    Confirm
                </Button>
            </Box>
        </Box>
    );
};
