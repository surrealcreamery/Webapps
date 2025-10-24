import React, { useState, useEffect, useContext } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    CircularProgress,
    Alert,
    Link as MuiLink,
    Card,
    CardContent,
    CardActions,
    Divider,
    Modal,
    Radio,
    Breadcrumbs,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useNavigate } from 'react-router-dom';
import {
    OTP_VERIFY_URL,
    LIST_CUSTOMER_SUBSCRIPTIONS_URL,
    UPDATE_PROFILE_URL,
    SUBSCRIBER_URL,
    CANCEL_SUBSCRIPTION_URL,
    RETRIEVE_CUSTOMER_URL,
    UPDATE_SUBSCRIPTION_PAYMENT_URL,
    RETRIEVE_SUBSCRIPTION_URL,
    LIST_ENTITLEMENTS_URL,
    SAVE_CARD_URL,
} from '@/constants/subscriptions/subscriptionsConstants';
import OtpInput from '@/components/subscription/otpInput';
import { parsePhoneNumber } from 'react-phone-number-input';
import { LayoutContext } from '@/contexts/subscriptions/SubscriptionsLayoutContext';
import CardBrandIcon from '@/components/subscription/cardBrandIcon';
import SquarePaymentForm from '@/components/subscription/squarePaymentForm';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

// Reusable function
const formatCardBrand = (brand = '') => {
    if (!brand) return 'Card';
    return brand.toLowerCase().replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// Helper function to add a timeout to fetch requests
const fetchWithTimeout = async (resource, options, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(resource, {
        ...options,
        signal: controller.signal  
    });

    clearTimeout(id);
    return response;
};

const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    const date = typeof dateValue === 'string' 
        ? new Date(dateValue.split('T')[0] + 'T00:00:00') 
        : new Date(dateValue);
        
    if (isNaN(date.getTime())) {
        console.error(`Invalid date value received by formatDate: "${dateValue}"`);
        return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const getSubscriptionDateInfo = (subscription) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const frequency = subscription?.['Frequency']?.[0];
    const anchorDay = subscription['Monthly Billing Anchor Date'];
    const endDate = subscription['Subscription End Date'];
    const startDate = subscription['Subscription Start Date']?.[0];

    // Rule 1: It's a recurring plan if it has an anchor day.
    if (anchorDay) {
        // Sub-rule: If it also has an end date, it's a canceled plan that will expire.
        if (endDate && typeof endDate === 'string' && endDate.includes('-')) {
            return { date: endDate, label: 'Expires on:' };
        }

        // Sub-rule: It's an active recurring plan.
        if (frequency === 'Monthly') {
            let renewalDate = new Date(today.getFullYear(), today.getMonth(), anchorDay);
            if (renewalDate < today) {
                renewalDate.setMonth(renewalDate.getMonth() + 1);
            }
            return { date: renewalDate, label: 'Next Renewal:' };
        }

        if (frequency === 'Annually' && startDate && typeof startDate === 'string' && startDate.includes('-')) {
            const anniversaryDate = new Date(startDate + 'T00:00:00');
            let renewalDate = new Date(today.getFullYear(), anniversaryDate.getMonth(), anniversaryDate.getDate());
            if (renewalDate < today) {
                renewalDate.setFullYear(today.getFullYear() + 1);
            }
            return { date: renewalDate, label: 'Next Renewal:' };
        }
    }
    
    // Rule 2: It's a fixed-term (gifted/one-month) plan if it has an end date but no anchor day.
    if (endDate && typeof endDate === 'string' && endDate.includes('-')) {
        return { date: endDate, label: 'Expires on:' };
    }

    // Fallback for any other case.
    return { date: null, label: 'Expires on:' };
};

const getAccountType = (subscription, loggedInUserId) => {
    if (!loggedInUserId || !subscription) {
        return null;
    }

    const ownerIds = subscription['Linked: Subscriber ID in Subscribers'];
    const activeUserIds = subscription['Linked: Active Subscriber ID in Subscribers'];
    
    const isOwner = ownerIds?.includes(loggedInUserId);

    if (isOwner) {
        return 'Account Manager';
    }

    const isOwnerActive = activeUserIds?.includes(ownerIds?.[0]);

    if (activeUserIds?.includes(loggedInUserId)) {
        return isOwnerActive ? 'Shared Member' : 'Gifted Member';
    }

    return null;
};


const AddNewCard = ({ customerId, onCardAdded, onCancel }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [savedCards, setSavedCards] = useState([]);

    useEffect(() => {
        const fetchCards = async () => {
            if (!customerId) return;
            try {
                const response = await fetch(RETRIEVE_CUSTOMER_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ CID: customerId })
                });
                if (response.ok) {
                    const customerDataArray = await response.json();
                    setSavedCards(customerDataArray?.[0]?.cards || []);
                }
            } catch (err) {
                console.error("Could not pre-fetch cards for duplicate check:", err);
            }
        };
        fetchCards();
    }, [customerId]);

    const handleSaveNewCard = async (nonce) => {
        setIsLoading(true);
        setError('');
        try {
            const idempotencyKey = crypto.randomUUID();
            const response = await fetch(SAVE_CARD_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
                body: JSON.stringify({ nonce, customerId, idempotency_key: idempotencyKey }),
            });

            if (response.status !== 200) {
                throw new Error('The card cant be added at this time.');
            }

            const result = await response.json();
            onCardAdded(result.card);
        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
    };

    return (
        <Box>
            <Typography variant="h2" gutterBottom>Add a New Card</Typography>
            <Divider sx={{ my: 2 }} />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <SquarePaymentForm
                isProcessing={isLoading}
                onNonceReceived={handleSaveNewCard}
                onTokenizationError={(message) => setError(message)}
                savedCards={savedCards}
                onSnackbar={(config) => setError(config.message)}
            />
            <Button variant="text" onClick={onCancel} disabled={isLoading} sx={{ mt: 2 }}>Cancel</Button>
        </Box>
    );
};

