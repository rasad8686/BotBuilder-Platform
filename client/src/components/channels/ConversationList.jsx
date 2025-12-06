import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Phone,
  Instagram,
  Send,
  MessageCircle,
  MessageSquare,
  User,
  Clock,
  CheckCheck,
  Filter
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

export default function ConversationList({ channel, onSelectConversation, onBack }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const Icon = channelIcons[channel.type] || MessageSquare;
  const colorClass = channelColors[channel.type] || 'bg-gray-500';

  useEffect(() => {
    fetchConversations();
  }, [channel.id]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels/${channel.id}/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch conversations');

      const data = await response.json();
      setConversations(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Demo data for display
      setConversations([
        {
          id: 1,
          contact_id: '+1234567890',
          contact_name: 'John Doe',
          last_message: 'Thanks for the information!',
          last_message_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          unread_count: 2,
          status: 'active'
        },
        {
          id: 2,
          contact_id: '+0987654321',
          contact_name: 'Jane Smith',
          last_message: 'Can you help me with my order?',
          last_message_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          unread_count: 0,
          status: 'active'
        },
        {
          id: 3,
          contact_id: '+1122334455',
          contact_name: 'Mike Johnson',
          last_message: 'Perfect, thanks!',
          last_message_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          unread_count: 0,
          status: 'closed'
        },
        {
          id: 4,
          contact_id: '+5566778899',
          contact_name: 'Sarah Wilson',
          last_message: 'I have a question about pricing',
          last_message_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          unread_count: 1,
          status: 'active'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60 * 1000) {
      return 'Just now';
    } else if (diff < 60 * 60 * 1000) {
      const mins = Math.floor(diff / (60 * 1000));
      return `${mins}m ago`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}h ago`;
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredConversations = conversations.filter(conv => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (conv.contact_name && conv.contact_name.toLowerCase().includes(searchLower)) ||
      (conv.contact_id && conv.contact_id.includes(searchTerm)) ||
      (conv.last_message && conv.last_message.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">{channel.name}</h1>
              <p className="text-sm text-gray-400">{conversations.length} conversations</p>
            </div>
          </div>
          <button
            onClick={fetchConversations}
            className="ml-auto p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No conversations</h3>
            <p className="text-gray-400">
              {searchTerm ? 'No matching conversations found' : 'Start receiving messages to see conversations here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredConversations.map(conversation => (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className="w-full p-4 flex items-center gap-3 hover:bg-gray-800 transition-colors text-left"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                    {conversation.contact_avatar ? (
                      <img
                        src={conversation.contact_avatar}
                        alt={conversation.contact_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-300 font-medium">
                        {getInitials(conversation.contact_name)}
                      </span>
                    )}
                  </div>
                  {conversation.unread_count > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white font-medium">
                        {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-medium truncate ${conversation.unread_count > 0 ? 'text-white' : 'text-gray-300'}`}>
                      {conversation.contact_name || conversation.contact_id}
                    </h3>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {formatTime(conversation.last_message_time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${conversation.unread_count > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                      {conversation.last_message}
                    </p>
                    {conversation.status === 'closed' && (
                      <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full flex-shrink-0">
                        Closed
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="p-4 bg-gray-800 border-t border-gray-700 flex-shrink-0">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-bold text-white">
              {conversations.filter(c => c.status === 'active').length}
            </p>
            <p className="text-xs text-gray-400">Active</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-400">
              {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)}
            </p>
            <p className="text-xs text-gray-400">Unread</p>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-400">
              {conversations.filter(c => c.status === 'closed').length}
            </p>
            <p className="text-xs text-gray-400">Closed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
