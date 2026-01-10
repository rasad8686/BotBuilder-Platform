import React, { useState } from 'react';
import {
  Shuffle,
  Plus,
  Trash2,
  Play,
  Pause,
  BarChart3,
  Users,
  Percent,
  Trophy,
  AlertCircle,
  Check,
  Copy,
  Eye,
  Settings,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock
} from 'lucide-react';

const SurveyABTest = ({ test = {}, onChange, onStart, onStop, readonly = false }) => {
  const [activeTab, setActiveTab] = useState('setup');

  const defaultTest = {
    enabled: false,
    status: 'draft', // draft, running, paused, completed
    name: 'A/B Test',
    startDate: null,
    endDate: null,
    variants: [
      { id: 'control', name: 'Control (A)', traffic: 50, changes: [], responses: 0, completionRate: 0 },
      { id: 'variant_b', name: 'Variant B', traffic: 50, changes: [], responses: 0, completionRate: 0 }
    ],
    winningMetric: 'completion_rate', // completion_rate, nps, response_time
    minSampleSize: 100,
    confidenceLevel: 95,
    winner: null,
    ...test
  };

  const [localTest, setLocalTest] = useState(defaultTest);

  const updateTest = (field, value) => {
    if (readonly) return;
    const updated = { ...localTest, [field]: value };
    setLocalTest(updated);
    onChange?.(updated);
  };

  const addVariant = () => {
    if (readonly || localTest.variants.length >= 4) return;
    const variantLetter = String.fromCharCode(65 + localTest.variants.length); // A, B, C, D
    const newVariant = {
      id: `variant_${variantLetter.toLowerCase()}`,
      name: `Variant ${variantLetter}`,
      traffic: 0,
      changes: [],
      responses: 0,
      completionRate: 0
    };

    // Redistribute traffic evenly
    const newVariants = [...localTest.variants, newVariant];
    const evenTraffic = Math.floor(100 / newVariants.length);
    const remainder = 100 - evenTraffic * newVariants.length;

    const redistributed = newVariants.map((v, i) => ({
      ...v,
      traffic: evenTraffic + (i === 0 ? remainder : 0)
    }));

    updateTest('variants', redistributed);
  };

  const removeVariant = (variantId) => {
    if (readonly || localTest.variants.length <= 2) return;
    const filtered = localTest.variants.filter((v) => v.id !== variantId);

    // Redistribute traffic
    const evenTraffic = Math.floor(100 / filtered.length);
    const remainder = 100 - evenTraffic * filtered.length;

    const redistributed = filtered.map((v, i) => ({
      ...v,
      traffic: evenTraffic + (i === 0 ? remainder : 0)
    }));

    updateTest('variants', redistributed);
  };

  const updateVariant = (variantId, field, value) => {
    if (readonly) return;
    const updated = localTest.variants.map((v) =>
      v.id === variantId ? { ...v, [field]: value } : v
    );
    updateTest('variants', updated);
  };

  const updateTrafficSplit = (variantId, newTraffic) => {
    if (readonly) return;

    // Ensure traffic doesn't go below 0 or above 100
    newTraffic = Math.max(0, Math.min(100, newTraffic));

    const otherVariants = localTest.variants.filter((v) => v.id !== variantId);
    const remainingTraffic = 100 - newTraffic;
    const otherTotal = otherVariants.reduce((sum, v) => sum + v.traffic, 0);

    const updated = localTest.variants.map((v) => {
      if (v.id === variantId) {
        return { ...v, traffic: newTraffic };
      }
      // Proportionally adjust other variants
      if (otherTotal > 0) {
        return { ...v, traffic: Math.round((v.traffic / otherTotal) * remainingTraffic) };
      }
      return { ...v, traffic: Math.round(remainingTraffic / otherVariants.length) };
    });

    updateTest('variants', updated);
  };

  const addChange = (variantId) => {
    if (readonly) return;
    const variant = localTest.variants.find((v) => v.id === variantId);
    if (!variant) return;

    const newChange = {
      id: Date.now(),
      type: 'question_text', // question_text, question_order, option_text, button_text
      target: '',
      originalValue: '',
      newValue: ''
    };

    updateVariant(variantId, 'changes', [...variant.changes, newChange]);
  };

  const updateChange = (variantId, changeId, field, value) => {
    if (readonly) return;
    const variant = localTest.variants.find((v) => v.id === variantId);
    if (!variant) return;

    const updated = variant.changes.map((c) =>
      c.id === changeId ? { ...c, [field]: value } : c
    );
    updateVariant(variantId, 'changes', updated);
  };

  const removeChange = (variantId, changeId) => {
    if (readonly) return;
    const variant = localTest.variants.find((v) => v.id === variantId);
    if (!variant) return;

    updateVariant(variantId, 'changes', variant.changes.filter((c) => c.id !== changeId));
  };

  const changeTypes = [
    { value: 'question_text', label: 'Question Text' },
    { value: 'question_order', label: 'Question Order' },
    { value: 'option_text', label: 'Option Text' },
    { value: 'button_text', label: 'Button Text' },
    { value: 'heading', label: 'Heading' },
    { value: 'description', label: 'Description' }
  ];

  const metrics = [
    { value: 'completion_rate', label: 'Completion Rate' },
    { value: 'nps', label: 'NPS Score' },
    { value: 'response_time', label: 'Response Time' },
    { value: 'satisfaction', label: 'Satisfaction Score' }
  ];

  const tabs = [
    { id: 'setup', label: 'Setup', icon: Settings },
    { id: 'results', label: 'Results', icon: BarChart3 }
  ];

  // Calculate statistics
  const totalResponses = localTest.variants.reduce((sum, v) => sum + v.responses, 0);
  const hasEnoughData = totalResponses >= localTest.minSampleSize;

  const getVariantColor = (index) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'];
    return colors[index % colors.length];
  };

  const getStatusBadge = () => {
    const statuses = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
      running: { bg: 'bg-green-100', text: 'text-green-700', label: 'Running' },
      paused: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Paused' },
      completed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Completed' }
    };
    return statuses[localTest.status] || statuses.draft;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-violet-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Shuffle className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">A/B Testing</h3>
              <p className="text-sm text-gray-500">Test different versions to optimize performance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge().bg} ${getStatusBadge().text}`}>
              {getStatusBadge().label}
            </span>
            {localTest.status === 'running' ? (
              <button
                onClick={() => {
                  updateTest('status', 'paused');
                  onStop?.();
                }}
                disabled={readonly}
                className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            ) : (
              <button
                onClick={() => {
                  updateTest('status', 'running');
                  onStart?.();
                }}
                disabled={readonly || localTest.variants.length < 2}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Test
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Setup Tab */}
        {activeTab === 'setup' && (
          <div className="space-y-6">
            {/* Test Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Name
              </label>
              <input
                type="text"
                value={localTest.name}
                onChange={(e) => updateTest('name', e.target.value)}
                disabled={readonly}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Traffic Split Visualization */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Traffic Split
              </label>
              <div className="h-8 rounded-lg overflow-hidden flex">
                {localTest.variants.map((variant, index) => (
                  <div
                    key={variant.id}
                    className={`${getVariantColor(index)} flex items-center justify-center text-white text-sm font-medium transition-all`}
                    style={{ width: `${variant.traffic}%` }}
                  >
                    {variant.traffic > 15 && `${variant.traffic}%`}
                  </div>
                ))}
              </div>
            </div>

            {/* Variants */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Variants</label>
                {!readonly && localTest.variants.length < 4 && (
                  <button
                    onClick={addVariant}
                    className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Variant
                  </button>
                )}
              </div>

              {localTest.variants.map((variant, index) => (
                <div key={variant.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded ${getVariantColor(index)}`} />
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) => updateVariant(variant.id, 'name', e.target.value)}
                        disabled={readonly}
                        className="font-medium text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0"
                      />
                      {index === 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Control
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={variant.traffic}
                          onChange={(e) => updateTrafficSplit(variant.id, parseInt(e.target.value) || 0)}
                          disabled={readonly}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-center"
                        />
                      </div>
                      {!readonly && localTest.variants.length > 2 && (
                        <button
                          onClick={() => removeVariant(variant.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Variant Changes */}
                  {index > 0 && (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Changes from Control</span>
                        {!readonly && (
                          <button
                            onClick={() => addChange(variant.id)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Change
                          </button>
                        )}
                      </div>

                      {variant.changes.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          No changes defined. This variant is identical to control.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {variant.changes.map((change) => (
                            <div key={change.id} className="grid grid-cols-4 gap-2 items-center">
                              <select
                                value={change.type}
                                onChange={(e) => updateChange(variant.id, change.id, 'type', e.target.value)}
                                disabled={readonly}
                                className="px-3 py-1.5 border border-gray-200 rounded text-sm"
                              >
                                {changeTypes.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={change.originalValue}
                                onChange={(e) => updateChange(variant.id, change.id, 'originalValue', e.target.value)}
                                placeholder="Original"
                                disabled={readonly}
                                className="px-3 py-1.5 border border-gray-200 rounded text-sm"
                              />
                              <input
                                type="text"
                                value={change.newValue}
                                onChange={(e) => updateChange(variant.id, change.id, 'newValue', e.target.value)}
                                placeholder="New value"
                                disabled={readonly}
                                className="px-3 py-1.5 border border-gray-200 rounded text-sm"
                              />
                              {!readonly && (
                                <button
                                  onClick={() => removeChange(variant.id, change.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Test Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Winning Metric
                </label>
                <select
                  value={localTest.winningMetric}
                  onChange={(e) => updateTest('winningMetric', e.target.value)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {metrics.map((metric) => (
                    <option key={metric.value} value={metric.value}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Sample Size
                </label>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  value={localTest.minSampleSize}
                  onChange={(e) => updateTest('minSampleSize', parseInt(e.target.value) || 100)}
                  disabled={readonly}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confidence Level
              </label>
              <div className="flex gap-2">
                {[90, 95, 99].map((level) => (
                  <button
                    key={level}
                    onClick={() => updateTest('confidenceLevel', level)}
                    disabled={readonly}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      localTest.confidenceLevel === level
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    {level}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Users className="w-4 h-4" />
                  Total Responses
                </div>
                <p className="text-2xl font-bold text-gray-900">{totalResponses.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <BarChart3 className="w-4 h-4" />
                  Sample Progress
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.min(100, Math.round((totalResponses / localTest.minSampleSize) * 100))}%
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Clock className="w-4 h-4" />
                  Status
                </div>
                <p className={`text-lg font-bold ${hasEnoughData ? 'text-green-600' : 'text-amber-600'}`}>
                  {hasEnoughData ? 'Sufficient Data' : 'Collecting Data'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Trophy className="w-4 h-4" />
                  Winner
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {localTest.winner || (hasEnoughData ? 'Tie' : 'TBD')}
                </p>
              </div>
            </div>

            {/* Variant Comparison */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Variant
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Responses
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Completion Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      vs Control
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Significance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {localTest.variants.map((variant, index) => {
                    const control = localTest.variants[0];
                    const diff = variant.completionRate - control.completionRate;
                    const isWinner = variant.id === localTest.winner;

                    return (
                      <tr key={variant.id} className={isWinner ? 'bg-green-50' : ''}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded ${getVariantColor(index)}`} />
                            <span className="font-medium text-gray-900">{variant.name}</span>
                            {isWinner && (
                              <Trophy className="w-4 h-4 text-yellow-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {variant.responses.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {variant.completionRate.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          {index === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className={`flex items-center justify-end gap-1 ${
                              diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {diff > 0 ? <TrendingUp className="w-4 h-4" /> :
                               diff < 0 ? <TrendingDown className="w-4 h-4" /> :
                               <Minus className="w-4 h-4" />}
                              {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {index === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : hasEnoughData ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <Check className="w-3 h-3 mr-1" />
                              {localTest.confidenceLevel}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Collecting...
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Not Enough Data Warning */}
            {!hasEnoughData && (
              <div className="bg-amber-50 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-900">Insufficient Data</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    You need at least {localTest.minSampleSize} responses to determine a statistically
                    significant winner. Currently at {totalResponses} responses
                    ({Math.round((totalResponses / localTest.minSampleSize) * 100)}% complete).
                  </p>
                </div>
              </div>
            )}

            {/* Winner Declaration */}
            {hasEnoughData && localTest.winner && (
              <div className="bg-green-50 rounded-lg p-4 flex items-start gap-3">
                <Trophy className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900">Winner Found!</h4>
                  <p className="text-sm text-green-700 mt-1">
                    <strong>{localTest.variants.find(v => v.id === localTest.winner)?.name}</strong> is
                    the winning variant with {localTest.confidenceLevel}% statistical confidence.
                    Consider applying this variant to all users.
                  </p>
                  <button className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                    Apply Winner to All Users
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyABTest;
