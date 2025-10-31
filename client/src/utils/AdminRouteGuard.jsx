import { Navigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';

/**
 * Admin Route Guard
 * Protects admin routes - only allows users with admin or owner role
 * Redirects non-admins to dashboard
 */
const AdminRouteGuard = ({ children }) => {
  const { userRole, loading, isAuthenticated } = useOrganization();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has admin or owner role
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  if (!isAdmin) {
    // User doesn't have admin permissions - redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  // User is admin - render the protected content
  return children;
};

export default AdminRouteGuard;
