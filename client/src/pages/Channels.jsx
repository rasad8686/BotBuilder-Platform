import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Phone,
  Instagram,
  Send,
  MessageCircle,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import ChannelCard from '../components/channels/ChannelCard';
import ChannelSetup from '../components/channels/ChannelSetup';
import ConversationList from '../components/channels/ConversationList';
import ChatView from '../components/channels/ChatView';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Channels() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [selectedChannelType, setSelectedChannelType] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [view, setView] = useState('list'); // list, conversations, chat

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch channels');

      const data = await response.json();
      setChannels(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChannel = (type) => {
    setSelectedChannelType(type);
    setShowAddModal(false);
    setShowSetupWizard(true);
  };

  const handleSetupComplete = async (channelData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(channelData)
      });

      if (!response.ok) throw new Error('Failed to create channel');

      const newChannel = await response.json();
      setChannels([...channels, newChannel]);
      setShowSetupWizard(false);
      setSelectedChannelType(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleViewMessages = (channel) => {
    setSelectedChannel(channel);
    setView('conversations');
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setView('chat');
  };

  const handleBackToList = () => {
    setSelectedChannel(null);
    setSelectedConversation(null);
    setView('list');
  };

  const handleBackToConversations = () => {
    setSelectedConversation(null);
    setView('conversations');
  };

  const filteredChannels = channels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (channel.phone_number && channel.phone_number.includes(searchTerm)) ||
                         (channel.username && channel.username.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterType === 'all' || channel.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const channelTypes = [
    { id: 'whatsapp', name: 'WhatsApp Business', icon: Phone, color: 'bg-green-500', description: 'Connect via WhatsApp Business API' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-500', description: 'Connect Instagram Direct Messages' },
    { id: 'telegram', name: 'Telegram', icon: Send, color: 'bg-blue-500', description: 'Connect Telegram Bot' },
    { id: 'messenger', name: 'Messenger', icon: MessageCircle, color: 'bg-blue-600', description: 'Connect Facebook Messenger' }
  ];

  // Render Chat View
  if (view === 'chat' && selectedChannel && selectedConversation) {
    return (
      <ChatView
        channel={selectedChannel}
        conversation={selectedConversation}
        onBack={handleBackToConversations}
      />
    );
  }

  // Render Conversations View
  if (view === 'conversations' && selectedChannel) {
    return (
      <ConversationList
        channel={selectedChannel}
        onSelectConversation={handleSelectConversation}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-blue-400" />
            Channels
          </h1>
          <p className="text-gray-400 mt-1">
            Manage your messaging channels - WhatsApp, Instagram, Telegram
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Channel
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Channels</p>
              <p className="text-xl font-bold text-white">{channels.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Active</p>
              <p className="text-xl font-bold text-white">
                {channels.filter(c => c.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Pending</p>
              <p className="text-xl font-bold text-white">
                {channels.filter(c => c.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MessageCircle className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Messages</p>
              <p className="text-xl font-bold text-white">
                {channels.reduce((sum, c) => sum + (c.messageCount || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="telegram">Telegram</option>
            <option value="messenger">Messenger</option>
          </select>
          <button
            onClick={fetchChannels}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : filteredChannels.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No channels found</h3>
          <p className="text-gray-400 mb-6">
            {searchTerm || filterType !== 'all'
              ? 'Try adjusting your search or filter'
              : 'Connect your first messaging channel to get started'}
          </p>
          {!searchTerm && filterType === 'all' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Channel
            </button>
          )}
        </div>
      ) : (
        /* Channel Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChannels.map(channel => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onViewMessages={() => handleViewMessages(channel)}
              onRefresh={fetchChannels}
            />
          ))}
        </div>
      )}

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Add New Channel</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-400 mb-6">
              Select a messaging platform to connect
            </p>

            <div className="grid grid-cols-2 gap-4">
              {channelTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => handleAddChannel(type.id)}
                  className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-blue-500 hover:bg-gray-700 transition-all text-left group"
                >
                  <div className={`w-10 h-10 ${type.color} rounded-lg flex items-center justify-center mb-3`}>
                    <type.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                    {type.name}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">{type.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Setup Wizard */}
      {showSetupWizard && selectedChannelType && (
        <ChannelSetup
          type={selectedChannelType}
          onComplete={handleSetupComplete}
          onClose={() => {
            setShowSetupWizard(false);
            setSelectedChannelType(null);
          }}
        />
      )}
    </div>
  );
}
