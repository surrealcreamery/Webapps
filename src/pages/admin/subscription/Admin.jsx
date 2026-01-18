// src/pages/admin/subscription/Admin.jsx
import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  ListItemIcon,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { useQuery } from '@tanstack/react-query';
import { useUserPermissions, fetchDevice } from '@/contexts/admin/AdminDataContext';
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

// Define the structure for all possible navigation links
const allNavLinks = [
    { text: 'Subscriptions', icon: <SubscriptionsIcon fontSize="large" />, path: '/admin/subscriptions', permission: 'Subscriptions' },
    { text: 'Subscribers', icon: <GroupIcon fontSize="large" />, path: '/admin/subscribers', permission: 'Subscribers' },
    { text: 'Reports', icon: <AssessmentIcon fontSize="large" />, path: '/admin/reports', permission: 'Reports' },
    { text: 'Locations', icon: <RoomIcon fontSize="large" />, path: '/admin/locations', permission: 'Locations' },
    { text: 'Campaigns', icon: <CampaignIcon fontSize="large" />, path: '/admin/campaigns', permission: 'Campaigns' },
    { text: 'Plans', icon: <CategoryIcon fontSize="large" />, path: '/admin/plans', permission: 'Plans' },
    { text: 'Pricing Models', icon: <MonetizationOnIcon fontSize="large" />, path: '/admin/pricing-models', permission: 'Pricing Models' },
    { text: 'Theme Editor', icon: <PaletteIcon fontSize="large" />, path: '/admin/theme-editor', permission: 'Theme Editor' },
    { text: 'Access', icon: <LockIcon fontSize="large" />, path: '/admin/access', permission: 'Access' },
    { text: 'Training', icon: <SchoolIcon fontSize="large" />, path: '/admin/training', permission: 'Training' },
    { text: 'Recipes', icon: <MenuBookIcon fontSize="large" />, path: '/admin/recipes', permission: 'Recipes' },
];

const NavCard = ({ title, icon, path }) => {
  const navigate = useNavigate();
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Card 
        elevation={2}
        sx={{
          height: '100%',
          border: '1px solid #ddd',
          borderRadius: 2,
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          }
        }}
      >
        <CardActionArea
          onClick={() => navigate(path)}
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            p: 3,
          }}
        >
          <ListItemIcon sx={{ minWidth: 0, mb: 2, color: 'primary.main' }}>
            {icon}
          </ListItemIcon>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            <Typography variant="h6" align="center">
              {title}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </Grid>
  );
};

const Admin = () => {
  const email = getAuth().currentUser?.email || '';
  const { data: fetchedPermissions = {}, isLoading } = useUserPermissions(email);

  // Get stored device ID for displaying device name
  const storedDeviceId = localStorage.getItem('surreal_device_id');
  const isMasterBypass = storedDeviceId === 'MASTER_BYPASS';

  // Fetch device info to get the device name
  const { data: deviceInfo } = useQuery({
    queryKey: ['admin', 'currentDevice', storedDeviceId],
    queryFn: () => fetchDevice(storedDeviceId),
    enabled: !!storedDeviceId && !isMasterBypass,
    staleTime: 5 * 60 * 1000,
  });

  // Determine what to display as the title
  const getDisplayTitle = () => {
    if (isMasterBypass) return 'Master Bypass';
    if (deviceInfo?.name) return deviceInfo.name;
    return 'Admin Dashboard';
  };

  // Filter the navigation links based on the user's permissions
  const accessiblePages = allNavLinks.filter(link => {
    const sectionPermissions = fetchedPermissions[link.permission] || {};
    return sectionPermissions.view === true || sectionPermissions.access === true;
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {getDisplayTitle()}
      </Typography>

      <Grid container spacing={3}>
        {accessiblePages.length > 0 ? (
          accessiblePages.map(page => (
            <NavCard
              key={page.text}
              title={page.text}
              icon={page.icon}
              path={page.path}
            />
          ))
        ) : (
          <Grid item xs={12}>
            <Typography sx={{ mt: 2 }}>
              You do not have permission to view any admin pages.
            </Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Admin;
