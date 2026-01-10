import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Send,
  CheckCircle,
  Eye,
  MousePointer,
  UserMinus,
  AlertTriangle,
  Download,
  Calendar,
  Clock,
  Users,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useCampaignReportQuery } from '../../hooks/email/useCampaigns';
import OpenRateChart from '../../components/email/campaigns/OpenRateChart';
import ClickMapWidget from '../../components/email/campaigns/ClickMapWidget';
import DeviceBreakdownChart from '../../components/email/campaigns/DeviceBreakdownChart';
import LocationMapWidget from '../../components/email/campaigns/LocationMapWidget';
import RecipientStatusTable from '../../components/email/campaigns/RecipientStatusTable';

const CampaignReportPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');

  const { data: report, isLoading, refetch } = useCampaignReportQuery(id);

  const formatNumber = (num) => {
    if (!num) return '0';
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

  const getStatusColor = (status) => {
    const colors = {
      sent: 'bg-green-100 text-green-700',
      sending: 'bg-yellow-100 text-yellow-700',
      scheduled: 'bg-blue-100 text-blue-700',
      paused: 'bg-orange-100 text-orange-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const handleExport = () => {
    // Export report as CSV
    const recipients = report?.recipients || report?.report?.recipients || [];
    const csvData = recipients.map(r => ({
      email: r.email,
      status: r.status,
      opened: r.opened ? 'Yes' : 'No',
      clicked: r.clicked ? 'Yes' : 'No',
      opened_at: r.opened_at || '',
      clicked_at: r.clicked_at || ''
    }));

    if (csvData.length === 0) {
      alert('No recipient data available to export');
      return;
    }

    const headers = ['Email', 'Status', 'Opened', 'Clicked', 'Opened At', 'Clicked At'];
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-report-${id}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-500">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Report not found</h2>
          <p className="text-gray-500 mb-4">The campaign report you're looking for doesn't exist.</p>
          <Link
            to="/email/campaigns"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Campaigns
          </Link>
        </div>
      </div>
    );
  }

  // Handle both API response formats: { report: { campaign, metrics } } or { campaign, stats }
  const campaign = report?.report?.campaign || report?.campaign || {};
  const stats = report?.report?.metrics || report?.stats || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/email/campaigns')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-gray-900">{campaign.name}</h1>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Sent {formatDate(campaign.completed_at || campaign.started_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {formatNumber(stats.sent)} recipients
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refetch}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-6 gap-4 mb-6">
          <StatCard
            icon={Send}
            label="Sent"
            value={formatNumber(stats.sent)}
            color="blue"
          />
          <StatCard
            icon={CheckCircle}
            label="Delivered"
            value={formatNumber(stats.delivered)}
            subValue={`${((stats.delivered / stats.sent) * 100 || 0).toFixed(1)}%`}
            color="green"
          />
          <StatCard
            icon={Eye}
            label="Opens"
            value={formatNumber(stats.opens)}
            subValue={`${((stats.opens / stats.delivered) * 100 || 0).toFixed(1)}%`}
            color="purple"
            trend={stats.openTrend}
          />
          <StatCard
            icon={MousePointer}
            label="Clicks"
            value={formatNumber(stats.clicks)}
            subValue={`${((stats.clicks / stats.delivered) * 100 || 0).toFixed(1)}%`}
            color="indigo"
            trend={stats.clickTrend}
          />
          <StatCard
            icon={UserMinus}
            label="Unsubscribed"
            value={formatNumber(stats.unsubscribed)}
            subValue={`${((stats.unsubscribed / stats.delivered) * 100 || 0).toFixed(2)}%`}
            color="orange"
          />
          <StatCard
            icon={AlertTriangle}
            label="Bounced"
            value={formatNumber(stats.bounced)}
            subValue={`${((stats.bounced / stats.sent) * 100 || 0).toFixed(2)}%`}
            color="red"
          />
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
          {['overview', 'engagement', 'recipients'].map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === section
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>

        {/* Content Sections */}
        {activeSection === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Open Rate Trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Open Rate Over Time</h3>
              <div style={{ minHeight: 256 }}>
                <OpenRateChart data={report.openTrend || []} />
              </div>
            </div>

            {/* Click Map */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Link Performance</h3>
              <ClickMapWidget links={report.clickMap || []} totalClicks={stats.clicks} />
            </div>

            {/* Device Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Device Breakdown</h3>
              <div style={{ minHeight: 256 }}>
                <DeviceBreakdownChart data={report.deviceBreakdown || {}} />
              </div>
            </div>

            {/* Location Map */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Opens by Location</h3>
              <LocationMapWidget locations={report.locationData || []} />
            </div>
          </div>
        )}

        {activeSection === 'engagement' && (
          <div className="space-y-6">
            {/* Detailed Click Map */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Detailed Link Clicks</h3>
              <div className="space-y-3">
                {(report.clickMap || []).map((link, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{link.url}</p>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          Open link <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">{link.clicks}</p>
                      <p className="text-xs text-gray-500">
                        {((link.clicks / stats.clicks) * 100 || 0).toFixed(1)}% of clicks
                      </p>
                    </div>
                  </div>
                ))}
                {(!report.clickMap || report.clickMap.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    No link clicks recorded yet
                  </div>
                )}
              </div>
            </div>

            {/* Hourly Opens */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Opens by Hour (First 48 Hours)</h3>
              <div style={{ minHeight: 320 }}>
                <OpenRateChart data={report.openTrend || []} detailed />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'recipients' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <RecipientStatusTable
              campaignId={id}
              recipients={report.recipients || []}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, subValue, color, trend }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        {subValue && <p className="text-sm font-medium text-gray-600">{subValue}</p>}
      </div>
    </div>
  );
};

export default CampaignReportPage;
