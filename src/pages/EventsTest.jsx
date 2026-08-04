import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Box, Typography, Button, CircularProgress, Alert, Divider, Stack, Container, Breadcrumbs } from '@mui/material';
import SmsRoundedIcon from '@mui/icons-material/SmsRounded';
import MailRoundedIcon from '@mui/icons-material/MailRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import RedeemRoundedIcon from '@mui/icons-material/RedeemRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';

import { format, parse } from 'date-fns';
import { LayoutContext } from '@/contexts/events/EventsLayoutContext';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { stateToPath, parseEventUrl, isAutoTransitionState, resolveEventsPath } from '@/utils/eventUrlSync';

const parseTestEventUrl = (pathname) => parseEventUrl(pathname);

// Import components — FlatDirectorySection replaces DirectorySection
import { FlatDirectorySection } from '@/components/events/FlatDirectorySection';
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

import { fetchInitialData } from '@/state/events/eventService';
import { trackEventViewed, trackSpaPageView } from '@/services/analytics';

const VerifyingLoader = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', p: 3 }} role="status" aria-live="polite" aria-busy="true">
        <CircularProgress aria-label="Loading" />
        <Typography variant="h5" sx={{ mt: 3 }}>
            Verifying your information...
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
            Please wait a moment.
        </Typography>
    </Box>
);

// Web-checkout-style rotating processing interstitial (mirrors CheckoutPage's ProcessingOverlay).
// Advances through `stages` every 2.5s and holds on the last until the machine transitions away.
const ProcessingInterstitial = ({ stages }) => {
    const [i, setI] = useState(0);
    const [fading, setFading] = useState(false);
    useEffect(() => {
        if (i >= stages.length - 1) return;
        const t = setInterval(() => {
            setFading(true);
            setTimeout(() => { setI(p => Math.min(p + 1, stages.length - 1)); setFading(false); }, 300);
        }, 2500);
        return () => clearInterval(t);
    }, [i, stages.length]);
    const stage = stages[Math.min(i, stages.length - 1)];
    const Icon = stage.icon;
    return (
        <Container maxWidth="sm" sx={{ py: { xs: 8, sm: 12 } }}>
            <Box role="status" aria-live="polite" aria-busy="true" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 3 }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <CircularProgress size={84} thickness={2} aria-label="Processing" />
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.3s ease', opacity: fading ? 0 : 1 }}>
                        <Icon color="primary" sx={{ fontSize: 38 }} />
                    </Box>
                </Box>
                <Typography variant="h5" component="h2" fontWeight={700} sx={{ transition: 'opacity 0.3s ease', opacity: fading ? 0 : 1 }}>
                    {stage.text}
                </Typography>
                <Typography variant="body2" color="text.secondary">Please don't close or refresh this window.</Typography>
            </Box>
        </Container>
    );
};

