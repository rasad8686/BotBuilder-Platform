import React from 'react';
import { Link } from 'react-router-dom';
import {
  MoreVertical,
  Send,
  Eye,
  MousePointer,
  Users,
  Calendar
} from 'lucide-react';
import CampaignStatusBadge from './CampaignStatusBadge';
import CampaignTypeBadge from './CampaignTypeBadge';

const CampaignCard = ({ campaign, onAction }) => {
  const [showMenu, setShowMenu] = React.useState(false);

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <Link
            to={campaign.status === 'sent' ? `/email/campaigns/${campaign.id}/report` : `/email/campaigns/${campaign.id}`}
            className="font-medium text-gray-900 hover:text-blue-600 truncate block"
          >
            {campaign.name}
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <CampaignTypeBadge type={campaign.type} />
            <span className="text-xs text-gray-400 truncate">{campaign.subject}</span>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              {campaign.status === 'draft' && (
                <button
                  onClick={() => { onAction('edit', campaign); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
              )}
              {campaign.status === 'sent' && (
                <button
                  onClick={() => { onAction('report', campaign); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  View Report
                </button>
              )}
              <button
                onClick={() => { onAction('duplicate', campaign); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Duplicate
              </button>
              <button
                onClick={() => { onAction('delete', campaign); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <CampaignStatusBadge status={campaign.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Send className="w-3 h-3" />
          </div>
          <p className="text-sm font-medium text-gray-900">{formatNumber(campaign.sent_count)}</p>
          <p className="text-xs text-gray-500">Sent</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Eye className="w-3 h-3" />
          </div>
          <p className="text-sm font-medium text-gray-900">{(campaign.open_rate || 0).toFixed(1)}%</p>
          <p className="text-xs text-gray-500">Opens</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <MousePointer className="w-3 h-3" />
          </div>
          <p className="text-sm font-medium text-gray-900">{(campaign.click_rate || 0).toFixed(1)}%</p>
          <p className="text-xs text-gray-500">Clicks</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {formatNumber(campaign.total_recipients || 0)} recipients
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(campaign.completed_at || campaign.scheduled_at || campaign.created_at)}
        </span>
      </div>
    </div>
  );
};

export default CampaignCard;
