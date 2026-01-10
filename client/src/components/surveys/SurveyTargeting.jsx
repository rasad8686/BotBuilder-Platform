import React, { useState } from 'react';
import {
  Users,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Link2,
  Tag,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Filter
} from 'lucide-react';

const SurveyTargeting = ({ targeting = {}, onChange }) => {
  const [activeSection, setActiveSection] = useState('segments');

  const defaultTargeting = {
    segments: [],
    pages: [],
    devices: [],
    countries: [],
    languages: [],
    customAttributes: [],
    excludeRules: {
      respondedBefore: true,
      respondedInDays: 30
    },
    ...targeting
  };

  const handleChange = (field, value) => {
    onChange?.({
      ...defaultTargeting,
      [field]: value
    });
  };

  const userSegments = [
    { id: 'new_users', label: 'New Users', description: 'Users who signed up in the last 7 days' },
    { id: 'active_users', label: 'Active Users', description: 'Users active in the last 30 days' },
    { id: 'passive_users', label: 'Passive Users', description: 'Users inactive for 30+ days' },
    { id: 'power_users', label: 'Power Users', description: 'Users with high engagement' },
    { id: 'trial_users', label: 'Trial Users', description: 'Users on free trial' },
    { id: 'paid_users', label: 'Paid Users', description: 'Users with active subscription' },
    { id: 'churned_users', label: 'Churned Users', description: 'Users who cancelled subscription' }
  ];

  const deviceOptions = [
    { id: 'desktop', label: 'Desktop', icon: Monitor },
    { id: 'mobile', label: 'Mobile', icon: Smartphone },
    { id: 'tablet', label: 'Tablet', icon: Tablet }
  ];

  const popularCountries = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'AZ', name: 'Azerbaijan' },
    { code: 'TR', name: 'Turkey' },
    { code: 'RU', name: 'Russia' }
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'az', name: 'Azerbaijani' },
    { code: 'tr', name: 'Turkish' },
    { code: 'ru', name: 'Russian' }
  ];

  const toggleSegment = (segmentId) => {
    const segments = defaultTargeting.segments || [];
    const newSegments = segments.includes(segmentId)
      ? segments.filter(s => s !== segmentId)
      : [...segments, segmentId];
    handleChange('segments', newSegments);
  };

  const toggleDevice = (deviceId) => {
    const devices = defaultTargeting.devices || [];
    const newDevices = devices.includes(deviceId)
      ? devices.filter(d => d !== deviceId)
      : [...devices, deviceId];
    handleChange('devices', newDevices);
  };

  const addPageRule = () => {
    const pages = defaultTargeting.pages || [];
    handleChange('pages', [...pages, { type: 'contains', value: '' }]);
  };

  const updatePageRule = (index, field, value) => {
    const pages = [...(defaultTargeting.pages || [])];
    pages[index] = { ...pages[index], [field]: value };
    handleChange('pages', pages);
  };

  const removePageRule = (index) => {
    const pages = (defaultTargeting.pages || []).filter((_, i) => i !== index);
    handleChange('pages', pages);
  };

  const addCustomAttribute = () => {
    const attrs = defaultTargeting.customAttributes || [];
    handleChange('customAttributes', [...attrs, { key: '', operator: 'equals', value: '' }]);
  };

  const updateCustomAttribute = (index, field, value) => {
    const attrs = [...(defaultTargeting.customAttributes || [])];
    attrs[index] = { ...attrs[index], [field]: value };
    handleChange('customAttributes', attrs);
  };

  const removeCustomAttribute = (index) => {
    const attrs = (defaultTargeting.customAttributes || []).filter((_, i) => i !== index);
    handleChange('customAttributes', attrs);
  };

  const sections = [
    { id: 'segments', label: 'User Segments', icon: Users },
    { id: 'pages', label: 'Page URL', icon: Link2 },
    { id: 'devices', label: 'Devices', icon: Monitor },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'attributes', label: 'Custom Attributes', icon: Tag },
    { id: 'exclude', label: 'Exclude Rules', icon: AlertCircle }
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Filter className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Survey Targeting</h3>
            <p className="text-sm text-gray-500">Define who should see this survey</p>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-48 border-r border-gray-200 p-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {/* User Segments */}
          {activeSection === 'segments' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Select which user segments should see this survey
              </p>
              <div className="space-y-2">
                {userSegments.map((segment) => (
                  <label
                    key={segment.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      (defaultTargeting.segments || []).includes(segment.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={(defaultTargeting.segments || []).includes(segment.id)}
                      onChange={() => toggleSegment(segment.id)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{segment.label}</p>
                      <p className="text-xs text-gray-500">{segment.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              {(defaultTargeting.segments || []).length === 0 && (
                <p className="mt-4 text-sm text-gray-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  No segments selected - survey will show to all users
                </p>
              )}
            </div>
          )}

          {/* Page URL */}
          {activeSection === 'pages' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Show survey only on specific pages
              </p>
              <div className="space-y-3">
                {(defaultTargeting.pages || []).map((rule, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={rule.type}
                      onChange={(e) => updatePageRule(index, 'type', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="contains">URL contains</option>
                      <option value="equals">URL equals</option>
                      <option value="starts_with">URL starts with</option>
                      <option value="regex">URL matches regex</option>
                    </select>
                    <input
                      type="text"
                      value={rule.value}
                      onChange={(e) => updatePageRule(index, 'value', e.target.value)}
                      placeholder="/pricing, /checkout, etc."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => removePageRule(index)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addPageRule}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add page rule
                </button>
              </div>
              {(defaultTargeting.pages || []).length === 0 && (
                <p className="mt-4 text-sm text-gray-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  No page rules - survey will show on all pages
                </p>
              )}
            </div>
          )}

          {/* Devices */}
          {activeSection === 'devices' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Show survey only on specific devices
              </p>
              <div className="flex gap-3">
                {deviceOptions.map((device) => {
                  const Icon = device.icon;
                  const isSelected = (defaultTargeting.devices || []).includes(device.id);
                  return (
                    <button
                      key={device.id}
                      onClick={() => toggleDevice(device.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`w-8 h-8 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                        {device.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {(defaultTargeting.devices || []).length === 0 && (
                <p className="mt-4 text-sm text-gray-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  No devices selected - survey will show on all devices
                </p>
              )}
            </div>
          )}

          {/* Location */}
          {activeSection === 'location' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Countries</h4>
                <div className="flex flex-wrap gap-2">
                  {popularCountries.map((country) => {
                    const isSelected = (defaultTargeting.countries || []).includes(country.code);
                    return (
                      <button
                        key={country.code}
                        onClick={() => {
                          const countries = defaultTargeting.countries || [];
                          handleChange('countries',
                            isSelected
                              ? countries.filter(c => c !== country.code)
                              : [...countries, country.code]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        {country.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Languages</h4>
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => {
                    const isSelected = (defaultTargeting.languages || []).includes(lang.code);
                    return (
                      <button
                        key={lang.code}
                        onClick={() => {
                          const langs = defaultTargeting.languages || [];
                          handleChange('languages',
                            isSelected
                              ? langs.filter(l => l !== lang.code)
                              : [...langs, lang.code]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        {lang.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Custom Attributes */}
          {activeSection === 'attributes' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Target users based on custom attributes
              </p>
              <div className="space-y-3">
                {(defaultTargeting.customAttributes || []).map((attr, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={attr.key}
                      onChange={(e) => updateCustomAttribute(index, 'key', e.target.value)}
                      placeholder="Attribute name"
                      className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <select
                      value={attr.operator}
                      onChange={(e) => updateCustomAttribute(index, 'operator', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="equals">equals</option>
                      <option value="not_equals">not equals</option>
                      <option value="contains">contains</option>
                      <option value="greater_than">greater than</option>
                      <option value="less_than">less than</option>
                      <option value="exists">exists</option>
                    </select>
                    <input
                      type="text"
                      value={attr.value}
                      onChange={(e) => updateCustomAttribute(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => removeCustomAttribute(index)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addCustomAttribute}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add attribute rule
                </button>
              </div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">
                  <strong>Examples:</strong> plan = "pro", age &gt; 25, company_size = "enterprise"
                </p>
              </div>
            </div>
          )}

          {/* Exclude Rules */}
          {activeSection === 'exclude' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Prevent survey from showing in certain conditions
              </p>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Exclude users who already responded</p>
                    <p className="text-sm text-gray-500">Don't show survey to users who completed it</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={defaultTargeting.excludeRules?.respondedBefore ?? true}
                    onChange={(e) => handleChange('excludeRules', {
                      ...defaultTargeting.excludeRules,
                      respondedBefore: e.target.checked
                    })}
                    className="w-5 h-5 rounded text-blue-600"
                  />
                </label>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900 mb-2">Rate limit per user</p>
                  <p className="text-sm text-gray-500 mb-3">
                    Don't show any survey to the same user more than once every:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={defaultTargeting.excludeRules?.respondedInDays ?? 30}
                      onChange={(e) => handleChange('excludeRules', {
                        ...defaultTargeting.excludeRules,
                        respondedInDays: parseInt(e.target.value) || 30
                      })}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-lg"
                    />
                    <span className="text-gray-600">days</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyTargeting;
