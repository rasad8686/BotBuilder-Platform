import { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axios';

const OrganizationContext = createContext(null);

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
};

export const OrganizationProvider = ({ children }) => {
  const [organizations, setOrganizations] = useState([]);
  const [currentOrganization, setCurrentOrganization] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Fetch user's organizations on mount
  useEffect(() => {
    // Check if user is authenticated before fetching
    const token = localStorage.getItem('token');
    if (!token) {
      // User not authenticated, don't fetch
      setLoading(false);
      setIsAuthenticated(false);
      return;
    }

    setIsAuthenticated(true);
    let isMounted = true;

    const loadOrganizations = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get('/api/organizations');

        if (!isMounted) return; // Component unmounted, don't update state

        const orgs = response.data.organizations || [];

        setOrganizations(orgs);

        // Set current organization (from localStorage or first org)
        const savedOrgId = localStorage.getItem('currentOrganizationId');

        if (savedOrgId) {
          const savedOrg = orgs.find(o => o.id === parseInt(savedOrgId));
          if (savedOrg) {
            setCurrentOrganization(savedOrg);
            setUserRole(savedOrg.role);
          } else if (orgs.length > 0) {
            setCurrentOrganization(orgs[0]);
            setUserRole(orgs[0].role);
          }
        } else if (orgs.length > 0) {
          setCurrentOrganization(orgs[0]);
          setUserRole(orgs[0].role);
        }

        setError(null);
      } catch (err) {
        if (!isMounted) return; // Component unmounted, don't update state

        // Handle 401 - user not authenticated
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('currentOrganizationId');
          setIsAuthenticated(false);
          // Don't redirect here - axios interceptor will handle it
          setError('Authentication required');
        } else {
          setError(err.response?.data?.message || 'Failed to load organizations');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOrganizations();

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
  }, []);

  // Update user role when current organization changes
  useEffect(() => {
    if (currentOrganization && organizations.length > 0) {
      const org = organizations.find(o => o.id === currentOrganization.id);
      if (org && org.role) {
        setUserRole(org.role);
        // Store in localStorage for persistence
        localStorage.setItem('currentOrganizationId', currentOrganization.id);
      }
    }
  }, [currentOrganization, organizations]);

  const fetchOrganizations = async () => {
    // Check authentication before fetching
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setIsAuthenticated(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/organizations');
      const orgs = response.data.organizations || [];
      setOrganizations(orgs);

      // Set current organization (from localStorage or first org)
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      if (savedOrgId) {
        const savedOrg = orgs.find(o => o.id === parseInt(savedOrgId));
        if (savedOrg) {
          setCurrentOrganization(savedOrg);
          setUserRole(savedOrg.role);
        } else if (orgs.length > 0) {
          setCurrentOrganization(orgs[0]);
          setUserRole(orgs[0].role);
        }
      } else if (orgs.length > 0) {
        setCurrentOrganization(orgs[0]);
        setUserRole(orgs[0].role);
      }

      setError(null);
    } catch (err) {
      // Handle 401 - user not authenticated
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('currentOrganizationId');
        setIsAuthenticated(false);
        setError('Authentication required');
      } else {
        setError(err.response?.data?.message || 'Failed to load organizations');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchOrganization = (organizationId) => {
    const org = organizations.find(o => o.id === organizationId);
    if (org) {
      setCurrentOrganization(org);
      setUserRole(org.role);
      localStorage.setItem('currentOrganizationId', organizationId);

      // Reload the page to refresh all data for new organization
      window.location.reload();
    }
  };

  const hasPermission = (requiredRole) => {
    if (!userRole) return false;

    const roleHierarchy = {
      'owner': 3,
      'admin': 2,
      'member': 1,
      'viewer': 0
    };

    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  };

  const refreshOrganizations = () => {
    fetchOrganizations();
  };

  const value = {
    organizations,
    currentOrganization,
    userRole,
    loading,
    error,
    isAuthenticated,
    switchOrganization,
    hasPermission,
    refreshOrganizations
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};