const ConfirmNewPaymentMethod = ({ subscription, newCard, onConfirmSuccess, onBack }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConfirm = async () => {
        const squareId = subscription?.['Square Subscription ID'];
        if (!squareId) {
            setError('Cannot update payment method: Square Subscription ID is missing.');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            await fetch(UPDATE_SUBSCRIPTION_PAYMENT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscriptionId: squareId,
                    cardId: newCard.id
                })
            });
            onConfirmSuccess('Payment method updated successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!newCard) {
        return <Typography>No card details to confirm. Please go back.</Typography>;
    }

    return (
        <Box>
            <Typography variant="h2" gutterBottom>Confirm Payment Method</Typography>
            <Divider sx={{ my: 2 }} />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Typography variant="body1" sx={{ mb: 2 }}>
                Please confirm you would like to use this card for your subscription.
            </Typography>
            <Card variant="outlined">
                <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                    <CardBrandIcon brand={newCard.card_brand} />
                    <Box ml={2}>
                        <Typography variant="h3">{formatCardBrand(newCard.card_brand)} ending in {newCard.last_4}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Expires {String(newCard.exp_month).padStart(2, '0')}/{newCard.exp_year}
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button variant="grey-back" onClick={onBack} disabled={isLoading}>Back</Button>
                <Button variant="contained" onClick={handleConfirm} disabled={isLoading}>
                    {isLoading ? <CircularProgress size={24} /> : 'Confirm'}
                </Button>
            </Box>
        </Box>
    );
};

