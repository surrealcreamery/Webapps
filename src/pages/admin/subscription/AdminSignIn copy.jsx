// src/pages/admin/subscription/AdminSignIn.jsx

import React, { useState, useEffect } from 'react';
import { Button, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '@/firebase';              // your single shared Firebase instance
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';

/**
 * AdminSignIn component renders a Google sign‐in button and handles authentication flow.
 * It listens for auth state changes to update UI but only navigates to /admin after
 * a successful popup sign‐in, not automatically on every mount.
 */
export default function AdminSignIn() {
  // State to hold the authenticated user object
  const [user, setUser] = useState(null);
  // State to hold any sign-in error message
  const [error, setError] = useState('');
  // React Router's navigation hook
  const navigate = useNavigate();

  /**
   * handleGoogleSignIn triggers the Firebase Google sign-in popup,
   * sets the user state on success, and navigates to the admin page.
   */
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const signedInUser = result.user;
      console.log('User signed in via popup:', signedInUser);
      setUser(signedInUser);
      // Redirect to /admin only after successful popup sign-in
      navigate('/admin');
    } catch (err) {
      const message = err?.message || 'Unknown error';
      console.error('Error signing in with Google:', err);
      setError('Google sign-in error: ' + message);
    }
  };

  /**
   * Listen for Firebase auth state changes. We update the `user` state
   * so the UI reflects the current auth status, but do not auto-navigate here.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('onAuthStateChanged ➞', currentUser);
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <Box
      sx={{
        display:        'flex',
        justifyContent: 'center',
        alignItems:     'center',
        minHeight:      '100vh',
        bgcolor:        'background.default'
      }}
    >
      <Box
        sx={{
          backgroundColor: 'white',
          padding:         4,
          borderRadius:    2,
          boxShadow:       3,
          width:           400
        }}
      >
        <Typography
          variant="h5"
          align="center"
          sx={{ fontWeight: 'bold', marginBottom: 2 }}
        >
          Sign In
        </Typography>

        {user ? (
          <Typography
            variant="h6"
            align="center"
            color="success.main"
            sx={{ marginBottom: 2 }}
          >
            Welcome, {user.displayName || user.email}
          </Typography>
        ) : (
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            sx={{ marginBottom: 2 }}
          >
            Please sign in with Google
          </Typography>
        )}

        {error && (
          <Typography color="error" sx={{ marginTop: 2 }}>
            {error}
          </Typography>
        )}

        {!user && (
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleGoogleSignIn}
            sx={{ marginTop: 2, textTransform: 'none' }}
          >
            Sign in with Google
          </Button>
        )}
      </Box>
    </Box>
  );
}
