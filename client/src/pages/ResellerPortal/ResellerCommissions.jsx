import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  Filter,
  Download,
  Building2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ResellerCommissions() {
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState([]);
  const [summary, setSummary] = useState({
    pending: { count: 0, total: 0 },
    approved: { count: 0, total: 0 },
    paid: { count: 0, total: 0 }
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    fetchCommissions();
  }, [pagination.page, statusFilter, yearFilter]);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 20,
        ...(statusFilter && { status: statusFilter }),
        ...(yearFilter && { year: yearFilter })
      });

      const response = await fetch(`${API_BASE}/api/reseller/commissions?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setCommissions(data.commissions);
        setSummary(data.summary);
        setPagination(data.pagination);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load commissions');
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

  const formatDateRange = (start, end) => {
    const startDate = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startDate} - ${endDate}`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'approved': return <CheckCircle className="w-4 h-4 text-blue-400" />;
      default: return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-500/20 text-green-400';
      case 'approved': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-yellow-500/20 text-yellow-400';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Commissions</h1>
          <p className="text-gray-400 mt-1">Track your earnings and commission history</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="text-gray-400 text-sm">{summary.pending.count} entries</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{formatCurrency(summary.pending.total)}</p>
          <p className="text-gray-400 text-sm mt-1">Pending</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-gray-400 text-sm">{summary.approved.count} entries</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{formatCurrency(summary.approved.total)}</p>
          <p className="text-gray-400 text-sm mt-1">Approved (Ready for Payout)</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-gray-400 text-sm">{summary.paid.count} entries</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(summary.paid.total)}</p>
          <p className="text-gray-400 text-sm mt-1">Paid Out</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Filter className="w-4 h-4" />
          <span>Filter:</span>
        </div>

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
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
        </select>

        <select
          value={yearFilter}
          onChange={(e) => {
            setYearFilter(e.target.value);
            setPagination({ ...pagination, page: 1 });
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Years</option>
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Commissions Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : commissions.length === 0 ? (
          <div className="p-8 text-center">
            <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No commissions found</p>
            <p className="text-gray-500 text-sm mt-1">
              Commissions are calculated at the end of each billing period
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Period
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Revenue
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Commission
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {commissions.map((commission) => (
                <tr key={commission.id} className="hover:bg-gray-700/30">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Calendar className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-white">
                        {formatDateRange(commission.period_start, commission.period_end)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {commission.organization_name ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-white">{commission.organization_name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-white">
                    {formatCurrency(commission.revenue)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-green-400 font-medium">
                      {formatCurrency(commission.commission_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(commission.status)}`}>
                      {getStatusIcon(commission.status)}
                      {commission.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-400 text-sm">
                    {new Date(commission.created_at).toLocaleDateString()}
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
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
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

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <h3 className="text-blue-400 font-medium mb-2">How Commissions Work</h3>
        <ul className="text-gray-400 text-sm space-y-1">
          <li>1. Commissions are calculated at the end of each billing period</li>
          <li>2. Pending commissions are reviewed by our team</li>
          <li>3. Once approved, commissions become available for payout</li>
          <li>4. Request a payout from the Payouts page when you reach the minimum threshold ($50)</li>
        </ul>
      </div>
    </div>
  );
}
