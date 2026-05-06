import React, { createContext, useContext, useState, useCallback } from 'react';

const CheckoutContext = createContext();

function loadConfirmation() {
  try {
    const raw = sessionStorage.getItem('checkoutConfirmation');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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

  // Authenticated checkout state (OTP sign-in)
  const [otpSessionToken, setOtpSessionToken] = useState(null);
  const [authenticatedCustomerId, setAuthenticatedCustomerId] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState([]);

  const proceedToOrderDetails = () => setShowOrderScreen(true);
  const backFromOrderDetails = () => setShowOrderScreen(false);

  const resetCheckout = useCallback(() => {
    setCheckoutCustomer(null);
    setCheckoutFulfillment(null);
    setCheckoutOrderCalc(null);
    setCheckoutPromoCode('');
    setCheckoutTip(0);
    setCheckoutConfirmation(null);
    setOtpSessionToken(null);
    setAuthenticatedCustomerId(null);
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
      // Authenticated checkout (OTP)
      otpSessionToken, setOtpSessionToken,
      authenticatedCustomerId, setAuthenticatedCustomerId,
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
