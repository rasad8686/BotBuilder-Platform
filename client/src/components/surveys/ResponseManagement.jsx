import React, { useState } from 'react';
import {
  Archive,
  Tag,
  Trash2,
  Download,
  Filter,
  Search,
  MoreHorizontal,
  Check,
  X,
  MessageSquare,
  Star,
  Flag,
  Eye,
  Clock,
  User,
  ChevronDown,
  Plus,
  Edit3,
  Send
} from 'lucide-react';

const ResponseManagement = ({ responses = [], onUpdate, onDelete, readonly = false }) => {
  const [selectedResponses, setSelectedResponses] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [newNote, setNewNote] = useState('');
  const [expandedResponse, setExpandedResponse] = useState(null);

  // Mock data for demonstration
  const mockResponses = responses.length > 0 ? responses : [
    {
      id: 1,
      respondent: 'john@example.com',
      submittedAt: '2024-01-15T10:30:00Z',
      status: 'active',
      starred: true,
      flagged: false,
      tags: ['promoter', 'enterprise'],
      notes: ['Great feedback on new features'],
      answers: {
        q1: 9,
        q2: 'Love the product!'
      }
    },
    {
      id: 2,
      respondent: 'jane@example.com',
      submittedAt: '2024-01-15T09:15:00Z',
      status: 'active',
      starred: false,
      flagged: true,
      tags: ['detractor', 'needs-followup'],
      notes: [],
      answers: {
        q1: 4,
        q2: 'Too complex to use'
      }
    },
    {
      id: 3,
      respondent: 'anonymous',
      submittedAt: '2024-01-14T16:45:00Z',
      status: 'archived',
      starred: false,
      flagged: false,
      tags: ['passive'],
      notes: [],
      answers: {
        q1: 7,
        q2: 'It\'s okay'
      }
    }
  ];

  const [localResponses, setLocalResponses] = useState(mockResponses);

  const allTags = ['promoter', 'passive', 'detractor', 'enterprise', 'startup', 'needs-followup', 'resolved', 'churned'];

  const toggleSelectAll = () => {
    if (selectedResponses.length === filteredResponses.length) {
      setSelectedResponses([]);
    } else {
      setSelectedResponses(filteredResponses.map((r) => r.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedResponses((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const updateResponse = (id, field, value) => {
    if (readonly) return;
    const updated = localResponses.map((r) =>
      r.id === id ? { ...r, [field]: value } : r
    );
    setLocalResponses(updated);
    onUpdate?.(updated);
  };

  const addTag = (id, tag) => {
    if (readonly) return;
    const response = localResponses.find((r) => r.id === id);
    if (response && !response.tags.includes(tag)) {
      updateResponse(id, 'tags', [...response.tags, tag]);
    }
  };

  const removeTag = (id, tag) => {
    if (readonly) return;
    const response = localResponses.find((r) => r.id === id);
    if (response) {
      updateResponse(id, 'tags', response.tags.filter((t) => t !== tag));
    }
  };

  const addNote = (id, note) => {
    if (readonly || !note.trim()) return;
    const response = localResponses.find((r) => r.id === id);
    if (response) {
      updateResponse(id, 'notes', [...response.notes, note]);
    }
    setNewNote('');
    setShowNoteModal(null);
  };

  const bulkAction = (action) => {
    if (readonly || selectedResponses.length === 0) return;

    let updated;
    switch (action) {
      case 'archive':
        updated = localResponses.map((r) =>
          selectedResponses.includes(r.id) ? { ...r, status: 'archived' } : r
        );
        break;
      case 'unarchive':
        updated = localResponses.map((r) =>
          selectedResponses.includes(r.id) ? { ...r, status: 'active' } : r
        );
        break;
      case 'delete':
        updated = localResponses.filter((r) => !selectedResponses.includes(r.id));
        break;
      case 'star':
        updated = localResponses.map((r) =>
          selectedResponses.includes(r.id) ? { ...r, starred: true } : r
        );
        break;
      case 'flag':
        updated = localResponses.map((r) =>
          selectedResponses.includes(r.id) ? { ...r, flagged: true } : r
        );
        break;
      default:
        return;
    }

    setLocalResponses(updated);
    onUpdate?.(updated);
    setSelectedResponses([]);
  };

  const filteredResponses = localResponses.filter((response) => {
    const matchesStatus = filterStatus === 'all' || response.status === filterStatus;
    const matchesTag = filterTag === 'all' || response.tags.includes(filterTag);
    const matchesSearch =
      searchQuery === '' ||
      response.respondent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Object.values(response.answers).some((a) =>
        String(a).toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesStatus && matchesTag && matchesSearch;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTagColor = (tag) => {
    const colors = {
      promoter: 'bg-green-100 text-green-700',
      passive: 'bg-yellow-100 text-yellow-700',
      detractor: 'bg-red-100 text-red-700',
      enterprise: 'bg-purple-100 text-purple-700',
      startup: 'bg-blue-100 text-blue-700',
      'needs-followup': 'bg-orange-100 text-orange-700',
      resolved: 'bg-teal-100 text-teal-700',
      churned: 'bg-gray-100 text-gray-700'
    };
    return colors[tag] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Archive className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Response Management</h3>
            <p className="text-sm text-gray-500">Organize, tag, and manage survey responses</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b border-gray-200 space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search responses..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Bulk Actions */}
        {selectedResponses.length > 0 && (
          <div className="flex items-center gap-4 p-3 bg-emerald-50 rounded-lg">
            <span className="text-sm font-medium text-emerald-700">
              {selectedResponses.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => bulkAction('archive')}
                className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"
              >
                <Archive className="w-4 h-4" />
                Archive
              </button>
              <button
                onClick={() => bulkAction('star')}
                className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"
              >
                <Star className="w-4 h-4" />
                Star
              </button>
              <button
                onClick={() => bulkAction('flag')}
                className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"
              >
                <Flag className="w-4 h-4" />
                Flag
              </button>
              <button
                onClick={() => setShowTagModal(true)}
                className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"
              >
                <Tag className="w-4 h-4" />
                Tag
              </button>
              <button
                onClick={() => bulkAction('delete')}
                className="px-3 py-1.5 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Responses Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedResponses.length === filteredResponses.length && filteredResponses.length > 0}
                  onChange={toggleSelectAll}
                  disabled={readonly}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Respondent
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Submitted
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tags
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredResponses.map((response) => (
              <React.Fragment key={response.id}>
                <tr
                  className={`hover:bg-gray-50 ${
                    selectedResponses.includes(response.id) ? 'bg-emerald-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedResponses.includes(response.id)}
                      onChange={() => toggleSelect(response.id)}
                      disabled={readonly}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {response.starred && (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      )}
                      {response.flagged && (
                        <Flag className="w-4 h-4 text-red-500 fill-red-500" />
                      )}
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="font-medium text-gray-900">{response.respondent}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      {formatDate(response.submittedAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {response.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${getTagColor(tag)}`}
                        >
                          {tag}
                          {!readonly && (
                            <button
                              onClick={() => removeTag(response.id, tag)}
                              className="hover:text-gray-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                      {!readonly && (
                        <button
                          onClick={() => setShowTagModal(response.id)}
                          className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        response.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {response.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setExpandedResponse(
                          expandedResponse === response.id ? null : response.id
                        )}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateResponse(response.id, 'starred', !response.starred)}
                        disabled={readonly}
                        className={`p-1.5 rounded hover:bg-gray-100 ${
                          response.starred ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${response.starred ? 'fill-yellow-500' : ''}`} />
                      </button>
                      <button
                        onClick={() => updateResponse(response.id, 'flagged', !response.flagged)}
                        disabled={readonly}
                        className={`p-1.5 rounded hover:bg-gray-100 ${
                          response.flagged ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        <Flag className={`w-4 h-4 ${response.flagged ? 'fill-red-500' : ''}`} />
                      </button>
                      <button
                        onClick={() => setShowNoteModal(response.id)}
                        disabled={readonly}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded relative"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {response.notes.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center">
                            {response.notes.length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => updateResponse(
                          response.id,
                          'status',
                          response.status === 'active' ? 'archived' : 'active'
                        )}
                        disabled={readonly}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded Response Details */}
                {expandedResponse === response.id && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 bg-gray-50">
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">Answers</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(response.answers).map(([key, value]) => (
                            <div key={key} className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">{key}</p>
                              <p className="text-gray-900">{String(value)}</p>
                            </div>
                          ))}
                        </div>

                        {response.notes.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                            <div className="space-y-2">
                              {response.notes.map((note, index) => (
                                <div key={index} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm">
                                  {note}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {filteredResponses.length === 0 && (
          <div className="text-center py-12">
            <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="font-medium text-gray-900">No responses found</h4>
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your filters or search query
            </p>
          </div>
        )}
      </div>

      {/* Tag Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Add Tags</h3>

            <div className="flex flex-wrap gap-2 mb-4">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    if (typeof showTagModal === 'number') {
                      addTag(showTagModal, tag);
                    } else {
                      selectedResponses.forEach((id) => addTag(id, tag));
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm ${getTagColor(tag)} hover:opacity-80`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Create new tag..."
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={() => {
                  if (newTag.trim()) {
                    if (typeof showTagModal === 'number') {
                      addTag(showTagModal, newTag.trim().toLowerCase());
                    } else {
                      selectedResponses.forEach((id) => addTag(id, newTag.trim().toLowerCase()));
                    }
                    setNewTag('');
                  }
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Add
              </button>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTagModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Add Note</h3>

            {/* Existing Notes */}
            {localResponses.find((r) => r.id === showNoteModal)?.notes.length > 0 && (
              <div className="mb-4 space-y-2">
                {localResponses.find((r) => r.id === showNoteModal)?.notes.map((note, index) => (
                  <div key={index} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm">
                    {note}
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowNoteModal(null);
                  setNewNote('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => addNote(showNoteModal, newNote)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Stats */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <span>{filteredResponses.length} responses</span>
          <span>{filteredResponses.filter((r) => r.status === 'active').length} active</span>
          <span>{filteredResponses.filter((r) => r.starred).length} starred</span>
          <span>{filteredResponses.filter((r) => r.flagged).length} flagged</span>
        </div>
      </div>
    </div>
  );
};

export default ResponseManagement;
