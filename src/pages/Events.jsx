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
import { DuplicateErrorSection } from '@/components/events/DuplicateErrorSection';

// ✅ 1. Import your new data-fetching function
import { fetchInitialData } from '@/state/events/eventService';

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

    // ✅ 2. KEEP THIS NEW useEffect HOOK for data fetching
    useEffect(() => {
        // Don't run if the machine/send function isn't ready
        if (!sendToFundraiser) return;

        const loadData = async () => {
            try {
                console.log("Fetching fresh data on page load...");
                const { events, locations } = await fetchInitialData();
                
                // Send the fresh data to the machine
                sendToFundraiser({ type: 'DATA.LOADED', events, locations });
                
            } catch (error) {
                console.error("Failed to load initial data:", error);
                // Only send failure if we're still in the 'booting' state
                if (fundraiserState?.matches('booting')) {
                    sendToFundraiser({ type: 'DATA.FAILED', data: error });
                }
            }
        };
        
        loadData();
    }, [sendToFundraiser]); // Runs once when sendToFundraiser is available

    // This effect runs when the user navigates to a new "page" (state node).
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [JSON.stringify(fundraiserState?.value)]); // Added optional chaining
    
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
    
    // ✅ NEW HANDLER for button click on the detail page
    const handleProceedToScheduling = () => sendToFundraiser({ type: 'PROCEED_TO_SCHEDULING' });

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
    
    // ✅ FIX: registeredEvents is now an object with hostedEvents and participantEvents
    const eventToView = (() => {
        if (!viewingEventId) return undefined;
        
        // Check if registeredEvents is the new format (object with hostedEvents/participantEvents)
        if (registeredEvents && typeof registeredEvents === 'object' && !Array.isArray(registeredEvents)) {
            const hostedEvent = registeredEvents.hostedEvents?.find(
                event => event['Registered Event ID'] === viewingEventId
            );
            if (hostedEvent) return hostedEvent;
            
            const participantEvent = registeredEvents.participantEvents?.find(
                event => event['Registered Event ID'] === viewingEventId
            );
            return participantEvent;
        }
        
        // Fallback for old format (array)
        return registeredEvents?.find(event => event['Registered Event ID'] === viewingEventId);
    })();
    
    console.log("7. FINAL eventToView prop passed to UI:", eventToView);

    // ✅ NEW VARIABLES for conditional button logic
    const locationCount = currentEvent?.locationIds?.length || 0;
    const isSingleLocation = locationCount === 1;


    // Logic to determine when to show the main verifying spinner
    const shouldShowVerifyingLoader =
      fundraiserState.matches({ wizardFlow: { submitting: 'decidingAuthPath' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'checkingGuestStatus' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'creatingOrganization' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'creatingRegistration' } });

    // ✅ 3. UPDATE THIS LOADING CHECK
    if (fundraiserState.matches('booting')) {
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

                {/* ✅ FIX: EVENT LANDING PAGE - Button in hero, location list below if multiple locations */}
                {fundraiserState.matches({ wizardFlow: 'eventLanding' }) && currentEvent && (
                    <>
                        <HeroSection 
                            title={currentEvent.title} 
                            imageUrl={currentEvent.imageUrl} 
                            description={currentEvent.description || currentEvent['Description']} 
                            bulletPoints={currentEvent.bulletPoints || currentEvent['Bullet Points']}
                            onSelectLocationClick={handleProceedToScheduling}
                            isSingleLocation={isSingleLocation}
                            // ✅ NEW: Pass date, time, and location for single-date/location events
                            eventDate={isSingleLocation ? (currentEvent.startDate || currentEvent['Start Date']) : null}
                            eventTime={isSingleLocation && currentEvent.eventTimes?.[0] ? currentEvent.eventTimes[0] : 
                                      (isSingleLocation && currentEvent['Event Times']?.[0] ? currentEvent['Event Times'][0] : null)}
                            locationAddress={isSingleLocation && locations?.length === 1 ? locations[0].Address : null}
                        />
                        
                        {!isSingleLocation && (
                            <>
                                <Divider sx={{ my: 3 }} />
                                <Box id="location-selection">
                                    <Typography variant="h2" component="h2" gutterBottom>
                                        Select a Location
                                    </Typography>
                                    {renderLocationList()}
                                </Box>
                            </>
                        )}
                    </>
                )}
                
                {/* ✅ Show event details when selecting location */}
                {fundraiserState.matches({ wizardFlow: 'selectingLocation' }) && currentEvent && (
                    <>
                        {/* Show event details */}
                        <Box sx={{ mb: 4 }}>
                            <Box sx={{ height: 250, backgroundColor: 'grey.200', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                                <img
                                    src={currentEvent.imageUrl}
                                    alt={currentEvent.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </Box>
                            <Typography variant="h1" component="h1" sx={{ mb: 2 }}>
                                {currentEvent.title}
                            </Typography>
                            
                            {/* Description */}
                            {(currentEvent.description || currentEvent['Description']) && (
                                <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                                    {currentEvent.description || currentEvent['Description']}
                                </Typography>
                            )}
                            
                            {/* Bullet points - render as formatted text, not bullet list */}
                            {(currentEvent.bulletPoints || currentEvent['Bullet Points']) && (
                                <Box sx={{ textAlign: 'left', my: 2 }}>
                                    {(() => {
                                        const bp = currentEvent.bulletPoints || currentEvent['Bullet Points'];
                                        // Handle string format (with newlines)
                                        if (typeof bp === 'string') {
                                            return (
                                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                                    {bp}
                                                </Typography>
                                            );
                                        }
                                        // Handle array format
                                        if (Array.isArray(bp) && bp.length > 0) {
                                            return (
                                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                                    {bp.map(point => {
                                                        if (typeof point === 'string') return point;
                                                        if (point?.name) return point.name;
                                                        if (point?.text) return point.text;
                                                        if (point?.value) return point.value;
                                                        // Return empty string for line breaks (will preserve spacing)
                                                        return '';
                                                    }).join('\n')}
                                                </Typography>
                                            );
                                        }
                                        return null;
                                    })()}
                                </Box>
                            )}
                        </Box>
                        
                        {/* Location selection */}
                        <Divider sx={{ my: 3 }} />
                        <Box ref={locationListRef} id="location-selection"> 
                            <Typography variant="h2" component="h2" gutterBottom>Select a Location</Typography> 
                            {renderLocationList()} 
                        </Box> 
                    </>
                )}
                
                {/* This prop was already correct, good! */}
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
                
                
                {fundraiserState.matches({ wizardFlow: 'duplicateError' }) && (
                    <DuplicateErrorSection 
                        currentEvent={currentEvent}
                        onViewOtherEvents={() => sendToFundraiser({ type: 'RESET' })}
                    />
                )}
                
                {fundraiserState.matches({ wizardFlow: 'success' }) && (<Alert severity="success" sx={{ mt: 2 }}>Your event has been successfully scheduled!</Alert>)}
            </Box>
        </Box>
    );
}
