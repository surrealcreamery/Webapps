import React, { useState, useEffect } from 'react';
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

// THEMES
import publicTheme from '@/theme/publicTheme';
import adminTheme from '@/theme/adminTheme';

// CONTEXTS & LAYOUTS
import { LayoutProvider } from '@/contexts/subscription/LayoutContext';
import DefaultLayout    from '@/layouts/default';
import LayoutNoFooter   from '@/layouts/layout-no-footer';
import AdminLayout      from '@/layouts/admin';
import Home             from '@/pages/Home';
import Redeem           from '@/pages/Redeem';

// ADMIN PAGES
import AdminSignIn      from '@/pages/admin/subscription/AdminSignIn';
import Admin            from '@/pages/admin/subscription/Admin';
import Subscriptions    from '@/pages/admin/subscription/Subscriptions';
import Subscribers      from '@/pages/admin/subscription/Subscribers';
import Locations        from '@/pages/admin/core/Locations';
import ThemeEditor      from '@/pages/admin/core/ThemeEditor';
import Access           from '@/pages/admin/core/Access';
import UserPermission   from '@/pages/admin/core/UserPermission';
import PricingModels    from '@/pages/admin/subscription/PricingModels';
import Plans            from '@/pages/admin/subscription/Plans';
import SelectSquarePlan from '@/pages/admin/subscription/SelectSquarePlan';
import ViewSquarePlan   from '@/pages/admin/subscription/ViewSquarePlan';
import Reports          from '@/pages/admin/core/Reports';
import Training         from '@/pages/admin/subscription/Training';
import Training         from '@/pages/admin/subscription/Training';
import Recipes          from '@/pages/admin/core/Recipes';
import DeviceManagement from '@/pages/admin/core/DeviceManagement';

import ProtectedRoute   from '@/components/protected-route/protected-route.jsx';
import {
  useUserPermissions,
  fetchPlans,
  fetchSquarePlans,
  fetchLocations,
  fetchPricingModels
} from '@/contexts/admin/AdminDataContext';

// Cache and Query Client Setup
const cache = createCache({
  key: 'mui',
  insertionPoint: document.querySelector('meta[name="emotion-insertion-point"]'),
});

const queryClient = new QueryClient({
  defaultOptions: { 
    queries: { 
      staleTime: 0, 
      cacheTime: 1000 * 60 * 60 * 24,
      retry: false 
    } 
  }
});
persistQueryClient({
  queryClient,
  persister: createSyncStoragePersister({ storage: window.localStorage }),
  maxAge: Infinity
});

// UIs & Admin Logic
const FullScreenSpinner = () => (
  <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}>
    <CircularProgress sx={{ color:'black' }} />
  </Box>
);

const CenteredCard = ({ children }) => (
  <Box sx={{
    display:'flex',
    justifyContent:'center',
    alignItems:'center',
    height:'100vh',
    bgcolor:'background.default',
    p:3
  }}>
    <Box textAlign="center" bgcolor="white" p={4} borderRadius={2} boxShadow={2}>
      {children}
    </Box>
  </Box>
);

function PrefetchAll() {
  const qc = useQueryClient();
  useEffect(() => {
    qc.prefetchQuery({ queryKey:['admin','plans'], queryFn: fetchPlans });
    qc.prefetchQuery({ queryKey:['admin','squarePlans'], queryFn: fetchSquarePlans });
    qc.prefetchQuery({ queryKey:['admin','locations'], queryFn: fetchLocations });
    qc.prefetchQuery({ queryKey:['admin','pricingModels'], queryFn: fetchPricingModels });
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
  if (isError)   return <CenteredCard><Typography color="error">Error loading permissions.</Typography></CenteredCard>;

  return (
    <AdminLayout fetchedPermissions={perms}>
      <PrefetchAll />
      <Outlet context={{ perms }} />
    </AdminLayout>
  );
}

// THE FIX: A single root layout provides the context to all public pages.
function PublicRootLayout() {
    return (
        <LayoutProvider>
            <ThemeProvider theme={publicTheme}>
                <Outlet />
            </ThemeProvider>
        </LayoutProvider>
    );
}

// Routes definition
const router = createBrowserRouter([
  {
    path: '/signin',
    element: <ThemeProvider theme={adminTheme}><AdminSignIn/></ThemeProvider>,
  },
  {
    // This single parent route now wraps ALL public pages in the provider.
    element: <PublicRootLayout />,
    children: [
      {
        path: '/',
        element: <DefaultLayout />,
        children: [
            {
                index: true,
                element: <Home />,
            },
            {
                path: 'redeem',
                element: <Redeem />,
            }
        ]
      },
      {
        element: <LayoutNoFooter />, // This layout is now also a child of the provider
        children: [
//          { path: 'termsconditions', element: <TermsConditions/> },
//          { path: 'checkout',        element: <Checkout/> },
//          { path: 'bag',             element: <Bag/> },
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

// App entrypoint - Renamed to avoid conflicts.
export default function AppRouter() {
  return (
    <CacheProvider value={cache}>
      <StyledEngineProvider injectFirst>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StyledEngineProvider>
    </CacheProvider>
  );
}

