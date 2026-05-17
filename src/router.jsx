import React, { useEffect, useRef, useCallback } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useRouteError,
  useLocation,
} from 'react-router-dom';
import {
  Box,
  CircularProgress
} from '@mui/material';
import {
  ThemeProvider,
  StyledEngineProvider
} from '@mui/material/styles';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import {
  QueryClient,
  QueryClientProvider
} from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { HelmetProvider } from 'react-helmet-async';

// --- APP CONFIGURATION ---
// ✅ Set the desired application mode here.
// Options: 'SUBSCRIPTION', 'EVENTS', 'CATERING', 'COMMERCE'
const VITE_APP_MODE = 'COMMERCE';

// THEMES
import publicTheme from '@/theme/publicTheme';

// --- SHARED PUBLIC COMPONENTS ---
import Redeem from '@/pages/Redeem';

// --- GA4 ---
import { initGA4 } from '@/components/google-tag-manager/google-tag-manager';

// --- Analytics (PostHog + GA4 event activation) ---
import { initAnalytics } from '@/services/analytics';
import { track } from '@/services/eventTracker';

// --- APP-SPECIFIC COMPONENTS ---

// 1. Subscription App Components
import { LayoutProvider as SubscriptionLayoutProvider } from '@/contexts/subscriptions/SubscriptionsLayoutContext';
import SubscriptionsLayout from '@/layouts/subscriptions/subscriptionsLayout';
import SubscriptionHome from '@/pages/Subscriptions';

// 2. Events & Fundraisers App Components
import { LayoutProvider as EventsLayoutProvider } from '@/contexts/events/EventsLayoutContext';
import EventsLayout from '@/layouts/events/eventsLayout';
import EventsBareLayout from '@/layouts/events/eventsBareLayout'; // For embedding in Commerce
import SubscriptionsBareLayout from '@/layouts/subscriptions/subscriptionsBareLayout'; // For embedding in Commerce
import EventsHome from '@/pages/Events';

// 3. Catering App Components
import { LayoutProvider as CateringLayoutProvider } from '@/contexts/catering/CateringLayoutContext';
import CateringLayout from '@/layouts/catering/cateringLayout';
import CateringBareLayout from '@/layouts/catering/cateringBareLayout'; // For embedding in Commerce
import CateringHome from '@/pages/Catering';

// 4. Commerce App Components
import { LayoutProvider as CommerceLayoutProvider } from '@/contexts/commerce/CommerceLayoutContext';
import { CatalogProvider } from '@/contexts/commerce/CatalogContext';
import { SegmentProvider } from '@/contexts/commerce/SegmentContext';
import { WebSocketProvider } from '@/contexts/commerce/WebSocketContext';
import { NotificationProvider } from '@/contexts/commerce/NotificationContext';
import { CheckoutProvider } from '@/components/commerce/CheckoutContext';
import CommerceLayout from '@/layouts/commerce/commerceLayout';

import Commerce from '@/pages/Commerce';
import CheckoutPage from '@/pages/CheckoutPage';
import DeliveryCheckPage from '@/pages/DeliveryCheckPage';
import AccountPage from '@/pages/AccountPage';

import SignageLayout from '@/layouts/commerce/signageLayout';
import Signage from '@/pages/Signage';

import KioskLayout from '@/layouts/commerce/kioskLayout';
import { KioskOverlay } from '@/components/kiosk/KioskOverlay';

