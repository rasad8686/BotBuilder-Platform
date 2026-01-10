import React from 'react';
import { Radio, RefreshCw, Droplets, Check, AlertCircle } from 'lucide-react';

const StepSetup = ({ data, errors, onChange }) => {
  const campaignTypes = [
    {
      id: 'broadcast',
      icon: Radio,
      label: 'Broadcast',
      description: 'One-time email to your list'
    },
    {
      id: 'automated',
      icon: RefreshCw,
      label: 'Automated',
      description: 'Trigger-based campaigns'
    },
    {
      id: 'drip',
      icon: Droplets,
      label: 'Drip',
      description: 'Sequenced email series'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Campaign Setup</h2>
        <p className="text-sm text-gray-500">Configure the basic settings for your campaign</p>
      </div>

      {/* Campaign Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Campaign Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Summer Sale Announcement"
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-300' : 'border-gray-200'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.name}
          </p>
        )}
      </div>

      {/* Campaign Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Campaign Type
        </label>
        <div className="grid grid-cols-3 gap-3">
          {campaignTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = data.type === type.id;

            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onChange({ type: type.id })}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
                  isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                  {type.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sender Details */}
      <div className="pt-4 border-t border-gray-100">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Sender Details</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              From Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.from_name}
              onChange={(e) => onChange({ from_name: e.target.value })}
              placeholder="Your Company"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.from_name ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {errors.from_name && (
              <p className="mt-1 text-sm text-red-500">{errors.from_name}</p>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              From Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={data.from_email}
              onChange={(e) => onChange({ from_email: e.target.value })}
              placeholder="hello@company.com"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.from_email ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {errors.from_email && (
              <p className="mt-1 text-sm text-red-500">{errors.from_email}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm text-gray-600 mb-1">
            Reply-To Email <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="email"
            value={data.reply_to}
            onChange={(e) => onChange({ reply_to: e.target.value })}
            placeholder="support@company.com"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Leave empty to use the same as sender email
          </p>
        </div>
      </div>
    </div>
  );
};

export default StepSetup;
