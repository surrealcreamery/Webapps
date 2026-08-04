import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCheckout } from '@/components/commerce/CheckoutContext';
import { getConsumerLoyalty } from '@/services/loyaltyService';

const LoyaltyContext = createContext();

export function LoyaltyProvider({ children }) {
  const { otpSessionToken, logoutSession } = useCheckout();
  const [loyaltyAccount, setLoyaltyAccount] = useState(null);
  const [pointsPerDollar, setPointsPerDollar] = useState(10);
  const [loading, setLoading] = useState(false);

  const fetchLoyalty = useCallback(async (token) => {
    if (!token) {
      setLoyaltyAccount(null);
      return;
    }
    setLoading(true);
    try {
      const data = await getConsumerLoyalty(token);
      if (data?.enrolled && data.account) {
        setLoyaltyAccount(data.account);
        if (data.pointsPerDollar) setPointsPerDollar(data.pointsPerDollar);
      } else {
        setLoyaltyAccount(null);
      }
    } catch (err) {
      console.warn('[LoyaltyContext] Failed to fetch loyalty:', err.message);
      // Session may be expired — clear it
      if (err.message?.includes('expired') || err.message?.includes('Invalid')) {
        logoutSession();
      }
      setLoyaltyAccount(null);
    } finally {
      setLoading(false);
    }
  }, [logoutSession]);

  useEffect(() => {
    fetchLoyalty(otpSessionToken);
  }, [otpSessionToken, fetchLoyalty]);

  const refreshLoyalty = useCallback(() => {
    return fetchLoyalty(otpSessionToken);
  }, [otpSessionToken, fetchLoyalty]);

  const loyaltyBalance = loyaltyAccount?.balance || 0;
  const isLoyaltyMember = !!loyaltyAccount;

  return (
    <LoyaltyContext.Provider value={{
      loyaltyAccount,
      loyaltyBalance,
      pointsPerDollar,
      isLoyaltyMember,
      loyaltyLoading: loading,
      refreshLoyalty,
    }}>
      {children}
    </LoyaltyContext.Provider>
  );
}

const LOYALTY_DEFAULTS = {
  loyaltyAccount: null,
  loyaltyBalance: 0,
  pointsPerDollar: 10,
  isLoyaltyMember: false,
  loyaltyLoading: false,
  refreshLoyalty: () => {},
};

export function useLoyalty() {
  const context = useContext(LoyaltyContext);
  return context || LOYALTY_DEFAULTS;
}
