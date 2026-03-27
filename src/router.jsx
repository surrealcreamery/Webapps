import React from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useRouteError
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

// --- GTM ---
import { initGTM } from '@/components/google-tag-manager/google-tag-manager';

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
import { ShopifyProvider } from '@/contexts/commerce/ShopifyContext_GraphQL';
import { CatalogProvider } from '@/contexts/commerce/CatalogContext';
import { CheckoutProvider } from '@/components/commerce/CheckoutContext';
import CommerceLayout from '@/layouts/commerce/commerceLayout';
import KioskLayout from '@/layouts/commerce/kioskLayout';
import Commerce from '@/pages/Commerce';
import CheckoutPage from '@/pages/CheckoutPage';
import DeliveryCheckPage from '@/pages/DeliveryCheckPage';
import Kiosk from '@/pages/Kiosk';

// --- APP CONFIGURATION OBJECT ---
const appConfigs = {
  SUBSCRIPTION: {
    // URL: https://www.dollarbobaclub.com
    LayoutProvider: SubscriptionLayoutProvider,
    Layout: SubscriptionsLayout,
    HomePage: SubscriptionHome,
    gtmId: null,
    ga4Id: null,
    additionalRoutes: [],
  },
  EVENTS: {
    // URL: https://events.surrealcreamery.com
    LayoutProvider: EventsLayoutProvider,
    Layout: EventsLayout,
    HomePage: EventsHome,
    gtmId: null,
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
    gtmId: null,
    ga4Id: null,
    additionalRoutes: [],
  },
  COMMERCE: {
    // URL: tokidoki.surrealcreamery.com (or similar)
    LayoutProvider: CommerceLayoutProvider,
    Layout: CommerceLayout,
    HomePage: Commerce,
    gtmId: 'GTM-T5KTLSWV',
    ga4Id: 'G-KK2CZRQQQ6',
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

// Initialize GTM and GA4 for selected app (if configured)
if (selectedApp.gtmId || selectedApp.ga4Id) {
  initGTM(selectedApp.gtmId, selectedApp.ga4Id);
}

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

    // If Commerce mode, wrap with ShopifyProvider, CheckoutProvider, and all embedded app providers
    // These providers are needed at this level so the header can access cart/state
    if (VITE_APP_MODE === 'COMMERCE') {
        return (
            <ShopifyProvider>
                <CatalogProvider>
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
                </CatalogProvider>
            </ShopifyProvider>
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
      // Kiosk route — no header/footer, dedicated kiosk experience
      ...(VITE_APP_MODE === 'COMMERCE' ? [{
        path: '/kiosk',
        element: <KioskLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            index: true,
            element: <Kiosk />,
            errorElement: <RouteErrorBoundary />,
          }
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
