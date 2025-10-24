// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// TODO: replace with your actual config
const firebaseConfig = {
  apiKey: "AIzaSyDaLfKJwNNaXOUgaEobiocJaO9ja8DFbB4",
  authDomain: "dollar-boba-club-subscriptions.firebaseapp.com",
  projectId: "dollar-boba-club-subscriptions",
  storageBucket: "dollar-boba-club-subscriptions.firebasestorage.app",
  messagingSenderId: "720555463240",
  appId: "1:720555463240:web:d8b05ccd4fac7f2ce77e7d",
  measurementId: "G-L7G44FY3SJ"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Create and export a single Auth instance
export const auth = getAuth(app);

// Export your Google provider
export const googleProvider = new GoogleAuthProvider();
