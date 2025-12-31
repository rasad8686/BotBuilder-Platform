import React, { useState } from 'react';

const scheduleTypes = [
  { value: 'once', label: 'One Time', icon: '1️⃣', description: 'Run once at a specific time' },
  { value: 'recurring', label: 'Recurring', icon: '🔄', description: 'Run at regular intervals' },
  { value: 'cron', label: 'Cron Expression', icon: '⏰', description: 'Advanced scheduling with cron' }
];

const intervalPresets = [
  { value: '5m', label: 'Every 5 minutes' },
  { value: '15m', label: 'Every 15 minutes' },
  { value: '30m', label: 'Every 30 minutes' },
  { value: '1h', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '12h', label: 'Every 12 hours' },
  { value: '1d', label: 'Daily' },
  { value: '1w', label: 'Weekly' }
];

const cronPresets = [
  { value: '0 9 * * *', label: 'Every day at 9:00 AM' },
  { value: '0 9 * * 1-5', label: 'Weekdays at 9:00 AM' },
  { value: '0 0 * * 0', label: 'Every Sunday at midnight' },
  { value: '0 0 1 * *', label: 'First of every month' }
];

const AgentScheduler = ({
  agentId,
  onSchedule,
  initialSchedule = null
}) => {
  const [scheduleType, setScheduleType] = useState(initialSchedule?.scheduleType || 'once');
  const [taskDescription, setTaskDescription] = useState(initialSchedule?.taskDescription || '');
  const [executeAt, setExecuteAt] = useState(() => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    return date.toISOString().slice(0, 16);
  });
  const [interval, setInterval] = useState('1h');
  const [cronExpression, setCronExpression] = useState('0 9 * * *');
  const [priority, setPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!taskDescription.trim()) {
      alert('Task description is required');
      return;
    }

    setIsSubmitting(true);

    const scheduleConfig = {};
    if (scheduleType === 'once') {
      scheduleConfig.executeAt = new Date(executeAt).toISOString();
    } else if (scheduleType === 'recurring') {
      scheduleConfig.interval = interval;
    } else if (scheduleType === 'cron') {
      scheduleConfig.cronExpression = cronExpression;
    }

    const scheduleData = {
      agentId,
      taskDescription,
      scheduleType,
      scheduleConfig,
      priority,
      inputData: {}
    };

    try {
      await onSchedule(scheduleData);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="agent-scheduler">
      <form onSubmit={handleSubmit}>
        {/* Task Description */}
        <div className="form-group">
          <label>Task Description *</label>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Describe what the agent should do..."
            rows={3}
            required
          />
        </div>

        {/* Schedule Type */}
        <div className="form-group">
          <label>Schedule Type</label>
          <div className="schedule-types">
            {scheduleTypes.map(type => (
              <button
                key={type.value}
                type="button"
                className={`schedule-type ${scheduleType === type.value ? 'active' : ''}`}
                onClick={() => setScheduleType(type.value)}
              >
                <span className="type-icon">{type.icon}</span>
                <div className="type-info">
                  <div className="type-label">{type.label}</div>
                  <div className="type-desc">{type.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* One Time Settings */}
        {scheduleType === 'once' && (
          <div className="form-group">
            <label>Execute At</label>
            <input
              type="datetime-local"
              value={executeAt}
              onChange={(e) => setExecuteAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              required
            />
          </div>
        )}

        {/* Recurring Settings */}
        {scheduleType === 'recurring' && (
          <div className="form-group">
            <label>Interval</label>
            <div className="interval-grid">
              {intervalPresets.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  className={`interval-btn ${interval === preset.value ? 'active' : ''}`}
                  onClick={() => setInterval(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cron Settings */}
        {scheduleType === 'cron' && (
          <div className="form-group">
            <label>Cron Expression</label>
            <input
              type="text"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="* * * * *"
              required
            />
            <div className="cron-presets">
              {cronPresets.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  className={`preset-btn ${cronExpression === preset.value ? 'active' : ''}`}
                  onClick={() => setCronExpression(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Priority */}
        <div className="form-group">
          <label>Priority</label>
          <div className="priority-options">
            {['low', 'normal', 'high'].map(p => (
              <button
                key={p}
                type="button"
                className={`priority-btn ${priority === p ? 'active' : ''} ${p}`}
                onClick={() => setPriority(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="spinner"></span>
              Scheduling...
            </>
          ) : (
            <>
              <span>📅</span>
              Create Schedule
            </>
          )}
        </button>
      </form>

      <style>{`
        .agent-scheduler {
          background: white;
          border-radius: 16px;
          padding: 24px;
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #1a1a2e;
          font-size: 14px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group textarea {
          resize: vertical;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          border-color: #667eea;
          outline: none;
        }

        .schedule-types {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .schedule-type {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: #f8f9fa;
          border: 2px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
        }

        .schedule-type:hover {
          background: #e9ecef;
        }

        .schedule-type.active {
          background: linear-gradient(135deg, #667eea10 0%, #764ba210 100%);
          border-color: #667eea;
        }

        .type-icon {
          font-size: 28px;
        }

        .type-label {
          font-weight: 600;
          color: #1a1a2e;
        }

        .type-desc {
          font-size: 12px;
          color: #6c757d;
        }

        .interval-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .interval-btn {
          padding: 12px;
          background: #f8f9fa;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: #495057;
          transition: all 0.2s;
        }

        .interval-btn:hover {
          background: #e9ecef;
        }

        .interval-btn.active {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .cron-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .preset-btn {
          padding: 8px 16px;
          background: #f8f9fa;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-size: 12px;
          color: #6c757d;
          transition: all 0.2s;
        }

        .preset-btn:hover {
          background: #e9ecef;
        }

        .preset-btn.active {
          background: #667eea20;
          color: #667eea;
        }

        .priority-options {
          display: flex;
          gap: 12px;
        }

        .priority-btn {
          flex: 1;
          padding: 12px;
          background: #f8f9fa;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .priority-btn.low.active {
          background: #d4edda;
          border-color: #48bb78;
          color: #155724;
        }

        .priority-btn.normal.active {
          background: #cce5ff;
          border-color: #4299e1;
          color: #004085;
        }

        .priority-btn.high.active {
          background: #f8d7da;
          border-color: #f56565;
          color: #721c24;
        }

        .submit-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s;
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid #fff;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AgentScheduler;
