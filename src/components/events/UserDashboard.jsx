import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Container, Stack, Paper, Divider, Alert,
    ToggleButtonGroup, ToggleButton, Tabs, Tab, Chip,
    Accordion, AccordionSummary, AccordionDetails, Skeleton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { format, isValid, parse } from 'date-fns';
import { trackEventsDashboardViewed } from '@/services/analytics';
import { EVENTS_API_URL } from '@/constants/events/eventsConstants';

const formatDateSafe = (dateValue, formatString) => {
  if (!dateValue) return 'Date TBD';
  const date = new Date(dateValue.replace(/-/g, '/'));
  if (!isValid(date)) return 'Invalid Date';
  return format(date, formatString);
};

const formatTimeSlot = (slot) => {
    if (!slot || !slot.includes(' - ')) return '';
    try {
        const [startTime, endTime] = slot.split(' - ');
        const start = parse(startTime, 'HH:mm', new Date());
        const end = parse(endTime, 'HH:mm', new Date());
        return `${format(start, 'h:mmaaa')} - ${format(end, 'h:mmaaa')}`.toLowerCase();
    } catch (e) {
        return 'Invalid Time';
    }
};

const getEventDate = (event) => {
    const dateString = event['Event Date'] || event['Start Date'] || event['End Date'];
    if (!dateString) return null;
    const date = new Date(dateString.replace(/-/g, '/'));
    return isValid(date) ? date : null;
};

// An event is "past" only once its day is over (its date is local midnight).
const isBeforeToday = (date) => {
    if (!date) return false;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return date < startOfToday;
};

const formatCents = (cents) => {
    if (cents == null) return '$0.00';
    return `$${(cents / 100).toFixed(2)}`;
};

const formatOrderDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const HostedEventCard = ({ event, eventDetails, onViewTransactions, onViewMarketingMaterials }) => {
    const eventDate = getEventDate(event);
    const isEventInThePast = isBeforeToday(eventDate);
    const first = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : arr || '');
    const imageUrl = first(event['Image URL']) || eventDetails?.imageUrl;
    const description = event['Description'] || eventDetails?.description || eventDetails?.['Description'];
    const bulletPoints = event['Bullet Points'] || eventDetails?.bulletPoints || eventDetails?.['Bullet Points'];
    const displayDate = event['Event Date'] || event['Start Date'];

    const renderBulletPoints = (bp) => {
        if (!bp) return null;
        if (typeof bp === 'string') return <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{bp}</Typography>;
        if (Array.isArray(bp) && bp.length > 0) {
            return (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {bp.map(point => typeof point === 'string' ? point : point?.name || point?.text || point?.value || '').join('\n')}
                </Typography>
            );
        }
        return null;
    };

    return (
        <Paper variant="outlined" sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            {imageUrl && (
                 <Box sx={{ height: 180, backgroundColor: 'grey.200', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', overflow: 'hidden' }}>
                    <img src={imageUrl} alt={first(event['Event Name'])} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
            )}
            <Stack sx={{ p: 2, flexGrow: 1 }} spacing={1}>
                <Typography variant="h3" component="h3">{first(event['Event Name'])}</Typography>
                {isEventInThePast && <Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>Past Event</Typography>}
                {displayDate && <Typography variant="body1" color="text.secondary">{formatDateSafe(displayDate, "EEEE, MMMM do")}</Typography>}
                {event['Event Time'] && <Typography variant="body1" color="text.secondary">{formatTimeSlot(event['Event Time'])}</Typography>}
                {first(event['Location Name']) && <Typography variant="body1" color="text.secondary">{first(event['Location Name'])}</Typography>}
                {first(event['Location Address']) && <Typography variant="body1" color="text.secondary">{first(event['Location Address'])}</Typography>}
                {description && <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{description}</Typography>}
                {bulletPoints && <Box sx={{ mt: 1 }}>{renderBulletPoints(bulletPoints)}</Box>}
                {event['Status'] && (
                    <Box sx={{ pt: 1 }}>
                        <Typography variant="body2">Status: <strong>{event['Status']}</strong></Typography>
                    </Box>
                )}
            </Stack>
            {event['Status'] === 'Approved' && (
                <>
                    <Divider />
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {isEventInThePast ? (
                            <Button onClick={() => onViewTransactions(event['Registered Event ID'])} sx={{ pl: 0 }}>View Fundraiser Details</Button>
                        ) : (
                            <Button onClick={() => onViewMarketingMaterials(event['Registered Event ID'])} sx={{ pl: 0 }}>View Marketing Materials</Button>
                        )}
                    </Box>
                </>
            )}
        </Paper>
    );
};

// Spot-confirmation control for events that require confirming to secure the
// tournament seat. Self-contained: inlines the confirmEventSpot call and tracks
// its own state (the dashboard is XState-driven and re-fetches on next load).
const SpotConfirmSection = ({ event }) => {
    const required = event['Spot Confirm Required'] === true;
    const initialStatus = event['Spot Status'] || null;
    const [status, setStatus] = useState(initialStatus); // reserved | confirmed | waitlisted | released
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');

    if (!required || !initialStatus) return null;

    const opensAt = event['Confirm Window Opens At'] ? new Date(event['Confirm Window Opens At']) : null;
    const deadline = event['Confirm Deadline At'] ? new Date(event['Confirm Deadline At']) : null;
    const now = new Date();
    const windowOpen = (!opensAt || now >= opensAt) && (!deadline || now < deadline);

    const doConfirm = async () => {
        setBusy(true);
        setNotice('');
        try {
            const res = await fetch(EVENTS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'confirmEventSpot',
                    guestId: event['Guest ID'],
                    registrationId: event['Registered Event ID'],
                    token: event['Confirm Token'],
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (data.spotStatus === 'confirmed' || data.status === 'ok') {
                setStatus('confirmed');
            } else if (data.status === 'full' || data.spotStatus === 'waitlisted') {
                setStatus('waitlisted');
                setNotice(data.message || "All seats are full — you're on the waitlist.");
            } else {
                setNotice(data.message || data.error || 'Could not confirm your spot. Please try again.');
            }
        } catch (e) {
            setNotice('Something went wrong. Please try again in a moment.');
        } finally {
            setBusy(false);
        }
    };

    // "Can't make it?" — cancel a confirmed/auto-confirmed spot (frees the seat).
    const doCancel = async () => {
        setBusy(true);
        setNotice('');
        try {
            const res = await fetch(EVENTS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'cancelEventSpot',
                    guestId: event['Guest ID'],
                    registrationId: event['Registered Event ID'],
                    token: event['Confirm Token'],
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (data.spotStatus === 'released' || data.status === 'ok') {
                setStatus('released');
            } else {
                setNotice(data.message || data.error || 'Could not cancel your spot. Please try again.');
            }
        } catch (e) {
            setNotice('Something went wrong. Please try again in a moment.');
        } finally {
            setBusy(false);
        }
    };

    if (status === 'confirmed') {
        return (
            <Box sx={{ mt: 1 }}>
                <Alert severity="success" sx={{ mb: 1 }}>Your spot is confirmed. See you there!</Alert>
                {notice && <Alert severity="error" sx={{ mb: 1 }}>{notice}</Alert>}
                <Button variant="text" size="small" color="error" disabled={busy} onClick={doCancel}>
                    {busy ? 'Cancelling…' : "Can't make it? Cancel my spot"}
                </Button>
            </Box>
        );
    }
    if (status === 'waitlisted') {
        return <Alert severity="info" sx={{ mt: 1 }}>{notice || "You're on the waitlist — we'll text you if a spot opens up."}</Alert>;
    }
    if (status === 'released') {
        return <Alert severity="info" sx={{ mt: 1 }}>Your spot has been cancelled.</Alert>;
    }
    // reserved
    return (
        <Box sx={{ mt: 1 }}>
            <Alert severity={windowOpen ? 'warning' : 'info'} sx={{ mb: 1 }}>
                {windowOpen
                    ? 'Confirm your spot to secure your seat.'
                    : `Confirmation opens ${opensAt ? format(opensAt, "EEE, MMM d 'at' h:mmaaa") : 'soon'}.`}
            </Alert>
            {notice && <Alert severity="error" sx={{ mb: 1 }}>{notice}</Alert>}
            <Button
                variant="contained"
                size="small"
                disabled={!windowOpen || busy}
                onClick={doConfirm}
            >
                {busy ? 'Confirming…' : 'Confirm my spot'}
            </Button>
        </Box>
    );
};

const ParticipantEventCard = ({ event }) => {
    const eventDate = getEventDate(event);
    const isEventInThePast = isBeforeToday(eventDate);
    const first = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : arr || '');
    const imageUrl = first(event['Image URL']) || event['Image URL'];
    const eventName = first(event['Event Name']) || event['Event Name'];
    const eventTime = Array.isArray(event['Event Times']) && event['Event Times'].length > 0
        ? event['Event Times'][0]
        : (event['Event Time'] || '');
    const description = event['Description'];
    const bulletPoints = event['Bullet Points'];
    const displayDate = event['Event Date'] || event['Start Date'];

    const renderBulletPoints = (bp) => {
        if (!bp) return null;
        if (typeof bp === 'string') return <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{bp}</Typography>;
        if (Array.isArray(bp) && bp.length > 0) {
            return (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {bp.map(point => typeof point === 'string' ? point : point?.name || point?.text || point?.value || '').join('\n')}
                </Typography>
            );
        }
        return null;
    };

    return (
        <Paper variant="outlined" sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            {imageUrl && (
                 <Box sx={{ height: 180, backgroundColor: 'grey.200', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', overflow: 'hidden' }}>
                    <img src={imageUrl} alt={eventName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
            )}
            <Stack sx={{ p: 2, flexGrow: 1 }} spacing={1}>
                <Typography variant="h3" component="h3">{eventName}</Typography>
                {event['Player Name'] && (
                    <Box>
                        <Chip label={`Player: ${event['Player Name']}`} size="small" color="primary" variant="outlined" />
                    </Box>
                )}
                {isEventInThePast && <Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>Past Event</Typography>}
                {displayDate && <Typography variant="body1" color="text.secondary">{formatDateSafe(displayDate, "EEEE, MMMM do")}</Typography>}
                {eventTime && <Typography variant="body1" color="text.secondary">{formatTimeSlot(eventTime)}</Typography>}
                {description && <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{description}</Typography>}
                {bulletPoints && <Box sx={{ mt: 1 }}>{renderBulletPoints(bulletPoints)}</Box>}
                <SpotConfirmSection event={event} />
            </Stack>
        </Paper>
    );
};

// ── Events Tab ──
const EventsTab = ({ events, allEvents, view, onViewChange, onScheduleNew, onViewTransactions, onViewMarketingMaterials }) => {
    const hostedEvents = (events?.hostedEvents || [])
        .filter(e => e && e['Registered Event ID'])
        .map(e => ({ ...e, _isHostedEvent: true }));
    const participantEvents = (events?.participantEvents || [])
        .filter(e => e && (e['Event ID'] || e['Registered Event ID']))
        .map(e => ({ ...e, _isHostedEvent: false }));
    const allUserEvents = [...hostedEvents, ...participantEvents];

    // Compare by day: an event stays "Active" through the end of the day it
    // occurs (its date parses to local midnight, so use midnight-of-today).
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const filteredEvents = allUserEvents.filter(e => {
        const eventDate = getEventDate(e);
        if (view === 'All') return true;
        if (!eventDate) return view === 'Active';
        return view === 'Active' ? eventDate >= startOfToday : eventDate < startOfToday;
    });

    const hasAnyEvents = allUserEvents.length > 0;

    if (!hasAnyEvents) {
        return (
            <Box>
                <Typography color="text.secondary" align="center" sx={{ my: 4 }}>
                    You have no events.
                </Typography>
                <Button variant="contained" fullWidth onClick={onScheduleNew} sx={{ mt: 1 }}>
                    Schedule a New Event or Fundraiser
                </Button>
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <ToggleButtonGroup color="primary" value={view} exclusive onChange={onViewChange} aria-label="Filter events">
                    <ToggleButton value="Active">Active</ToggleButton>
                    <ToggleButton value="All">All</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <Box sx={{ mb: 3 }}>
                {filteredEvents.length > 0 ? (
                    <Stack spacing={3}>
                        {filteredEvents.map((event, index) => {
                            if (event._isHostedEvent) {
                                const first = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : arr || '');
                                const eventName = first(event['Event Name']);
                                const eventDetails = allEvents?.find(e => e.title === eventName);
                                return (
                                    <HostedEventCard
                                        key={event['Registered Event ID'] || index}
                                        event={event}
                                        eventDetails={eventDetails}
                                        onViewTransactions={onViewTransactions}
                                        onViewMarketingMaterials={onViewMarketingMaterials}
                                    />
                                );
                            }
                            return (
                                <ParticipantEventCard
                                    key={event['Registered Event ID'] || event['Event ID'] || index}
                                    event={event}
                                />
                            );
                        })}
                    </Stack>
                ) : (
                    <Typography color="text.secondary" align="center">
                        {view === 'All' ? 'You have no events.' : `You have no ${view.toLowerCase()} events.`}
                    </Typography>
                )}
            </Box>

            <Button variant="contained" fullWidth onClick={onScheduleNew}>
                Schedule a New Event or Fundraiser
            </Button>
        </Box>
    );
};

// ── Orders Tab ──
const OrdersTab = ({ orders, pointsByOrder }) => {
    if (orders === null) {
        return (
            <Stack spacing={2}>
                {[1, 2, 3].map(i => (
                    <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Skeleton variant="text" width="40%" height={28} />
                        <Skeleton variant="text" width="60%" height={20} sx={{ mt: 1 }} />
                        <Skeleton variant="text" width="30%" height={20} sx={{ mt: 0.5 }} />
                    </Paper>
                ))}
            </Stack>
        );
    }

    if (!orders || orders.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 6 }}>
                <ReceiptLongIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>No orders yet</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Your order history will appear here once you place an order.
                </Typography>
            </Box>
        );
    }

    return (
        <Stack spacing={2}>
            {orders.map((order) => (
                <Accordion
                    key={order.masterOrderId}
                    variant="outlined"
                    disableGutters
                    sx={{
                        borderRadius: '8px !important',
                        '&:before': { display: 'none' },
                        '&.Mui-expanded': { margin: '0 !important' },
                    }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 0.5 }}>
                        <Stack sx={{ width: '100%', pr: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography sx={{ fontWeight: 600 }}>
                                    Order {order.displayName || `#${order.orderNumber}`}
                                </Typography>
                                <Typography sx={{ fontWeight: 700 }}>
                                    {formatCents(order.payment?.total)}
                                </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                        {formatOrderDate(order.createdAt || order.date)}
                                    </Typography>
                                    {pointsByOrder?.[order.masterOrderId] > 0 && (
                                        <Chip
                                            label={`+${pointsByOrder[order.masterOrderId]} pts`}
                                            size="small"
                                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#fff8e1', color: '#f57f17', border: '1px solid #f57f17' }}
                                        />
                                    )}
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    {order.fulfillment?.type && (
                                        order.fulfillment.type === 'shipping' || order.fulfillment.type === 'local'
                                            ? <LocalShippingIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                            : <StorefrontIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    )}
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                        {order.status}
                                    </Typography>
                                </Stack>
                            </Stack>
                        </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                        <Divider sx={{ mb: 1.5 }} />
                        <Stack spacing={1}>
                            {order.lineItems?.map((item, idx) => (
                                <Box key={idx}>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {item.quantity > 1 ? `${item.quantity} x ` : ''}{item.name}
                                            {item.variantName ? ` — ${item.variantName}` : ''}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 500, flexShrink: 0, ml: 1 }}>
                                            {formatCents(item.totalPrice)}
                                        </Typography>
                                    </Stack>
                                    {item.modifiers?.length > 0 && (
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', pl: 1, fontSize: '1.6rem' }}>
                                            {item.modifiers.map(m => m.name || m).join(', ')}
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                        </Stack>
                        {order.payment && (
                            <>
                                <Divider sx={{ my: 1.5 }} />
                                <Box component="dl" sx={{ m: 0, '& > div': { display: 'flex', justifyContent: 'space-between', mb: 0.5 } }}>
                                    <div>
                                        <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>Subtotal</Typography>
                                        <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatCents(order.payment.subtotal)}</Typography>
                                    </div>
                                    {order.payment.tax > 0 && (
                                        <div>
                                            <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>Tax</Typography>
                                            <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatCents(order.payment.tax)}</Typography>
                                        </div>
                                    )}
                                    {order.payment.shipping > 0 && (
                                        <div>
                                            <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>Shipping</Typography>
                                            <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatCents(order.payment.shipping)}</Typography>
                                        </div>
                                    )}
                                    {order.payment.tip > 0 && (
                                        <div>
                                            <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>Tip</Typography>
                                            <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatCents(order.payment.tip)}</Typography>
                                        </div>
                                    )}
                                    {order.payment.discount > 0 && (
                                        <div>
                                            <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>Discount</Typography>
                                            <Typography component="dd" variant="body2" sx={{ m: 0, color: 'success.main' }}>-{formatCents(order.payment.discount)}</Typography>
                                        </div>
                                    )}
                                    <Box component="div" sx={{ pt: 0.5 }}>
                                        <Typography component="dt" variant="body2" sx={{ fontWeight: 700 }}>Total</Typography>
                                        <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 700 }}>{formatCents(order.payment.total)}</Typography>
                                    </Box>
                                </Box>
                            </>
                        )}
                        {order.locationName && (
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                                {order.locationName}
                            </Typography>
                        )}
                    </AccordionDetails>
                </Accordion>
            ))}
        </Stack>
    );
};

