// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { userApi } from '../services/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Login function
  // In the login function, store the token in the user object
  const login = async (token) => {
    localStorage.setItem('token', token);
    setToken(token);

    // Decode token to get user info
    const payload = JSON.parse(atob(token.split('.')[1]));
    let user = payload.user || {};
    try {
      if (!user.name) {
        const res = await userApi.me(token);
        user = { id: res.data.id, name: res.data.name, email: res.data.email };
      }
    } catch (e) { }
    setCurrentUser({ ...user, token });
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
  };

  // Check if user is logged in on initial load
  useEffect(() => {
    const bootstrap = async () => {
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          let user = payload.user || {};
          if (!user.name) {
            try {
              const res = await userApi.me(token);
              user = { id: res.data.id, name: res.data.name, email: res.data.email };
            } catch (e) { }
          }
          setCurrentUser({ ...user, token });
        } catch (error) {
          // Token is invalid
          logout();
        }
      }
      setLoading(false);
    };
    bootstrap();
  }, [token]);

  const value = {
    currentUser,
    user: currentUser, // Alias for backward compatibility
    token,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
