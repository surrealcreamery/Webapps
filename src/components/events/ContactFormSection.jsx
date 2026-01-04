import React from 'react';
import { Box, Typography, Button, TextField, FormHelperText, FormControlLabel, Checkbox, Link } from '@mui/material';
import { PhoneInputComponent } from '@/components/events/PhoneInput';

export const ContactFormSection = ({ onBack, onSubmit, contactInfo, onFieldChange, formErrors, currentEvent }) => {
    
    // Debugging log to check the incoming currentEvent prop
    console.log('ContactFormSection received currentEvent:', currentEvent);

    // ✅ Only show organization field if role is "Host"
    const isHost = currentEvent?.Role === 'Host';
    
    // ✅ Log the role for debugging
    console.log('User role for this event:', currentEvent?.Role);
    console.log('Should show organization field?', isHost);

    // Handle checkbox change
    const handleSmsOptInChange = (event) => {
        onFieldChange({
            target: {
                name: 'smsOptIn',
                value: event.target.checked
            }
        });
    };

    return (
        <Box>
            <Typography variant="h2" component="h2" gutterBottom>
                Your Information
            </Typography>
            <Box component="form" noValidate sx={{ mt: 2 }}>
                <TextField 
                    fullWidth 
                    margin="dense" 
                    label="First Name" 
                    name="firstName" 
                    value={contactInfo.firstName}
                    onChange={onFieldChange}
                    error={!!formErrors.firstName}
                    helperText={formErrors.firstName || ' '}
                />
                <TextField 
                    fullWidth 
                    margin="dense" 
                    label="Last Name" 
                    name="lastName" 
                    value={contactInfo.lastName}
                    onChange={onFieldChange}
                    error={!!formErrors.lastName}
                    helperText={formErrors.lastName || ' '}
                />
                {/* ✅ Only render organization field for Hosts */}
                {isHost && (
                    <TextField 
                        fullWidth 
                        margin="dense" 
                        label="Organization Name" 
                        name="organizationName" 
                        value={contactInfo.organizationName}
                        onChange={onFieldChange}
                        error={!!formErrors.organizationName}
                        helperText={formErrors.organizationName || ' '}
                    />
                )}
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
                
                {/* SMS Opt-In Checkbox */}
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={contactInfo.smsOptIn || false}
                            onChange={handleSmsOptInChange}
                            name="smsOptIn"
                            color="primary"
                        />
                    }
                    label={
                        <Typography variant="body2" color="text.secondary">
                            {isHost 
                                ? "Text me my fundraiser confirmation and future updates. Msg & data rates may apply. Reply STOP to opt out."
                                : "Text me my event confirmation and future updates. Msg & data rates may apply. Reply STOP to opt out."
                            }
                        </Typography>
                    }
                    sx={{ mt: 2, alignItems: 'flex-start' }}
                />
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
