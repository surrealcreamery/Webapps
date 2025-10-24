import React, { useState, useEffect } from 'react';
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
  Button
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import GroupIcon from '@mui/icons-material/Group';
import RoomIcon from '@mui/icons-material/Room';
import PaletteIcon from '@mui/icons-material/Palette';
import LockIcon from '@mui/icons-material/Lock';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CategoryIcon from '@mui/icons-material/Category';
import CampaignIcon from '@mui/icons-material/Campaign';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SchoolIcon from '@mui/icons-material/School';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DevicesOtherIcon from '@mui/icons-material/DevicesOther';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import UUIDEntryGate from '@/pages/admin/subscription/UUIDEntryGate';

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
  '/admin/training':             'Training',
  '/admin/recipes':              'Recipes',
  '/admin/select-square-plan':   'Select a Square Plan',
  '/admin/view-square-plan/:planId/:variationId':  'View Plan',
};

export default function AdminLayout({ children, fetchedPermissions }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams();
  const auth = getAuth();
  const user = auth.currentUser;

  const [open, setOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const authKey = user ? `deviceAuthenticated_${user.uid}` : null;
    return authKey ? localStorage.getItem(authKey) === 'true' : false;
  });

  useEffect(() => {
    const authKey = user ? `deviceAuthenticated_${user.uid}` : null;
    if (authKey) {
        localStorage.setItem(authKey, isAuthenticated);
    }
  }, [isAuthenticated, user]);

  const handleDrawerToggle = () => setOpen(p => !p);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/signin');
  };
  
  const onAuthenticated = () => {
    setIsAuthenticated(true);
  };

  const navLinks = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin', permission: 'Dashboard' },
    { text: 'Campaigns', icon: <CampaignIcon />, path: '/admin/campaigns', permission: 'Campaigns' },
    { text: 'Pricing Models', icon: <MonetizationOnIcon />, path: '/admin/pricing-models', permission: 'Pricing Models' },
    { text: 'Plans', icon: <CategoryIcon />, path: '/admin/plans', permission: 'Plans' },
    { text: 'Subscriptions', icon: <SubscriptionsIcon />, path: '/admin/subscriptions', permission: 'Subscriptions' },
    { text: 'Subscribers', icon: <GroupIcon />, path: '/admin/subscribers', permission: 'Subscribers' },
    { text: 'Device Management', icon: <DevicesOtherIcon />, path: '/admin/devices', permission: 'Device Management' },
    { text: 'Reports', icon: <AssessmentIcon />, path: '/admin/reports', permission: 'Reports' },
    { text: 'Locations', icon: <RoomIcon />, path: '/admin/locations', permission: 'Locations' },
    { text: 'Theme Editor', icon: <PaletteIcon />, path: '/admin/theme-editor', permission: 'Theme Editor' },
    { text: 'Access', icon: <LockIcon />, path: '/admin/access', permission: 'Access' },
    { text: 'Training', icon: <SchoolIcon />, path: '/admin/training', permission: 'Training' },
    { text: 'Recipes', icon: <MenuBookIcon />, path: '/admin/recipes', permission: 'Recipes' }
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

  return (
    <Box sx={{ display: 'flex', bgcolor: 'white', color: 'black' }}>
      <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '50px', bgcolor: 'white', zIndex: 1201, px: 2, display: 'flex', alignItems: 'center', borderBottom: '1px solid #ccc' }}>
        <IconButton onClick={() => isModalRoute ? navigate(-1) : handleDrawerToggle()} sx={{ color: 'black', '&:active': { backgroundColor: 'rgba(0, 0, 0, 0.1)' }, '&:focus': { outline: 'none' } }}>
          {isModalRoute ? <CloseIcon /> : open ? <CloseIcon /> : <MenuIcon />}
        </IconButton>
        <Typography variant="h6" sx={{ ml: 1 }}>{getTitleFromPath()}</Typography>
      </Box>

      {!isModalRoute && (
        <Drawer anchor="left" open={open} onClose={handleDrawerToggle} sx={{ '.MuiDrawer-paper': { position: 'absolute', width: 250, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'white', color: 'black' } }}>
          <Box role="presentation" onClick={handleDrawerToggle} onKeyDown={(e) => { if (e.key === 'Tab' || e.key === 'Shift') return; handleDrawerToggle(); }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: '1px solid #ddd' }}>
              <Typography variant="h6">Navigation</Typography>
              <IconButton onClick={handleDrawerToggle} sx={{ color: 'black' }}><CloseIcon /></IconButton>
            </Box>

            {user && (
              <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{user.displayName || 'Logged in'}</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>{user.email}</Typography>
                <Button variant="contained" size="medium" onClick={handleSignOut} sx={{ bgcolor: 'black', color: 'white', textTransform: 'none', '&:hover': { bgcolor: 'white', color: 'black', border: '1px solid black' } }}>Sign Out</Button>
              </Box>
            )}

            <List>
              {navLinks.map(({ text, icon, path, permission }) => {
                const sectionPermissions = fetchedPermissions[permission] || {};
                const hasAccess = sectionPermissions.view === true || sectionPermissions.access === true;

                if (!hasAccess) {
                  return null;
                }
                const isActive = path === '/admin' ? location.pathname === path : location.pathname.startsWith(path);

                return (
                  <ListItemButton key={text} component={Link} to={path} sx={{ color: 'black', bgcolor: 'transparent', borderRadius: 1, mx: 1, my: 0.5, transition: 'all 0.3s ease', '&:hover': { bgcolor: '#000', color: '#fff', transform: 'translateX(4px)' }, '&.Mui-selected': { bgcolor: '#000', color: '#fff' }, '&.Mui-selected:hover': { bgcolor: '#000', color: '#fff' } }} selected={isActive}>
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{icon}</ListItemIcon>
                    <ListItemText primary={text} />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: 0,
          px: 3, 
          pb: 3,
          mt: '50px',
          width: '100%',
          height: 'calc(100vh - 50px)', // Define height for children to fill
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

