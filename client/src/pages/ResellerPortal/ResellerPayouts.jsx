import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Building,
  Wallet,
  AlertCircle,
  X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ResellerPayouts() {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPayouts();
  }, [pagination.page, statusFilter]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 20,
        ...(statusFilter && { status: statusFilter })
      });

      const response = await fetch(`${API_BASE}/api/reseller/payouts?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setPayouts(data.payouts);
        setAvailableBalance(data.available_balance);
        setPagination(data.pagination);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'processing': return <Clock className="w-4 h-4 text-blue-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'processing': return 'bg-blue-500/20 text-blue-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      default: return 'bg-yellow-500/20 text-yellow-400';
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'bank_transfer': return <Building className="w-4 h-4" />;
      case 'paypal': return <Wallet className="w-4 h-4" />;
      default: return <CreditCard className="w-4 h-4" />;
    }
  };

  const hasPendingPayout = payouts.some(p => p.status === 'pending');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payouts</h1>
          <p className="text-gray-400 mt-1">Manage your payout requests</p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          disabled={availableBalance < 50 || hasPendingPayout}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <DollarSign className="w-4 h-4" />
          Request Payout
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-xl p-6 border border-green-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400">Available Balance</p>
            <p className="text-4xl font-bold text-white mt-2">{formatCurrency(availableBalance)}</p>
            <p className="text-gray-400 text-sm mt-2">
              Minimum payout: $50.00
            </p>
          </div>
          <div className="p-4 bg-green-500/20 rounded-full">
            <Wallet className="w-8 h-8 text-green-400" />
          </div>
        </div>

        {availableBalance >= 50 && !hasPendingPayout && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="mt-4 flex items-center gap-2 text-green-400 hover:text-green-300"
          >
            Request payout now
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {hasPendingPayout && (
          <div className="mt-4 flex items-center gap-2 text-yellow-400">
            <AlertCircle className="w-4 h-4" />
            You have a pending payout request
          </div>
        )}

        {availableBalance < 50 && (
          <div className="mt-4 flex items-center gap-2 text-gray-400">
            <AlertCircle className="w-4 h-4" />
            You need at least $50 to request a payout
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Payouts</p>
          <p className="text-2xl font-bold text-white mt-1">{pagination.total}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Pending</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">
            {payouts.filter(p => p.status === 'pending').length}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Processing</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {payouts.filter(p => p.status === 'processing').length}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {payouts.filter(p => p.status === 'completed').length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination({ ...pagination, page: 1 });
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Payouts Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : payouts.length === 0 ? (
          <div className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No payouts yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Request your first payout when you have at least $50 available
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Paid At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {payouts.map((payout) => (
                <tr key={payout.id} className="hover:bg-gray-700/30">
                  <td className="px-4 py-4 text-white">
                    {new Date(payout.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-green-400 font-medium">
                      {formatCurrency(payout.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      {getMethodIcon(payout.method)}
                      <span className="capitalize">{payout.method.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(payout.status)}`}>
                      {getStatusIcon(payout.status)}
                      {payout.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-400 font-mono text-sm">
                    {payout.reference || '-'}
                  </td>
                  <td className="px-4 py-4 text-gray-400 text-sm">
                    {payout.paid_at
                      ? new Date(payout.paid_at).toLocaleDateString()
                      : '-'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Request Payout Modal */}
      {showRequestModal && (
        <RequestPayoutModal
          availableBalance={availableBalance}
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => {
            setShowRequestModal(false);
            fetchPayouts();
          }}
        />
      )}
    </div>
  );
}

function RequestPayoutModal({ availableBalance, onClose, onSuccess }) {
  const [method, setMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/reseller/payouts/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ method, notes })
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to request payout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Request Payout</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
          <p className="text-gray-400 text-sm">Payout Amount</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(availableBalance)}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Payment Method</label>
            <div className="space-y-2">
              {[
                { value: 'bank_transfer', label: 'Bank Transfer', icon: Building },
                { value: 'paypal', label: 'PayPal', icon: Wallet },
                { value: 'stripe', label: 'Stripe', icon: CreditCard }
              ].map(({ value, label, icon: Icon }) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    method === value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    value={value}
                    checked={method === value}
                    onChange={(e) => setMethod(e.target.value)}
                    className="hidden"
                  />
                  <Icon className={`w-5 h-5 ${method === value ? 'text-blue-400' : 'text-gray-400'}`} />
                  <span className={method === value ? 'text-white' : 'text-gray-400'}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              rows={3}
              placeholder="Any special instructions..."
            />
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-yellow-400 text-sm">
              Make sure your payment information is up to date in your branding settings before requesting a payout.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  Request Payout
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