// --- APP CONFIGURATION OBJECT ---
const appConfigs = {
  SUBSCRIPTION: {
    // URL: https://www.dollarbobaclub.com
    LayoutProvider: SubscriptionLayoutProvider,
    Layout: SubscriptionsLayout,
    HomePage: SubscriptionHome,

    ga4Id: null,
    additionalRoutes: [],
  },
  EVENTS: {
    // URL: https://events.surrealcreamery.com
    LayoutProvider: EventsLayoutProvider,
    Layout: EventsLayout,
    HomePage: EventsHome,

    ga4Id: null,
    additionalRoutes: [
      {
        path: 'login',
        element: <EventsHome />,
      }
    ],
  },
  CATERING: {
    LayoutProvider: CateringLayoutProvider,
    Layout: CateringLayout,
    HomePage: CateringHome,

    ga4Id: null,
    additionalRoutes: [],
  },
  COMMERCE: {
    // URL: tokidoki.surrealcreamery.com (or similar)
    LayoutProvider: CommerceLayoutProvider,
    Layout: CommerceLayout,
    HomePage: Commerce,
    ga4Id: 'G-CHP81EGC14',
    additionalRoutes: [
      {
        path: 'desserts',
        element: <Commerce />,
      },
      {
        path: 'collectibles',
        element: <Commerce />,
      },
      {
        path: 'category/:categoryId',
        element: <Commerce />,
      },
      {
        path: 'product/:productId',
        element: <Commerce />,
      },
      {
        path: 'checkout',
        element: <CheckoutPage />,
      },
      {
        path: 'delivery-check',
        element: <DeliveryCheckPage />,
      },
      {
        path: 'account',
        element: <AccountPage />,
      },
      // Catering app - runs with its own state machine (uses Commerce header/footer)
      {
        path: 'catering',
        element: <CateringBareLayout />,
        children: [
          {
            index: true,
            element: <CateringHome />,
          }
        ],
      },
      // Events app - runs with its own state machine (uses Commerce header/footer)
      {
        path: 'events',
        element: <EventsBareLayout />,
        children: [
          {
            index: true,
            element: <EventsHome />,
          },
          {
            path: 'login',
            element: <EventsHome />,
          }
        ],
      },
      // Subscriptions app - runs with its own state machine (uses Commerce header/footer)
      {
        path: 'subscriptions',
        element: <SubscriptionsBareLayout />,
        children: [
          {
            index: true,
            element: <SubscriptionHome />,
          },
          {
            path: 'redeem',
            element: <Redeem />,
          }
        ],
      },
    ],
  },
};

const selectedApp = appConfigs[VITE_APP_MODE];

// Initialize GA4 for selected app (if configured)
if (selectedApp.ga4Id) {
  initGA4(selectedApp.ga4Id);
}

// Initialize PostHog analytics (autocapture + session replay)
initAnalytics();

// Cache and Query Client Setup
const cache = createCache({
  key: 'mui',
  insertionPoint: document.querySelector('meta[name="emotion-insertion-point"]'),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, cacheTime: 1000 * 60 * 60 * 24, retry: false }
  }
});
persistQueryClient({
  queryClient,
  persister: createSyncStoragePersister({ storage: window.localStorage }),
  maxAge: Infinity
});