// ── Rewards Tab ──
const RewardsTab = ({ loyalty, onRedeem, redeeming }) => {
    if (loyalty === undefined) {
        return (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Skeleton variant="text" width="40%" height={28} />
                <Skeleton variant="rectangular" height={60} sx={{ mt: 1, borderRadius: 1 }} />
            </Paper>
        );
    }

    if (!loyalty?.enrolled || !loyalty.account) {
        return (
            <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Surreal Rewards</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Place an order to automatically enroll in our rewards program.
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, background: 'linear-gradient(135deg, #fff8e1 0%, #fff3e0 100%)' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Surreal Rewards</Typography>
                    <Chip label={loyalty.account.tierName} size="small" sx={{ fontWeight: 700, bgcolor: '#fff', border: '1px solid #f57f17', color: '#f57f17' }} />
                </Stack>

                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Points Balance</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#f57f17' }}>
                            {(loyalty.account.balance || 0).toLocaleString()}
                        </Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Lifetime Earned</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#e65100' }}>
                            {(loyalty.account.lifetimeEarned || 0).toLocaleString()}
                        </Typography>
                    </Box>
                    {loyalty.account.tournamentPoints > 0 && (
                        <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">Tournament Pts</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: '#6a1b9a' }}>
                                {(loyalty.account.tournamentPoints).toLocaleString()}
                            </Typography>
                        </Box>
                    )}
                </Box>

                {loyalty.nextTier && (
                    <Box sx={{ mb: 2 }}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                                Progress to {loyalty.nextTier.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {loyalty.nextTier.pointsNeeded.toLocaleString()} pts to go
                            </Typography>
                        </Stack>
                        <Box sx={{ height: 6, bgcolor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <Box sx={{
                                height: '100%', bgcolor: '#f57f17', borderRadius: 3,
                                width: `${Math.min(100, ((loyalty.account.lifetimeEarned / loyalty.nextTier.minLifetimePoints) * 100))}%`,
                                transition: 'width 0.3s ease',
                            }} />
                        </Box>
                    </Box>
                )}


                {loyalty.recentActivity?.length > 0 && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1.5 }}>
                        <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 1 }}>Recent Activity</Typography>
                        <Stack spacing={0.5} divider={<Divider flexItem />}>
                            {loyalty.recentActivity.map((e, i) => (
                                e.type === 'conversion' ? (
                                    <Box key={i} sx={{ py: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                            {new Date(e.timestamp).toLocaleDateString()}
                                        </Typography>
                                        <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>
                                            Switched to Surreal Rewards
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                                            Balance carried over: {(e.balance || 0).toLocaleString()} pts
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Stack key={i} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.5 }}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                {e.type === 'tournament_points' ? 'Tournament' : e.type === 'earn' ? 'Earned' : 'Redeemed'} · {new Date(e.timestamp).toLocaleDateString()}
                                            </Typography>
                                            {e.type === 'tournament_points' && e.tournamentName && (
                                                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', color: '#6a1b9a', fontWeight: 600 }}>
                                                    {e.tournamentName}{e.place ? ` — ${e.place}` : ''}
                                                </Typography>
                                            )}
                                            {e.type === 'redeem' && e.rewardName && (
                                                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', color: 'text.secondary' }}>
                                                    {e.rewardName}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, color: e.type === 'tournament_points' ? '#6a1b9a' : e.points > 0 ? 'success.main' : e.points < 0 ? 'error.main' : 'text.secondary' }}>
                                                {e.points > 0 ? '+' : ''}{e.points} pts
                                            </Typography>
                                            {e.type !== 'tournament_points' && (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.6rem' }}>
                                                    Balance: {(e.balance || 0).toLocaleString()}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Stack>
                                )
                            ))}
                        </Stack>
                    </Box>
                )}

                {loyalty.rewards?.length > 0 && (
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Redeem Rewards</Typography>
                        <Stack spacing={1}>
                            {loyalty.rewards.map((reward) => (
                                <Paper
                                    key={reward.id}
                                    variant="outlined"
                                    sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff', borderRadius: 1.5 }}
                                >
                                    <Box>
                                        <Typography variant="body2" fontWeight={600}>{reward.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">{reward.pointsCost} pts</Typography>
                                    </Box>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disabled={loyalty.account.balance < reward.pointsCost || redeeming === reward.id}
                                        onClick={() => onRedeem(reward.id)}
                                        sx={{
                                            bgcolor: '#f57f17', '&:hover': { bgcolor: '#e65100' },
                                            textTransform: 'none', fontWeight: 600, borderRadius: 2,
                                        }}
                                    >
                                        {redeeming === reward.id ? 'Redeeming...' : 'Redeem'}
                                    </Button>
                                </Paper>
                            ))}
                        </Stack>
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

// ── Subscriptions Tab ──
const SubscriptionsTab = ({ subscriptions }) => {
    if (subscriptions === undefined || subscriptions === null) {
        return (
            <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Subscriptions</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Your active subscriptions will appear here.
                </Typography>
            </Box>
        );
    }

    const active = subscriptions.filter(s => s.Status === 'ACTIVE');
    const inactive = subscriptions.filter(s => s.Status !== 'ACTIVE');

    if (subscriptions.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>No subscriptions</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    You don't have any subscriptions yet.
                </Typography>
            </Box>
        );
    }

    const first = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : arr || '');

    const renderCard = (sub) => (
        <Paper key={sub.id} variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
            <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h3" component="h3">{first(sub['Plan Name'])}</Typography>
                    <Chip
                        label={sub.Status}
                        size="small"
                        sx={{
                            fontWeight: 700,
                            bgcolor: sub.Status === 'ACTIVE' ? '#e8f5e9' : '#fafafa',
                            color: sub.Status === 'ACTIVE' ? '#2e7d32' : 'text.secondary',
                            border: '1px solid',
                            borderColor: sub.Status === 'ACTIVE' ? '#a5d6a7' : 'divider',
                        }}
                    />
                </Stack>
                {first(sub['Location Name']) && (
                    <Typography variant="body1" color="text.secondary">{first(sub['Location Name'])}</Typography>
                )}
                {first(sub['Frequency']) && (
                    <Typography variant="body2" color="text.secondary">{first(sub['Frequency'])}</Typography>
                )}
                {first(sub['Subscription Start Date']) && (
                    <Typography variant="body2" color="text.secondary">
                        Started {formatOrderDate(first(sub['Subscription Start Date']))}
                    </Typography>
                )}
                {sub.Code && (
                    <Box sx={{ mt: 0.5, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1.5, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Redemption Code</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 2 }}>{sub.Code}</Typography>
                    </Box>
                )}
            </Stack>
        </Paper>
    );

    return (
        <Stack spacing={3}>
            {active.map(renderCard)}
            {inactive.length > 0 && active.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>Past Subscriptions</Typography>
            )}
            {inactive.map(renderCard)}
        </Stack>
    );
};

export const UserDashboard = ({ events, allEvents, orders, loyalty, subscriptions, duplicateNotice, onDismissDuplicateNotice, registerAnotherPlayer, onRegisterAnotherPlayer, onDismissRegisterAnother, onScheduleNew, onViewTransactions, onViewMarketingMaterials, onRedeem }) => {
    const [tab, setTab] = useState(0);
    const [eventView, setEventView] = useState('Active');
    const [redeeming, setRedeeming] = useState(null);

    useEffect(() => {
        trackEventsDashboardViewed();
    }, []);

    const handleRedeem = (rewardId) => {
        setRedeeming(rewardId);
        onRedeem?.(rewardId);
        // Clear after a delay (state machine will refresh loyalty data)
        setTimeout(() => setRedeeming(null), 3000);
    };

    const hasOrders = orders && orders.length > 0;
    const hasLoyalty = loyalty?.enrolled;

    return (
        <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
            {duplicateNotice && (
                <Alert severity="info" onClose={onDismissDuplicateNotice} sx={{ mb: 2 }}>
                    You're already registered for this date. To register for a different date or event, use the button below.
                </Alert>
            )}
            {registerAnotherPlayer && (
                <Alert
                    severity="success"
                    onClose={onDismissRegisterAnother}
                    sx={{ mb: 2 }}
                    action={
                        <Button color="inherit" size="small" variant="outlined" onClick={onRegisterAnotherPlayer}>
                            Register another player
                        </Button>
                    }
                >
                    {registerAnotherPlayer.playerName ? `${registerAnotherPlayer.playerName} is registered` : "You're registered"} for {registerAnotherPlayer.eventName}. Want to register another player?
                </Alert>
            )}
            <Typography variant="h1" component="h1" align="center" sx={{ mb: 2 }}>
                My Account
            </Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    centered
                    sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '1.6rem' } }}
                >
                    <Tab label="Events" />
                    <Tab label="Orders" />
                    <Tab label="Rewards" />
                    <Tab label="Subscriptions" />
                </Tabs>
            </Box>

            {tab === 0 && (
                <EventsTab
                    events={events}
                    allEvents={allEvents}
                    view={eventView}
                    onViewChange={(_, v) => { if (v !== null) setEventView(v); }}
                    onScheduleNew={onScheduleNew}
                    onViewTransactions={onViewTransactions}
                    onViewMarketingMaterials={onViewMarketingMaterials}
                />
            )}

            {tab === 1 && <OrdersTab orders={orders} pointsByOrder={loyalty?.pointsByOrder} />}

            {tab === 2 && (
                <RewardsTab
                    loyalty={loyalty}
                    onRedeem={handleRedeem}
                    redeeming={redeeming}
                />
            )}

            {tab === 3 && <SubscriptionsTab subscriptions={subscriptions} />}
        </Container>
    );
};
