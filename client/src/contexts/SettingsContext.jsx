import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const SettingsContext = createContext(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    restaurant_name: 'Loading...',
    restaurant_address: '',
    restaurant_phone: '',
    restaurant_website: '',
    currency_symbol: 'Rs. ',
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(prev => ({ ...prev, ...res.data }));
      if (res.data.date_format) {
        localStorage.setItem('rms_date_format', res.data.date_format);
      }
    } catch (error) {
      console.error('Failed to load settings', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettingsLocally = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, isLoading, refreshSettings: fetchSettings, updateSettingsLocally }}>
      {children}
    </SettingsContext.Provider>
  );
};
