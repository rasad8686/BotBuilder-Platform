import React, { useState } from 'react';
import {
  Phone,
  Instagram,
  Send,
  MessageCircle,
  MessageSquare,
  Settings,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  Trash2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const channelIcons = {
  whatsapp: Phone,
  instagram: Instagram,
  telegram: Send,
  messenger: MessageCircle,
  sms: MessageSquare
};

const channelColors = {
  whatsapp: 'bg-green-500',
  instagram: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
  telegram: 'bg-blue-500',
  messenger: 'bg-blue-600',
  sms: 'bg-gray-500'
};

const statusConfig = {
  active: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Active' },
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
  inactive: { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Inactive' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Error' }
};

export default function ChannelCard({ channel, onViewMessages, onRefresh }) {
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const Icon = channelIcons[channel.type] || MessageSquare;
  const colorClass = channelColors[channel.type] || 'bg-gray-500';
  const status = statusConfig[channel.status] || statusConfig.inactive;
  const StatusIcon = status.icon;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this channel?')) return;

    try {
      setDeleting(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels/${channel.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete channel');

      onRefresh();
    } catch (err) {
      // Silent fail
      alert('Failed to delete channel');
    } finally {
      setDeleting(false);
      setShowMenu(false);
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    // Format: +1 234 567 8900
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      return `+${cleaned.slice(0, 1)} ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition-all overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${colorClass} rounded-xl flex items-center justify-center shadow-lg`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{channel.name}</h3>
              <p className="text-sm text-gray-400 capitalize">{channel.type}</p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 w-48 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-20 py-1">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      // Open configure modal
                    }}
                    className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-600 flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Configure
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onRefresh();
                    }}
                    className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-600 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                  <hr className="my-1 border-gray-600" />
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-600 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Status Badge */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${status.bg} rounded-full mb-4`}>
          <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
          <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
        </div>

        {/* Channel Info */}
        <div className="space-y-2 mb-4">
          {channel.phone_number && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-gray-500" />
              <span className="text-gray-300">{formatPhoneNumber(channel.phone_number)}</span>
            </div>
          )}
          {channel.username && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">@</span>
              <span className="text-gray-300">{channel.username}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-700/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-white">{channel.messageCount || 0}</p>
            <p className="text-xs text-gray-400">Messages</p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-blue-400">{channel.inboundCount || 0}</p>
            <p className="text-xs text-gray-400">Inbound</p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-green-400">{channel.outboundCount || 0}</p>
            <p className="text-xs text-gray-400">Outbound</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onViewMessages}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <MessageSquare className="w-4 h-4" />
            View Messages
          </button>
          <button
            className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Footer - Last Activity */}
      {channel.last_activity && (
        <div className="px-4 py-2 bg-gray-700/30 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Last activity: {new Date(channel.last_activity).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