const UpdatePayment = ({ customerId, subscription, onBack, onNavigate }) => {
    const [cards, setCards] = useState([]);
    const [selectedCardId, setSelectedCardId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchCards = async () => {
            if (!customerId) return;
            setIsLoading(true);
            setError('');
            try {
                const response = await fetch(RETRIEVE_CUSTOMER_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ CID: customerId })
                });
                if (!response.ok) throw new Error('Could not fetch your saved cards.');
                const customerDataArray = await response.json();
                const fetchedCards = customerDataArray?.[0]?.cards || [];
                setCards(fetchedCards);
                const currentCardId = subscription?.payment_method?.id;
                if (currentCardId && fetchedCards.some(c => c.id === currentCardId)) {
                     setSelectedCardId(currentCardId);
                } else if (fetchedCards.length > 0) {
                    setSelectedCardId(fetchedCards[0].id);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCards();
    }, [customerId, subscription]);

    const handleUpdatePayment = async () => {
        if (!selectedCardId) {
            setError('Please select a card.');
            return;
        }
        const squareId = subscription?.['Square Subscription ID'];
        if (!squareId) {
            setError('Cannot update payment method: Square Subscription ID is missing.');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            await fetch(UPDATE_SUBSCRIPTION_PAYMENT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscriptionId: squareId,
                    cardId: selectedCardId
                })
            });
            onBack('Payment method updated successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box>
            <Typography variant="h2" gutterBottom>Update Payment Method</Typography>
            <Divider sx={{ my: 2 }}/>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {isLoading ? <CircularProgress /> : (
                <>
                    <Typography variant="h4" gutterBottom>Choose a payment method</Typography>
                    {cards.length > 0 ? (
                        <Box component="fieldset" sx={{ border: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                            {cards.map(card => (
                                <Card key={card.id} variant="outlined" sx={{ '&:has(input:checked)': { borderColor: 'primary.main', borderWidth: 2 } }}>
                                    <CardContent component="label" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', p: '16px !important' }}>
                                        <Radio
                                            checked={selectedCardId === card.id}
                                            onChange={(e) => setSelectedCardId(e.target.value)}
                                            value={card.id}
                                            name="card-selection-radio"
                                            sx={{ p: 0, mr: 2 }}
                                        />
                                        <CardBrandIcon brand={card.card_brand} />
                                        <Box ml={2}>
                                            <Typography variant="h3">{formatCardBrand(card.card_brand)} ending in {card.last_4}</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Expires {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    ) : ( <Typography color="text.secondary" sx={{mt: 2}}>No saved cards found.</Typography> )}
                    
                    <Button variant="outlined" onClick={() => onNavigate('addCard')} sx={{ mt: 2, alignSelf: 'flex-start' }}>
                        Use A Different Card
                    </Button>

                    <Button variant="contained" onClick={handleUpdatePayment} disabled={isLoading || !selectedCardId} sx={{ mt: 3 }}>
                        {isLoading ? <CircularProgress size={24} /> : 'Confirm Update'}
                    </Button>
                </>
            )}
        </Box>
    );
};

const ManageSubscription = ({ subscription, onBack, onNavigate, successMessage }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(successMessage || '');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [detailedSubscription, setDetailedSubscription] = useState(null);

    useEffect(() => {
        const squareSubscriptionId = subscription?.['Square Subscription ID'];
        if (!squareSubscriptionId) {
            setError("Subscription ID is missing.");
            setIsLoading(false);
            return;
        }
        const fetchSubscriptionDetails = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(RETRIEVE_SUBSCRIPTION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscriptionId: squareSubscriptionId })
                });
                if (!response.ok) { throw new Error('Failed to retrieve subscription details.'); }
                const data = await response.json();
                const subscriptionData = data[0]?.data?.subscription;
                const cardData = data[0]?.array?.[0]?.data?.card;
                if (!subscriptionData) { throw new Error("Subscription data not found in the response."); }
                const newDetailedSubscription = {
                    ...subscriptionData,
                    'Subscription End Date': subscriptionData.charged_through_date,
                    payment_method: cardData ? { 
                        id: cardData.id, 
                        card_brand: cardData.card_brand, 
                        last_4: cardData.last_4,
                        exp_month: cardData.exp_month,
                        exp_year: cardData.exp_year
                    } : null,
                };
                setDetailedSubscription(newDetailedSubscription);
            } catch (err) { setError(err.message);
            } finally { setIsLoading(false); }
        };
        fetchSubscriptionDetails();
    }, [subscription]);
    
    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    const handleConfirmCancel = async () => {
        setIsLoading(true); setError(''); setSuccess('');
        try {
            const response = await fetch(CANCEL_SUBSCRIPTION_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriptionId: detailedSubscription.id })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to cancel subscription.' }));
                throw new Error(errorData.message);
            }
            setSuccess('Your subscription has been successfully canceled.');
            handleCloseModal();
            setTimeout(() => onBack(), 3000);
        } catch (err) { setError(err.message); }
        finally { setIsLoading(false); }
    };

    if (isLoading) { return <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>; }
    if (error) { return <Alert severity="error">{error}</Alert>; }
    if (!detailedSubscription) { return <Typography>Could not load subscription details.</Typography> }

    return (
        <Box>
            <Typography variant="h2" gutterBottom>Manage Subscription</Typography>
            {success && <Alert severity="success" sx={{ my: 2 }}>{success}</Alert>}
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mt: 2, mb: 4 }}>
                <Box>
                    <Typography variant="h3" component="h3">Next Billing Date</Typography>
                    <Typography variant="body1" color="text.secondary">{formatDate(detailedSubscription.charged_through_date)}</Typography>
                </Box>
                <Box sx={{ mt: 2.5 }}>
                    <Typography variant="h3" component="h3">Subscription End Date</Typography>
                    <Typography variant="body1" color="text.secondary">{formatDate(detailedSubscription.end_of_period_date)}</Typography>
                </Box>
            </Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom sx={{ mb: 1 }}>Billed To</Typography>
                <Card variant="outlined">
                    <CardContent sx={{ display: 'flex', alignItems: 'center', p: '16px !important' }}>
                        {detailedSubscription.payment_method ? (
                            <>
                                <CardBrandIcon brand={detailedSubscription.payment_method.card_brand} />
                                <Box ml={2}>
                                    <Typography variant="h3">{formatCardBrand(detailedSubscription.payment_method.card_brand)} ending in {detailedSubscription.payment_method.last_4}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Expires {String(detailedSubscription.payment_method.exp_month).padStart(2, '0')}/{detailedSubscription.payment_method.exp_year}
                                    </Typography>
                                </Box>
                            </>
                        ) : (<Typography color="text.secondary">No payment method on file.</Typography>)}
                    </CardContent>
                    <Divider />
                    <CardActions sx={{p: 2, gap: 1}}>
                        <Button variant="text" onClick={() => onNavigate('payment')} disabled={isLoading}>Update Payment</Button>
                        <Button variant="text" color="error" onClick={handleOpenModal} disabled={isLoading || !!success}>Cancel Subscription</Button>
                    </CardActions>
                </Card>
            </Box>
            <Modal open={isModalOpen} onClose={handleCloseModal}>
                <Box sx={modalStyle}>
                    <Typography variant="h2" component="h2">Confirm Cancellation</Typography>
                    <Typography sx={{ mt: 2 }}>Are you sure you want to cancel your subscription?</Typography>
                    <Typography sx={{ mt: 2, fontWeight: 'bold' }}>Your subscription will remain active until {formatDate(detailedSubscription['Subscription End Date'])}.</Typography>
                    {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button variant="text" onClick={handleCloseModal} disabled={isLoading}>Go Back</Button>
                        <Button variant="contained" color="error" onClick={handleConfirmCancel} disabled={isLoading}>{isLoading ? <CircularProgress size={24} /> : 'Confirm'}</Button>
                    </Box>
                </Box>
            </Modal>
        </Box>
    );
};

