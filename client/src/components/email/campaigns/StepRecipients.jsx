import React, { useState, useEffect } from 'react';
import { Users, Check, AlertCircle, Filter, RefreshCw } from 'lucide-react';
import { useEmailListsQuery } from '../../../hooks/email/useCampaigns';

const StepRecipients = ({ data, errors, onChange }) => {
  const [estimatedRecipients, setEstimatedRecipients] = useState(0);
  const { data: listsData, isLoading: loadingLists } = useEmailListsQuery();

  const lists = listsData?.lists || [];

  // Calculate estimated recipients
  useEffect(() => {
    if (data.send_to === 'all') {
      const total = lists.reduce((sum, list) => sum + (list.contact_count || 0), 0);
      setEstimatedRecipients(total);
    } else if (data.send_to === 'lists') {
      const selectedLists = lists.filter(l => data.list_ids.includes(l.id));
      const excludedLists = lists.filter(l => data.exclude_list_ids?.includes(l.id));

      const selected = selectedLists.reduce((sum, l) => sum + (l.contact_count || 0), 0);
      const excluded = excludedLists.reduce((sum, l) => sum + (l.contact_count || 0), 0);

      setEstimatedRecipients(Math.max(0, selected - excluded * 0.3)); // Rough estimation
    }
  }, [data.send_to, data.list_ids, data.exclude_list_ids, lists]);

  const toggleList = (listId, type = 'include') => {
    const field = type === 'include' ? 'list_ids' : 'exclude_list_ids';
    const currentList = data[field] || [];

    if (currentList.includes(listId)) {
      onChange({ [field]: currentList.filter(id => id !== listId) });
    } else {
      onChange({ [field]: [...currentList, listId] });
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Recipients</h2>
        <p className="text-sm text-gray-500">Choose who will receive this campaign</p>
      </div>

      {/* Send To Options */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Send To</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="send_to"
              value="all"
              checked={data.send_to === 'all'}
              onChange={() => onChange({ send_to: 'all', list_ids: [] })}
              className="w-4 h-4 text-blue-600"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900">All Contacts</span>
              <span className="text-sm text-gray-500 ml-2">
                ({formatNumber(lists.reduce((sum, l) => sum + (l.contact_count || 0), 0))} subscribed)
              </span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="send_to"
              value="lists"
              checked={data.send_to === 'lists'}
              onChange={() => onChange({ send_to: 'lists' })}
              className="w-4 h-4 text-blue-600"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900">Specific Lists</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="send_to"
              value="segment"
              checked={data.send_to === 'segment'}
              onChange={() => onChange({ send_to: 'segment', list_ids: [] })}
              className="w-4 h-4 text-blue-600"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900">Segment</span>
              <span className="text-sm text-gray-500 ml-2">(Custom filters)</span>
            </div>
          </label>
        </div>
      </div>

      {/* List Selection */}
      {data.send_to === 'lists' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Select Lists</label>
          {loadingLists ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
              No lists available. Create a list first.
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
              {lists.map((list) => (
                <label
                  key={list.id}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={data.list_ids.includes(list.id)}
                    onChange={() => toggleList(list.id, 'include')}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{list.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    ({formatNumber(list.contact_count)})
                  </span>
                </label>
              ))}
            </div>
          )}
          {errors.list_ids && (
            <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.list_ids}
            </p>
          )}
        </div>
      )}

      {/* Segment Builder (simplified) */}
      {data.send_to === 'segment' && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-4">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Segment Builder</span>
          </div>
          <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
            <p className="text-sm">Advanced segment builder coming soon.</p>
            <p className="text-xs mt-1">For now, please select specific lists.</p>
          </div>
        </div>
      )}

      {/* Estimated Recipients */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-blue-600">Estimated Recipients</p>
            <p className="text-2xl font-bold text-blue-700">
              {formatNumber(Math.round(estimatedRecipients))}
            </p>
          </div>
        </div>
        <p className="text-xs text-blue-500 mt-2">
          After removing duplicates and unsubscribed contacts
        </p>
      </div>

      {/* Exclude Lists */}
      {data.send_to !== 'all' && lists.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Exclude Lists <span className="text-gray-400">(optional)</span>
          </label>
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {lists.filter(l => !data.list_ids.includes(l.id)).map((list) => (
              <label
                key={list.id}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={(data.exclude_list_ids || []).includes(list.id)}
                  onChange={() => toggleList(list.id, 'exclude')}
                  className="w-4 h-4 text-orange-600 rounded"
                />
                <div className="flex-1">
                  <span className="text-gray-700">{list.name}</span>
                </div>
                <span className="text-sm text-gray-500">
                  ({formatNumber(list.contact_count)})
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StepRecipients;