export default function EventsTestHome() {
    const { fundraiserState, sendToFundraiser, logout } = useContext(LayoutContext);
    const navigate = useNavigate();
    const location = useLocation();
    const locationListRef = useRef(null);
    const [regCount, setRegCount] = useState(null);
    const [directoryCounts, setDirectoryCounts] = useState({});

    // Series directory state — persisted in URL so it survives refresh
    const [selectedSeriesSlug, setSelectedSeriesSlugState] = useState(null);
    // Location scope: when set, the directory + series detail are scoped to one location
    // (/events/<loc> and /events/<slug>/<loc>). Register then targets that location's stop.
    const [scopeLocationId, setScopeLocationId] = useState(null);
    const scopeLocationIdRef = useRef(null);
    scopeLocationIdRef.current = scopeLocationId;
    const selectedSeriesSlugRef = useRef(null);
    selectedSeriesSlugRef.current = selectedSeriesSlug;
    const selectedSeriesId = selectedSeriesSlug; // slug used as the identifier
    // Build the URL for the current series/location scope.
    const scopedUrl = (slug, loc) => {
        if (slug && loc) return `/events/${slug}/${loc}`;
        if (slug) return `/events/${slug}`;
        if (loc) return `/events/${loc}`;
        return '/events';
    };
    const setSelectedSeriesId = (slugOrId) => {
        setSelectedSeriesSlugState(slugOrId || null);
        window.history.replaceState(null, '', scopedUrl(slugOrId || null, scopeLocationIdRef.current));
    };
    // Pending card selection — used to dispatch SELECT_STOP after CHOOSE_EVENT transitions
    const pendingStopRef = useRef(null);
    // Where registration was launched from (location directory, scoped detail, or normal series
    // detail). Back from the wizard returns exactly here, preserving any location scope.
    const registerOriginRef = useRef(null);

    // Known series slugs + location ids, used to disambiguate /events/<x> URLs (see resolveEventsPath).
    const knownSlugs = useMemo(
        () => [...new Set((fundraiserState?.context?.fundraiserEvents || []).map(e => e.seriesSlug).filter(Boolean))],
        [fundraiserState?.context?.fundraiserEvents]
    );
    const knownLocationIds = useMemo(
        () => [...new Set((fundraiserState?.context?.locations || []).map(l => l.id).filter(Boolean))],
        [fundraiserState?.context?.locations]
    );

    // Data fetching
    const dataFreshRef = React.useRef(fundraiserState?.context?.fundraiserEvents?.length > 0);
    useEffect(() => {
        if (!sendToFundraiser) return;
        const loadData = async () => {
            try {
                const { events, locations } = await fetchInitialData();
                sendToFundraiser({ type: 'DATA.LOADED', events, locations });
                dataFreshRef.current = true;
            } catch (error) {
                console.error("Failed to load initial data:", error);
                if (fundraiserState?.matches('booting')) {
                    sendToFundraiser({ type: 'DATA.FAILED', data: error });
                }
                dataFreshRef.current = true;
            }
        };
        loadData();
    }, [sendToFundraiser]);

    // --- URL → State sync (inbound) ---
    const { eventId: urlEventId, step: urlStep } = useParams();
    const deepLinkHandledRef = React.useRef(false);
    const lastHandledUrlRef = React.useRef(null);
    const skipUrlSyncRef = React.useRef(false);
    const autoRegisterRef = React.useRef(false);
    const initialStopIndexRef = React.useRef(location.state?.stopIndex);

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

        const pathname = window.location.pathname;
        const parsed = parseTestEventUrl(pathname);

        // /events/<location> | /events/<series> | /events/<series>/<location> — resolve against the
        // real known series slugs + location ids (URL structure alone is ambiguous, see resolveEventsPath).
        if (parsed.isSeries) {
            const res = resolveEventsPath(pathname, { seriesSlugs: knownSlugs, locationIds: knownLocationIds });
            if (!fundraiserState.matches('directory') && !fundraiserState.matches('booting')) {
                sendToFundraiser({ type: 'RESET' });
            }
            if (fundraiserState.matches('directory')) {
                markHandled();
                // Keep the URL — the state→URL sync would otherwise rewrite it to /events (stateToPath
                // ignores the selected series/location), desyncing the URL and hiding the header back button.
                skipUrlSyncRef.current = true;
                setScopeLocationId(res.locationId || null);
                setSelectedSeriesSlugState(res.seriesSlug || null);
            }
            return;
        }

        // /events with no params → ensure directory state
        if (!parsed.eventId && !parsed.isLogin && !parsed.isDashboard) {
            if (!fundraiserState.matches('directory') && !fundraiserState.matches('booting')) {
                sendToFundraiser({ type: 'RESET' });
            }
            if (fundraiserState.matches('directory')) {
                markHandled();
            }
            return;
        }

        // /events/login
        if (parsed.isLogin) {
            markHandled();
            if (!fundraiserState.matches('loginFlow')) {
                sendToFundraiser({ type: 'LOGIN_START' });
            }
            return;
        }

        if (parsed.isDashboard) {
            markHandled();
            return;
        }

        // /events/:eventId[/:step]
        if (parsed.eventId) {
            if (!dataFreshRef.current) return;
            if (!fundraiserState.matches('directory') && !fundraiserState.matches('booting')) {
                sendToFundraiser({ type: 'RESET' });
                return;
            }
            if (fundraiserState.matches('directory')) {
                markHandled();
                const register = parsed.step === 'register' || parsed.step === 'location' || parsed.step === 'schedule'
                    || parsed.step === 'date' || parsed.step === 'time' || parsed.step === 'contact'
                    || parsed.step === 'payment' || parsed.step === 'verify';
                autoRegisterRef.current = register;
                const stopIndex = initialStopIndexRef.current;
                initialStopIndexRef.current = undefined;
                sendToFundraiser({ type: 'CHOOSE_EVENT', eventId: parsed.eventId, register, stopIndex });
                skipUrlSyncRef.current = true;
            }
        }
    }, [fundraiserState, sendToFundraiser, urlEventId, urlStep]);

    // Auto-register bypass
    useEffect(() => {
        if (autoRegisterRef.current && fundraiserState?.matches({ wizardFlow: 'eventLanding' })) {
            autoRegisterRef.current = false;
            sendToFundraiser({ type: 'PROCEED_TO_SCHEDULING' });
        }
    }, [fundraiserState, sendToFundraiser]);

    // Handle pending stop selection after CHOOSE_EVENT transitions to eventLanding
    useEffect(() => {
        if (pendingStopRef.current && fundraiserState?.matches({ wizardFlow: 'eventLanding' })) {
            const stop = pendingStopRef.current;
            pendingStopRef.current = null;
            sendToFundraiser({ type: 'SELECT_STOP', stop });
        }
    }, [fundraiserState, sendToFundraiser]);

    // --- Browser back/forward ---
    useEffect(() => {
        const handler = () => {
            skipUrlSyncRef.current = true;
            const parsed = parseTestEventUrl(window.location.pathname);

            if (parsed.isLogin) {
                if (!fundraiserState.matches('loginFlow')) {
                    sendToFundraiser({ type: 'LOGIN_START' });
                }
                return;
            }
            if (parsed.isDashboard) return;
            if (parsed.isSeries) {
                const res = resolveEventsPath(window.location.pathname, { seriesSlugs: knownSlugs, locationIds: knownLocationIds });
                setScopeLocationId(res.locationId || null);
                setSelectedSeriesSlugState(res.seriesSlug || null);
                sendToFundraiser({ type: 'RESET' });
                return;
            }
            if (!parsed.eventId) {
                setScopeLocationId(null);
                setSelectedSeriesSlugState(null);
                sendToFundraiser({ type: 'RESET' });
                return;
            }
            if (parsed.eventId !== fundraiserState.context.selectedEventId) {
                sendToFundraiser({ type: 'CHOOSE_EVENT', eventId: parsed.eventId });
            } else if (fundraiserState.context.fromSeriesId) {
                // Came from a series stop — return to wherever registration was launched from
                // (location directory, scoped detail, or normal series detail), re-resolving scope.
                const slug = fundraiserState.context.fromSeriesSlug || fundraiserState.context.fromSeriesId;
                skipUrlSyncRef.current = true;
                sendToFundraiser({ type: 'RESET' });
                const origin = registerOriginRef.current || `/events/${slug}`;
                registerOriginRef.current = null;
                const res = resolveEventsPath(origin, { seriesSlugs: knownSlugs, locationIds: knownLocationIds });
                setScopeLocationId(res.locationId || null);
                setSelectedSeriesSlugState(res.seriesSlug || null);
                window.history.replaceState(null, '', origin);
            } else {
                sendToFundraiser({ type: 'BACK' });
            }
        };
        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
    }, [sendToFundraiser, fundraiserState]);

    // State → URL sync + scroll to top
    useEffect(() => {
        window.scrollTo(0, 0);
        if (!fundraiserState?.context) return;
        if (skipUrlSyncRef.current) { skipUrlSyncRef.current = false; return; }

        // While a series/location is selected in the directory, its URL (/events/<slug>/<loc>) is
        // managed via the directory navigation — don't let the machine-derived path clobber it.
        if (fundraiserState.matches('directory') && (selectedSeriesSlugRef.current || scopeLocationIdRef.current)) return;

        const newPath = stateToPath(fundraiserState, fundraiserState.context);
        if (!newPath) return;

        const currentBase = window.location.pathname.replace(/\/$/, '');
        if (currentBase === newPath) return;

        if (isAutoTransitionState(fundraiserState) || fundraiserState.context.fromSeriesId) {
            window.history.replaceState(null, '', newPath);
        } else {
            window.history.pushState(null, '', newPath);
        }
        // These wizard-step navigations use bare pushState/replaceState (no 'events:nav'), so fire the
        // PageView explicitly. Deduped by path in trackSpaPageView.
        trackSpaPageView(newPath);
    }, [JSON.stringify(fundraiserState?.value), fundraiserState?.context?.selectedEventId]);

    // Track fromSeriesId so we can detect when BACK exits the wizard to return to a series.
    // softReset clears context.fromSeriesId, so we capture it before the transition.
    const prevFromSeriesSlugRef = useRef(null);
    useEffect(() => {
        // While in wizard, track the current fromSeriesId/slug
        if (fundraiserState?.matches('wizardFlow') && fundraiserState.context.fromSeriesId) {
            prevFromSeriesSlugRef.current = fundraiserState.context.fromSeriesSlug || fundraiserState.context.fromSeriesId;
        }
        // When we land in directory and there was a fromSeriesId, navigate to that series
        if (fundraiserState?.matches('directory') && prevFromSeriesSlugRef.current) {
            const slug = prevFromSeriesSlugRef.current;
            prevFromSeriesSlugRef.current = null;
            skipUrlSyncRef.current = true;
            // Return to the launch page (location directory / scoped detail / series detail),
            // re-resolving series + location scope from that URL.
            const origin = registerOriginRef.current || `/events/${slug}`;
            registerOriginRef.current = null;
            const res = resolveEventsPath(origin, { seriesSlugs: knownSlugs, locationIds: knownLocationIds });
            setScopeLocationId(res.locationId || null);
            setSelectedSeriesSlugState(res.seriesSlug || null);
            window.history.replaceState(null, '', origin);
        }
    }, [fundraiserState?.value]);

    // Stale event reset
    useEffect(() => {
        if (!fundraiserState || !fundraiserState.context) return;
        if (!dataFreshRef.current) return;
        const { fundraiserEvents, selectedEventId } = fundraiserState.context;
        const currentEvent = fundraiserEvents?.find(event => event.id === selectedEventId);
        if (fundraiserState.matches('wizardFlow') &&
            !fundraiserState.context.isAuthenticated &&
            fundraiserEvents?.length > 0 &&
            selectedEventId &&
            !currentEvent) {
            sendToFundraiser({ type: 'RESET' });
        }
    }, [fundraiserState, sendToFundraiser]);

    // ========================================
    // EARLY RETURNS
    // ========================================
    if (!fundraiserState || !fundraiserState.context) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }} role="status" aria-live="polite" aria-busy="true"><CircularProgress aria-label="Loading" /></Box>;
    }

    // Event handlers
    const handleChooseFundraiser = (eventId) => { trackEventViewed(eventId); sendToFundraiser({ type: 'CHOOSE_EVENT', eventId }); };
    const handleLocationSelect = (locationId) => sendToFundraiser({ type: 'SELECT_LOCATION', value: locationId });
    const handleDateSelect = (newDate) => sendToFundraiser({ type: 'SELECT_DATE', value: newDate });
    const handleTimeSelect = (newTime) => sendToFundraiser({ type: 'SELECT_TIME', value: newTime });
    const handleProceedToContact = () => sendToFundraiser({ type: 'PROCEED_TO_CONTACT' });
    const handleContactChange = (event) => sendToFundraiser({ type: 'UPDATE_FIELD', field: event.target.name, value: event.target.value });
    const handleSubmitContact = () => sendToFundraiser({ type: 'SUBMIT' });
    const handleProceedToScheduling = () => sendToFundraiser({ type: 'PROCEED_TO_SCHEDULING' });
    const handleLogout = () => { if (logout) logout(); };

    // Handle flat card selection — track series origin for back navigation
    const handleSelectCard = (card) => {
        trackEventViewed(card.id);
        if (card._stop && card.seriesId) {
            // Series stop — remember the page we launched from and push a history entry so back
            // (browser or in-app) returns exactly there, not to the non-scoped series detail.
            const slug = card.seriesSlug || card.seriesId;
            const origin = window.location.pathname;
            registerOriginRef.current = origin;
            window.history.pushState(null, '', origin);
            pendingStopRef.current = card._stop;
            // Pass fromSeriesId + slug into the state machine so BACK transitions know to exit the wizard
            sendToFundraiser({ type: 'CHOOSE_EVENT', eventId: card.id, fromSeriesId: card.seriesId, fromSeriesSlug: slug });
        } else {
            // Standalone event
            setSelectedSeriesId(null);
            if (card._stop) {
                pendingStopRef.current = card._stop;
            }
            sendToFundraiser({ type: 'CHOOSE_EVENT', eventId: card.id });
        }
    };

    // Wizard back — always delegates to the state machine.
    // If fromSeriesId is set in context, the machine's BACK guard routes to directory.
    // The prevFromSeriesIdRef effect above detects this and navigates to the series URL.
    const handleWizardBack = () => {
        sendToFundraiser({ type: 'BACK' });
    };

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

    if (!fundraiserState?.context) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}><CircularProgress /></Box>;
    }

    const { fundraiserEvents, registeredEvents, selectedEventId, viewingEventId, selectedLocationId, locations, selectedDate, contactInfo, formErrors } = fundraiserState.context;
    const currentEvent = fundraiserEvents?.find(event => event.id === selectedEventId);

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

    // Fetch registration counts for all events in directory
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
        (async () => {
            const counts = {};
            for (let i = 0; i < eventIds.length; i += 4) {
                if (cancelled) return;
                const batch = eventIds.slice(i, i + 4);
                const results = await Promise.all(batch.map(id => fetchWithRetry(id)));
                for (const r of results) {
                    if (r && r.data?.success !== false) counts[r.id] = r.data;
                }
                if (!cancelled) setDirectoryCounts(prev => ({ ...prev, ...counts }));
            }
        })();
        return () => { cancelled = true; };
    }, [eventIds.join(',')]);

    const selectedLocation = locations.find(loc => loc.id === selectedLocationId);

    const eventToView = (() => {
        if (!viewingEventId) return undefined;
        if (registeredEvents && typeof registeredEvents === 'object' && !Array.isArray(registeredEvents)) {
            const hostedEvent = registeredEvents.hostedEvents?.find(event => event['Registered Event ID'] === viewingEventId);
            if (hostedEvent) return hostedEvent;
            return registeredEvents.participantEvents?.find(event => event['Registered Event ID'] === viewingEventId);
        }
        return registeredEvents?.find(event => event['Registered Event ID'] === viewingEventId);
    })();

    const locationCount = currentEvent?.locationIds?.length || 0;
    const isSingleLocation = locationCount === 1;

    // The actual payment/registration submit — show the web-checkout-style processing interstitial here.
    const isProcessingRegistration = fundraiserState.matches({ wizardFlow: { submitting: 'creatingRegistration' } });
    // The identity/verification pre-steps keep the simple "Verifying your information" loader.
    const shouldShowVerifyingLoader =
      fundraiserState.matches({ wizardFlow: { submitting: 'decidingAuthPath' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'checkingDuplicate' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'checkingGuestStatus' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'creatingOrganization' } }) ||
      fundraiserState.matches({ wizardFlow: { submitting: 'updatingProfile' } });
    // Stages adapt to how they're paying (card / loyalty points / free).
    const payMethod = fundraiserState.context.paymentMethod;
    const firstStage = payMethod === 'card'
      ? { text: 'Processing your payment…', icon: CreditCardRoundedIcon }
      : payMethod === 'points'
        ? { text: 'Redeeming your points…', icon: RedeemRoundedIcon }
        : { text: 'Submitting your registration…', icon: HowToRegRoundedIcon };
    const registrationStages = [
      firstStage,
      { text: 'Confirming your registration…', icon: ReceiptLongRoundedIcon },
      { text: 'Almost done…', icon: HourglassBottomRoundedIcon },
    ];

    if (fundraiserState.matches('booting') || fundraiserState.matches('routing')) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }} role="status" aria-live="polite" aria-busy="true"><CircularProgress aria-label="Loading" /></Box>;
    }
    if (fundraiserState.matches('failure')) {
        return <Box><Alert severity="error" role="alert">{fundraiserState.context.error}</Alert></Box>;
    }
    if (fundraiserState.matches('wizardFlow') && !currentEvent) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }} role="status" aria-live="polite" aria-busy="true"><CircularProgress aria-label="Loading" /></Box>;
    }

    return (
        <Box sx={{ width: '100%', mx: 'auto' }}>
            <Helmet><title>Events | Surreal Creamery</title></Helmet>
            <Typography variant="h1" component="h1" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Events</Typography>

            {/* NEW: Flat directory replaces grouped directory */}
            {fundraiserState.matches('directory') && (
                <FlatDirectorySection
                    events={fundraiserState.context.fundraiserEvents}
                    locations={fundraiserState.context.locations}
                    onSelectCard={handleSelectCard}
                    regCounts={directoryCounts}
                    selectedSeriesId={selectedSeriesId}
                    onSeriesSelect={setSelectedSeriesId}
                    locationScope={scopeLocationId}
                    onLocationScopeExit={() => { setScopeLocationId(null); }}
                />
            )}

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
                {fundraiserState.matches({ wizardFlow: 'eventLanding' }) && currentEvent && (() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const futureStops = (currentEvent.schedule || []).filter(stop => !stop.date || stop.date >= today).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                    const isSingleStopTentpole = currentEvent.schedule?.length > 0 && futureStops.length === 1;
                    const singleStop = isSingleStopTentpole ? futureStops[0] : null;

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
                                            const stopStopKey = stop.date && stop.locationId ? `${stop.date}:${stop.locationId}` : null;
                                            const stopCount = (stopStopKey && regCount?.byStop?.[stopStopKey]) ?? ((stop.date && regCount?.byDate?.[stop.date]) || 0);
                                            const stopCapacity = (stopStopKey && regCount?.capacityByStop?.[stopStopKey]) ?? ((stop.date && regCount?.capacityByDate?.[stop.date]) || null);
                                            const stopSoldOut = stopCapacity && stopCount >= stopCapacity;
                                            // Staged availability: reveal spots in per-series brackets (default 4) to create urgency.
                                            // Display-only — real capacity/sold-out above is unchanged.
                                            const bStep = currentEvent.seriesBracketSize || currentEvent['Series Bracket Size'] || 4;
                                            const stopRemaining = !stopCapacity ? null
                                                : stopSoldOut ? 0
                                                : Math.min(stopCapacity, Math.ceil((stopCount + 1) / bStep) * bStep) - stopCount;
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

                {fundraiserState.matches({ wizardFlow: 'selectingLocation' }) && currentEvent && (
                    <>
                        <Box sx={{ mb: 4 }}>
                            <Box sx={{ height: 250, backgroundColor: 'grey.200', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                                <img src={currentEvent.imageUrl} alt={currentEvent.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </Box>
                            <Typography variant="h1" component="h2" sx={{ mb: 2 }}>{currentEvent.title}</Typography>
                            {(() => {
                                const dateStr = currentEvent.startDate || currentEvent['Start Date'];
                                const timeStr = (Array.isArray(currentEvent.eventTimes) ? currentEvent.eventTimes[0] : currentEvent.eventTimes) ||
                                               (Array.isArray(currentEvent['Event Times']) ? currentEvent['Event Times'][0] : currentEvent['Event Times']);
                                let formattedDate = '';
                                let formattedTime = '';
                                if (dateStr) { try { formattedDate = format(new Date(dateStr.replace(/-/g, '/')), 'EEEE, MMMM do, yyyy'); } catch {} }
                                if (timeStr && timeStr.includes(' - ')) { try { const [s, e] = timeStr.split(' - '); formattedTime = `from ${format(parse(s, 'HH:mm', new Date()), 'h:mmaaa')} to ${format(parse(e, 'HH:mm', new Date()), 'h:mmaaa')}`.toLowerCase(); } catch {} }
                                if (formattedDate || formattedTime) {
                                    return <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500, mb: 2 }}>{formattedDate}{formattedDate && formattedTime && ' '}{formattedTime}</Typography>;
                                }
                                return null;
                            })()}
                            {(currentEvent.description || currentEvent['Description']) && (
                                <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{currentEvent.description || currentEvent['Description']}</Typography>
                            )}
                            {(currentEvent.bulletPoints || currentEvent['Bullet Points']) && (
                                <Box sx={{ textAlign: 'left', my: 2 }}>
                                    {(() => {
                                        const bp = currentEvent.bulletPoints || currentEvent['Bullet Points'];
                                        if (typeof bp === 'string') return <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{bp}</Typography>;
                                        if (Array.isArray(bp) && bp.length > 0) {
                                            return <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{bp.map(point => typeof point === 'string' ? point : point?.name || point?.text || point?.value || '').join('\n')}</Typography>;
                                        }
                                        return null;
                                    })()}
                                </Box>
                            )}
                        </Box>
                        <Divider sx={{ my: 3 }} />
                        <Box ref={locationListRef} id="location-selection">
                            <Typography variant="h2" component="h2" gutterBottom>Select a Location</Typography>
                            {renderLocationList()}
                        </Box>
                    </>
                )}

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
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{currentEvent.description}</Typography>
                            )}
                        </Box>
                        <Divider sx={{ my: 3 }} />
                        <Typography variant="h2" component="h2" sx={{ mb: 3 }}>Select a Date & Location</Typography>
                        <Stack spacing={2}>
                            {[...(currentEvent.schedule || [])].filter(stop => !stop.date || stop.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((stop, i) => {
                                let formattedDate = stop.date || '';
                                let formattedTime = '';
                                try { formattedDate = format(new Date(stop.date.replace(/-/g, '/')), 'EEEE, MMMM do, yyyy'); } catch {}
                                if (stop.startTime && stop.endTime) { try { formattedTime = `${format(parse(stop.startTime, 'HH:mm', new Date()), 'h:mmaaa')} – ${format(parse(stop.endTime, 'HH:mm', new Date()), 'h:mmaaa')}`.toLowerCase(); } catch {} }
                                const locIdx2 = currentEvent.locationIds?.indexOf(stop.locationId);
                                const locName = locIdx2 >= 0 ? (currentEvent.locationNames?.[locIdx2] || stop.locationId || '') : (fundraiserState.context.locations?.find(l => l.id === stop.locationId)?.['Location Name'] || stop.locationId || '');
                                return (
                                    <Button key={i} variant="outlined" onClick={() => sendToFundraiser({ type: 'SELECT_STOP', stop })} sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 2, textTransform: 'none', borderRadius: 2 }}>
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
                            <Button variant="text" onClick={handleWizardBack}>Back</Button>
                        </Box>
                    </>
                )}

                {fundraiserState.matches({ wizardFlow: 'selectingDate' }) && currentEvent && (
                    <DatePickerSection onBack={handleWizardBack} onDateChange={handleDateSelect} selectedDate={fundraiserState.context.selectedDate} selectedLocation={selectedLocation} onContinue={handleProceedToContact} currentEvent={currentEvent} error={fundraiserState.context.error} />
                )}

                {fundraiserState.matches({ wizardFlow: 'selectingTime' }) && currentEvent && (<TimePickerSection currentEvent={currentEvent} selectedDate={fundraiserState.context.selectedDate} selectedTime={fundraiserState.context.selectedTime} onTimeChange={handleTimeSelect} onBack={handleWizardBack} onContinue={handleProceedToContact} locations={fundraiserState.context.locations} selectedLocationId={fundraiserState.context.selectedLocationId} />)}

                {fundraiserState.matches({ wizardFlow: 'selectingContact' }) && currentEvent && (<ContactFormSection onBack={handleWizardBack} onSubmit={handleSubmitContact} contactInfo={contactInfo} onFieldChange={handleContactChange} formErrors={formErrors} currentEvent={currentEvent} selectedLocation={fundraiserState.context.locations?.find(l => l.id === fundraiserState.context.selectedLocationId)} />)}

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
                        onBack={handleWizardBack}
                    />
                )}

                {fundraiserState.matches('loginFlow') && (<LoginFlow send={sendToFundraiser} context={fundraiserState} />)}

                {shouldShowVerifyingLoader && <VerifyingLoader />}
                {isProcessingRegistration && <ProcessingInterstitial stages={registrationStages} />}

                {fundraiserState.matches({ wizardFlow: { submitting: 'resolvingAccountMatch' } }) && (
                    <ResolvingPartialMatch send={sendToFundraiser} context={fundraiserState} />
                )}

                {fundraiserState.matches({ wizardFlow: { submitting: 'confirmingProfileUpdate' } }) && (
                    <ConfirmProfileUpdate send={sendToFundraiser} context={fundraiserState} />
                )}

                {/* Interstitial while the verification code is being sent (the brief pause after choosing a method) */}
                {fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.sendingGuestOtp') && (() => {
                    const isEmail = fundraiserState.context.otpChannel === 'email';
                    const dest = isEmail
                        ? (contactInfo?.email || 'your email')
                        : (contactInfo?.mobileNumber || 'your phone');
                    return (
                        <Container maxWidth="sm" sx={{ py: { xs: 8, sm: 12 } }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 3 }}>
                                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                    <CircularProgress size={84} thickness={2} />
                                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {isEmail
                                            ? <MailRoundedIcon color="primary" sx={{ fontSize: 38 }} />
                                            : <SmsRoundedIcon color="primary" sx={{ fontSize: 38 }} />}
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography variant="h5" component="h2" fontWeight={700} gutterBottom>
                                        {isEmail ? 'Emailing your code…' : 'Texting your code…'}
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary">
                                        {isEmail
                                            ? <>We're sending a verification code to <b>{dest}</b>.</>
                                            : <>We're sending a verification code by SMS to <b>{dest}</b>.</>}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        This usually takes just a few seconds.
                                    </Typography>
                                </Box>
                            </Box>
                        </Container>
                    );
                })()}
                {fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.choosingMethod') && (<GuestOtpChoiceSection contactInfo={contactInfo} emailMatched={fundraiserState.context.emailMatched} phoneMatched={fundraiserState.context.phoneMatched} onBack={() => sendToFundraiser({ type: 'BACK' })} onChooseEmail={() => sendToFundraiser({ type: 'CHOOSE_EMAIL' })} onChooseSms={() => sendToFundraiser({ type: 'CHOOSE_SMS' })} />)}
                {(fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.enteringGuestOtp') || fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.verifyingGuestOtp')) && (<GuestOtpInputSection contactInfo={contactInfo} otpChannel={fundraiserState.context.otpChannel} error={fundraiserState.context.error} isVerifying={fundraiserState.matches('wizardFlow.submitting.awaitingGuestAuthentication.verifyingGuestOtp')} onBack={() => sendToFundraiser({ type: 'BACK_TO_GUEST_METHOD_CHOICE' })} onSubmitOtp={(otp) => sendToFundraiser({ type: 'SUBMIT_GUEST_OTP', value: otp })} />)}

                {fundraiserState.matches({ wizardFlow: 'duplicateError' }) && currentEvent && (
                    <DuplicateErrorSection currentEvent={currentEvent} onViewOtherEvents={() => sendToFundraiser({ type: 'RESET' })} />
                )}

                {fundraiserState.matches({ wizardFlow: 'success' }) && (<Alert severity="success" role="alert" sx={{ mt: 2 }}>Your event has been successfully scheduled!</Alert>)}
            </Box>
        </Box>
    );
}
