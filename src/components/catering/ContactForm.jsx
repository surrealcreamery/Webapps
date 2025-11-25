import React from 'react';
import { Box, Typography, Button, TextField, FormHelperText, Stack } from '@mui/material';
import { PhoneInputComponent } from './PhoneInputComponent'; // Ensure this path is correct

export const ContactForm = ({ onBack, onSubmit, contactInfo, onFieldChange, formErrors }) => {
    return (
        <Box>
            <Typography variant="h1" component="h1" gutterBottom>
                Order Contact Information
            </Typography>
            <Typography sx={{ mb: 2 }}>
                Please enter the contact information for the person who will be placing this order
            </Typography>
            
            <Stack component="form" noValidate sx={{ mt: 1 }} spacing={1.5}>
                 <TextField
                    fullWidth
                    label="First Name"
                    name="firstName"
                    value={contactInfo.firstName || ''}
                    onChange={onFieldChange}
                    error={!!formErrors.firstName}
                    helperText={formErrors.firstName || ' '}
                    required
                 />

                 <TextField
                    fullWidth
                    label="Last Name"
                    name="lastName"
                    value={contactInfo.lastName || ''}
                    onChange={onFieldChange}
                    error={!!formErrors.lastName}
                    helperText={formErrors.lastName || ' '}
                    required
                 />

                 <TextField
                    fullWidth
                    label="Email"
                    name="email"
                    type="email"
                    value={contactInfo.email || ''}
                    onChange={onFieldChange}
                    error={!!formErrors.email}
                    helperText={formErrors.email || ' '}
                    required
                 />
                 <TextField
                    fullWidth
                    label="Mobile Number"
                    name="mobileNumber"
                    value={contactInfo.mobileNumber || ''}
                    onChange={onFieldChange}
                    InputProps={{ inputComponent: PhoneInputComponent }}
                    error={!!formErrors.mobileNumber}
                    required
                 />
                 {/* Display mobile error separately if needed */}
                 {formErrors.mobileNumber && !formErrors.firstName && !formErrors.lastName && !formErrors.email && (
                    <FormHelperText error sx={{ ml: '14px', mt: '3px !important' }}>{formErrors.mobileNumber}</FormHelperText>
                 )}
                 {/* Add a general helper text space if no specific error */}
                 {!formErrors.mobileNumber && !formErrors.firstName && !formErrors.lastName && !formErrors.email && (
                     <Box sx={{ height: '22.5px' }} /> // Placeholder to prevent layout shift
                 )}
            </Stack>
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