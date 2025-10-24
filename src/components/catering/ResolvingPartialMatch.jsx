import React from 'react';
import { Box, Typography, Button, Card, CardContent, Radio, Alert } from '@mui/material';

export const ResolvingPartialMatch = ({ send, context }) => {
    // context is the full machine state. machineContext is context.context
    const machineContext = context.context;
    const { partialMatchAlternatives, selectedPartialMatch, contactInfo } = machineContext;

    // This is the data the user originally typed into the form
    const submittedInfo = {
        'Organization Name': contactInfo.organizationName,
        'Email': contactInfo.email,
        'Mobile Number': contactInfo.mobileNumber, // ✅ Corrected from .phone
        'isNew': true // A flag to identify this special option
    };

    const handleSelect = (selection) => {
        send({ type: 'SELECT_PARTIAL_MATCH', selection });
    };

    const isSelected = (option) => {
        // Compare based on content since object references will be different
        return JSON.stringify(selectedPartialMatch) === JSON.stringify(option);
    };

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom>Confirm Your Information</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We found some existing records that are similar to the information you entered. Please select the correct record or confirm you'd like to create a new one.
            </Typography>

            <Box component="fieldset" sx={{ border: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                
                {/* ✅ New "Create New" Option Card */}
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
                            <Typography variant="h4" component="h3" sx={{ fontWeight: 'bold' }}>Create a new organization</Typography>
                            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                                Use the information you just submitted:
                            </Typography>
                            <Typography color="text.secondary" sx={{ mt: 0.5, pl: 2 }}>
                                • Org: {submittedInfo['Organization Name']}<br/>
                                • Email: {submittedInfo['Email']}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>

                {/* Existing Partial Match Options */}
                {(partialMatchAlternatives || []).map((alt, index) => (
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
                                <Typography variant="h4" component="h3">{alt['Organization Name'] || 'Select This Option'}</Typography>
                                {alt['Email'] && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{alt['Email']}</Typography>}
                                {alt['Mobile Number'] && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{alt['Mobile Number']}</Typography>}
                            </Box>
                        </CardContent>
                    </Card>
                ))}
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
