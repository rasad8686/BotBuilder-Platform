/* eslint-disable react-refresh/only-export-components */
import { AlertTriangle } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';

/**
 * PermissionGuard Component
 *
 * Conditionally renders children based on user's role in the current organization.
 *
 * Usage:
 * <PermissionGuard require="admin">
 *   <button>Admin Only Action</button>
 * </PermissionGuard>
 *
 * <PermissionGuard require="member">
 *   <button>Member and above</button>
 * </PermissionGuard>
 *
 * Props:
 * - require: The minimum role required ('owner', 'admin', 'member', 'viewer')
 * - fallback: Optional component to render if permission is denied
 * - showMessage: If true, shows a message when permission is denied (default: false)
 */
export default function PermissionGuard({
  require,
  fallback = null,
  showMessage = false,
  children
}) {
  const { hasPermission, userRole, loading } = useOrganization();

  // Show nothing while loading
  if (loading) {
    return null;
  }

  // Check if user has required permission
  const hasAccess = hasPermission(require);

  if (!hasAccess) {
    // Show fallback if provided
    if (fallback) {
      return fallback;
    }

    // Show message if requested
    if (showMessage) {
      return (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>You need {require} role or higher to access this feature. Your role: {userRole || 'none'}</span>
        </div>
      );
    }

    // Default: render nothing
    return null;
  }

  // User has permission, render children
  return <>{children}</>;
}

/**
 * usePermission Hook
 *
 * A hook version for programmatic permission checks
 *
 * Usage:
 * const canDelete = usePermission('admin');
 *
 * if (canDelete) {
 *   // show delete button
 * }
 */
export function usePermission(requiredRole) {
  const { hasPermission } = useOrganization();
  return hasPermission(requiredRole);
}
