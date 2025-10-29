import { useNavigate } from 'react-router-dom';

/**
 * Reusable Bot Card Component
 * @param {Object} bot - Bot object from API
 * @param {function} onDelete - Delete handler
 */
export default function BotCard({ bot, onDelete }) {
  const navigate = useNavigate();

  // Platform icons and colors
  const platformConfig = {
    telegram: { icon: '✈️', color: 'bg-blue-100 text-blue-800' },
    whatsapp: { icon: '💬', color: 'bg-green-100 text-green-800' },
    discord: { icon: '🎮', color: 'bg-indigo-100 text-indigo-800' },
    slack: { icon: '💼', color: 'bg-purple-100 text-purple-800' },
    messenger: { icon: '💌', color: 'bg-pink-100 text-pink-800' }
  };

  const platform = bot.platform?.toLowerCase() || 'telegram';
  const platformInfo = platformConfig[platform] || platformConfig.telegram;

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-100">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2 truncate">
            {bot.name}
          </h3>

          {/* Platform Badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${platformInfo.color}`}>
              <span>{platformInfo.icon}</span>
              <span className="capitalize">{platform}</span>
            </span>

            {/* Active Status Badge */}
            {bot.is_active !== undefined && (
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                bot.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${bot.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                {bot.is_active ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
        </div>

        {/* Bot Icon */}
        <div className="text-4xl ml-2">
          🤖
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-600 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
        {bot.description || 'No description provided'}
      </p>

      {/* Metadata */}
      <div className="text-xs text-gray-500 mb-4 space-y-1">
        <div className="flex items-center gap-2">
          <span>📅 Created:</span>
          <span>{formatDate(bot.created_at)}</span>
        </div>
        {bot.webhook_url && (
          <div className="flex items-center gap-2 truncate">
            <span>🔗 Webhook:</span>
            <span className="truncate">{bot.webhook_url}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/bot/${bot.id}/edit`)}
          className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 text-sm"
          title="Edit bot"
        >
          ✏️ <span>Edit</span>
        </button>

        <button
          onClick={() => navigate(`/bot/${bot.id}/messages`)}
          className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-1 text-sm"
          title="Manage messages"
        >
          💬 <span>Messages</span>
        </button>

        <button
          onClick={() => onDelete(bot)}
          className="bg-red-600 text-white py-2 px-3 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center text-sm"
          title="Delete bot"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
