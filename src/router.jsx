import React, { useState, useEffect, useMemo } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet
} from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  Box,
  Typography,
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
  QueryClientProvider,
  useQueryClient
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
import adminTheme from '@/theme/adminTheme';

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
import EventsHome from '@/pages/Events';

// 3. Catering App Components
import { LayoutProvider as CateringLayoutProvider } from '@/contexts/catering/CateringLayoutContext';
import CateringLayout from '@/layouts/catering/cateringLayout';
import CateringBareLayout from '@/layouts/catering/cateringBareLayout'; // For embedding in Commerce
import CateringHome from '@/pages/Catering';

// 4. Commerce App Components
import { LayoutProvider as CommerceLayoutProvider } from '@/contexts/commerce/CommerceLayoutContext';
import { ShopifyProvider } from '@/contexts/commerce/ShopifyContext_GraphQL'; // ← ADDED: Shopify integration
import { CheckoutProvider } from '@/components/commerce/CheckoutContext'; // ← NEW: Checkout context
import CommerceLayout from '@/layouts/commerce/commerceLayout';
import Commerce from '@/pages/Commerce';

// --- ADMIN COMPONENTS ---
import AdminLayout from '@/layouts/admin/adminLayout';
import AdminSignIn from '@/pages/admin/subscription/AdminSignIn';
import Admin from '@/pages/admin/subscription/Admin';
import Subscriptions from '@/pages/admin/subscription/Subscriptions';
import Subscribers from '@/pages/admin/subscription/Subscribers';
import Locations from '@/pages/admin/core/Locations';
import ThemeEditor from '@/pages/admin/core/ThemeEditor';
import Access from '@/pages/admin/core/Access';
import UserPermission from '@/pages/admin/core/UserPermission';
import PricingModels from '@/pages/admin/subscription/PricingModels';
import Plans from '@/pages/admin/subscription/Plans';
import SelectSquarePlan from '@/pages/admin/subscription/SelectSquarePlan';
import ViewSquarePlan from '@/pages/admin/subscription/ViewSquarePlan';
import Reports from '@/pages/admin/core/Reports';
import Training from '@/pages/admin/subscription/Training';
import Recipes from '@/pages/admin/core/Recipes';
import DeviceManagement from '@/pages/admin/core/DeviceManagement';

import ProtectedRoute from '@/components/protected-route/protected-route.jsx';
import {
  useUserPermissions,
  fetchPlans,
  fetchSquarePlans,
  fetchLocations,
  fetchPricingModels
} from '@/contexts/admin/AdminDataContext';

// --- APP CONFIGURATION OBJECT ---
const appConfigs = {
  SUBSCRIPTION: {
    // URL: https://www.dollarbobaclub.com
    LayoutProvider: SubscriptionLayoutProvider,
    Layout: SubscriptionsLayout,
    HomePage: SubscriptionHome,
    gtmId: null, // Add GTM ID when ready
    ga4Id: null, // Add GA4 ID when ready
    additionalRoutes: [],
  },
  EVENTS: {
    // URL: https://events.surrealcreamery.com
    LayoutProvider: EventsLayoutProvider,
    Layout: EventsLayout,
    HomePage: EventsHome,
    gtmId: null, // Add GTM ID when ready
    ga4Id: null, // Add GA4 ID when ready
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
    gtmId: null, // Add GTM ID when ready
    ga4Id: null, // Add GA4 ID when ready
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
        path: 'merchandise',
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

// Helper Components
const FullScreenSpinner = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress sx={{ color: 'black' }} />
  </Box>
);

const CenteredCard = ({ children }) => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default', p: 3 }}>
    <Box textAlign="center" bgcolor="white" p={4} borderRadius={2} boxShadow={2}>
      {children}
    </Box>
  </Box>
);

// Admin-specific Logic
function PrefetchAll() {
  const qc = useQueryClient();
  useEffect(() => {
    qc.prefetchQuery({ queryKey: ['admin', 'plans'], queryFn: fetchPlans });
    qc.prefetchQuery({ queryKey: ['admin', 'squarePlans'], queryFn: fetchSquarePlans });
    qc.prefetchQuery({ queryKey: ['admin', 'locations'], queryFn: fetchLocations });
    qc.prefetchQuery({ queryKey: ['admin', 'pricingModels'], queryFn: fetchPricingModels });
  }, [qc]);
  return null;
}

