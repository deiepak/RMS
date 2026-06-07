import React, { createContext, useContext, useEffect } from 'react';
import { socket } from '../api/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // Connect socket
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Join appropriate room based on role
      socket.emit('join', { room: user.role, role: user.role, userId: user.id, name: user.name });
    }
  }, [isAuthenticated, user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
