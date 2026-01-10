import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Plus,
  Search,
  Filter,
  Calendar,
  MoreVertical,
  Copy,
  Trash2,
  BarChart3,
  Play,
  Pause,
  Edit2,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Eye,
  MousePointer,
  Users,
  TrendingUp
} from 'lucide-react';
import { useCampaignsQuery, useDeleteCampaignMutation, useDuplicateCampaignMutation } from '../../hooks/email/useCampaigns';

// ActionDropdown component with dynamic positioning
const ActionDropdown = ({ campaign, isOpen, onToggle, onEdit, onViewReport, onDuplicate, onDelete, navigate }) => {
  const [openUpward, setOpenUpward] = useState(false);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const dropdownHeight = 150;

      setOpenUpward(spaceBelow < dropdownHeight);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={onToggle}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1
            ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          {campaign.status === 'draft' && (
            <button
              onClick={() => navigate(`/email/campaigns/${campaign.id}`)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
          {campaign.status === 'sent' && (
            <button
              onClick={() => navigate(`/email/campaigns/${campaign.id}/report`)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              View Report
            </button>
          )}
          <button
            onClick={onDuplicate}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Duplicate
          </button>
          <button
            onClick={onDelete}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

const CampaignsListPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sortBy, setSortBy] = useState('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const { data, isLoading, refetch } = useCampaignsQuery({
    status: activeTab === 'all' ? undefined : activeTab,
    type: typeFilter || undefined,
    search: searchQuery || undefined,
    sortBy,
    dateStart: dateRange.start || undefined,
    dateEnd: dateRange.end || undefined
  });

  const deleteMutation = useDeleteCampaignMutation();
  const duplicateMutation = useDuplicateCampaignMutation();

  const campaigns = data?.campaigns || [];
  const stats = data?.stats || {
    totalSent: 0,
    avgOpenRate: 0,
    avgClickRate: 0
  };

  const statusTabs = [
    { id: 'all', label: 'All', count: data?.counts?.all || 0 },
    { id: 'draft', label: 'Draft', count: data?.counts?.draft || 0 },
    { id: 'scheduled', label: 'Scheduled', count: data?.counts?.scheduled || 0 },
    { id: 'sending', label: 'Sending', count: data?.counts?.sending || 0 },
    { id: 'sent', label: 'Sent', count: data?.counts?.sent || 0 },
    { id: 'paused', label: 'Paused', count: data?.counts?.paused || 0 }
  ];

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-700',
      sending: 'bg-yellow-100 text-yellow-700',
      sent: 'bg-green-100 text-green-700',
      paused: 'bg-orange-100 text-orange-700',
      cancelled: 'bg-red-100 text-red-700'
    };

    const icons = {
      draft: Edit2,
      scheduled: Clock,
      sending: RefreshCw,
      sent: CheckCircle,
      paused: Pause,
      cancelled: XCircle
    };

    const Icon = icons[status] || AlertCircle;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        <Icon className={`w-3 h-3 ${status === 'sending' ? 'animate-spin' : ''}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const styles = {
      broadcast: 'bg-purple-100 text-purple-700',
      automated: 'bg-blue-100 text-blue-700',
      drip: 'bg-teal-100 text-teal-700'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[type] || 'bg-gray-100 text-gray-700'}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const handleDelete = async (campaign) => {
    if (window.confirm(`Are you sure you want to delete "${campaign.name}"?`)) {
      await deleteMutation.mutateAsync(campaign.id);
      setSelectedCampaign(null);
    }
  };

  const handleDuplicate = async (campaign) => {
    await duplicateMutation.mutateAsync(campaign.id);
    setSelectedCampaign(null);
    refetch();
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-gray-500 mt-1">Create and manage your email marketing campaigns</p>
        </div>
        <Link
          to="/email/campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </Link>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Sent</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(stats.totalSent)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Eye className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Open Rate</p>
              <p className="text-xl font-bold text-gray-900">{stats.avgOpenRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <MousePointer className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Click Rate</p>
              <p className="text-xl font-bold text-gray-900">{stats.avgClickRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded-full text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="broadcast">Broadcast</option>
            <option value="automated">Automated</option>
            <option value="drip">Drip</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Recent</option>
            <option value="sent_date">Sent Date</option>
            <option value="performance">Performance</option>
          </select>

          {/* Toggle Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-colors ${
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => {
                setTypeFilter('');
                setDateRange({ start: '', end: '' });
                setSearchQuery('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-500">Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns found</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first email campaign</p>
            <Link
              to="/email/campaigns/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Recipients</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sent / Delivered</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Open Rate</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Click Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{campaign.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getTypeBadge(campaign.type)}
                          <span className="text-xs text-gray-400">{campaign.subject}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(campaign.status)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{formatNumber(campaign.total_recipients || 0)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-600">
                      {formatNumber(campaign.sent_count || 0)} / {formatNumber(campaign.delivered_count || 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${Math.min(campaign.open_rate || 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {(campaign.open_rate || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${Math.min(campaign.click_rate || 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {(campaign.click_rate || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">
                      {campaign.completed_at ? formatDate(campaign.completed_at) : campaign.scheduled_at ? formatDate(campaign.scheduled_at) : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionDropdown
                      campaign={campaign}
                      isOpen={selectedCampaign === campaign.id}
                      onToggle={() => setSelectedCampaign(selectedCampaign === campaign.id ? null : campaign.id)}
                      onDuplicate={() => handleDuplicate(campaign)}
                      onDelete={() => handleDelete(campaign)}
                      navigate={navigate}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CampaignsListPage;
