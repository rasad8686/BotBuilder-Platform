import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

function EditBot() {
  const navigate = useNavigate();
  const { botId } = useParams();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    platform: 'web'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBot();
  }, []);

  const fetchBot = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:3000/bots/${botId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFormData({
        name: response.data.name,
        description: response.data.description,
        platform: response.data.platform
      });
      setLoading(false);
    } catch (err) {
      setError('Failed to load bot');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:3000/bots/${botId}`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      alert('Bot updated successfully!');
      navigate('/my-bots');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update bot');
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

      <div className="max-w-2xl mx-auto mt-12 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-6">
            <button
              onClick={() => navigate('/my-bots')}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              ← Back to My Bots
            </button>
          </div>

          <h2 className="text-3xl font-bold text-gray-800 mb-2">Edit Bot ✏️</h2>
          <p className="text-gray-600 mb-8">Update your bot information</p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                Bot Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Customer Support Bot"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe what your bot does..."
                required
                rows="4"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                Platform *
              </label>
              <select
                name="platform"
                value={formData.platform}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="web">Web</option>
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="slack">Slack</option>
                <option value="discord">Discord</option>
              </select>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition"
              >
                Save Changes ✓
              </button>
              <button
                type="button"
                onClick={() => navigate('/my-bots')}
                className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">
              💡 <strong>Tip:</strong> Make sure to save your changes before leaving this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditBot;