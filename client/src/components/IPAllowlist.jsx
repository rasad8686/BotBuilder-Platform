/**
 * IPAllowlist Component
 *
 * Manages IP allowlist for API tokens:
 * - View allowed IPs
 * - Add single IP or CIDR range
 * - Enable/disable IP restriction
 * - Add current IP button
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../api/axios';

export default function IPAllowlist({ token, onClose, onUpdate }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // State
  const [ipRestrictionEnabled, setIpRestrictionEnabled] = useState(false);
  const [allowlist, setAllowlist] = useState([]);
  const [currentIp, setCurrentIp] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    ipAddress: '',
    cidrRange: '',
    description: ''
  });
  const [useCidr, setUseCidr] = useState(false);

  /**
   * Load IP allowlist data
   */
  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [allowlistRes, ipRes] = await Promise.all([
        axiosInstance.get(`/api/api-tokens/${token.id}/ip-allowlist`),
        // Get current IP from a public API
        fetch('https://api.ipify.org?format=json').then(r => r.json()).catch(() => ({ ip: '' }))
      ]);

      if (allowlistRes.data.success) {
        setIpRestrictionEnabled(allowlistRes.data.data.ipRestrictionEnabled);
        setAllowlist(allowlistRes.data.data.allowlist);
      }

      if (ipRes.ip) {
        setCurrentIp(ipRes.ip);
      }

    } catch (err) {
      setError('Failed to load IP allowlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token.id]);

  /**
   * Add IP to allowlist
   */
  const handleAddIp = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await axiosInstance.post(`/api/api-tokens/${token.id}/ip-allowlist`, {
        ipAddress: formData.ipAddress,
        cidrRange: useCidr ? formData.cidrRange : null,
        description: formData.description || null
      });

      if (response.data.success) {
        setSuccess('IP added successfully');
        setFormData({ ipAddress: '', cidrRange: '', description: '' });
        setUseCidr(false);
        await loadData();
        if (onUpdate) onUpdate();
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add IP');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Remove IP from allowlist
   */
  const handleRemoveIp = async (ipId) => {
    if (!confirm('Are you sure you want to remove this IP?')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await axiosInstance.delete(`/api/api-tokens/${token.id}/ip-allowlist/${ipId}`);

      if (response.data.success) {
        setSuccess('IP removed successfully');
        await loadData();
        if (onUpdate) onUpdate();
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove IP');
    }
  };

  /**
   * Toggle IP restriction
   */
  const handleToggleRestriction = async () => {
    setError('');
    setSuccess('');

    try {
      const response = await axiosInstance.put(`/api/api-tokens/${token.id}/ip-restriction`, {
        enabled: !ipRestrictionEnabled
      });

      if (response.data.success) {
        setIpRestrictionEnabled(response.data.data.ipRestrictionEnabled);
        setSuccess(`IP restriction ${response.data.data.ipRestrictionEnabled ? 'enabled' : 'disabled'}`);
        if (onUpdate) onUpdate();
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update IP restriction');
    }
  };

  /**
   * Add current IP to form
   */
  const handleAddCurrentIp = () => {
    setFormData(prev => ({
      ...prev,
      ipAddress: currentIp,
      description: 'My current IP'
    }));
  };

  /**
   * Validate IP format
   */
  const isValidIp = (ip) => {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Pattern.test(ip)) return false;
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  };

  /**
   * Validate CIDR format
   */
  const isValidCidr = (cidr) => {
    if (!cidr || !cidr.includes('/')) return false;
    const [ip, bits] = cidr.split('/');
    const mask = parseInt(bits, 10);
    return isValidIp(ip) && mask >= 0 && mask <= 32;
  };

  const isFormValid = formData.ipAddress && isValidIp(formData.ipAddress) &&
    (!useCidr || (formData.cidrRange && isValidCidr(formData.cidrRange)));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-slate-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              IP Allowlist: {token.token_name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              X
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
              {success}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Loading...</p>
            </div>
          ) : (
            <>
              {/* IP Restriction Toggle */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">IP Restriction</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {ipRestrictionEnabled
                        ? 'Only allowed IPs can use this token'
                        : 'Any IP can use this token'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleRestriction}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      ipRestrictionEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        ipRestrictionEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Add IP Form */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Add IP Address</h3>

                <form onSubmit={handleAddIp} className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        IP Address *
                      </label>
                      <input
                        type="text"
                        value={formData.ipAddress}
                        onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                        placeholder="192.168.1.1"
                        className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                    {currentIp && (
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddCurrentIp}
                          className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 text-sm whitespace-nowrap"
                        >
                          Add My IP ({currentIp})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* CIDR Toggle */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useCidr"
                      checked={useCidr}
                      onChange={(e) => setUseCidr(e.target.checked)}
                      className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="useCidr" className="text-sm text-gray-700 dark:text-gray-300">
                      Use CIDR range (allow IP range)
                    </label>
                  </div>

                  {useCidr && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        CIDR Range *
                      </label>
                      <input
                        type="text"
                        value={formData.cidrRange}
                        onChange={(e) => setFormData(prev => ({ ...prev, cidrRange: e.target.value }))}
                        placeholder="192.168.1.0/24"
                        className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Example: 192.168.1.0/24 allows 192.168.1.0 - 192.168.1.255
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Office network, Home IP, etc."
                      className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !isFormValid}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Adding...' : 'Add IP'}
                  </button>
                </form>
              </div>

              {/* IP List */}
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
                  Allowed IPs ({allowlist.length})
                </h3>

                {allowlist.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400">No IPs in allowlist</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      Add an IP address to restrict access to this token
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allowlist.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-gray-800 dark:text-gray-200">
                              {entry.ipAddress}
                            </code>
                            {entry.cidrRange && (
                              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                                CIDR: {entry.cidrRange}
                              </span>
                            )}
                            {!entry.isActive && (
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {entry.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Added {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveIp(entry.id)}
                          className="px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">How IP Allowlist Works</h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>- When enabled, only listed IPs can use this API token</li>
                  <li>- Requests from other IPs will receive 403 Forbidden</li>
                  <li>- CIDR ranges allow you to whitelist entire IP blocks</li>
                  <li>- Add at least one IP before enabling restriction</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * IP Allowlist Button - Inline button to trigger IP allowlist modal
 */
export function IPAllowlistButton({ onClick, hasRestriction }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        hasRestriction
          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50'
          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
      }`}
      title={hasRestriction ? 'IP restriction enabled' : 'Configure IP allowlist'}
    >
      {hasRestriction ? 'IP Restricted' : 'IP Allowlist'}
    </button>
  );
}
