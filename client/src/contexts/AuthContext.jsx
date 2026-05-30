import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('rms_token'));
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('rms_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/verify');
        setUser(res.data.user);
        setToken(storedToken);
      } catch (err) {
        console.error('Token verification failed:', err);
        localStorage.removeItem('rms_token');
        localStorage.removeItem('rms_user');
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = useCallback(async (role, pin) => {
    const res = await api.post('/auth/login', { role, pin });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('rms_token', newToken);
    localStorage.setItem('rms_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('rms_token');
    localStorage.removeItem('rms_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
