import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function EditBot() {
  const navigate = useNavigate();
  const { botId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    token: '',
    description: '',
  });

  useEffect(() => {
    fetchBotData();
  }, [botId]);

  const fetchBotData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/bots/${botId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setFormData({
        name: response.data.name || '',
        token: response.data.token || '',
        description: response.data.description || '',
      });
      setLoading(false);
    } catch (err) {
      console.error('Fetch bot error:', err);
      setError('Failed to load bot data');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_BASE_URL}/bots/${botId}`,
        { name: formData.name, description: formData.description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data) {
        alert('Bot updated successfully!');
        navigate('/mybots');
      }
    } catch (err) {
      console.error('Update error:', err);
      setError('Failed to update bot');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <a href="/mybots" className="text-blue-600 hover:underline mb-4 block">← Back to My Bots</a>
        <h1 className="text-3xl font-bold mb-6">Edit Bot 🤖</h1>
        <p className="text-gray-600 mb-6">Update your bot information</p>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
          <div>
            <label className="block font-medium mb-2">Bot Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full border p-2 rounded"
              placeholder="e.g., Customer Support Bot"
              required
            />
          </div>

          <div>
            <label className="block font-medium mb-2">Bot Token *</label>
            <input
              type="text"
              value={formData.token}
              className="w-full border p-2 rounded bg-gray-100"
              placeholder="Token (read-only)"
              readOnly
              disabled
            />
            <p className="text-sm text-gray-500 mt-1">Token cannot be changed</p>
          </div>

          <div>
            <label className="block font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full border p-2 rounded"
              rows="4"
              placeholder="Describe what your bot does..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Updating...' : 'Update Bot'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default EditBot;