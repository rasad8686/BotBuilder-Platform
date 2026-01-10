/**
 * Survey Empty State Components
 * Beautiful empty states for various scenarios
 */

import React from 'react';

// Base Empty State Component
const EmptyState = ({
  icon,
  title,
  description,
  action,
  actionLabel,
  secondaryAction,
  secondaryActionLabel,
  className = ''
}) => (
  <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
    <div className="mb-6">{icon}</div>
    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
      {title}
    </h3>
    <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
      {description}
    </p>
    <div className="flex items-center gap-3">
      {secondaryAction && secondaryActionLabel && (
        <button
          onClick={secondaryAction}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {secondaryActionLabel}
        </button>
      )}
      {action && actionLabel && (
        <button
          onClick={action}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {actionLabel}
        </button>
      )}
    </div>
  </div>
);

// No Surveys Empty State
export const NoSurveysEmptyState = ({ onCreateSurvey }) => (
  <EmptyState
    icon={
      <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
        <svg className="w-12 h-12 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      </div>
    }
    title="No surveys yet"
    description="Create your first survey to start collecting valuable feedback from your customers. Choose from NPS, CSAT, or custom surveys."
    action={onCreateSurvey}
    actionLabel="Create Survey"
  />
);

// No Responses Empty State
export const NoResponsesEmptyState = ({ surveyName, onShareSurvey }) => (
  <EmptyState
    icon={
      <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
        <svg className="w-12 h-12 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
    }
    title="Waiting for responses"
    description={`Your survey "${surveyName || 'Survey'}" is ready! Share it with your audience to start collecting responses.`}
    action={onShareSurvey}
    actionLabel="Share Survey"
  />
);

// No Analytics Data Empty State
export const NoAnalyticsEmptyState = () => (
  <EmptyState
    icon={
      <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
    }
    title="No analytics data"
    description="Analytics will appear here once you receive responses to your survey."
  />
);

// No Questions Empty State
export const NoQuestionsEmptyState = ({ onAddQuestion }) => (
  <EmptyState
    icon={
      <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
        <svg className="w-12 h-12 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    }
    title="No questions added"
    description="Add questions to your survey. You can choose from different question types like rating, multiple choice, or open-ended."
    action={onAddQuestion}
    actionLabel="Add Question"
  />
);

// Search No Results Empty State
export const SearchNoResultsEmptyState = ({ searchTerm, onClearSearch }) => (
  <EmptyState
    icon={
      <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    }
    title="No results found"
    description={`No surveys found matching "${searchTerm}". Try a different search term or clear the search.`}
    action={onClearSearch}
    actionLabel="Clear Search"
  />
);

// First Time Onboarding
export const OnboardingEmptyState = ({ onGetStarted, onLearnMore }) => (
  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white">
    <div className="max-w-2xl mx-auto text-center">
      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold mb-3">
        Welcome to Surveys!
      </h2>
      <p className="text-white/80 mb-8 max-w-md mx-auto">
        Collect valuable feedback from your customers with NPS, CSAT, and custom surveys.
        Get insights that help you improve your product and customer experience.
      </p>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onLearnMore}
          className="px-6 py-3 text-sm font-medium bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
        >
          Learn More
        </button>
        <button
          onClick={onGetStarted}
          className="px-6 py-3 text-sm font-medium bg-white text-indigo-600 rounded-lg hover:bg-white/90 transition-colors inline-flex items-center gap-2"
        >
          Get Started
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-3 gap-6 mt-10 pt-8 border-t border-white/20">
        <div>
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h4 className="font-medium mb-1">NPS Surveys</h4>
          <p className="text-xs text-white/70">Measure customer loyalty</p>
        </div>
        <div>
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h4 className="font-medium mb-1">CSAT Surveys</h4>
          <p className="text-xs text-white/70">Track satisfaction scores</p>
        </div>
        <div>
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h4 className="font-medium mb-1">Analytics</h4>
          <p className="text-xs text-white/70">Detailed insights & reports</p>
        </div>
      </div>
    </div>
  </div>
);

// Survey Completed Empty State (for respondents)
export const SurveyCompletedState = ({ thankYouMessage }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-bounce-once">
      <svg className="w-12 h-12 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
      Thank You!
    </h3>
    <p className="text-gray-500 dark:text-gray-400 max-w-md">
      {thankYouMessage || 'Your feedback has been submitted successfully. We appreciate your time!'}
    </p>
  </div>
);

// Survey Archived State
export const SurveyArchivedState = ({ onRestore }) => (
  <EmptyState
    icon={
      <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      </div>
    }
    title="Survey Archived"
    description="This survey has been archived and is no longer collecting responses."
    action={onRestore}
    actionLabel="Restore Survey"
  />
);

export default {
  NoSurveysEmptyState,
  NoResponsesEmptyState,
  NoAnalyticsEmptyState,
  NoQuestionsEmptyState,
  SearchNoResultsEmptyState,
  OnboardingEmptyState,
  SurveyCompletedState,
  SurveyArchivedState
};
