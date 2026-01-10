import React, { useState } from 'react';

const AutomationEnrollmentList = ({ enrollments, isLoading, automationId }) => {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesFilter = filter === 'all' || enrollment.status === filter;
    const matchesSearch = enrollment.contact_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          enrollment.contact_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
      completed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Completed' },
      exited: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Exited' },
      paused: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Paused' }
    };
    const config = statusConfig[status] || statusConfig.active;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['all', 'active', 'completed', 'exited'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded text-sm capitalize ${
                filter === status
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Enrollment List */}
      {filteredEnrollments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>No enrollments found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-medium">Contact</th>
                <th className="pb-3 font-medium">Current Step</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Enrolled</th>
                <th className="pb-3 font-medium">Last Activity</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnrollments.map(enrollment => (
                <tr key={enrollment.id} className="border-b border-gray-100">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                        {(enrollment.contact_name || enrollment.contact_email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{enrollment.contact_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{enrollment.contact_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                        {enrollment.current_step + 1}
                      </span>
                      <span className="text-sm text-gray-600">
                        {enrollment.current_step_name || `Step ${enrollment.current_step + 1}`}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    {getStatusBadge(enrollment.status)}
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {new Date(enrollment.enrolled_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {enrollment.last_activity_at
                      ? new Date(enrollment.last_activity_at).toLocaleString()
                      : '-'}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      {enrollment.status === 'active' && (
                        <>
                          <button
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Move to step"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                          </button>
                          <button
                            className="p-1 text-red-400 hover:text-red-600"
                            title="Remove from automation"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                      <button
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="View contact"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filteredEnrollments.length > 0 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-gray-500">
            Showing {filteredEnrollments.length} of {enrollments.length} enrollments
          </p>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
              Previous
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationEnrollmentList;
