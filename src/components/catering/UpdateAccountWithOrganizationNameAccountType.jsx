import React, { useState } from 'react';
import {
    Box, Typography, Button, TextField, Stack,
    FormHelperText
} from '@mui/material';

export const UpdateAccountWithOrganizationNameAccountType = ({ sendToCatering, cateringState }) => {
    // Get existing org name from context if it was pre-filled (e.g., from a partial match)
    const existingOrgName = cateringState?.context?.contactInfo?.organizationName || '';
    
    const [organizationName, setOrganizationName] = useState(existingOrgName);
    // State to track view: '' (initial), 'Non-Profit', or 'Company'
    const [accountType, setAccountType] = useState(''); 
    const [orgError, setOrgError] = useState('');

    // Check if user has selected a type that requires an org name
    const isOrgSelected = accountType === 'Non-Profit' || accountType === 'Company';
    
    // Set the correct label for the text field
    const orgLabel = accountType === 'Non-Profit' ? 'Non-Profit Name' : 'Company Name';

    // Style for the selection buttons (like the OTP choice buttons)
    const buttonStyles = {
        justifyContent: 'flex-start', 
        py: 1.5, 
        textTransform: 'none',
        color: 'black', 
        borderColor: 'black',
        '&:hover': { 
            borderColor: 'black', 
            backgroundColor: 'rgba(0,0,0,0.04)' 
        }
    };

    /**
     * Step 1: User clicks one of the three account type buttons.
     */
    const handleTypeSelect = (type) => {
        if (type === 'Retail') {
            // Retail is selected, submit immediately and proceed.
            console.log("Retail selected, submitting immediately.");
            sendToCatering({
                type: 'SUBMIT_ORG_AND_TYPE',
                organizationName: '', // No org name for Retail
                accountType: 'Retail'
            });
        } else {
            // Non-Profit or Company selected, show the text field.
            console.log(`${type} selected, showing org name field.`);
            setAccountType(type);
            setOrgError(''); // Clear any previous errors
        }
    };

    /**
     * Step 2: User clicks "Continue" *after* entering an org name.
     */
    const handleSubmitOrgName = () => {
        if (!organizationName.trim()) {
            setOrgError(`${orgLabel} is required.`);
            return;
        }
        
        console.log("Org name submitted, proceeding.");
        sendToCatering({
            type: 'SUBMIT_ORG_AND_TYPE',
            organizationName: organizationName.trim(),
            accountType: accountType // 'Non-Profit' or 'Company'
        });
    };
    
    /**
     * Handle the "Back" button.
     * If in org name entry view, go back to type selection.
     * If in type selection view, go back in the state machine.
     */
    const handleBack = () => {
        if (isOrgSelected) {
            setAccountType('');
            setOrgError('');
        } else {
            sendToCatering({ type: 'BACK' });
        }
    };

    return (
        <Box>
            <Typography variant="h1" component="h1" gutterBottom>
                Account Details
            </Typography>
            
            {/* --- Main Content Area --- */}
            <Box>
                {!isOrgSelected ? (
                    // --- View 1: Select Account Type ---
                    <Stack spacing={2} sx={{ mt: 3 }}>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            Please select your account type.
                        </Typography>
                        <Button variant="outlined" sx={buttonStyles} onClick={() => handleTypeSelect('Retail')}>
                            Retail
                        </Button>
                        <Button variant="outlined" sx={buttonStyles} onClick={() => handleTypeSelect('Non-Profit')}>
                            Non-Profit
                        </Button>
                        <Button variant="outlined" sx={buttonStyles} onClick={() => handleTypeSelect('Company')}>
                            Company
                        </Button>
                    </Stack>
                ) : (
                    // --- View 2: Enter Organization Name ---
                    <Stack spacing={2} sx={{ mt: 3 }}>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            Please provide your organization's name.
                        </Typography>
                        <TextField
                            fullWidth
                            required
                            label={orgLabel} // Dynamic label
                            name="organizationName"
                            value={organizationName}
                            onChange={(e) => {
                                setOrganizationName(e.target.value);
                                if (orgError) setOrgError('');
                            }}
                            error={!!orgError}
                            helperText={orgError || ' '}
                            autoFocus
                        />
                        
                        {/* This "Continue" button only appears with the text field */}
                        <Button
                            variant="contained"
                            onClick={handleSubmitOrgName}
                            disabled={!organizationName.trim()}
                            sx={{ py: 1.5 }} // Make it a bit larger
                        >
                            Continue
                        </Button>
                    </Stack>
                )}
            </Box>
            
            {/* --- Global Back Button --- */}
            <Box sx={{ mt: 4 }}>
                <Button
                    variant="contained"
                    onClick={handleBack}
                    sx={{ backgroundColor: 'grey.200', color: 'primary.main', boxShadow: 'none', '&:hover': { backgroundColor: 'grey.300', boxShadow: 'none' } }}
                >
                    Back
                </Button>
            </Box>
        </Box>
    );
};