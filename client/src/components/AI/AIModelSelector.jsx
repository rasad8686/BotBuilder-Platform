import { useState, useEffect } from 'react';
import aiApi from '../../api/ai';

/**
 * AI Model Selector
 * Displays available models for selected provider
 */
export default function AIModelSelector({ provider, selectedModel, onModelChange }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, [provider]);

  const loadModels = async () => {
    try {
      setLoading(true);
      const response = await aiApi.getModels(provider);
      setModels(response.models);
    } catch (err) {
      // Silent fail
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-gray-700 font-semibold mb-2">
        Model <span className="text-red-500">*</span>
      </label>

      <div className="space-y-3">
        {models.map((model) => {
          const isSelected = selectedModel === model.id;

          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onModelChange(model.id)}
              className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                isSelected
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-gray-300 hover:border-purple-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-base">{model.name}</h3>
                    {model.id.includes('mini') || model.id.includes('haiku') ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        ⚡ Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {model.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>💰 ${model.pricing.input}/${model.pricing.output} per 1M tokens</span>
                    <span>📝 {model.maxTokens.toLocaleString()} max tokens</span>
                  </div>
                </div>

                {isSelected && (
                  <div className="text-purple-600 text-xl ml-4">
                    ✓
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {models.length === 0 && (
        <p className="text-gray-500 text-center py-4">
          No models available for this provider
        </p>
      )}
    </div>
  );
}
