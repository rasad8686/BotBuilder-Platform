import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
        <h2 className="text-4xl font-bold text-gray-800 mb-4">
          Welcome to Dashboard! 🎉
        </h2>
        <p className="text-gray-600 mb-12">Start building your bots here.</p>

        <div className="grid md:grid-cols-3 gap-6">
          {/* My Bots Card */}
          <div 
            onClick={() => navigate('/my-bots')}
            className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition cursor-pointer"
          >
            <h3 className="text-2xl font-bold text-blue-700 mb-2">My Bots</h3>
            <p className="text-gray-600">Manage your bots</p>
          </div>

          {/* Create Bot Card */}
          <div 
            onClick={() => navigate('/create-bot')}
            className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition cursor-pointer"
          >
            <h3 className="text-2xl font-bold text-green-700 mb-2">Create Bot</h3>
            <p className="text-gray-600">Build new bot</p>
          </div>

          {/* Analytics Card */}
          <div 
            onClick={() => navigate('/analytics')}
            className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition cursor-pointer"
          >
            <h3 className="text-2xl font-bold text-purple-700 mb-2">Analytics</h3>
            <p className="text-gray-600">View statistics</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;