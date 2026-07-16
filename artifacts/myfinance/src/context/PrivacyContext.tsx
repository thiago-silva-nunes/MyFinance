import React, { createContext, useContext, useState } from 'react';

const PRIVACY_KEY = 'myfinance_hide_values';

interface PrivacyContextType {
  hideValues: boolean;
  toggleHideValues: () => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  hideValues: false,
  toggleHideValues: () => {},
});

export const PrivacyProvider = ({ children }: { children: React.ReactNode }) => {
  const [hideValues, setHideValues] = useState<boolean>(() => {
    try { return localStorage.getItem(PRIVACY_KEY) === 'true'; } catch { return false; }
  });

  const toggleHideValues = () => {
    setHideValues(prev => {
      const next = !prev;
      try { localStorage.setItem(PRIVACY_KEY, String(next)); } catch {}
      return next;
    });
  };

  return (
    <PrivacyContext.Provider value={{ hideValues, toggleHideValues }}>
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = () => useContext(PrivacyContext);

/** Returns a currency string, or a masked placeholder when privacy mode is on. */
export function useMaskedCurrency() {
  const { hideValues } = usePrivacy();
  return (amount: number, formatter: (n: number) => string) =>
    hideValues ? 'R$ ••••••' : formatter(amount);
}
