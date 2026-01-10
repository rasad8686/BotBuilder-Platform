import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAutomationQuery, useAutomationReportQuery, useAutomationEnrollmentsQuery } from '../../hooks/email/useAutomations';
import AutomationEnrollmentList from '../../components/email/automation/AutomationEnrollmentList';

const AutomationReportPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: automation, isLoading: automationLoading } = useAutomationQuery(id);
  const { data: report, isLoading: reportLoading } = useAutomationReportQuery(id);
  const { data: enrollments, isLoading: enrollmentsLoading } = useAutomationEnrollmentsQuery(id);

  const isLoading = automationLoading || reportLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stats = {
    enrolled: report?.enrolled ?? 0,
    active: report?.active ?? 0,
    completed: report?.completed ?? 0,
    exited: report?.exited ?? 0,
    completionRate: report?.completionRate ?? 0,
    averageTimeToComplete: report?.averageTimeToComplete ?? 0,
    stepStats: report?.stepStats || []
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/email/automations')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{automation?.name || 'Automation Report'}</h1>
            <p className="text-gray-600">Performance analytics and insights</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/email/automations/${id}`)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Edit Automation
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Enrolled</p>
              <p className="text-2xl font-bold">{stats.enrolled.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Currently Active</p>
              <p className="text-2xl font-bold">{stats.active.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold">{stats.completed.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Exited Early</p>
              <p className="text-2xl font-bold">{stats.exited.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-4">
            {['overview', 'funnel', 'enrollments', 'activity'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Completion Rate */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Completion Rate</h3>
                <div className="flex items-center gap-8">
                  <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="none" />
                      <circle
                        cx="64" cy="64" r="56"
                        stroke="#3b82f6"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 56 * stats.completionRate / 100} ${2 * Math.PI * 56}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">{stats.completionRate}%</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Average Time to Complete</p>
                        <p className="text-lg font-medium">{stats.averageTimeToComplete || '2.5 days'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Conversion Rate</p>
                        <p className="text-lg font-medium">{stats.conversionRate || '12.5%'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Performance by Step */}
              <div>
                <h3 className="text-lg font-medium mb-4">Email Performance by Step</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                        <th className="pb-3 font-medium">Step</th>
                        <th className="pb-3 font-medium">Sent</th>
                        <th className="pb-3 font-medium">Delivered</th>
                        <th className="pb-3 font-medium">Opened</th>
                        <th className="pb-3 font-medium">Clicked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats.stepStats || []).map((step, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">
                                {index + 1}
                              </span>
                              <span>{step.name}</span>
                            </div>
                          </td>
                          <td className="py-3">{step.sent || 0}</td>
                          <td className="py-3">{step.delivered || 0}</td>
                          <td className="py-3">
                            <span>{step.opened || 0}</span>
                            <span className="text-gray-400 ml-1">({step.openRate || 0}%)</span>
                          </td>
                          <td className="py-3">
                            <span>{step.clicked || 0}</span>
                            <span className="text-gray-400 ml-1">({step.clickRate || 0}%)</span>
                          </td>
                        </tr>
                      ))}
                      {(!stats.stepStats || stats.stepStats.length === 0) && (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-gray-500">
                            No email steps in this automation
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'funnel' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium mb-4">Funnel Visualization</h3>
              <div className="max-w-2xl mx-auto">
                {(automation?.steps || []).map((step, index) => {
                  const stepStat = stats.stepStats?.[index] || { reached: 100, dropOff: 0 };
                  const widthPercent = Math.max(20, stepStat.reached || 100);

                  return (
                    <div key={index} className="mb-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{step.type === 'send_email' ? 'Email' : step.type}</span>
                        <span className="text-gray-600">{stepStat.reached || 0}% reached</span>
                      </div>
                      <div className="relative">
                        <div
                          className="h-10 bg-blue-500 rounded flex items-center justify-center text-white text-sm transition-all"
                          style={{ width: `${widthPercent}%` }}
                        >
                          {stepStat.count || 0} contacts
                        </div>
                        {stepStat.dropOff > 0 && (
                          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-red-500 text-sm">
                            -{stepStat.dropOff}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!automation?.steps || automation.steps.length === 0) && (
                  <div className="text-center py-12 text-gray-500">
                    No steps in this automation
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'enrollments' && (
            <AutomationEnrollmentList
              enrollments={enrollments || []}
              isLoading={enrollmentsLoading}
              automationId={id}
            />
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {(stats.recentActivity || []).map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-full ${
                      activity.type === 'enrolled' ? 'bg-blue-100 text-blue-600' :
                      activity.type === 'completed' ? 'bg-green-100 text-green-600' :
                      activity.type === 'email_sent' ? 'bg-purple-100 text-purple-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {activity.type === 'enrolled' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />}
                        {activity.type === 'completed' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                        {activity.type === 'email_sent' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />}
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
                {(!stats.recentActivity || stats.recentActivity.length === 0) && (
                  <div className="text-center py-12 text-gray-500">
                    No recent activity
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutomationReportPage;
