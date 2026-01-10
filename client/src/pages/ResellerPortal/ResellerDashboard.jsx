import React, { useState, useEffect } from 'react';
import {
  Users,
  DollarSign,
  TrendingUp,
  CreditCard,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Clock,
  CheckCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ResellerDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/reseller/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setDashboard(data.dashboard);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'platinum': return 'text-purple-400 bg-purple-500/20';
      case 'gold': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const { reseller, stats, monthly_trend, recent_customers } = dashboard;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reseller Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back, {reseller.name}</p>
        </div>
        <div className={`px-4 py-2 rounded-full ${getTierColor(reseller.tier)}`}>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4" />
            <span className="font-medium capitalize">{reseller.tier} Partner</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-green-400 text-sm flex items-center">
              <ArrowUpRight className="w-4 h-4" />
              12%
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-white">{stats.customer_count}</p>
            <p className="text-gray-400 text-sm">Active Customers</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-green-400 text-sm flex items-center">
              <ArrowUpRight className="w-4 h-4" />
              8%
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-white">{formatCurrency(stats.total_revenue)}</p>
            <p className="text-gray-400 text-sm">Total Revenue</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-sm text-gray-400">{reseller.commission_rate}%</span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-white">{formatCurrency(stats.total_commission)}</p>
            <p className="text-gray-400 text-sm">Total Commission</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <CreditCard className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-white">{formatCurrency(stats.pending_commission)}</p>
            <p className="text-gray-400 text-sm">Pending Commission</p>
          </div>
        </div>
      </div>

      {/* Payout Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h3 className="text-white font-medium">Total Paid</h3>
          </div>
          <p className="text-3xl font-bold text-green-400">{formatCurrency(stats.total_paid)}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-yellow-400" />
            <h3 className="text-white font-medium">Pending Payout</h3>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{formatCurrency(stats.pending_payout)}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-medium">Available Balance</h3>
          </div>
          <p className="text-3xl font-bold text-blue-400">
            {formatCurrency(stats.pending_commission - stats.pending_payout)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-white font-medium mb-4">Monthly Revenue Trend</h3>
          <div className="space-y-3">
            {monthly_trend.length > 0 ? (
              monthly_trend.map((month, index) => (
                <div key={month.month} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300">{month.month}</span>
                  <div className="text-right">
                    <p className="text-white font-medium">{formatCurrency(month.revenue)}</p>
                    <p className="text-green-400 text-sm">+{formatCurrency(month.commission)} commission</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No revenue data yet</p>
            )}
          </div>
        </div>

        {/* Recent Customers */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-white font-medium mb-4">Recent Customers</h3>
          <div className="space-y-3">
            {recent_customers.length > 0 ? (
              recent_customers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Building2 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{customer.organization_name}</p>
                      <p className="text-gray-400 text-sm">
                        {new Date(customer.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    customer.status === 'active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {customer.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No customers yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Commission Rate Info */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-5 border border-blue-500/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Your Commission Rate</h3>
            <p className="text-gray-400 text-sm mt-1">
              Based on your {reseller.tier} tier partnership
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-blue-400">{reseller.commission_rate}%</p>
            <p className="text-gray-400 text-sm">per transaction</p>
          </div>
        </div>
      </div>
    </div>
  );
}
