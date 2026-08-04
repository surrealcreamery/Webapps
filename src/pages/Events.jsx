import React, { useState, useRef, useContext, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Box, Typography, Button, CircularProgress, Alert, Divider, Stack, Container, Breadcrumbs, Link as MuiLink } from '@mui/material';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import VerifiedIcon from '@mui/icons-material/Verified';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { format, parse } from 'date-fns';
import { LayoutContext } from '@/contexts/events/EventsLayoutContext';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { stateToPath, parseEventUrl, isAutoTransitionState } from '@/utils/eventUrlSync';

// Import all the separated components
import { DirectorySection } from '@/components/events/DirectorySection';
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
import { ConfirmProfileUpdate } from '@/components/events/ConfirmProfileUpdate';
import { DuplicateErrorSection } from '@/components/events/DuplicateErrorSection';
import { PaymentStepSection } from '@/components/events/PaymentStepSection';

// ✅ 1. Import your new data-fetching function
import { fetchInitialData } from '@/state/events/eventService';
import { trackEventViewed } from '@/services/analytics';

// ─── Processing Overlay (matches CheckoutPage pattern) ───
const REGISTRATION_STAGES = [
  { text: 'Verifying Your Information...', icon: AssignmentIndIcon },
  { text: 'Processing Payment...', icon: CreditCardIcon },
  { text: 'Confirming Registration...', icon: ReceiptLongIcon },
  { text: 'Almost Done...', icon: HourglassBottomIcon },
  { text: 'Finalizing Registration...', icon: VerifiedIcon },
  { text: 'Registration Successful!', icon: CheckCircleIcon },
];

const overlayFadeKeyframes = {
  '@keyframes overlayFadeIn': {
    from: { opacity: 0, transform: 'translateY(8px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  '@keyframes overlayFadeOut': {
    from: { opacity: 1, transform: 'translateY(0)' },
    to: { opacity: 0, transform: 'translateY(-8px)' },
  },
};

function ProcessingOverlay({ success, onComplete }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);
  const successShownRef = useRef(false);
  const statusRef = useRef(null);

  useEffect(() => {
    setTimeout(() => statusRef.current?.focus(), 100);
  }, []);

  // Auto-advance stages 0-4 every 2.5s
  useEffect(() => {
    if (stageIndex >= 4) return;
    timerRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setStageIndex(prev => (prev >= 4 ? prev : prev + 1));
        setFading(false);
      }, 300);
    }, 2500);
    return () => clearInterval(timerRef.current);
  }, [stageIndex]);

  // Show success stage when registration completes
  useEffect(() => {
    if (success && !successShownRef.current) {
      successShownRef.current = true;
      setFading(true);
      setTimeout(() => {
        setStageIndex(5);
        setFading(false);
      }, 300);
      setTimeout(() => {
        onComplete();
      }, 2100);
    }
  }, [success, onComplete]);

  const stage = REGISTRATION_STAGES[stageIndex];
  const StageIcon = stage.icon;
  const isSuccess = stageIndex === 5;

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-label="Processing your registration"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        ...overlayFadeKeyframes,
      }}
    >
      <Box
        sx={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          width: 400,
          maxWidth: '90vw',
          py: 6,
          px: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Box
          key={stageIndex}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2.5,
            animation: fading
              ? 'overlayFadeOut 0.3s ease forwards'
              : 'overlayFadeIn 0.4s ease forwards',
          }}
        >
          <StageIcon
            sx={{
              fontSize: 80,
              color: isSuccess ? '#2e7d32' : '#222',
              transition: 'color 0.3s ease',
            }}
          />
          <Typography
            variant="h5"
            ref={statusRef}
            tabIndex={-1}
            aria-live="assertive"
            aria-atomic="true"
            sx={{
              color: '#222',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              textAlign: 'center',
              outline: 'none',
            }}
          >
            {stage.text}
          </Typography>
        </Box>
        {!isSuccess && (
          <CircularProgress
            size={28}
            thickness={4}
            sx={{ color: 'rgba(0,0,0,0.3)', mt: 1 }}
            aria-label="Processing registration"
          />
        )}
      </Box>
    </Box>
  );
}

