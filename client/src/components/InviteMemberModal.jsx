import { useState } from 'react';
import axiosInstance from '../api/axios';

export default function InviteMemberModal({ isOpen, onClose, onSuccess, organizationId }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate email
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      await axiosInstance.post(`/api/organizations/${organizationId}/members`, {
        email,
        role
      });

      // Reset form
      setEmail('');
      setRole('member');
      setError('');

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Silent fail
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setError('');
    onClose();
  };

  const getRoleBadgeColor = (roleValue) => {
    switch (roleValue) {
      case 'admin':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'member':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 z-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="invite-modal-title" className="text-2xl font-bold text-gray-900 dark:text-white">Invite Team Member</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Email Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              required
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              An invitation will be sent to this email address
            </p>
          </div>

          {/* Role Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <div className="space-y-2">
              {/* Admin */}
              <label
                className={`
                  flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all
                  ${role === 'admin' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}
                `}
              >
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={(e) => setRole(e.target.value)}
                  className="mr-3"
                  disabled={loading}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded border ${getRoleBadgeColor('admin')}`}>
                      🛡️ ADMIN
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Can manage members, settings, and all resources
                  </p>
                </div>
              </label>

              {/* Member */}
              <label
                className={`
                  flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all
                  ${role === 'member' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}
                `}
              >
                <input
                  type="radio"
                  name="role"
                  value="member"
                  checked={role === 'member'}
                  onChange={(e) => setRole(e.target.value)}
                  className="mr-3"
                  disabled={loading}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded border ${getRoleBadgeColor('member')}`}>
                      ✏️ MEMBER
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Can create, edit, and delete their own resources
                  </p>
                </div>
              </label>

              {/* Viewer */}
              <label
                className={`
                  flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all
                  ${role === 'viewer' ? 'border-gray-500 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}
                `}
              >
                <input
                  type="radio"
                  name="role"
                  value="viewer"
                  checked={role === 'viewer'}
                  onChange={(e) => setRole(e.target.value)}
                  className="mr-3"
                  disabled={loading}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded border ${getRoleBadgeColor('viewer')}`}>
                      👁️ VIEWER
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Can only view resources, no editing allowed
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-6 py-3 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
