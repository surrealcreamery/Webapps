import React, { useState } from 'react';
import {
    Box,
    Typography,
    Button,
    TextField,
    Card,
    CardContent,
    CardActions,
    CircularProgress,
    FormHelperText,
    Alert
} from '@mui/material';
import PhoneInputComponent from './phoneInput.jsx';

const emailRegex = /^\S+@\S+\.\S+$/;

const areContactsUnique = (forms, isGift) => {
    const formsToValidate = isGift ? forms.slice(1) : forms;
    const seen = new Set();
    
    for (const form of formsToValidate) {
        if (form.email && form.phone) {
            const contactKey = `${form.email.trim().toLowerCase()}:${form.phone.trim()}`;
            if (seen.has(contactKey)) {
                return false;
            }
            seen.add(contactKey);
        }
    }
    return true;
};

const StepContactInfo = ({
    send,
    isSubmitting,
    customerForms,
    submittedCustomers,
    currentCustomerIndex,
    numberOfSubscriptions,
    isEditing,
    isGift
}) => {
    const totalForms = isGift ? numberOfSubscriptions + 1 : numberOfSubscriptions;
    const activeForm = customerForms[currentCustomerIndex] || {};
    const allFormsSubmitted = submittedCustomers.length === totalForms;
    const [errors, setErrors] = useState({});
    const [uniquenessError, setUniquenessError] = useState(null);

    const getTitle = (index) => {
        if (isGift) {
            return index === 0 ? 'Your Information (Gifter)' : `Gifted Subscriber #${index}`;
        }
        return index === 0 ? 'Subscriber (Primary)' : `Subscriber #${index + 1}`;
    };

    const getErrorMessage = () => {
        return isGift 
            ? "Each gift recipient must have a unique email and phone number."
            : "Each subscriber must have a unique email and phone number.";
    };

    const mainButtonText = isEditing ? 'Save Changes' : (allFormsSubmitted ? 'Proceed to Payment' : 'Continue');
    const backButtonText = isEditing ? 'Cancel' : 'Back';
    
    const handleBackClick = () => {
        if (isEditing) {
            send({ type: 'CANCEL_EDIT' });
        } else {
            send({ type: 'BACK' });
        }
    };

    const handleMainClick = () => {
        if (allFormsSubmitted && !isEditing) {
            send({ type: 'PROCEED_TO_PAYMENT' });
        } else {
            handleSubmit();
        }
    };
    
    const handleFieldChange = (field, value) => {
        if (uniquenessError) {
            setUniquenessError(null);
        }
        send({ type: 'UPDATE_CUSTOMER_FORM_FIELD', index: currentCustomerIndex, field, value });
    };

    const validate = () => {
        const newErrors = {};
        const { firstName, lastName, email, phone } = activeForm;

        if (!firstName || !firstName.trim()) newErrors.firstName = 'First name is required.';
        if (!lastName || !lastName.trim()) newErrors.lastName = 'Last name is required.';
        if (!email || !emailRegex.test(email)) newErrors.email = 'Please enter a valid email address.';
        if (!phone || phone.replace(/\D/g, '').length < 10) newErrors.phone = 'Please enter a valid phone number.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    function handleSubmit() {
        setUniquenessError(null);

        if (!validate()) {
            return;
        }

        if (!areContactsUnique(customerForms, isGift)) {
            setUniquenessError(getErrorMessage());
            return;
        }
        
        send({ type: 'SUBMIT_CONTACT' });
    }

    return (
        <>
            <Typography variant="h1" gutterBottom>
                {isEditing ? `Edit ${getTitle(currentCustomerIndex)}` : 'Contact Information'}
            </Typography>

            {/* ✅ REMOVED: Error message moved from here... */}

            {/* Submitted contacts list */}
            {!isEditing && submittedCustomers.map((customer, index) => (
                <Card variant="outlined" sx={{ my: 2, backgroundColor: '#f9f9f9' }} key={index}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            {getTitle(index)}
                        </Typography>
                        <Typography><b>Name:</b> {customerForms[index].firstName} {customerForms[index].lastName}</Typography>
                        <Typography><b>Email:</b> {customerForms[index].email}</Typography>
                        <Typography><b>Phone:</b> {customerForms[index].phone}</Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-start', pt: 0, px: 1, pb: 1 }}>
                        <Button onClick={() => send({ type: 'EDIT_CONTACT', index })}>
                            Edit
                        </Button>
                    </CardActions>
                </Card>
            ))}

            {/* Active form for new or editing contact */}
            {(!allFormsSubmitted || isEditing) && (
                <Box mt={3}>
                    <Typography variant="h2" gutterBottom>
                        {getTitle(currentCustomerIndex)}
                    </Typography>
                    
                    {!isEditing && currentCustomerIndex === 0 && (
                        <Typography sx={{ mb: 2 }}>
                            {isGift
                                ? "As the gifter, your information is needed for payment and account management."
                                : "This is the primary contact and will be responsible for payment."
                            }
                        </Typography>
                    )}
                    {!isEditing && currentCustomerIndex > 0 && (
                        <Typography sx={{ mb: 2 }}>
                            {isGift
                                ? "Enter the details for the person receiving the subscription gift."
                                : "Enter details for the additional subscription."
                            }
                        </Typography>
                    )}

                    {/* ✅ MOVED: Error message now appears here, directly above the active form. */}
                    {uniquenessError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {uniquenessError}
                        </Alert>
                    )}

                    <Box component="form" noValidate>
                        <TextField fullWidth margin="dense" label="First Name" value={activeForm.firstName || ''}
                            onChange={e => handleFieldChange('firstName', e.target.value)}
                            error={!!errors.firstName}
                            helperText={errors.firstName || ' '}
                            autoComplete="given-name"
                        />
                        <TextField fullWidth margin="dense" label="Last Name" value={activeForm.lastName || ''}
                            onChange={e => handleFieldChange('lastName', e.target.value)}
                            error={!!errors.lastName}
                            helperText={errors.lastName || ' '}
                            autoComplete="family-name"
                        />
                        <TextField fullWidth margin="dense" label="Email" type="email" value={activeForm.email || ''}
                            onChange={e => handleFieldChange('email', e.target.value)}
                            error={!!errors.email}
                            helperText={errors.email || ' '}
                            autoComplete="email"
                        />
                        <TextField
                            fullWidth
                            margin="dense"
                            label="Phone"
                            value={activeForm.phone || ''}
                            name="phone"
                            onChange={e => handleFieldChange('phone', e.target.value)}
                            InputProps={{ inputComponent: PhoneInputComponent }}
                            error={!!errors.phone}
                            autoComplete="tel"
                        />
                        {errors.phone && <FormHelperText error>{errors.phone}</FormHelperText>}
                    </Box>
                </Box>
            )}

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="grey-back" onClick={handleBackClick}>
                    {backButtonText}
                </Button>
                
                <Button
                    variant="contained"
                    onClick={handleMainClick}
                    disabled={isSubmitting || (!allFormsSubmitted && Object.values(activeForm).every(v => v === ''))}
                >
                    {isSubmitting
                        ? <CircularProgress size={24} color="inherit" />
                        : mainButtonText
                    }
                </Button>
            </Box>
        </>
    );
};

export default StepContactInfo;