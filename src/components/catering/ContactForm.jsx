import React from 'react';
import { Box, Typography, Button, TextField, FormHelperText } from '@mui/material';
// ✅ FIX: Corrected the import path to match the actual filename.
import { PhoneInputComponent } from './PhoneInputComponent';

export const ContactForm = ({ onBack, onSubmit, contactInfo, onFieldChange, formErrors }) => {
    return (
        <Box>
            <Typography variant="h1" component="h1" gutterBottom>
                View Discounts
            </Typography>
            <Typography sx={{ mb: 2 }}>Please enter your contact information to view bulk discounts or log in to your account.</Typography>
            <Box component="form" noValidate sx={{ mt: 2 }}>
                <TextField 
                    fullWidth 
                    margin="dense" 
                    label="Email" 
                    name="email" 
                    type="email" 
                    value={contactInfo.email}
                    onChange={onFieldChange}
                    error={!!formErrors.email}
                    helperText={formErrors.email || ' '}
                />
                <TextField
                    fullWidth
                    margin="dense"
                    label="Mobile Number"
                    name="mobileNumber"
                    value={contactInfo.mobileNumber}
                    onChange={onFieldChange}
                    InputProps={{ inputComponent: PhoneInputComponent }}
                    error={!!formErrors.mobileNumber}
                />
                {formErrors.mobileNumber && <FormHelperText error sx={{ ml: '14px' }}>{formErrors.mobileNumber}</FormHelperText>}
            </Box>
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    variant="contained"
                    onClick={onBack}
                    sx={{ backgroundColor: 'grey.200', color: 'primary.main', boxShadow: 'none', '&:hover': { backgroundColor: 'grey.300', boxShadow: 'none' } }}
                >
                    Back
                </Button>
                <Button variant="contained" onClick={onSubmit}>
                    Continue
                </Button>
            </Box>
        </Box>
    );
};

