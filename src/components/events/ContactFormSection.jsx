import React from 'react';
import { Alert, Box, Typography, Button, TextField, FormHelperText, FormControlLabel, Checkbox, Link, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { PhoneInputComponent } from '@/components/events/PhoneInput';

export const ContactFormSection = ({ onBack, onSubmit, contactInfo, onFieldChange, formErrors, currentEvent, selectedLocation, error }) => {

    // Debugging log to check the incoming currentEvent prop
    console.log('ContactFormSection received currentEvent:', currentEvent);

    // ✅ Show organization field for all fundraiser events (Fundraiser or Rolling Fundraiser)
    const eventType = (currentEvent?.type || currentEvent?.Type || '').toLowerCase();
    const isFundraiser = eventType === 'fundraiser' || eventType === 'rolling fundraiser';
    const isSpaceRental = eventType === 'space rental';

    // ✅ Log for debugging
    console.log('Event type:', eventType);
    console.log('Should show organization field?', isFundraiser);

    // Handle checkbox change
    const handleSmsOptInChange = (event) => {
        onFieldChange({
            target: {
                name: 'smsOptIn',
                value: event.target.checked
            }
        });
    };

    // Per-event parental consent
    const requireConsent = !!currentEvent?.requireConsent;
    const consentText = currentEvent?.consentText || '';
    const handleConsentChange = (event) => {
        onFieldChange({
            target: {
                name: 'consentAccepted',
                value: event.target.checked
            }
        });
    };

    return (
        <Box>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Something went wrong. Please try again, or contact us directly if the problem persists.
                </Alert>
            )}
            <Typography variant="h2" component="h2" gutterBottom>
                Your Information
            </Typography>
            <Box component="form" noValidate sx={{ mt: 2 }}>
                {isSpaceRental && (
                    <>
                        <FormControl fullWidth margin="dense" error={!!formErrors.reservationType}>
                            <InputLabel>Reservation Type</InputLabel>
                            <Select
                                value={contactInfo.reservationType || ''}
                                label="Reservation Type"
                                name="reservationType"
                                onChange={(e) => onFieldChange({ target: { name: 'reservationType', value: e.target.value } })}
                            >
                                <MenuItem value="Birthday Party">Birthday Party</MenuItem>
                                <MenuItem value="TCG Session">TCG Session</MenuItem>
                                <MenuItem value="Private Event">Private Event</MenuItem>
                            </Select>
                            {formErrors.reservationType && (
                                <FormHelperText error>{formErrors.reservationType}</FormHelperText>
                            )}
                        </FormControl>
                        <TextField
                            fullWidth
                            margin="dense"
                            label={selectedLocation?.maxEventSize ? `Estimated Party Size (max ${selectedLocation.maxEventSize})` : "Estimated Party Size"}
                            name="partySize"
                            type="number"
                            inputProps={{ min: 1, ...(selectedLocation?.maxEventSize && { max: selectedLocation.maxEventSize }) }}
                            value={contactInfo.partySize || ''}
                            onChange={onFieldChange}
                            error={!!formErrors.partySize}
                            helperText={formErrors.partySize || ' '}
                        />
                    </>
                )}
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
                {/* ✅ Render organization field for all fundraiser events */}
                {isFundraiser && (
                    <TextField
                        fullWidth
                        margin="dense"
                        label="Organization Name"
                        name="organizationName"
                        required
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
                            {isFundraiser
                                ? "Text me my fundraiser confirmation and future updates. Msg & data rates may apply. Reply STOP to opt out."
                                : "Text me my event confirmation and future updates. Msg & data rates may apply. Reply STOP to opt out."
                            }
                        </Typography>
                    }
                    sx={{ mt: 2, alignItems: 'flex-start' }}
                />

                {/* Parental Consent Checkbox (per-event, required) */}
                {requireConsent && consentText && (
                    <>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={contactInfo.consentAccepted || false}
                                    onChange={handleConsentChange}
                                    name="consentAccepted"
                                    color="primary"
                                />
                            }
                            label={
                                <Typography variant="body2" color="text.secondary">
                                    {consentText}
                                </Typography>
                            }
                            sx={{ mt: 2, alignItems: 'flex-start' }}
                        />
                        {formErrors.consentAccepted && (
                            <FormHelperText error sx={{ ml: '14px' }}>{formErrors.consentAccepted}</FormHelperText>
                        )}
                    </>
                )}
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
