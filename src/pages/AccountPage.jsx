import React, { useContext, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Box, CircularProgress } from '@mui/material';
import { LayoutContext } from '@/contexts/events/EventsLayoutContext';
import { UserDashboard } from '@/components/events/UserDashboard';
import { LoginFlow } from '@/components/events/LoginFlow';
import { fetchInitialData } from '@/state/events/eventService';

export default function AccountPage() {
  const { fundraiserState, sendToFundraiser, logout } = useContext(LayoutContext);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Ensure events data is loaded (needed for the state machine to leave 'booting')
  useEffect(() => {
    if (!sendToFundraiser || dataLoaded) return;
    const loadData = async () => {
      try {
        const { events, locations } = await fetchInitialData();
        sendToFundraiser({ type: 'DATA.LOADED', events, locations });
      } catch (error) {
        if (fundraiserState?.matches('booting')) {
          sendToFundraiser({ type: 'DATA.FAILED', data: error });
        }
      }
      setDataLoaded(true);
    };
    loadData();
  }, [sendToFundraiser]);

  // Reset machine if it's in an unexpected state (e.g., wizardFlow from previous events interaction)
  useEffect(() => {
    if (!fundraiserState || !sendToFundraiser) return;
    const isExpectedState =
      fundraiserState.matches('booting') ||
      fundraiserState.matches('directory') ||
      fundraiserState.matches('loginFlow') ||
      fundraiserState.matches('userDashboard');
    if (!isExpectedState) {
      sendToFundraiser({ type: 'RESET' });
    }
  }, [sendToFundraiser]);

  // Auto-trigger login flow when landing on /account unauthenticated
  useEffect(() => {
    if (!fundraiserState || !sendToFundraiser) return;
    if (fundraiserState.matches('directory') && !fundraiserState.context.isAuthenticated) {
      sendToFundraiser({ type: 'LOGIN_START' });
    }
    if (fundraiserState.matches('directory') && fundraiserState.context.isAuthenticated) {
      sendToFundraiser({ type: 'GO_TO_DASHBOARD' });
    }
  }, [fundraiserState?.value, sendToFundraiser]);

  if (!fundraiserState || !fundraiserState.context) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Loading states
  if (
    fundraiserState.matches('booting') ||
    fundraiserState.matches('userDashboard.ensureSession') ||
    fundraiserState.matches('userDashboard.creatingSessionInline') ||
    fundraiserState.matches('userDashboard.loadingEvents')
  ) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}>
        <Helmet><title>My Account | Surreal Creamery</title></Helmet>
        <CircularProgress />
      </Box>
    );
  }

  // Login flow
  if (fundraiserState.matches('loginFlow')) {
    return (
      <Box sx={{ width: '100%', mx: 'auto' }}>
        <Helmet><title>My Account | Surreal Creamery</title></Helmet>
        <Box sx={{ maxWidth: 'sm', width: '100%', mx: 'auto', pt: 0, pb: 3, px: 3 }}>
          <LoginFlow send={sendToFundraiser} context={fundraiserState} />
        </Box>
      </Box>
    );
  }

  // Dashboard
  if (
    fundraiserState.matches('userDashboard.idle') ||
    fundraiserState.matches('userDashboard.redeemingReward') ||
    fundraiserState.matches('userDashboard.refreshingLoyalty')
  ) {
    return (
      <Box sx={{ width: '100%', mx: 'auto' }}>
        <Helmet><title>My Account | Surreal Creamery</title></Helmet>
        <UserDashboard
          events={fundraiserState.context.registeredEvents}
          allEvents={fundraiserState.context.fundraiserEvents}
          orders={fundraiserState.context.orders}
          loyalty={fundraiserState.context.loyalty}
          subscriptions={fundraiserState.context.subscriptions}
          onScheduleNew={() => sendToFundraiser({ type: 'SCHEDULE_NEW' })}
          onViewTransactions={(eventId) => sendToFundraiser({ type: 'VIEW_TRANSACTIONS', eventId })}
          onViewMarketingMaterials={(eventId) => sendToFundraiser({ type: 'VIEW_MARKETING_MATERIALS', eventId })}
          onRedeem={(rewardId) => sendToFundraiser({ type: 'REDEEM_REWARD', rewardId })}
        />
      </Box>
    );
  }

  // Fallback: loading
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}>
      <Helmet><title>My Account | Surreal Creamery</title></Helmet>
      <CircularProgress />
    </Box>
  );
}
