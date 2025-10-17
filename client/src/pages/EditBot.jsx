import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function CreateBot() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    token: '',
    description: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/bots`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success) {
        alert('Bot created successfully!');
        navigate('/mybots');
      }
    } catch (err) {
      setError('Failed to create bot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <a href="/mybots" className="text-blue-600 hover:underline mb-4 block">← Back to My Bots</a>
        <h1 className="text-3xl font-bold mb-6">Create New Bot 🤖</h1>
        <p className="text-gray-600 mb-6">Set up your new chatbot</p>
        
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
              onChange={(e) => setFormData({...formData, token: e.target.value})}
              className="w-full border p-2 rounded"
              placeholder="Paste your bot token here"
              required
            />
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
            {loading ? 'Creating...' : 'Create Bot'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateBot;

