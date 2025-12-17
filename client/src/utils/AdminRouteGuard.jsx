import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

/**
 * Admin Route Guard
 *
 * Protects admin routes - allows users with:
 * - superadmin status (global)
 * - admin role in current organization
 * - owner role in current organization
 *
 * Redirects non-admins to dashboard
 */
const AdminRouteGuard = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { userRole, loading, isAuthenticated } = useOrganization();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [superAdminChecked, setSuperAdminChecked] = useState(false);

  useEffect(() => {
    checkSuperadminStatus();
  }, []);

  const checkSuperadminStatus = async () => {
    try {
      // Check admin token first
      const adminToken = localStorage.getItem('adminToken');
      if (adminToken) {
        const response = await api.get('/admin-auth/session', {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        if (response.data.success) {
          setIsSuperAdmin(response.data.data.user.isSuperAdmin || false);
        }
      }
    } catch (err) {
      // Silently handle - user may not have admin token
    } finally {
      setSuperAdminChecked(true);
    }
  };

  // Show loading state while checking authentication
  if (loading || !superAdminChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {t('admin.verifyingAccess', 'Verifying access...')}
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has admin or owner role OR is superadmin
  const isOrgAdmin = userRole === 'admin' || userRole === 'owner';
  const hasAdminAccess = isOrgAdmin || isSuperAdmin;

  if (!hasAdminAccess) {
    // User doesn't have admin permissions - show forbidden page
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 mx-auto bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl">&#9888;&#65039;</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {t('admin.accessRestricted', 'Access Restricted')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('admin.adminRoleRequired', 'You need admin or owner role in this organization to access this area.')}
          </p>
          <a
            href="/dashboard"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            {t('admin.goToDashboard', 'Go to Dashboard')}
          </a>
        </div>
      </div>
    );
  }

  // User is admin - render the protected content
  return children;
};

export default AdminRouteGuard;