// Dynamic Public Root Layout
function PublicRootLayout() {
    const AppLayoutProvider = selectedApp.LayoutProvider;
    const location = useLocation();
    const depthMilestones = useRef(new Set());

    // Page view tracking on route change
    useEffect(() => {
        track('page_view', { path: location.pathname });
        depthMilestones.current = new Set();
    }, [location.pathname]);

    // Scroll depth tracking (25/50/75/100% milestones)
    const handleScroll = useCallback(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 0) return;
        const pct = Math.round((scrollTop / docHeight) * 100);
        const thresholds = [25, 50, 75, 100];
        for (const t of thresholds) {
            if (pct >= t && !depthMilestones.current.has(t)) {
                depthMilestones.current.add(t);
                track('scroll_depth', { depth: t, page: location.pathname });
            }
        }
    }, [location.pathname]);

    useEffect(() => {
        let rafId = null;
        const onScroll = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => { handleScroll(); rafId = null; });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => { window.removeEventListener('scroll', onScroll); if (rafId) cancelAnimationFrame(rafId); };
    }, [handleScroll]);

    // Capture UTM params + ad click IDs on first landing (first-touch within session)
    // Also persist to localStorage.attributionTouches for cross-session multi-touch attribution
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid', 'sclid', 'campaign_id', 'adset_id', 'ad_id'];
        const attribution = {};
        keys.forEach(k => {
            // Support both underscore (utm_medium) and hyphen (utm-medium) formats
            const val = params.get(k) || params.get(k.replace(/_/g, '-'));
            if (val) attribution[k] = val;
        });
        if (document.referrer) attribution.referrer = document.referrer;
        attribution.landingPage = window.location.pathname;
        attribution.capturedAt = new Date().toISOString();
        const hasAttribution = Object.keys(attribution).length > 2; // more than just landingPage + capturedAt
        // Session-level first-touch (backward compat)
        if (hasAttribution && !sessionStorage.getItem('attribution')) {
            sessionStorage.setItem('attribution', JSON.stringify(attribution));
        }
        // Cross-session multi-touch: append to localStorage array (max 20, dedupe reloads)
        if (hasAttribution) {
            try {
                const touches = JSON.parse(localStorage.getItem('attributionTouches') || '[]');
                const last = touches[touches.length - 1];
                const isDupe = last && last.utm_source === attribution.utm_source
                    && last.utm_medium === attribution.utm_medium
                    && last.utm_campaign === attribution.utm_campaign
                    && last.utm_content === attribution.utm_content
                    && last.utm_term === attribution.utm_term;
                if (!isDupe) {
                    touches.push(attribution);
                    if (touches.length > 20) touches.splice(0, touches.length - 20);
                    localStorage.setItem('attributionTouches', JSON.stringify(touches));
                }
            } catch { /* localStorage unavailable */ }
        }
    }, []);

    // If Commerce mode, wrap with CatalogProvider, CheckoutProvider, and all embedded app providers
    // These providers are needed at this level so the header can access cart/state
    if (VITE_APP_MODE === 'COMMERCE') {
        return (
            <CatalogProvider>
                <WebSocketProvider>
                <SegmentProvider>
                <NotificationProvider>
                <CheckoutProvider>
                    <CateringLayoutProvider>
                        <EventsLayoutProvider>
                            <SubscriptionLayoutProvider>
                                <AppLayoutProvider>
                                    <ThemeProvider theme={publicTheme}>
                                        <Outlet />
                                    </ThemeProvider>
                                </AppLayoutProvider>
                            </SubscriptionLayoutProvider>
                        </EventsLayoutProvider>
                    </CateringLayoutProvider>
                </CheckoutProvider>
                </NotificationProvider>
                </SegmentProvider>
                </WebSocketProvider>
            </CatalogProvider>
        );
    }

    // For other modes, use existing structure
    return (
        <AppLayoutProvider>
            <ThemeProvider theme={publicTheme}>
                <Outlet />
            </ThemeProvider>
        </AppLayoutProvider>
    );
}

// Route error boundary — keeps header/footer visible and shows the actual error
function RouteErrorBoundary() {
  const error = useRouteError();
  console.error('[RouteErrorBoundary]', error);
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <h2>Something went wrong</h2>
      <pre style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto', whiteSpace: 'pre-wrap', color: 'red' }}>
        {error?.message || String(error)}
        {error?.stack && `\n\n${error.stack}`}
      </pre>
    </Box>
  );
}

// Routes definition
const router = createBrowserRouter([
  {
    element: <PublicRootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/',
        element: React.createElement(selectedApp.Layout),
        errorElement: <RouteErrorBoundary />,
        children: [
            {
                index: true,
                element: React.createElement(selectedApp.HomePage),
                errorElement: <RouteErrorBoundary />,
            },
            {
                path: 'redeem',
                element: <Redeem />,
                errorElement: <RouteErrorBoundary />,
            },
            // Dynamically add app-specific routes
            ...selectedApp.additionalRoutes.map(route => ({
                ...route,
                errorElement: route.errorElement || <RouteErrorBoundary />,
            }))
        ]
      },
      // Signage route — fullscreen TV display, no header/footer
      ...(VITE_APP_MODE === 'COMMERCE' ? [{
        path: '/signage/:configId',
        element: <SignageLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            index: true,
            element: <Signage />,
            errorElement: <RouteErrorBoundary />,
          }
        ]
      }] : []),
      // Kiosk route — Commerce wrapped in KioskOverlay for tablet ordering
      ...(VITE_APP_MODE === 'COMMERCE' ? [{
        path: '/kiosk',
        element: <KioskLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            index: true,
            element: <KioskOverlay><Commerce /></KioskOverlay>,
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'product/:productId',
            element: <KioskOverlay><Commerce /></KioskOverlay>,
            errorElement: <RouteErrorBoundary />,
          },
        ]
      }] : []),
    ]
  },
  { path: '*', element: <Navigate to='/' replace/> }
], {
  future: { v7_startTransition: true }
});

// App entrypoint
export default function AppRouter() {
  return (
    <HelmetProvider>
      <CacheProvider value={cache}>
        <StyledEngineProvider injectFirst>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </StyledEngineProvider>
      </CacheProvider>
    </HelmetProvider>
  );
}
