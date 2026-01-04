import React, { createContext, useContext, useState } from 'react';

const CheckoutContext = createContext();

export function CheckoutProvider({ children }) {
  const [showOrderScreen, setShowOrderScreen] = useState(false);

  const proceedToOrderDetails = () => {
    setShowOrderScreen(true);
  };

  const backFromOrderDetails = () => {
    setShowOrderScreen(false);
  };

  return (
    <CheckoutContext.Provider value={{
      showOrderScreen,
      proceedToOrderDetails,
      backFromOrderDetails
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
