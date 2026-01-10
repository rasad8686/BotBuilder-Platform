import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const DIFFICULTY_COLORS = {
  beginner: '#22c55e',
  intermediate: '#f59e0b',
  advanced: '#ef4444'
};

function TutorialDetail() {
  const { slug } = useParams();
  const [tutorial, setTutorial] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTutorial = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/blog/tutorials/${slug}`);
      setTutorial(response.data.data);
    } catch (error) {
      console.error('Failed to fetch tutorial:', error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchProgress = useCallback(async () => {
    try {
      const response = await axios.get('/api/blog/tutorials/my/progress');
      const progress = response.data.data?.find(p => p.slug === slug);
      if (progress) {
        const steps = typeof progress.completed_steps === 'string'
          ? JSON.parse(progress.completed_steps)
          : progress.completed_steps || [];
        setCompletedSteps(steps);
      }
    } catch (error) {
      console.log('Could not fetch progress');
    }
  }, [slug]);

  useEffect(() => {
    fetchTutorial();
    fetchProgress();
  }, [fetchTutorial, fetchProgress]);

  const handleStepComplete = async (stepNumber) => {
    const isCompleted = completedSteps.includes(stepNumber);

    try {
      const response = await axios.post(`/api/blog/tutorials/${slug}/progress`, {
        stepNumber,
        completed: !isCompleted
      });

      setCompletedSteps(response.data.data.completedSteps);
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  const navigateStep = (direction) => {
    if (!tutorial?.steps) return;

    const newStep = currentStep + direction;
    if (newStep >= 0 && newStep < tutorial.steps.length) {
      setCurrentStep(newStep);
      window.scrollTo(0, 0);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading tutorial...</div>;
  }

  if (!tutorial) {
    return (
      <div style={styles.notFound}>
        <h2>Tutorial not found</h2>
        <Link to="/tutorials" style={styles.backLink}>Back to Tutorials</Link>
      </div>
    );
  }

  const steps = tutorial.steps || [];
  const currentStepData = steps[currentStep];
  const progress = steps.length > 0
    ? (completedSteps.length / steps.length) * 100
    : 0;

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <Link to="/tutorials" style={styles.backLink}>← Back to Tutorials</Link>

        <div style={styles.tutorialInfo}>
          <h2 style={styles.tutorialTitle}>{tutorial.title}</h2>
          <div style={styles.tutorialMeta}>
            <span
              style={{
                ...styles.difficultyBadge,
                backgroundColor: DIFFICULTY_COLORS[tutorial.difficulty] || '#6b7280'
              }}
            >
              {tutorial.difficulty}
            </span>
            <span style={styles.duration}>⏱ {tutorial.estimated_time} min</span>
          </div>
        </div>

        {/* Progress */}
        <div style={styles.progressSection}>
          <div style={styles.progressHeader}>
            <span>Progress</span>
            <span style={styles.progressPercent}>{Math.round(progress)}%</span>
          </div>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <span style={styles.progressText}>
            {completedSteps.length} of {steps.length} steps completed
          </span>
        </div>

        {/* Steps List */}
        <div style={styles.stepsList}>
          <h3 style={styles.stepsTitle}>Steps</h3>
          {steps.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(idx)}
              style={{
                ...styles.stepItem,
                ...(idx === currentStep ? styles.stepItemActive : {}),
                ...(completedSteps.includes(step.step_number) ? styles.stepItemCompleted : {})
              }}
            >
              <span style={styles.stepNumber}>
                {completedSteps.includes(step.step_number) ? '✓' : idx + 1}
              </span>
              <span style={styles.stepTitle}>{step.title || `Step ${idx + 1}`}</span>
            </button>
          ))}
        </div>

        {/* Series Navigation */}
        {tutorial.seriesTutorials && tutorial.seriesTutorials.length > 0 && (
          <div style={styles.seriesSection}>
            <h3 style={styles.seriesTitle}>In This Series</h3>
            {tutorial.seriesTutorials.map(t => (
              <Link
                key={t.id}
                to={`/tutorials/${t.slug}`}
                style={{
                  ...styles.seriesItem,
                  ...(t.slug === slug ? styles.seriesItemActive : {})
                }}
              >
                {t.series_order}. {t.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {currentStepData ? (
          <>
            <div style={styles.stepHeader}>
              <span style={styles.stepLabel}>Step {currentStep + 1} of {steps.length}</span>
              <h1 style={styles.currentStepTitle}>
                {currentStepData.title || `Step ${currentStep + 1}`}
              </h1>
            </div>

            <div
              style={styles.stepContent}
              dangerouslySetInnerHTML={{ __html: currentStepData.content }}
            />

            {/* Code Snippet */}
            {currentStepData.code_snippet && (
              <div style={styles.codeBlock}>
                <div style={styles.codeHeader}>
                  <span>{currentStepData.code_language || 'Code'}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(currentStepData.code_snippet)}
                    style={styles.copyBtn}
                  >
                    Copy
                  </button>
                </div>
                <pre style={styles.codeContent}>
                  <code>{currentStepData.code_snippet}</code>
                </pre>
              </div>
            )}

            {/* Step Actions */}
            <div style={styles.stepActions}>
              <button
                onClick={() => handleStepComplete(currentStepData.step_number)}
                style={{
                  ...styles.completeBtn,
                  ...(completedSteps.includes(currentStepData.step_number) ? styles.completeBtnDone : {})
                }}
              >
                {completedSteps.includes(currentStepData.step_number)
                  ? '✓ Completed'
                  : 'Mark as Complete'}
              </button>
            </div>

            {/* Navigation */}
            <div style={styles.navigation}>
              <button
                onClick={() => navigateStep(-1)}
                disabled={currentStep === 0}
                style={styles.navBtn}
              >
                ← Previous Step
              </button>

              {currentStep < steps.length - 1 ? (
                <button
                  onClick={() => navigateStep(1)}
                  style={styles.navBtnPrimary}
                >
                  Next Step →
                </button>
              ) : (
                <div style={styles.completionMessage}>
                  {progress === 100 ? (
                    <span style={styles.completedText}>🎉 Tutorial Completed!</span>
                  ) : (
                    <span>Complete all steps to finish this tutorial</span>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={styles.noSteps}>
            <h2>No steps available</h2>
            <p>This tutorial doesn't have any steps yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#6b7280'
  },
  notFound: {
    textAlign: 'center',
    padding: '60px'
  },
  sidebar: {
    width: '320px',
    backgroundColor: '#f9fafb',
    padding: '24px',
    borderRight: '1px solid #e5e7eb',
    overflowY: 'auto',
    position: 'sticky',
    top: 0,
    height: '100vh'
  },
  backLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '14px',
    display: 'inline-block',
    marginBottom: '24px'
  },
  tutorialInfo: {
    marginBottom: '24px'
  },
  tutorialTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 12px 0'
  },
  tutorialMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  difficultyBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase'
  },
  duration: {
    fontSize: '13px',
    color: '#6b7280'
  },
  progressSection: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px'
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '14px',
    color: '#374151'
  },
  progressPercent: {
    fontWeight: '600',
    color: '#22c55e'
  },
  progressBar: {
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: '4px',
    transition: 'width 0.3s'
  },
  progressText: {
    fontSize: '12px',
    color: '#6b7280'
  },
  stepsList: {
    marginBottom: '24px'
  },
  stepsTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '12px'
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    backgroundColor: 'white',
    border: 'none',
    borderRadius: '6px',
    marginBottom: '4px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    fontSize: '14px',
    color: '#374151'
  },
  stepItemActive: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8'
  },
  stepItemCompleted: {
    color: '#22c55e'
  },
  stepNumber: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
    borderRadius: '50%',
    fontSize: '12px',
    fontWeight: '600'
  },
  stepTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  seriesSection: {
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb'
  },
  seriesTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '12px'
  },
  seriesItem: {
    display: 'block',
    padding: '8px 12px',
    color: '#374151',
    textDecoration: 'none',
    fontSize: '13px',
    borderRadius: '4px',
    marginBottom: '4px'
  },
  seriesItemActive: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontWeight: '500'
  },
  mainContent: {
    flex: 1,
    padding: '40px 60px',
    maxWidth: '800px'
  },
  stepHeader: {
    marginBottom: '32px'
  },
  stepLabel: {
    fontSize: '14px',
    color: '#3b82f6',
    fontWeight: '500',
    marginBottom: '8px',
    display: 'block'
  },
  currentStepTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  stepContent: {
    fontSize: '16px',
    lineHeight: 1.8,
    color: '#374151',
    marginBottom: '32px'
  },
  codeBlock: {
    backgroundColor: '#1f2937',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '32px'
  },
  codeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#374151',
    color: '#9ca3af',
    fontSize: '13px'
  },
  copyBtn: {
    padding: '4px 12px',
    backgroundColor: '#4b5563',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  codeContent: {
    padding: '16px',
    margin: 0,
    color: '#e5e7eb',
    fontSize: '14px',
    lineHeight: 1.6,
    overflowX: 'auto'
  },
  stepActions: {
    marginBottom: '32px'
  },
  completeBtn: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500'
  },
  completeBtnDone: {
    backgroundColor: '#22c55e'
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '32px',
    borderTop: '1px solid #e5e7eb'
  },
  navBtn: {
    padding: '10px 20px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151'
  },
  navBtnPrimary: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  completionMessage: {
    fontSize: '14px',
    color: '#6b7280'
  },
  completedText: {
    color: '#22c55e',
    fontWeight: '600'
  },
  noSteps: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280'
  }
};

export default TutorialDetail;
