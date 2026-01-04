import React from 'react';
import { Box, Typography, Button, Card, CardContent, Radio, Alert } from '@mui/material';

export const ResolvingPartialMatch = ({ send, context }) => {
    const machineContext = context.context;
    const { partialMatchAlternatives, selectedPartialMatch, contactInfo, otpChannel } = machineContext;

    // ✅ Get current event to check role
    const currentEvent = machineContext.fundraiserEvents?.find(e => e.id === machineContext.selectedEventId);
    const isHost = currentEvent?.Role === 'Host';
    const isParticipant = currentEvent?.Role === 'Participant' || !isHost;

    // ✅ Check if we need to show organization names to differentiate
    // Show org names if:
    // 1. User is a Host (always show)
    // 2. Any alternatives have an organization name (for participants to differentiate)
    const shouldShowOrgNames = () => {
        if (isHost) return true; // Always show for hosts
        if (!partialMatchAlternatives || partialMatchAlternatives.length === 0) return false;
        
        // Check if any alternatives have an organization name
        const hasAnyOrgName = partialMatchAlternatives.some(alt => 
            alt['Organization Name'] && alt['Organization Name'].trim() !== ''
        );
        
        return hasAnyOrgName;
    };

    const showOrgNames = shouldShowOrgNames();

    // ✅ This is the data the user originally typed into the form
    const submittedInfo = {
        'Email': contactInfo.email,
        'Mobile Number': contactInfo.mobileNumber,
        'Organization Name': contactInfo.organizationName,
        'isNew': true
    };

    const handleSelect = (selection) => {
        send({ type: 'SELECT_PARTIAL_MATCH', selection });
    };

    const isSelected = (option) => {
        return JSON.stringify(selectedPartialMatch) === JSON.stringify(option);
    };

    // ✅ Helper function to display contact info, filling in gaps
    const getDisplayInfo = (alternative) => {
        const email = alternative['Email'] || contactInfo.email;
        const mobile = alternative['Mobile Number'] || contactInfo.mobileNumber;
        const orgName = alternative['Organization Name'] || '';
        
        return { email, mobile, orgName };
    };

    // ✅ Determine display order based on authentication method (for login flow)
    const authenticatedWithPhone = otpChannel === 'sms';
    const authenticatedWithEmail = otpChannel === 'email';

    return (
        <Box>
            <Typography variant="h2" gutterBottom>Confirm Your Information</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We found some existing accounts that are similar to the information you entered. Please select the correct account or confirm you'd like to create a new one.
            </Typography>

            <Box component="fieldset" sx={{ border: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                
                {/* ✅ "Create New Account" Option */}
                <Card variant="outlined" sx={{ '&:has(input:checked)': { borderColor: 'primary.main', borderWidth: 2 } }}>
                    <CardContent 
                        component="label" 
                        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%', p: '16px !important' }}
                    >
                        <Radio 
                            value="new"
                            name="partialMatchSelection" 
                            checked={isSelected(submittedInfo)}
                            onChange={() => handleSelect(submittedInfo)}
                            sx={{mr: 2}} 
                        />
                        <Box>
                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>Create a new account</Typography>
                            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                                Use the information you just submitted:
                            </Typography>
                            <Box sx={{ mt: 1, pl: 2 }}>
                                {/* ✅ Show organization for hosts */}
                                {isHost && submittedInfo['Organization Name'] && (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        {submittedInfo['Organization Name']}
                                    </Typography>
                                )}
                                <Typography variant="body2" color="text.secondary">
                                    {submittedInfo['Email']}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {submittedInfo['Mobile Number']}
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* ✅ Partial Match Options */}
                {(partialMatchAlternatives || []).map((alt, index) => {
                    const displayInfo = getDisplayInfo(alt);
                    
                    return (
                        <Card key={index} variant="outlined" sx={{ '&:has(input:checked)': { borderColor: 'primary.main', borderWidth: 2 } }}>
                            <CardContent 
                                component="label" 
                                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%', p: '16px !important' }}
                            >
                                <Radio 
                                    value={index}
                                    name="partialMatchSelection" 
                                    checked={isSelected(alt)}
                                    onChange={() => handleSelect(alt)}
                                    sx={{mr: 2}} 
                                />
                                <Box>
                                    {/* ✅ PARTICIPANT REGISTRATION: Display order Email → Organization → Phone */}
                                    {isParticipant && (
                                        <>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                {displayInfo.email}
                                            </Typography>
                                            {showOrgNames && displayInfo.orgName && (
                                                <Typography variant="body2" color="text.secondary">
                                                    {displayInfo.orgName}
                                                </Typography>
                                            )}
                                            <Typography variant="body2" color="text.secondary">
                                                {displayInfo.mobile}
                                            </Typography>
                                        </>
                                    )}

                                    {/* ✅ HOST: Show what they DIDN'T authenticate with first */}
                                    {isHost && authenticatedWithPhone && (
                                        <>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                {displayInfo.email}
                                            </Typography>
                                            {showOrgNames && displayInfo.orgName && (
                                                <Typography variant="body2" color="text.secondary">
                                                    {displayInfo.orgName}
                                                </Typography>
                                            )}
                                            <Typography variant="body2" color="text.secondary">
                                                {displayInfo.mobile}
                                            </Typography>
                                        </>
                                    )}
                                    
                                    {isHost && authenticatedWithEmail && (
                                        <>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                {displayInfo.mobile}
                                            </Typography>
                                            {showOrgNames && displayInfo.orgName && (
                                                <Typography variant="body2" color="text.secondary">
                                                    {displayInfo.orgName}
                                                </Typography>
                                            )}
                                            <Typography variant="body2" color="text.secondary">
                                                {displayInfo.email}
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
                    onClick={() => send({ type: 'BACK' })}
                    sx={{ backgroundColor: 'grey.200', color: 'primary.main', boxShadow: 'none', '&:hover': { backgroundColor: 'grey.300', boxShadow: 'none' } }}
                >
                    Back
                </Button>
                <Button 
                    variant="contained" 
                    onClick={() => send({ type: 'CONFIRM_PARTIAL_MATCH' })}
                    disabled={!selectedPartialMatch} 
                >
                    Continue
                </Button>
            </Box>
        </Box>
    );
};
