import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Box, Typography, Button, CircularProgress, Alert, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { EVENTS_API_URL } from '@/constants/events/eventsConstants';

// One-click spot-confirmation landing page. Reached from the SMS reminder link:
//   /confirm-spot?c=<confirmCode>            (short friendly code — preferred)
//   /confirm-spot?g=<guestId>&r=<registrationId>&t=<token>   (legacy fallback)
// Auto-confirms on load and shows the result.

const readParams = () => {
  const p = new URLSearchParams(window.location.search);
  return {
    code: p.get('c') || p.get('code') || '',
    guestId: p.get('g') || p.get('guestId') || '',
    registrationId: p.get('r') || p.get('registrationId') || '',
    token: p.get('t') || p.get('token') || '',
  };
};

const ConfirmSpot = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading | confirmed | waitlisted | not_open | closed | error
  const [message, setMessage] = useState('');

  const { code, guestId, registrationId, token } = readParams();

  const confirm = useCallback(async () => {
    const hasCode = !!code;
    const hasLegacy = guestId && registrationId && token;
    if (!hasCode && !hasLegacy) {
      setPhase('error');
      setMessage('This confirmation link is missing information. Please use the exact link from your text message.');
      return;
    }
    setPhase('loading');
    try {
      const body = hasCode
        ? { action: 'confirmEventSpot', code }
        : { action: 'confirmEventSpot', guestId, registrationId, token };
      const res = await fetch(EVENTS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (data.spotStatus === 'confirmed' || data.status === 'ok') {
        setPhase('confirmed');
        setMessage(data.message || 'Your spot is confirmed. See you there!');
      } else if (data.status === 'full' || data.spotStatus === 'waitlisted') {
        setPhase('waitlisted');
        setMessage(data.message || "All seats are currently full — you're on the waitlist and we'll text you if a spot opens up.");
      } else if (data.status === 'not_open') {
        setPhase('not_open');
        setMessage(data.message || 'Confirmation is not open yet. Please use the link again once your window opens.');
      } else if (data.status === 'closed') {
        setPhase('closed');
        setMessage(data.message || 'The confirmation window has closed for this event.');
      } else {
        setPhase('error');
        setMessage(data.message || data.error || 'We could not confirm your spot. Please try again or contact us.');
      }
    } catch (err) {
      setPhase('error');
      setMessage('Something went wrong reaching our server. Please try again in a moment.');
    }
  }, [code, guestId, registrationId, token]);

  useEffect(() => {
    confirm();
  }, [confirm]);

  const severity = phase === 'confirmed' ? 'success'
    : phase === 'waitlisted' ? 'info'
    : phase === 'not_open' ? 'warning'
    : phase === 'closed' ? 'warning'
    : 'error';

  const heading = phase === 'confirmed' ? "You're all set! 🎉"
    : phase === 'waitlisted' ? "You're on the waitlist"
    : phase === 'not_open' ? 'Almost there'
    : phase === 'closed' ? 'Window closed'
    : 'Confirm your spot';

  return (
    <>
      <Helmet><title>Confirm Your Spot | Surreal Creamery</title></Helmet>
      <Box sx={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, borderRadius: 3, maxWidth: 460, width: '100%', textAlign: 'center' }}>
          {phase === 'loading' ? (
            <Box sx={{ py: 4 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }} color="text.secondary">Confirming your spot…</Typography>
            </Box>
          ) : (
            <>
              <Typography variant="h5" fontWeight={700} gutterBottom>{heading}</Typography>
              <Alert severity={severity} sx={{ textAlign: 'left', mb: 3 }}>{message}</Alert>
              {(phase === 'error' || phase === 'not_open') && (
                <Button variant="contained" onClick={confirm} sx={{ mr: 1 }}>Try again</Button>
              )}
              <Button variant={phase === 'confirmed' || phase === 'waitlisted' ? 'contained' : 'text'} onClick={() => navigate('/account')}>
                View my events
              </Button>
            </>
          )}
        </Paper>
      </Box>
    </>
  );
};

export default ConfirmSpot;
