import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function EditBot() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    token: '',
    description: '',
  });

  useEffect(() => {
    fetchBot();
  }, [id]);

  const fetchBot = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/bots/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success && response.data.bot) {
        setFormData({
          name: response.data.bot.name || '',
          token: response.data.bot.token || '',
          description: response.data.bot.description || '',
        });
      }
    } catch (err) {
      setError('Failed to load bot');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/bots/${id}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Bot updated successfully!');
      navigate('/mybots');
    } catch (err) {
      setError('Failed to update bot');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <a href="/mybots" className="text-blue-600 hover:underline mb-4 block">← Back to My Bots</a>
        <h1 className="text-3xl font-bold mb-6">Edit Bot ✏️</h1>
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
            <label className="block font-medium mb-2">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full border p-2 rounded"
              rows="4"
              placeholder="Describe what your bot does..."
            />
          </div>
          
          <div>
            <label className="block font-medium mb-2">Platform *</label>
            <select className="w-full border p-2 rounded">
              <option>Web</option>
            </select>
          </div>
          
          <div className="flex gap-4">
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
              Save Changes ✓
            </button>
            <button type="button" onClick={() => navigate('/mybots')} className="bg-gray-300 px-6 py-2 rounded hover:bg-gray-400">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditBot;