import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

export default function SuperadminDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Users management state
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState('');

  // Organizations management state
  const [organizations, setOrganizations] = useState([]);
  const [orgsPage, setOrgsPage] = useState(1);
  const [orgsTotal, setOrgsTotal] = useState(0);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'organizations') {
      loadOrganizations();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, usersPage, orgsPage, logsPage, usersSearch]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/superadmin/dashboard');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/superadmin/users', {
        params: { page: usersPage, limit: 20, search: usersSearch }
      });
      if (response.data.success) {
        setUsers(response.data.data.users);
        setUsersTotal(response.data.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await api.get('/api/superadmin/organizations', {
        params: { page: orgsPage, limit: 20 }
      });
      if (response.data.success) {
        setOrganizations(response.data.data.organizations);
        setOrgsTotal(response.data.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const response = await api.get('/api/superadmin/audit-logs', {
        params: { page: logsPage, limit: 50 }
      });
      if (response.data.success) {
        setAuditLogs(response.data.data.logs);
        setLogsTotal(response.data.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const toggleSuperadmin = async (userId, currentStatus) => {
    if (!confirm(currentStatus
      ? t('superadmin.confirmRevokeSuperadmin')
      : t('superadmin.confirmGrantSuperadmin')
    )) return;

    try {
      await api.put(`/api/superadmin/users/${userId}/superadmin`, {
        is_superadmin: !currentStatus
      });
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update superadmin status');
    }
  };

  const updateOrgPlan = async (orgId, newPlan) => {
    try {
      await api.put(`/api/superadmin/organizations/${orgId}/plan`, {
        plan_tier: newPlan
      });
      loadOrganizations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update plan');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">&#128081;</span>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white">
            {t('superadmin.dashboard', 'Superadmin Dashboard')}
          </h1>
          <span className="px-3 py-1 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full">
            {t('sidebar.superadminBadge')}
          </span>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {t('superadmin.dashboardSubtitle', 'Platform-wide administration and monitoring')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 dark:border-slate-700">
        {[
          { id: 'overview', label: t('superadmin.overview', 'Overview'), icon: '&#128202;' },
          { id: 'users', label: t('superadmin.users', 'Users'), icon: '&#128101;' },
          { id: 'organizations', label: t('superadmin.organizations', 'Organizations'), icon: '&#127970;' },
          { id: 'audit', label: t('superadmin.auditLogs', 'Audit Logs'), icon: '&#128203;' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-purple-600 border-purple-600'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-purple-600'
            }`}
          >
            <span dangerouslySetInnerHTML={{ __html: tab.icon }} className="mr-2"></span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title={t('superadmin.totalUsers', 'Total Users')}
              value={stats.totalUsers}
              icon="&#128101;"
              color="purple"
            />
            <StatCard
              title={t('superadmin.totalOrganizations', 'Total Organizations')}
              value={stats.totalOrganizations}
              icon="&#127970;"
              color="blue"
            />
            <StatCard
              title={t('superadmin.totalBots', 'Total Bots')}
              value={stats.totalBots}
              icon="&#129302;"
              color="green"
            />
            <StatCard
              title={t('superadmin.superadmins', 'Superadmins')}
              value={stats.totalSuperadmins}
              icon="&#128081;"
              color="yellow"
            />
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plan Distribution */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                {t('superadmin.planDistribution', 'Plan Distribution')}
              </h3>
              <div className="space-y-3">
                {stats.planDistribution.map(plan => (
                  <div key={plan.plan_tier} className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400 capitalize">
                      {plan.plan_tier}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${(plan.count / stats.totalOrganizations) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-gray-800 dark:text-white font-medium w-12 text-right">
                        {plan.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Organizations */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                {t('superadmin.topOrganizations', 'Top Organizations by Bots')}
              </h3>
              <div className="space-y-3">
                {stats.topOrganizations.slice(0, 5).map((org, index) => (
                  <div key={org.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-purple-600 bg-purple-100 dark:bg-purple-900 rounded-full">
                        {index + 1}
                      </span>
                      <span className="text-gray-800 dark:text-white">{org.name}</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">
                      {org.bot_count} bots
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              {t('superadmin.recentActivity', 'Recent Activity')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('superadmin.newUsersLast30Days', 'New users (last 30 days)')}
                </p>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">
                  {stats.recentRegistrations}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('superadmin.adminActionsLast7Days', 'Admin actions (last 7 days)')}
                </p>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">
                  {stats.recentActivity}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700">
            <input
              type="text"
              placeholder={t('superadmin.searchUsers', 'Search users by email or name...')}
              value={usersSearch}
              onChange={(e) => setUsersSearch(e.target.value)}
              className="w-full md:w-96 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.user', 'User')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.email', 'Email')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.organizations', 'Organizations')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.status', 'Status')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-800 dark:text-white">{user.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{user.email}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{user.org_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {user.is_superadmin && (
                          <span className="px-2 py-1 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full">
                            SUPER
                          </span>
                        )}
                        {user.email_verified ? (
                          <span className="px-2 py-1 text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 rounded-full">
                            {t('superadmin.verified', 'Verified')}
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                            {t('superadmin.unverified', 'Unverified')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSuperadmin(user.id, user.is_superadmin)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          user.is_superadmin
                            ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}
                      >
                        {user.is_superadmin
                          ? t('superadmin.revokeSuperadmin', 'Revoke')
                          : t('superadmin.grantSuperadmin', 'Grant Superadmin')
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('superadmin.showingUsers', 'Showing {{count}} of {{total}} users', {
                count: users.length,
                total: usersTotal
              })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                disabled={usersPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-lg disabled:opacity-50"
              >
                {t('common.previous', 'Previous')}
              </button>
              <button
                onClick={() => setUsersPage(p => p + 1)}
                disabled={users.length < 20}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-lg disabled:opacity-50"
              >
                {t('common.next', 'Next')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Organizations Tab */}
      {activeTab === 'organizations' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.organization', 'Organization')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.owner', 'Owner')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.members', 'Members')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.bots', 'Bots')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.plan', 'Plan')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {organizations.map(org => (
                  <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-gray-800 dark:text-white font-medium">{org.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{org.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-gray-800 dark:text-white">{org.owner_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{org.owner_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{org.member_count}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{org.bot_count}</td>
                    <td className="px-4 py-3">
                      <select
                        value={org.plan_tier}
                        onChange={(e) => updateOrgPlan(org.id, e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white"
                      >
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('superadmin.showingOrgs', 'Showing {{count}} of {{total}} organizations', {
                count: organizations.length,
                total: orgsTotal
              })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOrgsPage(p => Math.max(1, p - 1))}
                disabled={orgsPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-lg disabled:opacity-50"
              >
                {t('common.previous', 'Previous')}
              </button>
              <button
                onClick={() => setOrgsPage(p => p + 1)}
                disabled={organizations.length < 20}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-lg disabled:opacity-50"
              >
                {t('common.next', 'Next')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.timestamp', 'Timestamp')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.user', 'User')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.action', 'Action')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.resource', 'Resource')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('superadmin.ipAddress', 'IP Address')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-800 dark:text-white">{log.user_name || log.user_email || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        log.action.includes('DENIED') || log.action.includes('BLOCKED')
                          ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                          : log.action.includes('SUCCESS') || log.action.includes('GRANT')
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {log.resource_type ? `${log.resource_type}${log.resource_id ? `:${log.resource_id}` : ''}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('superadmin.showingLogs', 'Showing {{count}} of {{total}} logs', {
                count: auditLogs.length,
                total: logsTotal
              })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                disabled={logsPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-lg disabled:opacity-50"
              >
                {t('common.previous', 'Previous')}
              </button>
              <button
                onClick={() => setLogsPage(p => p + 1)}
                disabled={auditLogs.length < 50}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-lg disabled:opacity-50"
              >
                {t('common.next', 'Next')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon, color }) {
  const colorClasses = {
    purple: 'from-purple-500 to-purple-600',
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-orange-500'
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${colorClasses[color]} flex items-center justify-center text-white text-2xl`}>
          <span dangerouslySetInnerHTML={{ __html: icon }}></span>
        </div>
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-sm">{title}</p>
      <p className="text-3xl font-bold text-gray-800 dark:text-white">{value.toLocaleString()}</p>
    </div>
  );
}
