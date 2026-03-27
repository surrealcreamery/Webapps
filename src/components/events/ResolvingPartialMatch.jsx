import React from 'react';
import { Box, Typography, Button, Card, CardContent, Radio } from '@mui/material';

export const ResolvingPartialMatch = ({ send, context }) => {
    const machineContext = context.context;
    const { matchedAccounts, selectedPartialMatch, contactInfo, otpChannel, matchType } = machineContext;

    // Get current event to check role
    const currentEvent = machineContext.fundraiserEvents?.find(e => e.id === machineContext.selectedEventId);
    const isHost = currentEvent?.Role === 'Host';

    // "Create new account" option with the user's submitted info
    const submittedInfo = {
        'Email': contactInfo.email,
        'Mobile Number': contactInfo.mobileNumber,
        'Organization Name': contactInfo.organizationName,
        'isNew': true
    };

    const handleSelect = (selection) => {
        send({ type: 'SELECT_ACCOUNT_OPTION', selection });
    };

    const isSelected = (option) => {
        return JSON.stringify(selectedPartialMatch) === JSON.stringify(option);
    };

    return (
        <Box>
            <Typography variant="h2" gutterBottom>Confirm Your Account</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We found existing accounts that match your information. Please select the correct account or create a new one.
            </Typography>

            <Box component="fieldset" sx={{ border: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>

                {/* "Create New Account" Option */}
                <Card variant="outlined" sx={{ '&:has(input:checked)': { borderColor: 'primary.main', borderWidth: 2 } }}>
                    <CardContent
                        component="label"
                        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%', p: '16px !important' }}
                    >
                        <Radio
                            value="new"
                            name="accountSelection"
                            checked={isSelected(submittedInfo)}
                            onChange={() => handleSelect(submittedInfo)}
                            sx={{ mr: 2 }}
                        />
                        <Box>
                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>Create a new account</Typography>
                            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                                Register with the information you submitted:
                            </Typography>
                            <Box sx={{ mt: 1, pl: 2 }}>
                                {contactInfo.organizationName && (
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {contactInfo.organizationName}
                                    </Typography>
                                )}
                                <Typography variant="body2" color="text.secondary">
                                    {contactInfo.email}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {contactInfo.mobileNumber}
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* Matched Account Options */}
                {(matchedAccounts || []).map((account, index) => {
                    return (
                        <Card key={account['Guest ID'] || index} variant="outlined" sx={{ '&:has(input:checked)': { borderColor: 'primary.main', borderWidth: 2 } }}>
                            <CardContent
                                component="label"
                                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%', p: '16px !important' }}
                            >
                                <Radio
                                    value={index}
                                    name="accountSelection"
                                    checked={isSelected(account)}
                                    onChange={() => handleSelect(account)}
                                    sx={{ mr: 2 }}
                                />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                                        {account['First Name']} {account['Last Name']}
                                    </Typography>
                                    {account['Organization Name'] && (
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {account['Organization Name']}
                                        </Typography>
                                    )}
                                    {otpChannel !== 'email' && account['Email'] && (
                                        <Typography variant="body2" color="text.secondary">
                                            {account['Email']}
                                        </Typography>
                                    )}
                                    {otpChannel !== 'sms' && account['Mobile Number'] && (
                                        <Typography variant="body2" color="text.secondary">
                                            {account['Mobile Number']}
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
                    sx={{ backgroundColor: 'grey.200', color: 'primary.main', boxShadow: 'none', '&:hover': { backgroundColor: 'grey.300', boxShadow: 'none' } }}
                >
                    Back
                </Button>
                <Button
                    variant="contained"
                    onClick={() => send({ type: 'CONFIRM_ACCOUNT_OPTION' })}
                    disabled={!selectedPartialMatch}
                >
                    Continue
                </Button>
            </Box>
        </Box>
    );
};
