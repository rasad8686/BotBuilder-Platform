import React from 'react';
import { Check, AlertTriangle, X, ExternalLink } from 'lucide-react';

const PreSendChecklist = ({ checklist }) => {
  const getStatusIcon = (item) => {
    if (item.passed) {
      return (
        <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-green-600" />
        </div>
      );
    }
    if (item.required) {
      return (
        <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
          <X className="w-3 h-3 text-red-600" />
        </div>
      );
    }
    return (
      <div className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-3 h-3 text-yellow-600" />
      </div>
    );
  };

  const getStatusClass = (item) => {
    if (item.passed) return 'text-green-700';
    if (item.required) return 'text-red-700';
    return 'text-yellow-700';
  };

  const passedCount = checklist.filter(c => c.passed).length;
  const requiredCount = checklist.filter(c => c.required).length;
  const requiredPassed = checklist.filter(c => c.required && c.passed).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Pre-send Checklist</h3>
        <span className={`text-xs font-medium ${
          requiredPassed === requiredCount ? 'text-green-600' : 'text-orange-600'
        }`}>
          {passedCount}/{checklist.length} complete
        </span>
      </div>

      <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
        {checklist.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 p-3 ${
              !item.passed && item.required ? 'bg-red-50' : ''
            }`}
          >
            {getStatusIcon(item)}
            <span className={`text-sm flex-1 ${getStatusClass(item)}`}>
              {item.label}
            </span>
            {!item.passed && item.fixLink && (
              <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Fix <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {!item.required && !item.passed && (
              <span className="text-xs text-gray-400">Optional</span>
            )}
          </div>
        ))}
      </div>

      {requiredPassed < requiredCount && (
        <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Please complete all required items before sending
        </p>
      )}
    </div>
  );
};

export default PreSendChecklist;
