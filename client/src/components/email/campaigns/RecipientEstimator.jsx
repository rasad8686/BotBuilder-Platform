import React from 'react';
import { Users, MinusCircle, AlertCircle } from 'lucide-react';

const RecipientEstimator = ({
  totalContacts,
  selectedContacts,
  duplicatesRemoved,
  unsubscribedRemoved,
  finalCount
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <Users className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Estimated Recipients</p>
          <p className="text-2xl font-bold text-blue-700">{finalCount.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Total from selected lists</span>
          <span className="font-medium text-gray-900">{totalContacts.toLocaleString()}</span>
        </div>

        {selectedContacts > 0 && selectedContacts !== totalContacts && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">After selection filter</span>
            <span className="font-medium text-gray-900">{selectedContacts.toLocaleString()}</span>
          </div>
        )}

        {duplicatesRemoved > 0 && (
          <div className="flex items-center justify-between text-orange-600">
            <span className="flex items-center gap-1">
              <MinusCircle className="w-3 h-3" />
              Duplicates removed
            </span>
            <span>-{duplicatesRemoved.toLocaleString()}</span>
          </div>
        )}

        {unsubscribedRemoved > 0 && (
          <div className="flex items-center justify-between text-red-600">
            <span className="flex items-center gap-1">
              <MinusCircle className="w-3 h-3" />
              Unsubscribed removed
            </span>
            <span>-{unsubscribedRemoved.toLocaleString()}</span>
          </div>
        )}

        <div className="pt-2 mt-2 border-t border-blue-200">
          <div className="flex items-center justify-between">
            <span className="font-medium text-blue-700">Final recipient count</span>
            <span className="font-bold text-blue-700">{finalCount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {finalCount === 0 && (
        <div className="mt-3 p-2 bg-yellow-50 rounded-lg flex items-center gap-2 text-yellow-700 text-xs">
          <AlertCircle className="w-4 h-4" />
          No recipients available. Please select at least one list.
        </div>
      )}
    </div>
  );
};

export default RecipientEstimator;