function AuthLayout() {
  const [authState, setAuthState] = useState('checking');
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), u => setAuthState(u ? 'signed-in' : 'signed-out'));
    return unsub;
  }, []);

  if (authState === 'checking') return <FullScreenSpinner />;
  
  return authState === 'signed-out'
    ? <Navigate to="/signin" />
    : <Outlet />;
}

function AdminRoutes() {
  const { data: perms = {}, isLoading, isError } =
    useUserPermissions(getAuth().currentUser?.email || '');
  
  if (isLoading) return <FullScreenSpinner />;
  if (isError) return <CenteredCard><Typography color="error">Error loading permissions.</Typography></CenteredCard>;

  return (
    <AdminLayout fetchedPermissions={perms}>
      <PrefetchAll />
      <Outlet context={{ perms }} />
    </AdminLayout>
  );
}

// Dynamic Public Root Layout
// ✅ UPDATED: Added conditional ShopifyProvider for Commerce mode
// ✅ UPDATED: Added CateringLayoutProvider for Commerce mode (so header can access catering state)
function PublicRootLayout() {
    const AppLayoutProvider = selectedApp.LayoutProvider;

    // If Commerce mode, wrap with ShopifyProvider, CheckoutProvider, and CateringLayoutProvider
    // CateringLayoutProvider is needed at this level so the header can access catering cart/state
    if (VITE_APP_MODE === 'COMMERCE') {
        return (
            <ShopifyProvider>
                <CheckoutProvider>
                    <CateringLayoutProvider>
                        <AppLayoutProvider>
                            <ThemeProvider theme={publicTheme}>
                                <Outlet />
                            </ThemeProvider>
                        </AppLayoutProvider>
                    </CateringLayoutProvider>
                </CheckoutProvider>
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

// Routes definition
const router = createBrowserRouter([
  {
    path: '/signin',
    element: <ThemeProvider theme={adminTheme}><AdminSignIn/></ThemeProvider>,
  },
  {
    element: <PublicRootLayout />,
    children: [
      {
        path: '/',
        element: React.createElement(selectedApp.Layout),
        children: [
            {
                index: true,
                element: React.createElement(selectedApp.HomePage),
            },
            {
                path: 'redeem',
                element: <Redeem />,
            },
            // ✅ Dynamically add app-specific routes
            ...selectedApp.additionalRoutes
        ]
      },
    ]
  },
  {
    path: '/admin',
    element: <AuthLayout/>,
    children: [
      {
        element: <ThemeProvider theme={adminTheme}><AdminRoutes/></ThemeProvider>,
        children: [
          { index: true, element: <ProtectedRoute permission="Dashboard"><Admin/></ProtectedRoute> },
          { path: 'subscriptions',      element: <ProtectedRoute permission="Subscriptions"><Subscriptions/></ProtectedRoute> },
          { path: 'subscribers',        element: <ProtectedRoute permission="Subscribers"><Subscribers/></ProtectedRoute> },
          { path: 'locations',          element: <ProtectedRoute permission="Locations"><Locations/></ProtectedRoute> },
          { path: 'theme-editor',       element: <ProtectedRoute permission="Theme Editor"><ThemeEditor/></ProtectedRoute> },
          { path: 'access',             element: <ProtectedRoute permission="Access"><Access/></ProtectedRoute> },
          { path: 'access/:email',      element: <ProtectedRoute permission="User Permissions"><UserPermission/></ProtectedRoute> },
          { path: 'pricing-models',     element: <ProtectedRoute permission="Pricing Models"><PricingModels/></ProtectedRoute> },
          { path: 'plans',              element: <ProtectedRoute permission="Plans"><Plans/></ProtectedRoute> },
          { path: 'select-square-plan', element: <ProtectedRoute permission="Plans"><SelectSquarePlan/></ProtectedRoute> },
          { path: 'view-square-plan/:planId/:variationId', element: <ProtectedRoute permission="Plans"><ViewSquarePlan/></ProtectedRoute> },
          { path: 'reports',            element: <ProtectedRoute permission="Reports"><Reports/></ProtectedRoute> },
          { path: 'training',           element: <ProtectedRoute permission="Training"><Training/></ProtectedRoute> },
          { path: 'recipes',            element: <ProtectedRoute permission="Recipes"><Recipes/></ProtectedRoute> },
          { path: 'devices',            element: <ProtectedRoute permission="Device Management"><DeviceManagement/></ProtectedRoute> },
        ]
      }
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
