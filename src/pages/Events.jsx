import React, { useState, useRef, useContext, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Divider, Stack, Container, Breadcrumbs, Link as MuiLink } from '@mui/material';
import { LayoutContext } from '@/contexts/events/EventsLayoutContext';
import { useNavigate } from 'react-router-dom';

// Import all the separated components
import { DirectorySection } from '@/components/events/DirectorySection';
import { BreadcrumbsComponent } from '@/components/events/Breadcrumbs';
import { HeroSection } from '@/components/events/HeroSection';
import { DatePickerSection } from '@/components/events/DatePickerSection';
import { TimePickerSection } from '@/components/events/TimePickerSection';
import { ContactFormSection } from '@/components/events/ContactFormSection';
import { LoginFlow } from '@/components/events/LoginFlow';
import { GuestOtpChoiceSection } from '@/components/events/GuestOtpChoiceSection';
import { GuestOtpInputSection } from '@/components/events/GuestOtpInputSection';
import { UserDashboard } from '@/components/events/UserDashboard';
import { TransactionDetails } from '@/components/events/TransactionDetails';
import { PayoutDetails } from '@/components/events/PayoutDetails';
import { MarketingMaterials } from '@/components/events/MarketingMaterials';
import { ResolvingPartialMatch } from '@/components/events/ResolvingPartialMatch';

// ✅ New component for the loading/verifying screen
const VerifyingLoader = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', p: 3 }}>
        <CircularProgress />
        <Typography variant="h5" sx={{ mt: 3 }}>
            Verifying your information...
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
            Please wait a moment.
        </Typography>
    </Box>
);

