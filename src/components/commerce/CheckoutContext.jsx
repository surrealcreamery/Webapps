import React, { createContext, useContext, useState, useCallback } from 'react';

const CheckoutContext = createContext();

const OTP_STORAGE_KEY = 'surrealOtpSession';
const OTP_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadConfirmation() {
  try {
    const raw = sessionStorage.getItem('checkoutConfirmation');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function loadOtpSession() {
  try {
    const raw = localStorage.getItem(OTP_STORAGE_KEY);
    if (!raw) return null;
    const { token, customerId, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > OTP_EXPIRY_MS) {
      localStorage.removeItem(OTP_STORAGE_KEY);
      return null;
    }
    return { token, customerId };
  } catch {
    localStorage.removeItem(OTP_STORAGE_KEY);
    return null;
  }
}

export function CheckoutProvider({ children }) {
  const [showOrderScreen, setShowOrderScreen] = useState(false);

  // Checkout state
  const [checkoutCustomer, setCheckoutCustomer] = useState(null);
  const [checkoutFulfillment, setCheckoutFulfillment] = useState(null);
  const [checkoutOrderCalc, setCheckoutOrderCalc] = useState(null);
  const [checkoutPromoCode, setCheckoutPromoCode] = useState('');
  const [checkoutTip, setCheckoutTip] = useState(0);
  const [checkoutConfirmation, _setCheckoutConfirmation] = useState(loadConfirmation);

  const setCheckoutConfirmation = useCallback((val) => {
    _setCheckoutConfirmation(val);
    if (val) {
      sessionStorage.setItem('checkoutConfirmation', JSON.stringify(val));
    } else {
      sessionStorage.removeItem('checkoutConfirmation');
    }
  }, []);

  // Authenticated checkout state (OTP sign-in) — persisted in localStorage
  const [otpSessionToken, setOtpSessionTokenState] = useState(() => loadOtpSession()?.token || null);
  const [authenticatedCustomerId, setAuthenticatedCustomerIdState] = useState(() => loadOtpSession()?.customerId || null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState([]);

  const setOtpSession = useCallback((token, customerId) => {
    setOtpSessionTokenState(token);
    setAuthenticatedCustomerIdState(customerId);
    if (token) {
      localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify({ token, customerId, timestamp: Date.now() }));
    } else {
      localStorage.removeItem(OTP_STORAGE_KEY);
    }
  }, []);

  const logoutSession = useCallback(() => {
    setOtpSessionTokenState(null);
    setAuthenticatedCustomerIdState(null);
    setSavedAddresses([]);
    setSavedPaymentMethods([]);
    localStorage.removeItem(OTP_STORAGE_KEY);
  }, []);

  const proceedToOrderDetails = () => setShowOrderScreen(true);
  const backFromOrderDetails = () => setShowOrderScreen(false);

  const resetCheckout = useCallback(() => {
    setCheckoutCustomer(null);
    setCheckoutFulfillment(null);
    setCheckoutOrderCalc(null);
    setCheckoutPromoCode('');
    setCheckoutTip(0);
    setCheckoutConfirmation(null);
    // Preserve OTP session across checkouts — don't clear it
    setSavedAddresses([]);
    setSavedPaymentMethods([]);
  }, [setCheckoutConfirmation]);

  return (
    <CheckoutContext.Provider value={{
      showOrderScreen,
      proceedToOrderDetails,
      backFromOrderDetails,
      // Checkout flow state
      checkoutCustomer, setCheckoutCustomer,
      checkoutFulfillment, setCheckoutFulfillment,
      checkoutOrderCalc, setCheckoutOrderCalc,
      checkoutPromoCode, setCheckoutPromoCode,
      checkoutTip, setCheckoutTip,
      checkoutConfirmation, setCheckoutConfirmation,
      // Authenticated checkout (OTP) — persistent session
      otpSessionToken,
      authenticatedCustomerId,
      setAuthenticatedCustomerId: setAuthenticatedCustomerIdState,
      setOtpSession,
      logoutSession,
      savedAddresses, setSavedAddresses,
      savedPaymentMethods, setSavedPaymentMethods,
      resetCheckout,
    }}>
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckout must be used within CheckoutProvider');
  }
  return context;
}
