import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function InviteModal({ roles, onClose, onInviteSent }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  const getToken = () => localStorage.getItem('token');

  // Focus trap and keyboard handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus first input on mount
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !roleId) {
      setError(t('team.fillAllFields', 'Please fill in all fields'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/team/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          roleId: parseInt(roleId)
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onInviteSent();
        }, 1500);
      } else {
        setError(data.error || t('team.inviteFailed', 'Failed to send invitation'));
      }
    } catch (err) {
      setError(t('team.networkError', 'Network error. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-invite-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 id="team-invite-modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('team.inviteTeamMember', 'Invite Team Member')}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={t('common.close', 'Close modal')}
          >
            &times;
          </button>
        </div>

        {success ? (
          <div className="text-center py-10 px-5 bg-green-50 dark:bg-green-900/30 rounded-xl" role="status">
            <div className="text-5xl mb-4">✉️</div>
            <h3 className="text-green-700 dark:text-green-300 font-semibold mb-2">
              {t('team.invitationSent', 'Invitation Sent!')}
            </h3>
            <p className="text-green-600 dark:text-green-400">
              {t('team.invitationSentTo', 'An invitation has been sent to')} {email}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Email Input */}
            <div className="mb-5">
              <label className="block mb-2 font-medium text-gray-700 dark:text-gray-200">
                {t('team.emailAddress', 'Email Address')}
              </label>
              <input
                ref={firstInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-4 py-3 min-h-[44px] rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 outline-none transition-all"
                aria-required="true"
              />
            </div>

            {/* Role Select */}
            <div className="mb-6">
              <label className="block mb-2 font-medium text-gray-700 dark:text-gray-200">
                {t('team.role', 'Role')}
              </label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full px-4 py-3 min-h-[44px] rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 outline-none transition-all"
                aria-required="true"
              >
                <option value="">{t('team.selectRole', 'Select a role')}</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-4 py-3 mb-5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-lg text-sm" role="alert">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-5 py-3 min-h-[44px] bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-5 py-3 min-h-[44px] bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? t('team.sending', 'Sending...') : t('team.sendInvite', 'Send Invite')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
