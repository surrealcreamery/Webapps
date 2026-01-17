import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import {
  Box,
  Typography,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
  Collapse,
  useMediaQuery,
  ToggleButtonGroup,
  ToggleButton,
  Snackbar,
  Alert
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { Icon } from '@iconify/react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useOrdersWebSocket } from '@/hooks/useOrdersWebSocket';

// Iconify icon wrapper for consistent sizing
const Iconify = ({ icon, width = 24, sx, ...other }) => (
  <Box
    component={Icon}
    icon={icon}
    sx={{ width, height: width, flexShrink: 0, ...sx }}
    {...other}
  />
);
import UUIDEntryGate from '@/pages/admin/subscription/UUIDEntryGate';
import surrealLogo from '@/assets/images/svg/surreal-brandmark.svg';
import surrealWordmark from '@/assets/images/svg/surreal-wordmark.svg';

// Layout constants
const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 88;
const HEADER_HEIGHT = 80;

export const routeNames = {
  '/admin':                      'Dashboard',
  '/admin/pricing-models':       'Pricing Models',
  '/admin/plans':                'Plans',
  '/admin/subscriptions':        'Subscriptions',
  '/admin/subscribers':          'Subscribers',
  '/admin/locations':            'Locations',
  '/admin/theme-editor':         'Theme Editor',
  '/admin/access':               'Access',
  '/admin/access/:userId':       'User Permissions',
  '/admin/reports':              'Reports',
  '/admin/delivery-orders':      'In-store Orders',
  '/admin/training':             'Training',
  '/admin/recipes':              'Recipes',
  '/admin/select-square-plan':   'Select a Square Plan',
  '/admin/view-square-plan/:planId/:variationId':  'View Plan',
  '/admin/devices':              'Device Management',
};

// Sidebar content component
function SidebarContent({ user, navLinks, fetchedPermissions, location, onSignOut, isCollapsed, onClose, showCloseButton }) {
  const theme = useTheme();

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      bgcolor: theme.palette.background.paper,
    }}>
      {/* Logo area */}
      <Box sx={{
        p: isCollapsed ? 2 : 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        minHeight: HEADER_HEIGHT,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            component="img"
            src={surrealLogo}
            alt="Surreal"
            sx={{
              width: 40,
              height: 40,
              objectFit: 'contain',
            }}
          />
          {!isCollapsed && (
            <Box
              component="img"
              src={surrealWordmark}
              alt="Surreal"
              sx={{
                height: 36,
                objectFit: 'contain',
              }}
            />
          )}
        </Box>
        {/* Close button for mobile */}
        {showCloseButton && onClose && (
          <IconButton
            onClick={onClose}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                bgcolor: alpha(theme.palette.grey[500], 0.08),
              },
            }}
          >
            <Iconify icon="solar:close-circle-bold" width={24} />
          </IconButton>
        )}
      </Box>

      {/* User info */}
      {user && (
        <Box sx={{
          mx: isCollapsed ? 1 : 2.5,
          mb: 2,
          p: isCollapsed ? 1 : 2,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.grey[500], 0.08),
          display: 'flex',
          alignItems: 'center',
          flexDirection: isCollapsed ? 'column' : 'row',
        }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: 'black',
              color: 'white',
              fontSize: '1.6rem',
              fontWeight: 600,
            }}
          >
            {user.displayName?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          {!isCollapsed && (
            <Box sx={{ ml: 1.5, overflow: 'hidden' }}>
              <Typography
                variant="subtitle2"
                noWrap
                sx={{ fontWeight: 600, color: theme.palette.text.primary }}
              >
                {user.displayName || 'Admin User'}
              </Typography>
              <Typography
                variant="body2"
                noWrap
                sx={{ color: theme.palette.text.secondary, fontSize: '1.2rem' }}
              >
                {user.email}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ flex: 1, overflow: 'auto', px: isCollapsed ? 1 : 2 }}>
        <List disablePadding>
          {navLinks.map(({ text, icon, path, permission }) => {
            const sectionPermissions = fetchedPermissions[permission] || {};
            const hasAccess = sectionPermissions.view === true || sectionPermissions.access === true;

            if (!hasAccess) return null;

            const isActive = path === '/admin'
              ? location.pathname === path
              : location.pathname.startsWith(path);

            return (
              <ListItemButton
                key={text}
                component={Link}
                to={path}
                sx={{
                  minHeight: 44,
                  borderRadius: 1,
                  mb: 0.5,
                  px: isCollapsed ? 1.5 : 2,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                  bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                  '&:hover': {
                    bgcolor: isActive
                      ? alpha(theme.palette.primary.main, 0.16)
                      : alpha(theme.palette.grey[500], 0.08),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: isCollapsed ? 0 : 36,
                    mr: isCollapsed ? 0 : 2,
                    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                    justifyContent: 'center',
                  }}
                >
                  <Iconify icon={icon} width={22} />
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText
                    primary={text}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  />
                )}
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      {/* Sign out button */}
      <Box sx={{ p: isCollapsed ? 1 : 2, mt: 'auto' }}>
        <Divider sx={{ mb: 2 }} />
        <ListItemButton
          onClick={onSignOut}
          sx={{
            minHeight: 44,
            borderRadius: 1,
            px: isCollapsed ? 1.5 : 2,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            color: theme.palette.text.secondary,
            '&:hover': {
              bgcolor: alpha(theme.palette.error.main, 0.08),
              color: theme.palette.error.main,
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: isCollapsed ? 0 : 36,
              mr: isCollapsed ? 0 : 2,
              color: 'inherit',
              justifyContent: 'center',
            }}
          >
            <Iconify icon="solar:logout-2-bold-duotone" width={22} />
          </ListItemIcon>
          {!isCollapsed && (
            <ListItemText
              primary="Sign Out"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          )}
        </ListItemButton>
      </Box>
    </Box>
  );
}

export default function AdminLayout({ children, fetchedPermissions }) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams();
  const auth = getAuth();
  const user = auth.currentUser;

  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const authKey = user ? `deviceAuthenticated_${user.uid}` : null;
    return authKey ? localStorage.getItem(authKey) === 'true' : false;
  });

  // Wake Lock state (PWA mode only) - defaults to ON
  const [wakeLockEnabled, setWakeLockEnabled] = useState(() => {
    const stored = localStorage.getItem('wakeLockEnabled');
    // Default to true if not explicitly set to false
    return stored !== 'false';
  });
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef(null);

  // Persist wake lock preference
  useEffect(() => {
    localStorage.setItem('wakeLockEnabled', wakeLockEnabled.toString());
  }, [wakeLockEnabled]);

  // Detect if running as installed PWA
  const [isPWA, setIsPWA] = useState(false);
  useEffect(() => {
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true  // iOS Safari
        || document.referrer.includes('android-app://');
      setIsPWA(isStandalone);
    };
    checkPWA();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkPWA);
    return () => mediaQuery.removeEventListener('change', checkPWA);
  }, []);

  // Screen Wake Lock - keeps tablet awake
  useEffect(() => {
    let isMounted = true;

    const requestWakeLock = async () => {
      if (!('wakeLock' in navigator)) {
        console.warn('[WakeLock] Wake Lock API not supported');
        return;
      }

      try {
        // Release existing lock first
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
        }

        wakeLockRef.current = await navigator.wakeLock.request('screen');
        if (isMounted) setWakeLockActive(true);
        console.log('[WakeLock] Screen wake lock acquired');

        wakeLockRef.current.addEventListener('release', () => {
          console.log('[WakeLock] Screen wake lock was released');
          if (isMounted) setWakeLockActive(false);
        });
      } catch (err) {
        console.error('[WakeLock] Failed to acquire:', err.name, err.message);
        if (isMounted) setWakeLockActive(false);
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch (err) {
          console.log('[WakeLock] Release error (may already be released):', err);
        }
        wakeLockRef.current = null;
        if (isMounted) setWakeLockActive(false);
      }
    };

    if (wakeLockEnabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Re-acquire wake lock when page becomes visible (after screen unlock, tab switch, etc.)
    const handleVisibilityChange = () => {
      if (wakeLockEnabled && document.visibilityState === 'visible') {
        console.log('[WakeLock] Page visible, re-acquiring wake lock...');
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also try to re-acquire periodically as a fallback (every 30 seconds)
    const intervalId = wakeLockEnabled ? setInterval(() => {
      if (wakeLockEnabled && !wakeLockRef.current?.released === false) {
        console.log('[WakeLock] Periodic check - ensuring wake lock is active');
        requestWakeLock();
      }
    }, 30000) : null;

    return () => {
      isMounted = false;
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [wakeLockEnabled]);

  // Snackbar state for notifications
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const queryClient = useQueryClient();

  // Play notification sound/speech
  const playNotificationSound = useCallback((deliveryType) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // "Darling hold my HAND" melody: G4 - A4 - C5 - D5 - E5 (held)
      // Tempo: 123 BPM, eighth notes (~0.244s each)
      const eighthNote = 60 / 123 / 2;
      const notes = [
        { freq: 392.00, time: 0, duration: eighthNote },
        { freq: 440.00, time: eighthNote, duration: eighthNote },
        { freq: 523.25, time: eighthNote * 2, duration: eighthNote },
        { freq: 587.33, time: eighthNote * 3, duration: eighthNote },
        { freq: 659.25, time: eighthNote * 4, duration: eighthNote * 4 },
      ];

      notes.forEach(({ freq, time, duration }) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        const startTime = audioContext.currentTime + time;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });

      // Speak the message after the melody
      setTimeout(() => {
        let message;
        if (deliveryType === 'pickup') {
          message = 'New order for pickup';
        } else if (deliveryType === 'local') {
          message = 'New order for local delivery';
        } else {
          message = 'New order to be shipped';
        }
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      }, 1500);
    } catch (error) {
      console.log('[Notification] Sound failed:', error);
    }
  }, []);

  // Handle new order from WebSocket
  const handleNewOrder = useCallback((newOrder) => {
    console.log('[WebSocket] New order received:', newOrder);
    console.log('[WebSocket] Order deliveryType:', newOrder.deliveryType);
    console.log('[WebSocket] Order shippingMethod:', newOrder.shippingMethod);
    console.log('[WebSocket] Order shipping_lines:', newOrder.shipping_lines);

    // Determine delivery type
    let orderDeliveryType = newOrder.deliveryType;
    if (!orderDeliveryType) {
      // Check shippingMethod field
      const method = (newOrder.shippingMethod || '').toLowerCase();
      // Also check shipping_lines from Shopify (raw data)
      const shippingLineTitle = (newOrder.shipping_lines?.[0]?.title || '').toLowerCase();
      const combinedMethod = `${method} ${shippingLineTitle}`;

      console.log('[WebSocket] Combined shipping method for detection:', combinedMethod);

      if (combinedMethod.includes('pickup') || combinedMethod.includes('pick up') || combinedMethod.includes('pick-up')) {
        orderDeliveryType = 'pickup';
      } else if (combinedMethod.includes('local') || combinedMethod.includes('same day') || combinedMethod.includes('courier')) {
        orderDeliveryType = 'local';
      } else {
        orderDeliveryType = 'shipping';
      }

      console.log('[WebSocket] Detected delivery type:', orderDeliveryType);
    }

    // Play notification sound
    playNotificationSound(orderDeliveryType);

    // Show snackbar
    setSnackbar({
      open: true,
      message: `New order #${newOrder.orderNumber} from ${newOrder.customerName}`,
      severity: 'info',
    });

    // Invalidate orders query so it refetches when we navigate
    queryClient.invalidateQueries({ queryKey: ['admin', 'delivery-orders'] });

    // Navigate to In-store Orders page
    if (location.pathname !== '/admin/delivery-orders') {
      navigate('/admin/delivery-orders');
    }
  }, [playNotificationSound, queryClient, navigate, location.pathname]);

  // WebSocket connection for real-time orders (active on all admin pages)
  useOrdersWebSocket(handleNewOrder);

  useEffect(() => {
    const authKey = user ? `deviceAuthenticated_${user.uid}` : null;
    if (authKey) {
      localStorage.setItem(authKey, isAuthenticated);
    }
  }, [isAuthenticated, user]);

  const handleMobileDrawerToggle = () => setMobileOpen(prev => !prev);
  const handleCollapse = () => setIsCollapsed(prev => !prev);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/signin');
  };

  const onAuthenticated = () => setIsAuthenticated(true);

  const navLinks = [
    { text: 'Dashboard', icon: 'solar:chart-square-bold-duotone', path: '/admin', permission: 'Dashboard' },
    { text: 'Campaigns', icon: 'solar:speaker-minimalistic-bold-duotone', path: '/admin/campaigns', permission: 'Campaigns' },
    { text: 'Pricing Models', icon: 'solar:tag-price-bold-duotone', path: '/admin/pricing-models', permission: 'Pricing Models' },
    { text: 'Plans', icon: 'solar:clipboard-list-bold-duotone', path: '/admin/plans', permission: 'Plans' },
    { text: 'Subscriptions', icon: 'solar:card-recive-bold-duotone', path: '/admin/subscriptions', permission: 'Subscriptions' },
    { text: 'Subscribers', icon: 'solar:users-group-rounded-bold-duotone', path: '/admin/subscribers', permission: 'Subscribers' },
    { text: 'Device Management', icon: 'solar:devices-bold-duotone', path: '/admin/devices', permission: 'Device Management' },
    { text: 'Reports', icon: 'solar:chart-bold-duotone', path: '/admin/reports', permission: 'Reports' },
    { text: 'In-store Orders', icon: 'solar:shop-bold-duotone', path: '/admin/delivery-orders', permission: 'In-store Orders' },
    { text: 'Locations', icon: 'solar:map-point-bold-duotone', path: '/admin/locations', permission: 'Locations' },
    { text: 'Theme Editor', icon: 'solar:pallete-2-bold-duotone', path: '/admin/theme-editor', permission: 'Theme Editor' },
    { text: 'Access', icon: 'solar:lock-keyhole-bold-duotone', path: '/admin/access', permission: 'Access' },
    { text: 'Training', icon: 'solar:square-academic-cap-2-bold-duotone', path: '/admin/training', permission: 'Training' },
    { text: 'Recipes', icon: 'solar:book-2-bold-duotone', path: '/admin/recipes', permission: 'Recipes' }
  ];

  const isModalRoute = location.pathname === '/admin/select-square-plan' || location.pathname.startsWith('/admin/view-square-plan/');

  const getTitleFromPath = () => {
    if (location.pathname.startsWith('/admin/access/') && userId) return 'User Permissions';
    if (location.pathname === '/admin/select-square-plan') return 'Select a Square Plan';
    if (location.pathname.startsWith('/admin/view-square-plan/')) {
      const parts = location.pathname.split('/');
      const planId = parts[3];
      return `View Plan: ${planId}`;
    }
    return routeNames[location.pathname] || 'Dashboard';
  };

  if (!isAuthenticated) {
    return <UUIDEntryGate onAuthenticated={onAuthenticated} />;
  }

  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: theme.palette.background.neutral || '#F4F6F8' }}>
      {/* Desktop Sidebar - Persistent */}
      {isDesktop && !isModalRoute && (
        <Box
          component="nav"
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
            transition: theme.transitions.create('width', {
              duration: theme.transitions.duration.shorter,
            }),
          }}
        >
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: sidebarWidth,
              height: '100vh',
              borderRight: `1px dashed ${alpha(theme.palette.grey[500], 0.2)}`,
              bgcolor: theme.palette.background.paper,
              transition: theme.transitions.create('width', {
                duration: theme.transitions.duration.shorter,
              }),
              overflow: 'hidden',
              zIndex: theme.zIndex.drawer, // 1200 - higher than content area elements
            }}
          >
            <SidebarContent
              user={user}
              navLinks={navLinks}
              fetchedPermissions={fetchedPermissions}
              location={location}
              onSignOut={handleSignOut}
              isCollapsed={isCollapsed}
            />
          </Box>
        </Box>
      )}

      {/* Collapse toggle button - completely outside nav container */}
      {isDesktop && !isModalRoute && (
        <IconButton
          onClick={handleCollapse}
          sx={{
            position: 'fixed',
            top: 22,
            left: sidebarWidth - 12,
            width: 24,
            height: 24,
            bgcolor: theme.palette.background.paper,
            border: `1px dashed ${alpha(theme.palette.grey[500], 0.2)}`,
            borderRadius: '50%',
            zIndex: theme.zIndex.drawer + 1,
            transition: theme.transitions.create('left', {
              duration: theme.transitions.duration.shorter,
            }),
            '&:hover': {
              bgcolor: theme.palette.background.default,
            },
          }}
        >
          <Iconify
            icon="solar:alt-arrow-left-bold"
            width={16}
            sx={{
              transform: isCollapsed ? 'rotate(180deg)' : 'none',
              transition: theme.transitions.create('transform'),
            }}
          />
        </IconButton>
      )}

      {/* Mobile Drawer */}
      {!isDesktop && !isModalRoute && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleMobileDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              bgcolor: theme.palette.background.paper,
            },
          }}
        >
          <SidebarContent
            user={user}
            navLinks={navLinks}
            fetchedPermissions={fetchedPermissions}
            location={location}
            onSignOut={handleSignOut}
            isCollapsed={false}
            onClose={handleMobileDrawerToggle}
            showCloseButton={true}
          />
        </Drawer>
      )}

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          minWidth: 0,
          width: isDesktop && !isModalRoute ? `calc(100% - ${sidebarWidth}px)` : '100%',
          transition: theme.transitions.create(['width', 'margin'], {
            duration: theme.transitions.duration.shorter,
          }),
          isolation: 'isolate', // Creates stacking context so child z-indices don't escape
        }}
      >
        {/* Header */}
        <Box
          component="header"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: theme.zIndex.appBar,
            minHeight: HEADER_HEIGHT,
            bgcolor: alpha(theme.palette.background.default, 0.8),
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            px: { xs: 2, sm: 3 },
            py: 2,
            borderBottom: `1px dashed ${alpha(theme.palette.grey[500], 0.2)}`,
          }}
        >
          {/* Mobile menu button */}
          {!isDesktop && !isModalRoute && (
            <IconButton
              onClick={handleMobileDrawerToggle}
              sx={{
                mr: 1,
                color: theme.palette.text.primary,
              }}
            >
              <Iconify icon="solar:hamburger-menu-bold" width={24} />
            </IconButton>
          )}

          {/* Back button for modal routes */}
          {isModalRoute && (
            <IconButton
              onClick={() => navigate(-1)}
              sx={{
                mr: 1,
                color: theme.palette.text.primary,
              }}
            >
              <Iconify icon="solar:alt-arrow-left-bold" width={24} />
            </IconButton>
          )}

          {/* Page title */}
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: theme.palette.text.primary,
              fontSize: { xs: '2rem', sm: '2.4rem' },
              flex: 1,
            }}
          >
            {getTitleFromPath()}
          </Typography>

          {/* Wake Lock Toggle - visible on all admin pages in PWA mode */}
          {isPWA && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ToggleButtonGroup
                value={wakeLockEnabled ? 'on' : 'sleep'}
                exclusive
                onChange={(e, val) => val && setWakeLockEnabled(val === 'on')}
                size="small"
              >
                <ToggleButton
                  value="on"
                  sx={{
                    px: 1.5,
                    gap: 0.5,
                    '&.Mui-selected': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      color: theme.palette.primary.main,
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) }
                    }
                  }}
                >
                  <Iconify icon="solar:sun-bold" width={18} sx={{ color: wakeLockEnabled ? theme.palette.primary.main : 'inherit' }} />
                  Always On
                  {/* Green dot when wake lock is actually active */}
                  {wakeLockEnabled && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: wakeLockActive ? 'success.main' : 'warning.main',
                        ml: 0.5,
                        animation: wakeLockActive ? 'none' : 'pulse 1.5s infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.4 },
                        },
                      }}
                    />
                  )}
                </ToggleButton>
              <ToggleButton
                value="sleep"
                sx={{
                  px: 1.5,
                  gap: 0.5,
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: theme.palette.primary.main,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) }
                  }
                }}
              >
                <Iconify icon="solar:moon-bold" width={18} sx={{ color: !wakeLockEnabled ? theme.palette.primary.main : 'inherit' }} />
                Sleep
              </ToggleButton>
            </ToggleButtonGroup>
            </Box>
          )}
        </Box>

        {/* Page content */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            p: { xs: 2, sm: 2.5, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {children}
        </Box>
      </Box>

      {/* Snackbar for order notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
