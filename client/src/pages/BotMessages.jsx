import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

function BotMessages() {
  const navigate = useNavigate();
  const { botId } = useParams();
  const [bot, setBot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    message_type: 'greeting',
    content: '',
    trigger_keywords: ''
  });

  useEffect(() => {
    fetchBot();
    fetchMessages();
  }, []);

  const fetchBot = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:3000/bots/${botId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBot(response.data);
    } catch (err) {
      console.error('Error fetching bot:', err);
    }
  };

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:3000/api/bots/${botId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:3000/api/bots/${botId}/messages`,
        {
          ...formData,
          trigger_keywords: formData.trigger_keywords.split(',').map(k => k.trim())
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Message added successfully!');
      setShowForm(false);
      setFormData({ message_type: 'greeting', content: '', trigger_keywords: '' });
      fetchMessages();
    } catch (err) {
      alert('Failed to add message');
    }
  };

  const handleDelete = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3000/api/bots/${botId}/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Message deleted!');
      fetchMessages();
    } catch (err) {
      alert('Failed to delete message');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-700">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">BotBuilder</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-6">
          <button
            onClick={() => navigate('/my-bots')}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            ← Back to My Bots
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-5xl">🤖</div>
            <div>
              <h2 className="text-3xl font-bold text-gray-800">{bot?.name}</h2>
              <p className="text-gray-600">{bot?.description}</p>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mt-2 inline-block">
                {bot?.platform}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800">Bot Messages 💬</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700"
          >
            {showForm ? 'Cancel' : '+ Add Message'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h4 className="text-xl font-bold text-gray-800 mb-4">Add New Message</h4>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">Message Type</label>
                <select
                  value={formData.message_type}
                  onChange={(e) => setFormData({ ...formData, message_type: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="greeting">Greeting</option>
                  <option value="response">Response</option>
                  <option value="fallback">Fallback</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">Message Content *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter bot response..."
                  required
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">Trigger Keywords</label>
                <input
                  type="text"
                  value={formData.trigger_keywords}
                  onChange={(e) => setFormData({ ...formData, trigger_keywords: e.target.value })}
                  placeholder="hello, hi, hey (comma separated)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">Separate keywords with commas</p>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700"
              >
                Save Message
              </button>
            </form>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No messages yet</h3>
            <p className="text-gray-600 mb-6">Add your first message to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {msg.message_type === 'greeting' ? '👋' : msg.message_type === 'response' ? '💬' : '🤷'}
                    </span>
                    <div>
                      <h4 className="font-bold text-gray-800 capitalize">{msg.message_type}</h4>
                      {msg.trigger_keywords && msg.trigger_keywords.length > 0 && (
                        <div className="flex gap-2 mt-1">
                          {msg.trigger_keywords.map((kw, i) => (
                            <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>
                <p className="text-gray-700">{msg.content}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Added: {new Date(msg.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BotMessages;


