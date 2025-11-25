import React from 'react';
import { Box, Typography, Button, Card, CardContent, Radio, Alert } from '@mui/material';

// This is the NEW component specifically for the CATERING flow
export const ResolvingCateringMatch = ({ send, context }) => {
    // context is the full machine state. machineContext is context.context
    const machineContext = context.context;
    
    // 'potentialAccounts' = API results (e.g., [ { 'First Name': 'Al', 'Email': 'a@b.com' } ])
    // 'contactInfo' = What user typed (e.g., { firstName: 'Al', lastName: 'T', email: 'a@b.com', mobileNumber: '123' })
    const { potentialAccounts, selectedPartialMatch, contactInfo } = machineContext;

    // This is the data for the "Create New Account" option, based on user's form input
    const submittedInfo = {
        'First Name': contactInfo.firstName,
        'Last Name': contactInfo.lastName,
        'Organization Name': contactInfo.organizationName,
        'Email': contactInfo.email,
        'Mobile Number': contactInfo.mobileNumber,
        'isNew': true // A flag to identify this special option
    };

    const handleSelect = (selection) => {
        // This sends the *original* API data (or the 'isNew' object).
        // The machine's 'setFinalGuestFromSelection' action handles the merging.
        send({ type: 'SELECT_PARTIAL_MATCH', selection });
    };

    const isSelected = (option) => {
        // Compare based on content
        return JSON.stringify(selectedPartialMatch) === JSON.stringify(option);
    };

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom>Confirm Your Account</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We found existing accounts matching your info. Please select the correct account, or confirm you want to create a new one.
            </Typography>

            <Box component="fieldset" sx={{ border: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                
                {/* "Create New" Option Card - uses the 'submittedInfo' object */}
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
                            <Typography variant="h4" component="h3" sx={{ fontWeight: 'bold' }}>Create a new account</Typography>
                            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                                Use the information you just submitted:
                            </Typography>
                            {/* ✅ MODIFIED: Removed labels */}
                            <Typography color="text.secondary" sx={{ mt: 0.5, pl: 2 }}>
                                • {submittedInfo['First Name']} {submittedInfo['Last Name']}<br/>
                                • {submittedInfo['Email']}<br/>
                                • {submittedInfo['Mobile Number']}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>

                {/* Existing Partial Match Options */}
                {(potentialAccounts || []).map((alt, index) => {
                    
                    // --- Fill in the Gaps Logic ---
                    const displayName = (alt['First Name'] || alt['Organization Name'])
                        ? `${alt['First Name'] || contactInfo.firstName || ''} ${alt['Last Name'] || contactInfo.lastName || ''} ${alt['Organization Name'] ? `(${alt['Organization Name']})` : ''}`.trim()
                        : `${contactInfo.firstName || ''} ${contactInfo.lastName || ''}`.trim() || 'Select This Account';
                    
                    const displayEmail = alt['Email'] || contactInfo.email;
                    const displayMobile = alt['Mobile Number'] || contactInfo.mobileNumber;
                    // --- End Gap Logic ---

                    return (
                        <Card key={alt['Account ID'] || index} variant="outlined" sx={{ '&:has(input:checked)': { borderColor: 'primary.main', borderWidth: 2 } }}>
                            <CardContent 
                                component="label" 
                                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%', p: '16px !important' }}
                            >
                                <Radio 
                                    value={alt['Account ID'] || index}
                                    name="partialMatchSelection" 
                                    checked={isSelected(alt)}
                                    onChange={() => handleSelect(alt)} // Send the *original* API object ('alt')
                                    sx={{mr: 2}} 
                                />
                                <Box>
                                    <Typography variant="h4" component="h3">{displayName}</Typography>
                                    {displayEmail && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{displayEmail}</Typography>}
                                    {displayMobile && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{displayMobile}</Typography>}
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
                    Confirm
                </Button>
            </Box>
        </Box>
    );
};