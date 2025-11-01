/**
 * AI Provider Selector
 * Allows selection between OpenAI and Claude
 */
export default function AIProviderSelector({ providers, selectedProvider, onProviderChange }) {
  return (
    <div>
      <label className="block text-gray-700 font-semibold mb-2">
        AI Provider <span className="text-red-500">*</span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((provider) => {
          const isSelected = selectedProvider === provider.id;

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onProviderChange(provider.id)}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                isSelected
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-gray-300 hover:border-purple-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">
                    {provider.id === 'openai' && '🤖 '}
                    {provider.id === 'claude' && '🧠 '}
                    {provider.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {provider.models.length} models available
                  </p>
                  <p className="text-xs text-gray-500">
                    {provider.id === 'openai' && 'GPT models from OpenAI'}
                    {provider.id === 'claude' && 'Claude models from Anthropic'}
                  </p>
                </div>

                {isSelected && (
                  <div className="text-purple-600 text-2xl">
                    ✓
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {providers.length === 0 && (
        <p className="text-gray-500 text-center py-4">
          Loading providers...
        </p>
      )}
    </div>
  );
}
