import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  Paperclip,
  Image,
  Smile,
  MoreVertical,
  Phone,
  Video,
  User,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  X,
  FileText,
  Download
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ChatView({ channel, conversation, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchMessages();
  }, [channel.id, conversation.contact_id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/channels/${channel.id}/conversation/${encodeURIComponent(conversation.contact_id)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch messages');

      const data = await response.json();
      setMessages(data);
    } catch (err) {
      // Silent fail
      // Demo messages
      setMessages([
        {
          id: 1,
          direction: 'inbound',
          content: 'Hi, I need help with my order',
          message_type: 'text',
          status: 'read',
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          direction: 'outbound',
          content: 'Hello! I\'d be happy to help. Could you please provide your order number?',
          message_type: 'text',
          status: 'delivered',
          created_at: new Date(Date.now() - 55 * 60 * 1000).toISOString()
        },
        {
          id: 3,
          direction: 'inbound',
          content: 'Sure, it\'s #12345',
          message_type: 'text',
          status: 'read',
          created_at: new Date(Date.now() - 50 * 60 * 1000).toISOString()
        },
        {
          id: 4,
          direction: 'outbound',
          content: 'Thank you! I can see your order was shipped yesterday. Here\'s the tracking info:',
          message_type: 'text',
          status: 'delivered',
          created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString()
        },
        {
          id: 5,
          direction: 'outbound',
          content: 'https://tracking.example.com/12345',
          message_type: 'text',
          status: 'delivered',
          created_at: new Date(Date.now() - 44 * 60 * 1000).toISOString()
        },
        {
          id: 6,
          direction: 'inbound',
          content: 'Thanks for the information!',
          message_type: 'text',
          status: 'read',
          created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');

      // Add optimistic message
      const tempMessage = {
        id: Date.now(),
        direction: 'outbound',
        content: newMessage,
        message_type: selectedFile ? 'image' : 'text',
        media_url: selectedFile ? URL.createObjectURL(selectedFile) : null,
        status: 'sending',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      setSelectedFile(null);

      const response = await fetch(`${API_URL}/api/channels/${channel.id}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: conversation.contact_id,
          type: selectedFile ? 'image' : 'text',
          content: newMessage,
          mediaUrl: selectedFile ? URL.createObjectURL(selectedFile) : undefined
        })
      });

      if (!response.ok) throw new Error('Failed to send message');

      // Update message status
      setMessages(prev => prev.map(msg =>
        msg.id === tempMessage.id ? { ...msg, status: 'sent' } : msg
      ));
    } catch (err) {
      // Silent fail
      // Mark as failed
      setMessages(prev => prev.map(msg =>
        msg.status === 'sending' ? { ...msg, status: 'failed' } : msg
      ));
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setShowAttachMenu(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-500" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-500" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-500" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-400" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      default:
        return null;
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
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
            <div>
              <h1 className="font-semibold text-white">
                {conversation.contact_name || conversation.contact_id}
              </h1>
              <p className="text-xs text-gray-400">{conversation.contact_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors">
              <Phone className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors">
              <Video className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date Separator */}
              <div className="flex items-center justify-center my-4">
                <div className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400">
                  {date}
                </div>
              </div>

              {/* Messages */}
              {dateMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'} mb-2`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      message.direction === 'outbound'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-gray-700 text-white rounded-bl-md'
                    }`}
                  >
                    {/* Media Content */}
                    {message.media_url && (
                      <div className="mb-2">
                        {message.message_type === 'image' && (
                          <img
                            src={message.media_url}
                            alt="Shared image"
                            className="rounded-lg max-w-full"
                          />
                        )}
                        {message.message_type === 'document' && (
                          <div className="flex items-center gap-2 p-2 bg-gray-600/50 rounded-lg">
                            <FileText className="w-8 h-8 text-gray-300" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{message.media_filename || 'Document'}</p>
                              <p className="text-xs text-gray-400">{message.media_mime_type}</p>
                            </div>
                            <button className="p-1 hover:bg-gray-600 rounded">
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Content */}
                    {message.content && (
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    )}

                    {/* Time and Status */}
                    <div className={`flex items-center gap-1 mt-1 ${
                      message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                    }`}>
                      <span className="text-xs opacity-70">{formatTime(message.created_at)}</span>
                      {message.direction === 'outbound' && getStatusIcon(message.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center gap-3 p-2 bg-gray-700 rounded-lg">
            {selectedFile.type.startsWith('image/') ? (
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Preview"
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-600 rounded-lg flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm text-white truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-400">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 bg-gray-800 border-t border-gray-700 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Attachment Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {showAttachMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowAttachMenu(false)}
                />
                <div className="absolute bottom-12 left-0 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-20 py-2 w-48">
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current.accept = 'image/*';
                      fileInputRef.current.click();
                    }}
                    className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-600 flex items-center gap-2"
                  >
                    <Image className="w-4 h-4 text-green-400" />
                    Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current.accept = '.pdf,.doc,.docx,.txt';
                      fileInputRef.current.click();
                    }}
                    className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-600 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    Document
                  </button>
                </div>
              </>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Message Input */}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />

          {/* Emoji Button */}
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={sending || (!newMessage.trim() && !selectedFile)}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
