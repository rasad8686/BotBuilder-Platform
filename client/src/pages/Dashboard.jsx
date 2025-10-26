import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://botbuilder-platform.onrender.com";

function Dashboard() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchBots();
  }, []);

  useEffect(() => {
    if (location.state?.botCreated) {
      setSuccessMessage("Bot created successfully!");
      // Clear the state to prevent showing on refresh
      window.history.replaceState({}, document.title);
      // Auto-hide after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  }, [location]);

  const fetchBots = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/bots`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setBots(response.data.bots || response.data || []);
    } catch (err) {
      console.error('Fetch bots error:', err);

      if (!err.response) {
        setError("Network error: Unable to connect to server");
      } else if (err.response?.status === 401) {
        localStorage.clear();
        navigate("/login");
      } else {
        setError(err.response?.data?.message || "Failed to fetch bots");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bot?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/bots/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBots(bots.filter(bot => bot.id !== id));
      setSuccessMessage("Bot deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error('Delete bot error:', err);
      const errorMsg = !err.response
        ? "Network error: Unable to connect to server"
        : (err.response?.data?.message || "Failed to delete bot");
      alert(errorMsg);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Bots 🤖</h1>
            <p className="text-gray-600">Manage your chatbots</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/create-bot")}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              + Create New Bot
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 flex items-center gap-2">
            ✅ {successMessage}
          </div>
        )}

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

        {bots.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold mb-2">No bots yet</h2>
            <p className="text-gray-600 mb-6">Create your first bot to get started!</p>
            <button
              onClick={() => navigate("/create-bot")}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Create Your First Bot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <div key={bot.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-3xl">🤖</div>
                  <button
                    onClick={() => handleDelete(bot.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </div>
                <h3 className="text-xl font-bold mb-2">{bot.name}</h3>
                <p className="text-gray-600 mb-4">{bot.description}</p>
                <div className="text-xs text-gray-400">
                  Token: {bot.token}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