const Redeem = () => {
    const { login, logout, wizardState } = useContext(LayoutContext) || {};
    const isAuthenticated = wizardState?.context.isReauthenticated;
    const customerIdFromContext = wizardState?.context.primaryCustomerId;
    const navigate = useNavigate();

    const [step, setStep] = useState('checkingAuth');
    const [contactInfo, setContactInfo] = useState('');
    const [formattedContact, setFormattedContact] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [authChannel, setAuthChannel] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [subscriptions, setSubscriptions] = useState([]);
    const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [initialProfile, setInitialProfile] = useState(null);
    const [potentialAccounts, setPotentialAccounts] = useState([]);
    const [selectedCid, setSelectedCid] = useState(null);
    const [showPrevious, setShowPrevious] = useState(false);
    const [manageState, setManageState] = useState({ view: null, subscription: null, newCard: null, successMessage: null });
    const [benefits, setBenefits] = useState([]);
    
    useEffect(() => {
        if (!wizardState) {
            setStep('checkingAuth');
            return;
        }
    
        const fetchAndDetermineStep = async () => {
            if (isAuthenticated && customerIdFromContext) {
                setIsLoading(true);
                setError('');
                try {
                    const [subsResponse, benefitsResponse] = await Promise.all([
                        fetchWithTimeout(LIST_CUSTOMER_SUBSCRIPTIONS_URL, { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' }, 
                            body: JSON.stringify({ CID: customerIdFromContext }) 
                        }),
                        fetchWithTimeout(LIST_ENTITLEMENTS_URL, { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' }, 
                            body: JSON.stringify({ CID: customerIdFromContext }) 
                        })
                    ]);

                    if (!subsResponse.ok) throw new Error("Could not fetch your subscriptions.");
                    if (!benefitsResponse.ok) throw new Error("Could not fetch your benefits.");

                    const subs = await subsResponse.json();
                    const benefitsData = await benefitsResponse.json();

                    setSubscriptions(subs || []);
                    setBenefits(benefitsData || []);

                    const findBestValue = (key) => (subs || []).map(s => s[key]?.[0]).find(value => value && String(value).trim().length > 0) || '';
                    
                    const baseProfile = {
                        firstName: findBestValue('First Name'),
                        lastName: findBestValue('Last Name'),
                        email: findBestValue('Email'),
                        phone: findBestValue('Phone'),
                    };
                    
                    const finalProfile = { ...baseProfile };
                    if (authChannel === 'email' && formattedContact) {
                        finalProfile.email = formattedContact;
                    } else if (authChannel === 'sms' && formattedContact) {
                        finalProfile.phone = formattedContact;
                    }

                    setProfile(finalProfile);
                    setInitialProfile(finalProfile);
                    setContactInfo(finalProfile.email || finalProfile.phone);
                    
                    if (!finalProfile.firstName || !finalProfile.lastName || !finalProfile.email || !finalProfile.phone) {
                        setStep('completeProfile');
                    } else {
                        setStep('success');
                    }
                } catch (err) {
                    if (err.name === 'AbortError') {
                        setError("The request took too long to respond. Please try again later.");
                    } else {
                        setError(err.message);
                    }
                    setStep('success');
                } finally {
                    setIsLoading(false);
                }
            } else {
                setStep('enterContact');
                setIsLoading(false);
            }
        };
    
        fetchAndDetermineStep();
    }, [isAuthenticated, customerIdFromContext]);

    const handleSendOtp = async () => {
        setError(''); let channel = ''; let contactToSend = contactInfo;
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (emailRegex.test(contactInfo)) { channel = 'email'; } 
        else {
            const phoneNumber = parsePhoneNumber(contactInfo, 'US');
            if (phoneNumber && phoneNumber.isValid()) { channel = 'sms'; contactToSend = phoneNumber.number; }
        }
        if (!channel) { setError('Please enter a valid email or phone number.'); return; }
        setFormattedContact(contactToSend); setAuthChannel(channel); setIsLoading(true);
        try {
            const response = await fetch(OTP_VERIFY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', to: contactToSend, channel }) });
            if (!response.ok) {
                const result = await response.json().catch(() => ({ message: "Failed to send OTP" }));
                throw new Error(result.message);
            }
            setStep('enterOtp');
        } catch (err) { setError(err.message); } 
        finally { setIsLoading(false); }
    };

    const handleVerifyOtp = async () => {
        if (otpCode.length !== 6) { 
            setError('Please enter the 6-digit code.'); 
            return; 
        }
        setError(''); setIsLoading(true);
        try {
            const otpResponse = await fetch(OTP_VERIFY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check', to: formattedContact, code: otpCode, channel: authChannel }) });
            const otpResult = await otpResponse.json();
    
            if (otpResult.success !== 'approved') {
                throw new Error(otpResult.message || 'Invalid verification code.');
            }
            
            const customerInfoResponse = await fetch(SUBSCRIBER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [authChannel === 'email' ? 'email' : 'phone']: formattedContact }) });
            let customerInfoResult = await customerInfoResponse.json();
    
            if (customerInfoResult && !Array.isArray(customerInfoResult)) {
                customerInfoResult = [customerInfoResult];
            }
    
            if (!customerInfoResult || customerInfoResult.length === 0) {
                throw new Error("No account associated with this contact was found.");
            }
            
            if (customerInfoResult.length === 1) { 
                if (login) login(customerInfoResult[0].id);
            } else {
                const accountsWithSubCounts = await Promise.all(
                    customerInfoResult.map(async (account) => {
                        try {
                            const subsResponse = await fetch(LIST_CUSTOMER_SUBSCRIPTIONS_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ CID: account.id }),
                            });

                            if (!subsResponse.ok) {
                                return { ...account, subscriptionCount: 0 };
                            }
                            
                            const subscriptions = await subsResponse.json();
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);

                            const activeSubscriptions = subscriptions.filter(sub => {
                                if (sub['Monthly Billing Anchor Date']) {
                                    return true;
                                }
                                if (!sub['Subscription End Date']) return false;
                                const endDate = new Date(sub['Subscription End Date'] + 'T00:00:00');
                                return endDate >= today;
                            });

                            return { ...account, subscriptionCount: activeSubscriptions.length };
                        } catch (err) {
                            return { ...account, subscriptionCount: 0 };
                        }
                    })
                );
                setPotentialAccounts(accountsWithSubCounts);
                setStep('selectAccount');
            }
        } catch (err) { 
            setError(err.message); 
        } 
        finally { 
            setIsLoading(false); 
        }
    };

    const handleAccountSelected = () => {
        if (!selectedCid) { 
            setError("Please select an account to continue."); 
            return; 
        }
        if (login) {
            login(selectedCid);
        }
    };

    const handleUpdateProfile = async () => {
        if (!profile.firstName || !profile.lastName || !profile.email) {
            setError('All fields are required.');
            return;
        }

        setError('');
        setIsLoading(true);
        try {
            const response = await fetch(UPDATE_PROFILE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ CID: customerIdFromContext, ...profile })
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage;

                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorText;
                } catch (e) {
                    errorMessage = errorText;
                }

                if (!errorMessage) {
                    errorMessage = 'An unknown server error occurred.';
                }
                throw new Error(errorMessage);
            }
            
            setInitialProfile(profile);
            setStep('success');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        if (logout) { logout(); }
        navigate('/');
    };

    const pageTitle = () => {
        if (step === 'completeProfile') return 'Complete Your Profile';
        if (step === 'success' && !manageState.view) return `Hi, ${profile.firstName || 'there'}`;
        if (step === 'selectAccount') return 'Select Your Account';
        return 'Redeem Your Subscription';
    };

    const renderHeader = () => {
        const chipInlineStyles = { backgroundColor: '#f5f5f5', height: '32px', color: 'rgba(0, 0, 0, 0.87)', fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: '1.8rem', borderRadius: '16px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', lineHeight: 1, border: 'none', margin: '4px', };

        if (manageState.view) {
            let title = '';
            if (manageState.view === 'details') title = 'Manage Subscription';
            if (manageState.view === 'payment') title = 'Update Payment';
            if (manageState.view === 'addCard') title = 'Use A Different Card';
            if (manageState.view === 'confirmPayment') title = 'Confirm Payment Method';

            return (
                <Box sx={{ mb: 3 }}>
                    <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
                        <MuiLink component="button" onClick={() => setManageState({ view: null, subscription: null, newCard: null, successMessage: null })} underline="none"><span style={chipInlineStyles}>My Subscriptions</span></MuiLink>
                        {(manageState.view === 'payment' || manageState.view === 'addCard' || manageState.view === 'confirmPayment') && (
                            <MuiLink component="button" onClick={() => setManageState({ ...manageState, view: 'details', newCard: null, successMessage: null })} underline="none"><span style={chipInlineStyles}>Manage Subscription</span></MuiLink>
                        )}
                        {(manageState.view === 'addCard' || manageState.view === 'confirmPayment') && (
                             <MuiLink component="button" onClick={() => setManageState({ ...manageState, view: 'payment', newCard: null })} underline="none"><span style={chipInlineStyles}>Update Payment</span></MuiLink>
                        )}
                        <Typography color="text.primary" sx={{ fontSize: '1.8rem', fontFamily: 'Outfit', fontWeight: 'light', margin: '4px' }}>{title}</Typography>
                    </Breadcrumbs>
                </Box>
            );
        }
        return ( <Typography variant="h1" gutterBottom>{pageTitle()}</Typography> );
    };

    const renderContent = () => {
        if (isLoading || step === 'checkingAuth') {
            return <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}><CircularProgress /></Box>;
        }
        switch (step) {
            case 'enterContact':
                return (
                    <>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>Please enter the email address or phone number associated with your subscription.</Typography>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <TextField label="Email or Phone Number" variant="outlined" fullWidth value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} sx={{ mb: 2 }} />
                        <Button variant="contained" onClick={handleSendOtp} disabled={isLoading} fullWidth sx={{ py: 1.5 }}>
                            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
                        </Button>
                    </>
                );
            case 'enterOtp':
                return (
                    <>
                        <Typography sx={{ mb: 2 }}>A 6-digit code was sent to {formattedContact}. Please enter it below.</Typography>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <OtpInput value={otpCode} onCodeChange={setOtpCode} onSubmit={handleVerifyOtp} />
                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <MuiLink component="button" variant="body2" onClick={() => { setStep('enterContact'); setError(''); }}>Use another method</MuiLink>
                            <Button variant="contained" onClick={handleVerifyOtp} disabled={isLoading || otpCode.length !== 6}>
                                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Verify'}
                            </Button>
                        </Box>
                    </>
                );
            case 'selectAccount':
                return (
                    <>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>We found multiple accounts. Please select which one you'd like to use.</Typography>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <Box component="fieldset" sx={{ border: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {potentialAccounts.map((account) => (
                                <Card key={account.id} variant="outlined" sx={{ '&:has(input:checked)': { borderColor: 'primary.main', borderWidth: 2 } }}>
                                    <CardContent component="label" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%', p: '16px !important' }}>
                                        <Radio value={account.id} name="accountSelection" checked={selectedCid === account.id} onChange={(e) => setSelectedCid(e.target.value)} sx={{mr: 2}} />
                                        <Box>
                                            <Typography variant="h3">{account.given_name} {account.family_name}</Typography>
                                            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {account.email_address ? account.email_address : 'Setup Your Subscription'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold', color: 'primary.main' }}>
                                                {account.subscriptionCount} Current {account.subscriptionCount === 1 ? 'Subscription' : 'Subscriptions'}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                        <Button variant="contained" onClick={handleAccountSelected} disabled={isLoading || !selectedCid} fullWidth sx={{ mt: 3, py: 1.5 }}>
                            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
                        </Button>
                    </>
                );
            case 'completeProfile':
                return (
                    <>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>Please complete your profile to continue.</Typography>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        
                        {!initialProfile?.firstName && <TextField label="First Name" fullWidth margin="dense" value={profile.firstName} onChange={(e) => setProfile(p => ({...p, firstName: e.target.value}))} />}
                        {!initialProfile?.lastName && <TextField label="Last Name" fullWidth margin="dense" value={profile.lastName} onChange={(e) => setProfile(p => ({...p, lastName: e.target.value}))} />}
                        
                        {!initialProfile?.email && (
                            <TextField
                                label="Email"
                                fullWidth
                                margin="dense"
                                type="email"
                                value={authChannel === 'email' ? formattedContact : profile.email}
                                onChange={(e) => setProfile(p => ({...p, email: e.target.value}))}
                                disabled={authChannel === 'email'}
                                helperText={authChannel === 'email' ? "This email was used to verify your account." : ""}
                            />
                        )}
                        {!initialProfile?.phone && (
                            <TextField
                                label="Phone"
                                fullWidth
                                margin="dense"
                                type="tel"
                                value={authChannel === 'sms' ? formattedContact : profile.phone}
                                onChange={(e) => setProfile(p => ({...p, phone: e.target.value}))}
                                disabled={authChannel === 'sms'}
                                helperText={authChannel === 'sms' ? "This phone number was used to verify your account." : ""}
                            />
                        )}

                        <Button variant="contained" onClick={handleUpdateProfile} disabled={isLoading} fullWidth sx={{ mt: 2, py: 1.5 }}>
                            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Save Profile'}
                        </Button>
                    </>
                );
            case 'success':
                if (error) {
                    return <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>;
                }
                if (manageState.view) {
                    if (manageState.view === 'confirmPayment') {
                        return <ConfirmNewPaymentMethod
                            subscription={manageState.subscription}
                            newCard={manageState.newCard}
                            onConfirmSuccess={(message) => setManageState({ ...manageState, view: 'details', newCard: null, successMessage: message })}
                            onBack={() => setManageState({ ...manageState, view: 'payment', newCard: null })}
                        />
                    }
                    if (manageState.view === 'addCard') {
                        return <AddNewCard
                            customerId={customerIdFromContext}
                            onCardAdded={(newlyAddedCard) => setManageState({ ...manageState, view: 'confirmPayment', newCard: newlyAddedCard })}
                            onCancel={() => setManageState({ ...manageState, view: 'payment', newCard: null })}
                        />
                    }
                    if (manageState.view === 'payment') {
                        return <UpdatePayment
                                    customerId={customerIdFromContext}
                                    subscription={manageState.subscription}
                                    onBack={(message) => setManageState({ ...manageState, view: 'details', successMessage: message })}
                                    onNavigate={(view) => setManageState({ ...manageState, view })}
                                />;
                    }
                    if (manageState.view === 'details') {
                        return <ManageSubscription
                                    subscription={manageState.subscription}
                                    onBack={() => setManageState({ view: null, subscription: null, newCard: null, successMessage: null })}
                                    onNavigate={(view) => setManageState({ ...manageState, view, successMessage: null })}
                                    successMessage={manageState.successMessage}
                                />;
                    }
                }
                
                const enrichedSubscriptions = subscriptions.map(sub => {
                    const relatedEntitlements = benefits.filter(benefit =>
                        benefit['Linked: Subscription ID in Subscriptions']?.[0] === sub.id
                    );
                    return { ...sub, entitlements: relatedEntitlements };
                });
                const linkedEntitlementIds = new Set(enrichedSubscriptions.flatMap(sub => sub.entitlements.map(e => e['Entitlement ID'])));
                const orphanedEntitlements = benefits.filter(benefit => !linkedEntitlementIds.has(benefit['Entitlement ID']));
                const groupedOrphanedEntitlements = orphanedEntitlements.reduce((acc, benefit) => {
                    const parentSubId = benefit['Linked: Subscription ID in Subscriptions']?.[0];
                    if (parentSubId) { if (!acc[parentSubId]) { acc[parentSubId] = []; } acc[parentSubId].push(benefit); }
                    return acc;
                }, {});
                const sharedSubscriptions = Object.values(groupedOrphanedEntitlements).map(benefitGroup => {
                    const firstBenefit = benefitGroup[0];
                    return {
                        id: firstBenefit?.['Linked: Subscription ID in Subscriptions']?.[0],
                        Code: firstBenefit.Code?.[0],
                        subscriptionEndDate: firstBenefit['Subscription End Date']?.[0],
                        entitlements: benefitGroup,
                    };
                });
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const currentEnrichedSubscriptions = enrichedSubscriptions.filter(sub => {
                    if (sub['Monthly Billing Anchor Date']) {
                        return true;
                    }
                    const endDate = sub['Subscription End Date'] ? new Date(sub['Subscription End Date'] + 'T00:00:00') : null;
                    return endDate && endDate >= today;
                });
                const previousEnrichedSubscriptions = enrichedSubscriptions.filter(sub => {
                    if (sub['Monthly Billing Anchor Date']) return false;
                    const endDate = sub['Subscription End Date'] ? new Date(sub['Subscription End Date'] + 'T00:00:00') : null;
                    return endDate && endDate < today;
                });

                return (
                     <Box sx={{ my: 4 }}>
                        <Card sx={{ backgroundColor: 'black', color: 'white', mb: 4, boxShadow: 'none', border: '1px solid', borderColor: 'grey.400' }}>
                            <CardContent>
                                <Typography variant="h3" component="div">{profile.firstName} {profile.lastName}</Typography>
                                <Typography sx={{ mt: 1.5 }} color="rgba(255, 255, 255, 0.7)">{contactInfo}</Typography>
                            </CardContent>
                        </Card>

                        {(() => {
                            const loggedInUserAirtableId = subscriptions[0]?.['Linked: Subscriber ID in Subscribers']?.[0];

                            return (
                                <>
                                    {currentEnrichedSubscriptions.length > 0 && (
                                        <Box>
                                            <Typography variant="h2" gutterBottom>My Subscriptions</Typography>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                                                {currentEnrichedSubscriptions.map((sub) => {
                                                    const codeDigits = String(sub.Code).padStart(6, '0').split('');
                                                    const { date, label } = getSubscriptionDateInfo(sub);
                                                    const displayDate = formatDate(date);
                                                    const accountType = getAccountType(sub, loggedInUserAirtableId);

                                                    return (
                                                        <Card key={sub.id} variant="outlined">
                                                            <CardContent sx={{ pb: '8px !important' }}>
                                                                <Typography variant="h3" component="div">{sub.entitlements[0]?.['Plan Name']?.[0] || 'Subscription Plan'}</Typography>
                                                                <Typography variant="body1" color="text.secondary">{sub['Location Name']?.[0] || 'N/A'}</Typography>
                                                                
                                                                {accountType && (
                                                                    <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1.5 }}>
                                                                        Your Role: {accountType}
                                                                    </Typography>
                                                                )}

                                                                <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                                                                    {label} {displayDate}
                                                                </Typography>

                                                                <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                                                                    {label} {displayDate}
                                                                </Typography>
                                                                
                                                                {sub.entitlements.length > 0 && (
                                                                    <Box sx={{ mt: 2.5, pl: 2, borderLeft: '3px solid', borderColor: 'grey.200' }}>
                                                                        <Typography variant="h4" sx={{ mb: 1.5 }}>Use Code To Redeem</Typography>
                                                                        <Box sx={{ display: 'flex', gap: 0.75, mb: 2 }}>
                                                                            {codeDigits.map((digit, idx) => (
                                                                                <Typography key={idx} sx={{ backgroundColor: 'black', color: 'white', borderRadius: '8px', width: { xs: '35px', sm: '40px' }, height: { xs: '45px', sm: '50px' }, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: { xs: '1.2rem', sm: '1.5rem' }, fontWeight: 'bold' }}>
                                                                                    {digit}
                                                                                </Typography>
                                                                            ))}
                                                                        </Box>
                                                                        {sub.entitlements.map(benefit => (
                                                                            <Box key={benefit['Entitlement ID']} sx={{ mb: 1.5 }}>
                                                                                <Typography variant="body1" component="div">{benefit['Display Benefit Name']}</Typography>
                                                                                <Typography variant="body2" sx={{ mt: 0.5 }}>Status: <Box component="span" sx={{ fontWeight: 'bold', color: benefit['Test for Redeem Status'] === 'Available' ? 'success.main' : 'text.secondary', ml: 0.5 }}>{benefit['Test for Redeem Status'] === 'Available' ? 'Ready to Redeem' : 'Redeemed this period'}</Box></Typography>
                                                                            </Box>
                                                                        ))}
                                                                    </Box>
                                                                )}
                                                            </CardContent>
                                                            
                                                            {sub['Square Subscription ID'] && sub['Square Subscription ID'] !== 'Complimentary' && (
                                                                <>
                                                                    <Divider />
                                                                    <CardActions>
                                                                        <Button onClick={() => setManageState({ view: 'details', subscription: sub })}>
                                                                            Manage Subscription
                                                                        </Button>
                                                                    </CardActions>
                                                                </>
                                                            )}
                                                        </Card>
                                                    )
                                                })}
                                            </Box>
                                        </Box>
                                    )}
                                    {sharedSubscriptions.length > 0 && (
                                        <Box sx={{mt: 4}}>
                                            <Typography variant="h2" gutterBottom>Gifted Subscriptions</Typography>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
                                                {sharedSubscriptions.map((sub) => {
                                                    const codeDigits = String(sub.Code).padStart(6, '0').split('');
                                                    const accountType = getAccountType(sub, loggedInUserAirtableId);
                                                    const safeEndDate = typeof sub.subscriptionEndDate === 'string' && sub.subscriptionEndDate.includes('-') 
                                                        ? sub.subscriptionEndDate 
                                                        : null;
                                                    return(
                                                        <Card key={sub.id} variant="outlined">
                                                            <CardContent sx={{ pb: '8px !important' }}>
                                                                <Typography variant="h3" component="div">{sub.entitlements[0]?.['Plan Name']?.[0] || 'Shared Plan'}</Typography>
                                                                
                                                                {accountType && (
                                                                    <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1.5 }}>
                                                                        Your Role: {accountType}
                                                                    </Typography>
                                                                )}

                                                                <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>Expires on: {formatDate(safeEndDate)}</Typography>
                                                                
                                                                <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>Expires on: {formatDate(safeEndDate)}</Typography>
                                                                
                                                                <Box sx={{ mt: 2.5, pl: 2, borderLeft: '3px solid', borderColor: 'grey.200' }}>
                                                                    <Typography variant="h4" sx={{ mb: 1.5 }}>Use Code To Redeem</Typography>
                                                                    <Box sx={{ display: 'flex', gap: 0.75, mb: 2 }}>
                                                                        {codeDigits.map((digit, idx) => (
                                                                            <Typography key={idx} sx={{ backgroundColor: 'black', color: 'white', borderRadius: '8px', width: { xs: '35px', sm: '40px' }, height: { xs: '45px', sm: '50px' }, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: { xs: '1.2rem', sm: '1.5rem' }, fontWeight: 'bold' }}>
                                                                                    {digit}
                                                                                </Typography>
                                                                            ))}
                                                                    </Box>
                                                                    {sub.entitlements.map(benefit => (
                                                                        <Box key={benefit['Entitlement ID']} sx={{ mb: 1.5 }}>
                                                                            <Typography variant="body1" component="div">{benefit['Display Benefit Name']}</Typography>
                                                                            <Typography variant="body2" sx={{ mt: 0.5 }}>Status: <Box component="span" sx={{ fontWeight: 'bold', color: benefit['Test for Redeem Status'] === 'Available' ? 'success.main' : 'text.secondary', ml: 0.5 }}>{benefit['Test for Redeem Status'] === 'Available' ? 'Ready to Redeem' : 'Redeemed this period'}</Box></Typography>
                                                                        </Box>
                                                                    ))}
                                                                </Box>
                                                            </CardContent>
                                                            <Divider />
                                                            <CardActions>
                                                                <Button disabled>Managed by Primary Account Holder</Button>
                                                            </CardActions>
                                                        </Card>
                                                    )
                                                })}
                                            </Box>
                                        </Box>
                                    )}
                                </>
                            )
                        })()}
                        
                        {currentEnrichedSubscriptions.length === 0 && sharedSubscriptions.length === 0 && ( <Typography>No active subscriptions found.</Typography> )}
                        
                        {previousEnrichedSubscriptions.length > 0 && (
                            <Button variant="grey-back" onClick={() => setShowPrevious(!showPrevious)} sx={{ mt: 4 }} fullWidth>
                                {showPrevious ? 'Hide' : 'Show'} Previous Subscriptions
                            </Button>
                        )}

                        {showPrevious && (
                             <Box sx={{ mt: 4 }}>
                                <Typography variant="h2" gutterBottom>Previous Subscriptions</Typography>
                                {previousEnrichedSubscriptions.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {previousEnrichedSubscriptions.map((sub) => (
                                            <Card key={sub.id} variant="outlined"><CardContent><Typography variant="h3">{sub.entitlements[0]?.['Plan Name']?.[0] || 'Subscription Plan'}</Typography><Typography sx={{ mt: 1 }}>Ended on {formatDate(sub['Subscription End Date']?.[0])}</Typography></CardContent></Card>
                                        ))}
                                    </Box>
                                ) : ( <Typography>No previous subscriptions found.</Typography> )}
                            </Box>
                        )}
                    </Box>
                );
            default:
                return null;
        }
    };

    return (
        <Box sx={{ maxWidth: 'sm', width: '100%', mx: 'auto', pt: 0, pb: 3, px: 3, display: 'flex', flexDirection: 'column', flexGrow: 1, }}>
           {renderHeader()}
           {renderContent()}
        </Box>
    );
};

export default Redeem;