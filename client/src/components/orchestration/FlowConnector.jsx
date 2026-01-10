import { useState } from 'react';
import { CheckCircle, Shuffle, Target, Key } from 'lucide-react';

const TRIGGER_TYPES = [
  { value: 'on_complete', label: 'On Flow Complete', Icon: CheckCircle, description: 'Trigger when the source flow completes' },
  { value: 'on_condition', label: 'On Condition', Icon: Shuffle, description: 'Trigger based on variable condition' },
  { value: 'on_intent', label: 'On Intent', Icon: Target, description: 'Trigger when specific intent is detected' },
  { value: 'on_keyword', label: 'On Keyword', Icon: Key, description: 'Trigger when keywords are found in user input' }
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' }
];

export default function FlowConnector({ onClose, onSave }) {
  const [triggerType, setTriggerType] = useState('on_complete');
  const [triggerValue, setTriggerValue] = useState({});
  const [priority, setPriority] = useState(0);

  const handleSave = () => {
    onSave({
      trigger_type: triggerType,
      trigger_value: triggerValue,
      priority
    });
  };

  const renderTriggerConfig = () => {
    switch (triggerType) {
      case 'on_complete':
        return (
          <div style={{ padding: 16, backgroundColor: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ marginBottom: 8 }}><CheckCircle size={32} className="text-green-500 mx-auto" /></div>
            <p style={{ color: '#6b7280', margin: 0 }}>
              This transition will trigger automatically when the source flow completes.
            </p>
          </div>
        );

      case 'on_condition':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Variable Name</label>
              <input
                type="text"
                value={triggerValue.variable || ''}
                onChange={(e) => setTriggerValue({ ...triggerValue, variable: e.target.value })}
                placeholder="e.g., user_choice"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Operator</label>
              <select
                value={triggerValue.operator || 'equals'}
                onChange={(e) => setTriggerValue({ ...triggerValue, operator: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                  backgroundColor: 'white'
                }}
              >
                {OPERATORS.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>
            {!['is_empty', 'is_not_empty'].includes(triggerValue.operator) && (
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Value</label>
                <input
                  type="text"
                  value={triggerValue.value || ''}
                  onChange={(e) => setTriggerValue({ ...triggerValue, value: e.target.value })}
                  placeholder="e.g., yes"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14
                  }}
                />
              </div>
            )}
          </div>
        );

      case 'on_intent':
        return (
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Intent Name</label>
            <input
              type="text"
              value={triggerValue.intent || ''}
              onChange={(e) => setTriggerValue({ ...triggerValue, intent: e.target.value })}
              placeholder="e.g., request_support"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14
              }}
            />
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
              The transition will trigger when this intent is detected by the AI.
            </p>
          </div>
        );

      case 'on_keyword':
        return (
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Keywords (comma separated)</label>
            <textarea
              value={(triggerValue.keywords || []).join(', ')}
              onChange={(e) => setTriggerValue({
                ...triggerValue,
                keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
              })}
              placeholder="e.g., help, support, assistance"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                resize: 'vertical'
              }}
            />
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
              The transition will trigger if any of these keywords are found in the user's message.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 32,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Create Flow Transition</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}
          >
            ×
          </button>
        </div>

        {/* Trigger Type Selection */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, fontSize: 14 }}>Trigger Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {TRIGGER_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => { setTriggerType(type.value); setTriggerValue({}); }}
                style={{
                  padding: 16,
                  border: triggerType === type.value ? '2px solid #8b5cf6' : '1px solid #e5e7eb',
                  borderRadius: 12,
                  backgroundColor: triggerType === type.value ? '#f3e8ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ marginBottom: 8 }}>{type.Icon && <type.Icon size={24} />}</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{type.label}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{type.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Trigger Configuration */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, fontSize: 14 }}>Configuration</label>
          {renderTriggerConfig()}
        </div>

        {/* Priority */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            min={0}
            max={100}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14
            }}
          />
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            Higher priority transitions are evaluated first (0-100).
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '12px 24px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Create Transition
          </button>
        </div>
      </div>
    </div>
  );
}