export default function Home() {
    const { fundraiserState, sendToFundraiser, logout } = useContext(LayoutContext);

    // This effect runs when the user navigates to a new "page" (state node).
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [JSON.stringify(fundraiserState.value)]);
    
    if (!fundraiserState || !fundraiserState.context) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}><CircularProgress /></Box>;
    }

    const navigate = useNavigate();
        
    const locationListRef = useRef(null);
    
    console.log('Current machine state:', fundraiserState.value);

    if (fundraiserState.matches({ wizardFlow: { submitting: 'resolvingPartialMatch' } })) {
        console.log('Partial Match Alternatives:', fundraiserState.context.partialMatchAlternatives);
    }

    const [view, setView] = useState('All');
    const handleViewChange = (event, newView) => { if (newView !== null) setView(newView); };

    const handleChooseFundraiser = (eventId) => sendToFundraiser({ type: 'CHOOSE_FUNDRAISER', eventId: eventId });
    const handleLocationSelect = (locationId) => {
        console.log(`Location selected, sending event: SELECT_LOCATION with id: ${locationId}`);
        sendToFundraiser({ type: 'SELECT_LOCATION', value: locationId });
    };
    const handleDateSelect = (newDate) => sendToFundraiser({ type: 'SELECT_DATE', value: newDate });
    const handleTimeSelect = (newTime) => sendToFundraiser({ type: 'SELECT_TIME', value: newTime });
    const handleProceedToContact = () => sendToFundraiser({ type: 'PROCEED_TO_CONTACT' });
    const handleContactChange = (event) => sendToFundraiser({ type: 'UPDATE_FIELD', field: event.target.name, value: event.target.value });
    const handleSubmitContact = () => sendToFundraiser({ type: 'SUBMIT' });
    const handleScrollToLocations = () => locationListRef.current?.scrollIntoView({ behavior: 'smooth' });
    const handleLogout = () => { if (logout) logout(); };

    const renderLocationList = () => {
        const { locations } = fundraiserState.context;
        if (!locations || locations.length === 0) return <Typography sx={{ p: 2 }}>No locations are available at this time.</Typography>;
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                {locations.map((location) => (
                    <Button key={location.id} variant="outlined" fullWidth onClick={() => handleLocationSelect(location.id)}>
                        <Box sx={{ width: '100%', p: 1, textTransform: 'none', textAlign: 'left' }}>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{location['Location Name']}</Typography>
                            <Typography variant="body2" color="text.secondary">{location.Address}</Typography>
                        </Box>
                    </Button>
                ))}
            </Box>
        );
    };

    const { fundraiserEvents, registeredEvents, selectedEventId, viewingEventId, selectedLocationId, locations, selectedDate, contactInfo, formErrors } = fundraiserState.context;
    const currentEvent = fundraiserEvents?.find(event => event.id === selectedEventId);
    const selectedLocation = locations.find(loc => loc.id === selectedLocationId);
    const eventToView = registeredEvents?.find(event => event['Registered Event ID'] === viewingEventId);
    console.log("7. FINAL eventToView prop passed to UI:", eventToView);

    // Logic to determine when to show the main verifying spinner
    const shouldShowVerifyingLoader =
      fundraiserState.matches({ wizardFlow: { submitting: 'decidingAuthPath' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'checkingGuestStatus' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'creatingOrganization' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'creatingRegistration' } });

    if (fundraiserState.matches('loadingInitialData')) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}><CircularProgress /></Box>;
    }
    if (fundraiserState.matches('failure')) {
        return <Alert severity="error">{fundraiserState.context.error}</Alert>;
    }
    if (fundraiserState.matches('wizardFlow') && !currentEvent && !fundraiserState.context.isAuthenticated) {
        return (<DirectorySection events={fundraiserState.context.fundraiserEvents} onChooseFundraiser={handleChooseFundraiser} view={view} handleViewChange={handleViewChange} />);
    }

    return (
        <Box sx={{ width: '100%', mx: 'auto' }}>
            {fundraiserState.matches('directory') && (<DirectorySection events={fundraiserState.context.fundraiserEvents} onChooseFundraiser={handleChooseFundraiser} view={view} handleViewChange={handleViewChange} />)}
            {fundraiserState.matches('userDashboard.loadingEvents') && (<Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}><CircularProgress /></Box>)}
            {fundraiserState.matches('userDashboard.idle') && (<UserDashboard events={fundraiserState.context.registeredEvents} allEvents={fundraiserState.context.fundraiserEvents} onScheduleNew={() => sendToFundraiser({ type: 'SCHEDULE_NEW' })} onViewTransactions={(eventId) => sendToFundraiser({ type: 'VIEW_TRANSACTIONS', eventId })} onViewMarketingMaterials={(eventId) => sendToFundraiser({ type: 'VIEW_MARKETING_MATERIALS', eventId })} />)}
            
            {fundraiserState.matches('transactionDetails.loading') && (<Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}><CircularProgress /></Box>)}
            {fundraiserState.matches('transactionDetails.idle') && eventToView && (<TransactionDetails event={eventToView} onBack={() => sendToFundraiser({ type: 'BACK_TO_DASHBOARD' })} onGoHome={() => sendToFundraiser({ type: 'RESET' })} onViewPayouts={() => sendToFundraiser({ type: 'VIEW_PAYOUTS' })} />)}

            {fundraiserState.matches('payoutDetails') && eventToView && (
                <PayoutDetails 
                    event={eventToView} 
                    onBack={() => sendToFundraiser({ type: 'BACK_TO_TRANSACTIONS' })} 
                    onBackToDashboard={() => sendToFundraiser({ type: 'BACK_TO_DASHBOARD' })} 
                    onGoHome={() => sendToFundraiser({ type: 'RESET' })}
                    send={sendToFundraiser}
                    context={fundraiserState}
                />
            )}
            
            {fundraiserState.matches('marketingMaterials') && eventToView && (
                <MarketingMaterials
                    event={eventToView}
                    onBack={() => sendToFundraiser({ type: 'BACK_TO_DASHBOARD' })}
                    onGoHome={() => sendToFundraiser({ type: 'RESET' })}
                />
            )}

            <Box sx={{ maxWidth: 'sm', width: '100%', mx: 'auto', pt: 0, pb: 3, px: 3 }}>
                <BreadcrumbsComponent />
                {fundraiserState.matches({ wizardFlow: 'selectingLocation' }) && currentEvent && (<> <HeroSection title={currentEvent.title} imageUrl={currentEvent.imageUrl} description={currentEvent.description} bulletPoints={currentEvent.bulletPoints} onSelectLocationClick={handleScrollToLocations} /> <Divider sx={{ my: 3 }} /> <Box ref={locationListRef}> <Typography variant="h2" component="h2" gutterBottom> Select a Location</Typography> {renderLocationList()} </Box> </>)}
                
                {/* ✅ This is the fix: The 'error' prop is now being passed to the component */}
                {fundraiserState.matches({ wizardFlow: 'selectingDate' }) && selectedLocation && (
                    <DatePickerSection 
                        onBack={() => sendToFundraiser({ type: 'BACK' })} 
                        onDateChange={handleDateSelect} 
                        selectedDate={fundraiserState.context.selectedDate} 
                        selectedLocation={selectedLocation} 
                        onContinue={handleProceedToContact} 
                        currentEvent={currentEvent}
                        error={fundraiserState.context.error}
                    />
                )}

                {fundraiserState.matches({ wizardFlow: 'selectingTime' }) && currentEvent && (<TimePickerSection currentEvent={currentEvent} selectedDate={fundraiserState.context.selectedDate} selectedTime={fundraiserState.context.selectedTime} onTimeChange={handleTimeSelect} onBack={() => sendToFundraiser({ type: 'BACK' })} onContinue={handleProceedToContact} />)}
                
                {fundraiserState.matches({ wizardFlow: 'selectingContact' }) && (<ContactFormSection onBack={() => sendToFundraiser({ type: 'BACK' })} onSubmit={handleSubmitContact} contactInfo={contactInfo} onFieldChange={handleContactChange} formErrors={formErrors} currentEvent={currentEvent} />)}
                
                {fundraiserState.matches('loginFlow') && (<LoginFlow send={sendToFundraiser} context={fundraiserState} />)}
                
                {/* Updated rendering logic for the verifying screen */}
                {shouldShowVerifyingLoader && <VerifyingLoader />}
                
                {fundraiserState.matches({ wizardFlow: { submitting: 'resolvingPartialMatch' } }) && (
                    <ResolvingPartialMatch send={sendToFundraiser} context={fundraiserState} />
                )}

                {fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.choosingMethod') && (<GuestOtpChoiceSection contactInfo={contactInfo} onBack={() => sendToFundraiser({ type: 'BACK' })} onChooseEmail={() => sendToFundraiser({ type: 'CHOOSE_EMAIL' })} onChooseSms={() => sendToFundraiser({ type: 'CHOOSE_SMS' })} />)}
                {(fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.enteringGuestOtp') || fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.verifyingGuestOtp')) && (<GuestOtpInputSection contactInfo={contactInfo} otpChannel={fundraiserState.context.otpChannel} error={fundraiserState.context.error} isVerifying={fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.verifyingGuestOtp')} onBack={() => sendToFundraiser({ type: 'BACK_TO_GUEST_METHOD_CHOICE' })} onSubmitOtp={(otp) => sendToFundraiser({ type: 'SUBMIT_GUEST_OTP', value: otp })} />)}
                
                {fundraiserState.matches({ wizardFlow: 'success' }) && (<Alert severity="success" sx={{ mt: 2 }}>Your event has been successfully scheduled!</Alert>)}
            </Box>
        </Box>
    );
}

