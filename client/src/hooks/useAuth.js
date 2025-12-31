/**
 * @fileoverview Authentication hook for managing user authentication state
 * @module hooks/useAuth
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Custom hook for managing authentication state and operations
 * @returns {Object} Authentication state and methods
 * @property {Object|null} user - Current authenticated user object
 * @property {boolean} isAuthenticated - Whether user is authenticated
 * @property {boolean} loading - Loading state during auth operations
 * @property {string|null} error - Error message if auth fails
 * @property {Function} login - Login function (email, password) => Promise
 * @property {Function} logout - Logout function () => Promise
 * @property {Function} register - Register function (userData) => Promise
 * @property {Function} refreshUser - Refresh user data from server
 * @property {Function} updateUser - Update user data locally
 * @property {Function} clearError - Clear any authentication errors
 *
 * @example
 * const { user, isAuthenticated, login, logout, loading, error } = useAuth();
 *
 * if (loading) return <Spinner />;
 * if (!isAuthenticated) return <LoginForm onSubmit={login} error={error} />;
 * return <Dashboard user={user} onLogout={logout} />;
 */
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Check if user is authenticated based on user state
   */
  const isAuthenticated = useMemo(() => !!user, [user]);

  /**
   * Get auth token from localStorage
   * @returns {string|null} JWT token or null
   */
  const getToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  /**
   * Set auth token in localStorage
   * @param {string} token - JWT token to store
   */
  const setToken = useCallback((token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, []);

  /**
   * Fetch current user from server
   */
  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user || data);
      } else {
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setError('Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  }, [getToken, setToken]);

  /**
   * Login with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User data on success
   */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setToken]);

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @param {string} userData.name - User name
   * @returns {Promise<Object>} User data on success
   */
  const register = useCallback(async (userData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      if (data.token) {
        setToken(data.token);
        setUser(data.user);
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setToken]);

  /**
   * Logout current user
   * @returns {Promise<void>}
   */
  const logout = useCallback(async () => {
    setLoading(true);

    try {
      const token = getToken();
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  }, [getToken, setToken]);

  /**
   * Refresh user data from server
   * @returns {Promise<void>}
   */
  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  /**
   * Update user data locally
   * @param {Object} updates - Partial user updates
   */
  const updateUser = useCallback((updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  /**
   * Clear authentication error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch user on mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    register,
    refreshUser,
    updateUser,
    clearError,
    getToken
  };
};

export default useAuth;
