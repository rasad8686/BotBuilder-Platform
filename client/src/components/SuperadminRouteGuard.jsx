import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

/**
 * SuperadminRouteGuard
 *
 * Protects routes that require superadmin access.
 * Checks for valid admin session and superadmin status.
 */
export default function SuperadminRouteGuard({ children }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkSuperadminAccess();
  }, []);

  const checkSuperadminAccess = async () => {
    try {
      // First check localStorage for user data
      const adminUserStr = localStorage.getItem('adminUser');
      const userStr = localStorage.getItem('user');

      // Check adminUser first, then regular user
      if (adminUserStr) {
        try {
          const adminUser = JSON.parse(adminUserStr);
          if (adminUser.isSuperAdmin || adminUser.is_superadmin) {
            setIsSuperAdmin(true);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Error parsing adminUser - silent fail
        }
      }

      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.isSuperAdmin || user.is_superadmin) {
            setIsSuperAdmin(true);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Error parsing user - silent fail
        }
      }

      // Fallback: verify with backend
      const adminToken = localStorage.getItem('adminToken');
      const regularToken = localStorage.getItem('token');
      const token = adminToken || regularToken;

      if (!token) {
        setLoading(false);
        return;
      }

      const response = await api.get('/api/admin-auth/session', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && (response.data.data?.user?.isSuperAdmin || response.data.data?.user?.is_superadmin)) {
        setIsSuperAdmin(true);
      }
    } catch (err) {
      // Superadmin check failed - silent fail
      // Don't clear token - localStorage check already passed if we got here
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {t('superadmin.verifyingAccess', 'Verifying superadmin access...')}
          </p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    // Check if user has admin token but not superadmin
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      // Has admin access but not superadmin - show forbidden
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900">
          <div className="text-center max-w-md px-6">
            <div className="w-20 h-20 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">&#128683;</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              {t('superadmin.accessDenied', 'Access Denied')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('superadmin.superadminRequired', 'This area requires superadmin privileges. Please contact your system administrator.')}
            </p>
            <a
              href="/admin/dashboard"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              {t('superadmin.goToAdminDashboard', 'Go to Admin Dashboard')}
            </a>
          </div>
        </div>
      );
    }

    // No admin token - redirect to admin login
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}
