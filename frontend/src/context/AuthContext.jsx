import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.data.user));
      }
    } catch (err) {
      // If token expired or invalid, log out
      if (err.response?.status === 401) {
        logout();
      }
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      const { token, user: userData } = res.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    }
    return { success: false, message: 'Login failed' };
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