export default function Home() {
    // ========================================
    // ALL HOOKS MUST BE AT THE TOP - React Rules of Hooks
    // ========================================
    const { fundraiserState, sendToFundraiser, logout } = useContext(LayoutContext);
    const navigate = useNavigate();
    const location = useLocation();
    const locationListRef = useRef(null);
    const [view, setView] = useState('All');
    const [regCount, setRegCount] = useState(null);
    const [directoryCounts, setDirectoryCounts] = useState({});
    const [showOverlay, setShowOverlay] = useState(false);

    // ✅ Data fetching effect
    // If machine already has events (e.g. navigating from a custom page), data is already fresh
    const dataFreshRef = React.useRef(fundraiserState?.context?.fundraiserEvents?.length > 0);
    useEffect(() => {
        // Don't run if the machine/send function isn't ready
        if (!sendToFundraiser) return;

        const loadData = async () => {
            try {
                console.log("=== FETCHING DATA ===");
                console.log("Current state before fetch:", JSON.stringify(fundraiserState?.value));
                const { events, locations } = await fetchInitialData();

                console.log("Data fetched - events count:", events?.length);

                // Send the fresh data to the machine
                sendToFundraiser({ type: 'DATA.LOADED', events, locations });
                dataFreshRef.current = true;

            } catch (error) {
                console.error("Failed to load initial data:", error);
                // Only send failure if we're still in the 'booting' state
                if (fundraiserState?.matches('booting')) {
                    sendToFundraiser({ type: 'DATA.FAILED', data: error });
                }
                dataFreshRef.current = true; // Allow deep-link to proceed even on error
            }
        };

        loadData();
    }, [sendToFundraiser]); // Runs once when sendToFundraiser is available

    // --- URL → State sync (inbound, on mount / URL change) ---
    const { eventId: urlEventId, step: urlStep } = useParams();
    const deepLinkHandledRef = React.useRef(false);
    const lastHandledUrlRef = React.useRef(null);
    const skipUrlSyncRef = React.useRef(false);
    const autoRegisterRef = React.useRef(false);
    const initialStopIndexRef = React.useRef(location.state?.stopIndex);

    // Reset deep-link flag when URL changes (e.g. navigating from a custom page)
    useEffect(() => {
        const currentUrl = `${urlEventId || ''}/${urlStep || ''}`;
        if (lastHandledUrlRef.current && lastHandledUrlRef.current !== currentUrl) {
            deepLinkHandledRef.current = false;
        }
    }, [urlEventId, urlStep]);

    useEffect(() => {
        if (!sendToFundraiser || !fundraiserState) return;
        const currentUrl = `${urlEventId || ''}/${urlStep || ''}`;
        if (deepLinkHandledRef.current) return;

        const markHandled = () => {
            deepLinkHandledRef.current = true;
            lastHandledUrlRef.current = currentUrl;
        };

        // Read URL directly — React Router's location may not reflect pushState changes
        const pathname = window.location.pathname;
        const isBookSpace = pathname.startsWith('/book-space');
        const parsed = parseEventUrl(pathname);

        // /book-space → find the space-rental event and redirect
        if (isBookSpace) {
            if (!dataFreshRef.current) return; // wait for data
            const events = fundraiserState.context?.fundraiserEvents || [];
            const spaceRentalEvent = events.find(e => (e.type || '').toLowerCase() === 'space rental');
            if (spaceRentalEvent) {
                markHandled();
                navigate(`/events/${spaceRentalEvent.id}/register`, { replace: true });
            }
            return;
        }

        // /events with no params → ensure directory state
        if (!parsed.eventId && !parsed.isLogin && !parsed.isDashboard) {
            if (!fundraiserState.matches('directory') && !fundraiserState.matches('booting')) {
                sendToFundraiser({ type: 'RESET' });
            }
            // Mark handled once machine is in directory (initial mount complete)
            if (fundraiserState.matches('directory')) {
                markHandled();
            }
            return;
        }

        // /events/login → start login flow
        if (parsed.isLogin) {
            markHandled();
            if (!fundraiserState.matches('loginFlow')) {
                sendToFundraiser({ type: 'LOGIN_START' });
            }
            return;
        }

        // /events/dashboard → handled by existing auth logic in LayoutContext
        if (parsed.isDashboard) {
            markHandled();
            return;
        }

        // /events/:eventId[/:step] → select event and navigate to step
        if (parsed.eventId) {
            if (!dataFreshRef.current) return; // wait for fresh data

            // Reset machine if it's not in directory/booting to prepare for deep-link
            if (!fundraiserState.matches('directory') && !fundraiserState.matches('booting')) {
                sendToFundraiser({ type: 'RESET' });
                return; // Will re-enter on next state change
            }

            if (fundraiserState.matches('directory')) {
                markHandled();
                const register = parsed.step === 'register' || parsed.step === 'location' || parsed.step === 'schedule'
                    || parsed.step === 'date' || parsed.step === 'time' || parsed.step === 'contact'
                    || parsed.step === 'payment' || parsed.step === 'verify';
                autoRegisterRef.current = register;
                const stopIndex = initialStopIndexRef.current;
                initialStopIndexRef.current = undefined;
                sendToFundraiser({ type: 'CHOOSE_FUNDRAISER', eventId: parsed.eventId, register, stopIndex });
                skipUrlSyncRef.current = true;
            }
        }
    }, [fundraiserState, sendToFundraiser, urlEventId, urlStep]);

    // Skip event landing and go straight to registration when register=true
    useEffect(() => {
        if (autoRegisterRef.current && fundraiserState?.matches({ wizardFlow: 'eventLanding' })) {
            autoRegisterRef.current = false;
            sendToFundraiser({ type: 'PROCEED_TO_SCHEDULING' });
        }
    }, [fundraiserState, sendToFundraiser]);

    // (State → URL sync is handled in the scroll-to-top effect below)

    // --- Browser back/forward (popstate) handler ---
    useEffect(() => {
        const handler = () => {
            skipUrlSyncRef.current = true;
            const parsed = parseEventUrl(window.location.pathname);

            if (parsed.isLogin) {
                if (!fundraiserState.matches('loginFlow')) {
                    sendToFundraiser({ type: 'LOGIN_START' });
                }
                return;
            }

            if (parsed.isDashboard) {
                // Stay on dashboard — no action needed
                return;
            }

            if (!parsed.eventId) {
                // Back to /events → reset to directory
                sendToFundraiser({ type: 'RESET' });
                return;
            }

            if (parsed.eventId !== fundraiserState.context.selectedEventId) {
                // Different event → choose it
                sendToFundraiser({ type: 'CHOOSE_FUNDRAISER', eventId: parsed.eventId });
            } else {
                // Same event, different step → use BACK
                sendToFundraiser({ type: 'BACK' });
            }
        };
        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
    }, [sendToFundraiser, fundraiserState]);


    // This effect runs when the user navigates to a new "page" (state node).
    // Also syncs state → URL using window.history (not navigate) to avoid remounting.
    useEffect(() => {
        window.scrollTo(0, 0);

        // --- State → URL sync ---
        if (!fundraiserState?.context) return;
        if (skipUrlSyncRef.current) { skipUrlSyncRef.current = false; return; }

        const newPath = stateToPath(fundraiserState, fundraiserState.context);
        if (!newPath) return;

        const currentBase = window.location.pathname.replace(/\/$/, '');
        if (currentBase === newPath) return;

        if (isAutoTransitionState(fundraiserState)) {
            window.history.replaceState(null, '', newPath);
        } else {
            window.history.pushState(null, '', newPath);
        }
    }, [JSON.stringify(fundraiserState?.value), fundraiserState?.context?.selectedEventId]);

    // Handle stale selectedEventId - if event no longer exists, reset to directory
    // Only fires after fresh data has loaded to avoid race condition with deep-links
    useEffect(() => {
        if (!fundraiserState || !fundraiserState.context) return;
        if (!dataFreshRef.current) return; // Don't judge staleness against persisted events

        const { fundraiserEvents, selectedEventId } = fundraiserState.context;
        const currentEvent = fundraiserEvents?.find(event => event.id === selectedEventId);

        if (fundraiserState.matches('wizardFlow') &&
            !fundraiserState.context.isAuthenticated &&
            fundraiserEvents &&
            fundraiserEvents.length > 0 &&
            selectedEventId &&
            !currentEvent) {
            console.log('Event not found (stale ID), resetting to directory. selectedEventId:', selectedEventId);
            sendToFundraiser({ type: 'RESET' });
        }
    }, [fundraiserState, sendToFundraiser]);

    // ========================================
    // EARLY RETURNS - After all hooks
    // ========================================
    if (!fundraiserState || !fundraiserState.context) {
        return <Box  sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }} role="status" aria-live="polite" aria-busy="true"><CircularProgress aria-label="Loading" /></Box>;
    }

    console.log('Current machine state:', fundraiserState.value);

    if (fundraiserState.matches({ wizardFlow: { submitting: 'resolvingAccountMatch' } })) {
        console.log('Matched Accounts:', fundraiserState.context.matchedAccounts);
    }
    const handleViewChange = (event, newView) => { if (newView !== null) setView(newView); };

    const handleChooseFundraiser = (eventId) => { trackEventViewed(eventId); sendToFundraiser({ type: 'CHOOSE_FUNDRAISER', eventId: eventId }); };
    const handleLocationSelect = (locationId) => {
        console.log(`Location selected, sending event: SELECT_LOCATION with id: ${locationId}`);
        sendToFundraiser({ type: 'SELECT_LOCATION', value: locationId });
    };
    const handleDateSelect = (newDate) => { sendToFundraiser({ type: 'SELECT_DATE', value: newDate }); };
    const handleTimeSelect = (newTime) => { sendToFundraiser({ type: 'SELECT_TIME', value: newTime }); };
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
            <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                {locations.map((location) => (
                    <Box component="li" key={location.id}>
                        <Button variant="outlined" fullWidth onClick={() => handleLocationSelect(location.id)}>
                            <Box sx={{ width: '100%', p: 1, textTransform: 'none', textAlign: 'left' }}>
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{location['Location Name']}</Typography>
                                <Typography variant="body2" color="text.secondary">{location.Address}</Typography>
                            </Box>
                        </Button>
                    </Box>
                ))}
            </Box>
        );
    };

    // Guard: if state machine context isn't ready
    if (!fundraiserState?.context) {
        return <Box  sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}><CircularProgress /></Box>;
    }

    const { fundraiserEvents, registeredEvents, selectedEventId, viewingEventId, selectedLocationId, locations, selectedDate, contactInfo, formErrors } = fundraiserState.context;

    const currentEvent = fundraiserEvents?.find(event => event.id === selectedEventId);
    console.log('🔍 Events render — state:', JSON.stringify(fundraiserState.value), 'currentEvent:', currentEvent?.title || 'null', 'eventId:', selectedEventId);

    // Fetch registration count for current event
    const currentEventId = currentEvent?.id;
    useEffect(() => {
        if (!currentEventId) { setRegCount(null); return; }
        let cancelled = false;
        fetch('https://svlh6ckfdkcgh4fbvub2nyz2r40mcvdq.lambda-url.us-east-1.on.aws', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getRegistrationCount', eventId: currentEventId }),
        })
            .then(r => r.json())
            .then(data => { if (!cancelled && data.success !== false) setRegCount(data); })
            .catch(() => { if (!cancelled) setRegCount(null); });
        return () => { cancelled = true; };
    }, [currentEventId]);

    // Fetch registration counts for all events in directory view
    const eventIds = useMemo(() => (fundraiserEvents || []).filter(e => e.status === 'Active').map(e => e.id), [fundraiserEvents]);
    useEffect(() => {
        if (!eventIds.length) return;
        let cancelled = false;
        const API_URL = 'https://svlh6ckfdkcgh4fbvub2nyz2r40mcvdq.lambda-url.us-east-1.on.aws';
        const fetchWithRetry = async (id, retries = 2) => {
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    const r = await fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'getRegistrationCount', eventId: id }),
                    });
                    const data = await r.json();
                    return { id, data };
                } catch {
                    if (attempt < retries) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                }
            }
            return null;
        };
        // Fetch in batches of 4 to avoid Lambda throttling
        (async () => {
            const counts = {};
            for (let i = 0; i < eventIds.length; i += 4) {
                if (cancelled) return;
                const batch = eventIds.slice(i, i + 4);
                const results = await Promise.all(batch.map(id => fetchWithRetry(id)));
                for (const r of results) {
                    if (r && r.data?.success !== false) counts[r.id] = r.data;
                }
                // Update progressively so UI fills in as data arrives
                if (!cancelled) setDirectoryCounts(prev => ({ ...prev, ...counts }));
            }
        })();
        return () => { cancelled = true; };
    }, [eventIds.join(',')]);

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


    // Logic to determine when to show the processing overlay
    const isSubmitting =
      fundraiserState.matches({ wizardFlow: { submitting: 'decidingAuthPath' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'checkingDuplicate' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'checkingGuestStatus' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'creatingOrganization' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'updatingProfile' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'creatingRegistration' } });

    const isRegistrationSuccess = fundraiserState.matches({ wizardFlow: 'success' });

    // Show overlay when submitting starts, hide if flow needs user interaction
    const needsUserInput =
      fundraiserState.matches({ wizardFlow: { submitting: 'resolvingAccountMatch' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'confirmingProfileUpdate' } }) ||
      fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication');

    useEffect(() => {
      if (isSubmitting && !showOverlay) setShowOverlay(true);
      if (needsUserInput && showOverlay) setShowOverlay(false);
    }, [isSubmitting, needsUserInput]);

    const handleOverlayComplete = useCallback(() => setShowOverlay(false), []);

    if (fundraiserState.matches('booting') || fundraiserState.matches('routing')) {
        return <Box  sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }} role="status" aria-live="polite" aria-busy="true"><CircularProgress aria-label="Loading" /></Box>;
    }
    if (fundraiserState.matches('failure')) {
        return <Box ><Alert severity="error" role="alert">{fundraiserState.context.error}</Alert></Box>;
    }

    // If in wizardFlow but currentEvent not found — show spinner (data may still be loading)
    if (fundraiserState.matches('wizardFlow') && !currentEvent) {
        return <Box  sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }} role="status" aria-live="polite" aria-busy="true"><CircularProgress aria-label="Loading" /></Box>;
    }

    return (
        <Box  sx={{ width: '100%', mx: 'auto' }}>
            <Helmet><title>Events | Surreal Creamery</title></Helmet>
            <Typography variant="h1" component="h1" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Fundraiser Events</Typography>
            {fundraiserState.matches('directory') && (<DirectorySection events={fundraiserState.context.fundraiserEvents} onChooseFundraiser={handleChooseFundraiser} view={view} handleViewChange={handleViewChange} regCounts={directoryCounts} />)}
            {fundraiserState.matches('userDashboard') && !(fundraiserState.matches('userDashboard.idle') || fundraiserState.matches('userDashboard.redeemingReward') || fundraiserState.matches('userDashboard.refreshingLoyalty')) && (<Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }} role="status" aria-live="polite" aria-busy="true"><CircularProgress aria-label="Loading" /></Box>)}
            {(fundraiserState.matches('userDashboard.idle') || fundraiserState.matches('userDashboard.redeemingReward') || fundraiserState.matches('userDashboard.refreshingLoyalty')) && (<UserDashboard events={fundraiserState.context.registeredEvents} allEvents={fundraiserState.context.fundraiserEvents} orders={fundraiserState.context.orders} loyalty={fundraiserState.context.loyalty} duplicateNotice={fundraiserState.context.duplicateNotice} onDismissDuplicateNotice={() => sendToFundraiser({ type: 'DISMISS_DUPLICATE_NOTICE' })} onScheduleNew={() => sendToFundraiser({ type: 'SCHEDULE_NEW' })} onViewTransactions={(eventId) => sendToFundraiser({ type: 'VIEW_TRANSACTIONS', eventId })} onViewMarketingMaterials={(eventId) => sendToFundraiser({ type: 'VIEW_MARKETING_MATERIALS', eventId })} onRedeem={(rewardId) => sendToFundraiser({ type: 'REDEEM_REWARD', rewardId })} onLogout={handleLogout} />)}
            
            {fundraiserState.matches('transactionDetails.loading') && (<Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }} role="status" aria-live="polite" aria-busy="true"><CircularProgress aria-label="Loading" /></Box>)}
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
                {/* ✅ FIX: EVENT LANDING PAGE - Button in hero, location list below if multiple locations */}
                {fundraiserState.matches({ wizardFlow: 'eventLanding' }) && currentEvent && (() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const futureStops = (currentEvent.schedule || []).filter(stop => !stop.date || stop.date >= today).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                    const isSingleStopTentpole = currentEvent.schedule?.length > 0 && futureStops.length === 1;
                    const singleStop = isSingleStopTentpole ? futureStops[0] : null;

                    // Resolve single stop details
                    let singleStopDate = '', singleStopTime = '', singleStopLocName = '';
                    let singleStopFee = 0, singleStopPoints = 0, singleStopTournamentId = null;
                    if (singleStop) {
                        try { singleStopDate = format(new Date(singleStop.date.replace(/-/g, '/')), 'EEEE, MMMM do, yyyy'); } catch (e) {}
                        if (singleStop.startTime && singleStop.endTime) {
                            try {
                                const s = parse(singleStop.startTime, 'HH:mm', new Date());
                                const e2 = parse(singleStop.endTime, 'HH:mm', new Date());
                                singleStopTime = `${format(s, 'h:mmaaa')} – ${format(e2, 'h:mmaaa')}`.toLowerCase();
                            } catch (e) {}
                        }
                        const locIdx = currentEvent.locationIds?.indexOf(singleStop.locationId);
                        singleStopLocName = locIdx >= 0 ? (currentEvent.locationNames?.[locIdx] || '') : (fundraiserState.context.locations?.find(l => l.id === singleStop.locationId)?.['Location Name'] || '');
                        singleStopFee = singleStop.admissionFeeCents || singleStop['Admission Fee Cents'] || currentEvent['Admission Fee Cents'] || currentEvent.admissionFeeCents || 0;
                        singleStopPoints = singleStop.pointsCost || singleStop['Points Cost'] || currentEvent['Points Cost'] || currentEvent.pointsCost || 0;
                        singleStopTournamentId = singleStop.tournamentId || singleStop['Tournament ID'] || currentEvent.tournamentId || currentEvent['Tournament ID'] || null;
                    }

                    // Build CTA label for single-stop
                    const singleStopCtaLabel = (() => {
                        if (!singleStop) return '';
                        const isTournament = !!singleStopTournamentId;
                        const base = isTournament ? 'Register For This Tournament' : 'Register For This Event';
                        if (singleStopFee > 0) {
                            return `${base} — $${(singleStopFee / 100).toFixed(2)}`;
                        }
                        const priceLabel = singleStopPoints > 0 ? ` — ${singleStopPoints} Points` : '';
                        return `${base}${priceLabel}`;
                    })();

                    return (
                    <>
                        <HeroSection
                            title={currentEvent.title}
                            imageUrl={currentEvent.imageUrl}
                            description={currentEvent.description || currentEvent['Description']}
                            bulletPoints={currentEvent.bulletPoints || currentEvent['Bullet Points']}
                            onSelectLocationClick={isSingleStopTentpole ? () => sendToFundraiser({ type: 'SELECT_STOP', stop: singleStop }) : handleProceedToScheduling}
                            isSingleLocation={isSingleStopTentpole || (isSingleLocation && !(currentEvent.schedule?.length > 0))}
                            selectLocationLabel={isSingleStopTentpole ? singleStopCtaLabel : (currentEvent.schedule?.length > 0 ? 'Select a Date & Location' : undefined)}
                            eventDate={isSingleStopTentpole ? singleStop.date : (currentEvent.schedule ? null : (currentEvent.startDate || currentEvent['Start Date']))}
                            eventTime={isSingleStopTentpole ? (singleStop.startTime && singleStop.endTime ? `${singleStop.startTime} - ${singleStop.endTime}` : null) : (currentEvent.schedule ? null : (
                                (Array.isArray(currentEvent.eventTimes) ? currentEvent.eventTimes[0] : currentEvent.eventTimes) ||
                                (Array.isArray(currentEvent['Event Times']) ? currentEvent['Event Times'][0] : currentEvent['Event Times'])
                            ))}
                            locationAddress={isSingleStopTentpole ? singleStopLocName : (!currentEvent.schedule && isSingleLocation && locations?.length === 1 ? locations[0].Address : null)}
                            eventType={currentEvent.type || currentEvent['Type']}
                            eventRole={currentEvent.Role || currentEvent.role}
                            eventEndDate={currentEvent.endDate || currentEvent['End Date']}
                            admissionFeeCents={isSingleStopTentpole ? singleStopFee : (currentEvent['Admission Fee Cents'] || currentEvent.admissionFeeCents || 0)}
                            pointsCost={isSingleStopTentpole ? singleStopPoints : (currentEvent['Points Cost'] || currentEvent.pointsCost || 0)}
                            regCount={regCount}
                            regCountDate={isSingleStopTentpole ? singleStop?.date : null}
                        />

                        {/* Tentpole: show stop list directly on landing */}
                        {currentEvent.schedule?.length > 0 && futureStops.length >= 1 && (
                            <>
                                <Divider sx={{ my: 3 }} />
                                <Box id="location-selection">
                                    <Typography variant="h2" component="h2" sx={{ mb: 3 }}>
                                        Select a Date & Location
                                    </Typography>
                                    <Stack spacing={2}>
                                        {futureStops.map((stop, i) => {
                                            let formattedDate = stop.date || '';
                                            let formattedTime = '';
                                            try {
                                                const d = new Date(stop.date.replace(/-/g, '/'));
                                                formattedDate = format(d, 'EEEE, MMMM do, yyyy');
                                            } catch (e) {}
                                            if (stop.startTime && stop.endTime) {
                                                try {
                                                    const s = parse(stop.startTime, 'HH:mm', new Date());
                                                    const e2 = parse(stop.endTime, 'HH:mm', new Date());
                                                    formattedTime = `${format(s, 'h:mmaaa')} – ${format(e2, 'h:mmaaa')}`.toLowerCase();
                                                } catch (e) {}
                                            }
                                            const locIdx = currentEvent.locationIds?.indexOf(stop.locationId);
                                            const locName = locIdx >= 0 ? (currentEvent.locationNames?.[locIdx] || '') : (fundraiserState.context.locations?.find(l => l.id === stop.locationId)?.['Location Name'] || '');
                                            const stopFeeCents = stop.admissionFeeCents || stop['Admission Fee Cents'] || currentEvent.admissionFeeCents || currentEvent['Admission Fee Cents'] || 0;
                                            const stopPtsCost = stop.pointsCost || stop['Points Cost'] || currentEvent.pointsCost || currentEvent['Points Cost'] || 0;
                                            const stopCount = stop.date && regCount?.byDate?.[stop.date] || 0;
                                            const stopCapacity = stop.date && regCount?.capacityByDate?.[stop.date] || null;
                                            const stopSoldOut = stopCapacity && stopCount >= stopCapacity;
                                            const stopRemaining = stopCapacity ? stopCapacity - stopCount : null;
                                            return (
                                                <Button
                                                    key={i}
                                                    variant="outlined"
                                                    onClick={() => sendToFundraiser({ type: 'SELECT_STOP', stop })}
                                                    disabled={!!stopSoldOut}
                                                    sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 2, textTransform: 'none', borderRadius: 2, opacity: stopSoldOut ? 0.6 : 1 }}
                                                >
                                                    <Box>
                                                        <Typography variant="subtitle1" fontWeight={600}>{formattedDate}</Typography>
                                                        {formattedTime && <Typography variant="body2" color="text.secondary">{formattedTime}</Typography>}
                                                        {locName && <Typography variant="body2" color="text.secondary">{locName}</Typography>}
                                                        {stopFeeCents > 0 && (
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                ${(stopFeeCents / 100).toFixed(2)}
                                                            </Typography>
                                                        )}
                                                        {!stopFeeCents && stopPtsCost > 0 && (
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                {stopPtsCost} Points
                                                            </Typography>
                                                        )}
                                                        {stopSoldOut ? (
                                                            <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600, mt: 0.5 }}>
                                                                Sold Out
                                                            </Typography>
                                                        ) : stopRemaining !== null && (
                                                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600, mt: 0.5 }}>
                                                                {stopRemaining} spot{stopRemaining !== 1 ? 's' : ''} remaining
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Button>
                                            );
                                        })}
                                    </Stack>
                                </Box>
                            </>
                        )}

                        {/* Non-tentpole: show location list if multiple locations */}
                        {!currentEvent.schedule && !isSingleLocation && (
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
                );
                })()}

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
                            <Typography variant="h1" component="h2" sx={{ mb: 2 }}>
                                {currentEvent.title}
                            </Typography>

                            {/* Date and Time */}
                            {(() => {
                                const dateStr = currentEvent.startDate || currentEvent['Start Date'];
                                const timeStr = (Array.isArray(currentEvent.eventTimes) ? currentEvent.eventTimes[0] : currentEvent.eventTimes) ||
                                               (Array.isArray(currentEvent['Event Times']) ? currentEvent['Event Times'][0] : currentEvent['Event Times']);

                                let formattedDate = '';
                                let formattedTime = '';

                                if (dateStr) {
                                    try {
                                        const date = new Date(dateStr.replace(/-/g, '/'));
                                        formattedDate = format(date, 'EEEE, MMMM do, yyyy');
                                    } catch (e) {}
                                }

                                if (timeStr && timeStr.includes(' - ')) {
                                    try {
                                        const [startTime, endTime] = timeStr.split(' - ');
                                        const start = parse(startTime, 'HH:mm', new Date());
                                        const end = parse(endTime, 'HH:mm', new Date());
                                        formattedTime = `from ${format(start, 'h:mmaaa')} to ${format(end, 'h:mmaaa')}`.toLowerCase();
                                    } catch (e) {}
                                }

                                if (formattedDate || formattedTime) {
                                    return (
                                        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500, mb: 2 }}>
                                            {formattedDate}{formattedDate && formattedTime && ' '}{formattedTime}
                                        </Typography>
                                    );
                                }
                                return null;
                            })()}

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
                
                {/* Tentpole stop picker */}
                {fundraiserState.matches({ wizardFlow: 'selectingStop' }) && currentEvent && (
                    <>
                        <Box sx={{ mb: 4 }}>
                            {currentEvent.imageUrl && (
                                <Box sx={{ height: 250, backgroundColor: 'grey.200', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                                    <img src={currentEvent.imageUrl} alt={currentEvent.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </Box>
                            )}
                            <Typography variant="h1" component="h2" sx={{ mb: 1 }}>{currentEvent.title}</Typography>
                            {currentEvent.description && (
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                                    {currentEvent.description}
                                </Typography>
                            )}
                        </Box>
                        <Divider sx={{ my: 3 }} />
                        <Typography variant="h2" component="h2" sx={{ mb: 3 }}>Select a Date & Location</Typography>
                        <Stack spacing={2}>
                            {[...(currentEvent.schedule || [])].filter(stop => !stop.date || stop.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((stop, i) => {
                                let formattedDate = stop.date || '';
                                let formattedTime = '';
                                try {
                                    const d = new Date(stop.date.replace(/-/g, '/'));
                                    formattedDate = format(d, 'EEEE, MMMM do, yyyy');
                                } catch (e) {}
                                if (stop.startTime && stop.endTime) {
                                    try {
                                        const s = parse(stop.startTime, 'HH:mm', new Date());
                                        const e2 = parse(stop.endTime, 'HH:mm', new Date());
                                        formattedTime = `${format(s, 'h:mmaaa')} – ${format(e2, 'h:mmaaa')}`.toLowerCase();
                                    } catch (e) {}
                                }
                                const locIdx2 = currentEvent.locationIds?.indexOf(stop.locationId);
                                const locName = locIdx2 >= 0 ? (currentEvent.locationNames?.[locIdx2] || stop.locationId || '') : (fundraiserState.context.locations?.find(l => l.id === stop.locationId)?.['Location Name'] || stop.locationId || '');
                                return (
                                    <Button
                                        key={i}
                                        variant="outlined"
                                        onClick={() => sendToFundraiser({ type: 'SELECT_STOP', stop })}
                                        sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 2, textTransform: 'none', borderRadius: 2 }}
                                    >
                                        <Box>
                                            <Typography variant="subtitle1" fontWeight={600}>{formattedDate}</Typography>
                                            {formattedTime && <Typography variant="body2" color="text.secondary">{formattedTime}</Typography>}
                                            {locName && <Typography variant="body2" color="text.secondary">{locName}</Typography>}
                                        </Box>
                                    </Button>
                                );
                            })}
                        </Stack>
                        <Box sx={{ mt: 3 }}>
                            <Button variant="text" onClick={() => sendToFundraiser({ type: 'BACK' })}>Back</Button>
                        </Box>
                    </>
                )}

                {/* This prop was already correct, good! */}
                {fundraiserState.matches({ wizardFlow: 'selectingDate' }) && currentEvent && (
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

                {fundraiserState.matches({ wizardFlow: 'selectingTime' }) && currentEvent && (<TimePickerSection currentEvent={currentEvent} selectedDate={fundraiserState.context.selectedDate} selectedTime={fundraiserState.context.selectedTime} onTimeChange={handleTimeSelect} onBack={() => sendToFundraiser({ type: 'BACK' })} onContinue={handleProceedToContact} locations={fundraiserState.context.locations} selectedLocationId={fundraiserState.context.selectedLocationId} />)}
                
                {fundraiserState.matches({ wizardFlow: 'selectingContact' }) && currentEvent && (<ContactFormSection onBack={() => { const returnTo = sessionStorage.getItem('eventDeepLinkReturn'); if (returnTo) { sessionStorage.removeItem('eventDeepLinkReturn'); sendToFundraiser({ type: 'RESET' }); navigate(returnTo); } else { navigate(-1); }}} onSubmit={handleSubmitContact} contactInfo={contactInfo} onFieldChange={handleContactChange} formErrors={formErrors} currentEvent={currentEvent} selectedLocation={fundraiserState.context.locations?.find(l => l.id === fundraiserState.context.selectedLocationId)} error={fundraiserState.context.error} />)}

                {fundraiserState.matches({ wizardFlow: 'selectingPayment' }) && currentEvent && (
                    <PaymentStepSection
                        currentEvent={currentEvent}
                        paymentMethod={fundraiserState.context.paymentMethod}
                        paymentError={fundraiserState.context.paymentError}
                        squareLocationId={fundraiserState.context.locations?.find(l => l.id === fundraiserState.context.selectedLocationId)?.squareLocationId}
                        selectedDate={fundraiserState.context.selectedDate}
                        selectedLocationId={fundraiserState.context.selectedLocationId}
                        onSelectPaymentMethod={(method, cardData) => sendToFundraiser({ type: 'SELECT_PAYMENT_METHOD', method, cardData })}
                        onSubmit={() => sendToFundraiser({ type: 'SUBMIT_PAYMENT' })}
                        onBack={() => sendToFundraiser({ type: 'BACK' })}
                    />
                )}

                {fundraiserState.matches('loginFlow') && (<LoginFlow send={sendToFundraiser} context={fundraiserState} />)}
                
                {/* Processing overlay — multi-stage with animations */}
                {showOverlay && (
                  <ProcessingOverlay
                    success={isRegistrationSuccess}
                    onComplete={handleOverlayComplete}
                  />
                )}
                
                {fundraiserState.matches({ wizardFlow: { submitting: 'resolvingAccountMatch' } }) && (
                    <ResolvingPartialMatch send={sendToFundraiser} context={fundraiserState} />
                )}

                {fundraiserState.matches({ wizardFlow: { submitting: 'confirmingProfileUpdate' } }) && (
                    <ConfirmProfileUpdate send={sendToFundraiser} context={fundraiserState} />
                )}

                {fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.choosingMethod') && (<GuestOtpChoiceSection contactInfo={contactInfo} emailMatched={fundraiserState.context.emailMatched} phoneMatched={fundraiserState.context.phoneMatched} onBack={() => sendToFundraiser({ type: 'BACK' })} onChooseEmail={() => sendToFundraiser({ type: 'CHOOSE_EMAIL' })} onChooseSms={() => sendToFundraiser({ type: 'CHOOSE_SMS' })} />)}
                {(fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.enteringGuestOtp') || fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.verifyingGuestOtp')) && (<GuestOtpInputSection contactInfo={contactInfo} otpChannel={fundraiserState.context.otpChannel} error={fundraiserState.context.error} isVerifying={fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.verifyingGuestOtp')} onBack={() => sendToFundraiser({ type: 'BACK_TO_GUEST_METHOD_CHOICE' })} onSubmitOtp={(otp) => sendToFundraiser({ type: 'SUBMIT_GUEST_OTP', value: otp })} />)}
                
                
                {fundraiserState.matches({ wizardFlow: 'duplicateError' }) && currentEvent && (
                    <DuplicateErrorSection
                        currentEvent={currentEvent}
                        onViewOtherEvents={() => sendToFundraiser({ type: 'RESET' })}
                    />
                )}
                
                {fundraiserState.matches({ wizardFlow: 'success' }) && (<Alert severity="success" role="alert" sx={{ mt: 2 }}>Your event has been successfully scheduled!</Alert>)}
            </Box>

            {/* Terms & Conditions — only show if current event has a T&C page */}
            {currentEvent?.termsPageSlug && (
              <Box sx={{ textAlign: 'center', py: 3, mt: 2 }}>
                <MuiLink
                  href={`/pages/${currentEvent.termsPageSlug}`}
                  sx={{ fontSize: '1.2rem', color: 'text.secondary', textDecoration: 'underline', '&:hover': { color: 'text.primary' } }}
                >
                  Terms & Conditions
                </MuiLink>
              </Box>
            )}
        </Box>
    );
}
