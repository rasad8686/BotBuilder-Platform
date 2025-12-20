import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const statusColors = {
  pending: { bg: '#fff3cd', color: '#856404' },
  running: { bg: '#cce5ff', color: '#004085' },
  completed: { bg: '#d4edda', color: '#155724' },
  failed: { bg: '#f8d7da', color: '#721c24' }
};

const stepIcons = {
  think: '🧠',
  plan: '📋',
  execute: '⚡',
  complete: '✅'
};

const AgentTasks = () => {
  const { t } = useTranslation();
  const { id: agentId } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskSteps, setTaskSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // New task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const token = localStorage.getItem('token');
  const pollRef = useRef(null);

  useEffect(() => {
    fetchAgentAndTasks();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    if (selectedTask) {
      fetchTaskSteps(selectedTask.id);

      // Poll for updates if task is running
      if (selectedTask.status === 'running') {
        pollRef.current = setInterval(() => {
          fetchTaskSteps(selectedTask.id);
          refreshTask(selectedTask.id);
        }, 2000);
      }
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?.id, selectedTask?.status]);

  const fetchAgentAndTasks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch agent info
      const agentRes = await fetch(`/api/autonomous/agents/${agentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!agentRes.ok) {
        throw new Error('Agent not found');
      }

      const agentData = await agentRes.json();
      setAgent(agentData.agent);

      // Fetch tasks
      const tasksRes = await fetch(`/api/autonomous/agents/${agentId}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!tasksRes.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const tasksData = await tasksRes.json();
      setTasks(tasksData.tasks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTaskSteps = async (taskId) => {
    try {
      const res = await fetch(`/api/autonomous/tasks/${taskId}/steps`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setTaskSteps(data.steps || []);
      }
    } catch (err) {
      // Failed to fetch steps - silent fail
    }
  };

  const refreshTask = async (taskId) => {
    try {
      const res = await fetch(`/api/autonomous/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedTask(data.task);
        setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));

        // Stop polling if completed
        if (data.task.status === 'completed' || data.task.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    } catch (err) {
      // Failed to refresh task - silent fail
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskDescription.trim()) return;

    setIsCreating(true);

    try {
      const res = await fetch(`/api/autonomous/agents/${agentId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          task_description: newTaskDescription,
          execute_now: true
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create task');
      }

      const data = await res.json();
      const newTask = data.task;

      setTasks(prev => [newTask, ...prev]);
      setSelectedTask(newTask);
      setShowNewTask(false);
      setNewTaskDescription('');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6c757d' }}>{t('common.loading')}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#c53030', marginBottom: '8px' }}>{t('common.error')}</h2>
          <p style={{ color: '#6c757d' }}>{error}</p>
          <button onClick={() => navigate('/autonomous')} style={{ marginTop: '16px', padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            {t('autonomous.backToAgents', 'Back to Agents')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e9ecef', padding: '16px 32px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Link to="/autonomous" style={{ color: '#667eea', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
            ← {t('autonomous.backToAgents', 'Back to Agents')}
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px'
              }}>
                🤖
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '24px', color: '#1a1a2e' }}>{agent?.name}</h1>
                <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
                  {agent?.description || t('autonomous.noDescription', 'No description')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNewTask(true)}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '18px' }}>+</span>
              {t('autonomous.newTask', 'New Task')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 32px', display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px' }}>
        {/* Tasks List */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e9ecef' }}>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#1a1a2e' }}>
              {t('autonomous.tasks', 'Tasks')} ({tasks.length})
            </h2>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
            {tasks.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                <p>{t('autonomous.noTasks', 'No tasks yet')}</p>
              </div>
            ) : (
              tasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    background: selectedTask?.id === task.id ? '#f8f9fa' : 'white',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: statusColors[task.status]?.bg || '#e9ecef',
                      color: statusColors[task.status]?.color || '#495057'
                    }}>
                      {task.status}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6c757d' }}>
                      #{task.id}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1a1a2e', lineHeight: '1.4' }}>
                    {task.task_description?.substring(0, 100)}
                    {task.task_description?.length > 100 ? '...' : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6c757d' }}>
                    <span>📊 {task.completed_steps || 0}/{task.total_steps || 0}</span>
                    <span>📅 {formatDate(task.created_at).split(',')[0]}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Task Details */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {!selectedTask ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>👆</div>
                <p>{t('autonomous.selectTask', 'Select a task to view details')}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Task Header */}
              <div style={{ padding: '20px', borderBottom: '1px solid #e9ecef' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: statusColors[selectedTask.status]?.bg || '#e9ecef',
                    color: statusColors[selectedTask.status]?.color || '#495057'
                  }}>
                    {selectedTask.status === 'running' && (
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'currentColor', borderRadius: '50%', marginRight: '8px', animation: 'pulse 1s infinite' }}></span>
                    )}
                    {selectedTask.status}
                  </span>
                  <span style={{ fontSize: '13px', color: '#6c757d' }}>Task #{selectedTask.id}</span>
                </div>
                <p style={{ margin: 0, fontSize: '16px', color: '#1a1a2e', lineHeight: '1.5' }}>
                  {selectedTask.task_description}
                </p>
              </div>

              {/* Progress Bar */}
              {selectedTask.total_steps > 0 && (
                <div style={{ padding: '16px 20px', background: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#495057', fontWeight: '500' }}>
                      {t('autonomous.progress', 'Progress')}
                    </span>
                    <span style={{ fontSize: '13px', color: '#6c757d' }}>
                      {selectedTask.completed_steps}/{selectedTask.total_steps} steps
                    </span>
                  </div>
                  <div style={{ height: '8px', background: '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(selectedTask.completed_steps / selectedTask.total_steps) * 100}%`,
                      background: selectedTask.status === 'completed' ? '#48bb78' : 'linear-gradient(90deg, #667eea, #764ba2)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              )}

              {/* Execution Steps */}
              <div style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#1a1a2e', fontWeight: '600' }}>
                  {t('autonomous.executionSteps', 'Execution Steps')}
                </h3>
                <div style={{ maxHeight: 'calc(100vh - 500px)', overflow: 'auto' }}>
                  {taskSteps.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                      {selectedTask.status === 'pending' ? (
                        <p>{t('autonomous.waitingExecution', 'Waiting for execution...')}</p>
                      ) : selectedTask.status === 'running' ? (
                        <p>{t('autonomous.executionStarting', 'Execution starting...')}</p>
                      ) : (
                        <p>{t('autonomous.noSteps', 'No execution steps')}</p>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {taskSteps.map((step) => (
                        <div key={step.id} style={{
                          padding: '16px',
                          background: '#f8f9fa',
                          borderRadius: '12px',
                          borderLeft: `4px solid ${step.status === 'completed' ? '#48bb78' : step.status === 'failed' ? '#f56565' : '#667eea'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '18px' }}>{stepIcons[step.action_type] || '⚙️'}</span>
                              <span style={{ fontWeight: '600', color: '#1a1a2e', fontSize: '14px' }}>
                                Step {step.step_number}: {step.action}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {step.duration_ms && (
                                <span style={{ fontSize: '12px', color: '#6c757d' }}>
                                  ⏱️ {formatDuration(step.duration_ms)}
                                </span>
                              )}
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: '500',
                                background: step.status === 'completed' ? '#d4edda' : step.status === 'failed' ? '#f8d7da' : '#cce5ff',
                                color: step.status === 'completed' ? '#155724' : step.status === 'failed' ? '#721c24' : '#004085'
                              }}>
                                {step.status}
                              </span>
                            </div>
                          </div>
                          {step.reasoning && (
                            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6c757d', lineHeight: '1.5' }}>
                              {step.reasoning}
                            </p>
                          )}
                          {step.output && (
                            <div style={{ marginTop: '8px', padding: '12px', background: 'white', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', overflow: 'auto' }}>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                              </pre>
                            </div>
                          )}
                          {step.error_message && (
                            <div style={{ marginTop: '8px', padding: '12px', background: '#fff5f5', borderRadius: '8px', fontSize: '13px', color: '#c53030' }}>
                              ❌ {step.error_message}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Result */}
              {selectedTask.status === 'completed' && selectedTask.result && (
                <div style={{ padding: '20px', borderTop: '1px solid #e9ecef', background: '#f0fff4' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#155724', fontWeight: '600' }}>
                    ✅ {t('autonomous.result', 'Result')}
                  </h3>
                  <div style={{ padding: '16px', background: 'white', borderRadius: '8px', fontSize: '14px', lineHeight: '1.6' }}>
                    {selectedTask.result.output || selectedTask.result.summary || JSON.stringify(selectedTask.result, null, 2)}
                  </div>
                </div>
              )}

              {/* Error */}
              {selectedTask.status === 'failed' && selectedTask.error_message && (
                <div style={{ padding: '20px', borderTop: '1px solid #e9ecef', background: '#fff5f5' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#c53030', fontWeight: '600' }}>
                    ❌ {t('autonomous.error', 'Error')}
                  </h3>
                  <div style={{ padding: '16px', background: 'white', borderRadius: '8px', fontSize: '14px', color: '#c53030' }}>
                    {selectedTask.error_message}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Task Modal */}
      {showNewTask && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e9ecef' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#1a1a2e' }}>
                {t('autonomous.newTask', 'New Task')}
              </h2>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6c757d' }}>
                {t('autonomous.newTaskDesc', 'Describe what you want the agent to do')}
              </p>
            </div>

            <form onSubmit={handleCreateTask} style={{ padding: '24px' }}>
              <textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                rows={4}
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '2px solid #e9ecef',
                  borderRadius: '12px',
                  fontSize: '15px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: '1.5'
                }}
                placeholder={t('autonomous.taskPlaceholder', 'e.g., Find top 5 Python libraries for data analysis...')}
              />

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => { setShowNewTask(false); setNewTaskDescription(''); }}
                  style={{
                    padding: '12px 24px',
                    background: '#e9ecef',
                    color: '#495057',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newTaskDescription.trim()}
                  style={{
                    padding: '12px 24px',
                    background: isCreating ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isCreating ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isCreating ? (
                    <>
                      <span style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                      {t('autonomous.creating', 'Creating...')}
                    </>
                  ) : (
                    <>
                      <span>▶</span>
                      {t('autonomous.createAndRun', 'Create & Run')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
};

export default AgentTasks;
