import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const VARIABLE_TYPES = [
  { value: 'string', label: 'String', icon: '📝' },
  { value: 'number', label: 'Number', icon: '🔢' },
  { value: 'boolean', label: 'Boolean', icon: '✓' },
  { value: 'array', label: 'Array', icon: '📋' },
  { value: 'object', label: 'Object', icon: '📦' }
];

const SCOPES = [
  { value: 'global', label: 'Global', description: 'Persists across all sessions', color: '#ef4444' },
  { value: 'session', label: 'Session', description: 'Persists for current session', color: '#f59e0b' },
  { value: 'flow', label: 'Flow', description: 'Resets when flow changes', color: '#10b981' }
];

export default function VariableManager({ orchestrationId, onClose }) {
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVariable, setNewVariable] = useState({
    name: '',
    type: 'string',
    default_value: '',
    scope: 'session'
  });

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    fetchVariables();
  }, [orchestrationId]);

  const fetchVariables = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/orchestrations/${orchestrationId}/variables`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVariables(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching variables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariable = async () => {
    if (!newVariable.name.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/orchestrations/${orchestrationId}/variables`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newVariable)
      });

      if (res.ok) {
        setNewVariable({ name: '', type: 'string', default_value: '', scope: 'session' });
        setShowAddForm(false);
        fetchVariables();
      }
    } catch (error) {
      console.error('Error adding variable:', error);
    }
  };

  const handleDeleteVariable = async (variableId) => {
    if (!window.confirm('Are you sure you want to delete this variable?')) return;

    try {
      const res = await fetch(`${API_URL}/api/orchestrations/${orchestrationId}/variables/${variableId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        fetchVariables();
      }
    } catch (error) {
      console.error('Error deleting variable:', error);
    }
  };

  const getScopeColor = (scope) => {
    const scopeInfo = SCOPES.find(s => s.value === scope);
    return scopeInfo?.color || '#6b7280';
  };

  const getTypeIcon = (type) => {
    const typeInfo = VARIABLE_TYPES.find(t => t.value === type);
    return typeInfo?.icon || '📝';
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
        maxWidth: 640,
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📊</span> Shared Variables
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Variables shared between flows in this orchestration
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}
          >
            ×
          </button>
        </div>

        {/* Add Variable Button */}
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              width: '100%',
              padding: '14px 20px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '2px dashed #d1d5db',
              borderRadius: 12,
              cursor: 'pointer',
              fontWeight: 500,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <span>+</span> Add New Variable
          </button>
        )}

        {/* Add Variable Form */}
        {showAddForm && (
          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>New Variable</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Name</label>
                <input
                  type="text"
                  value={newVariable.name}
                  onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                  placeholder="e.g., user_name"
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
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Type</label>
                <select
                  value={newVariable.type}
                  onChange={(e) => setNewVariable({ ...newVariable, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                    backgroundColor: 'white'
                  }}
                >
                  {VARIABLE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>Default Value</label>
              <input
                type="text"
                value={newVariable.default_value}
                onChange={(e) => setNewVariable({ ...newVariable, default_value: e.target.value })}
                placeholder="Optional default value"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>Scope</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {SCOPES.map(scope => (
                  <button
                    key={scope.value}
                    onClick={() => setNewVariable({ ...newVariable, scope: scope.value })}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: newVariable.scope === scope.value ? `2px solid ${scope.color}` : '1px solid #e5e7eb',
                      borderRadius: 8,
                      backgroundColor: newVariable.scope === scope.value ? `${scope.color}10` : 'white',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, color: scope.color }}>{scope.label}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{scope.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowAddForm(false); setNewVariable({ name: '', type: 'string', default_value: '', scope: 'session' }); }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddVariable}
                disabled={!newVariable.name.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: newVariable.name.trim() ? '#8b5cf6' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: newVariable.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 500
                }}
              >
                Add Variable
              </button>
            </div>
          </div>
        )}

        {/* Variables List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
            Loading variables...
          </div>
        ) : variables.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 40,
            backgroundColor: '#f9fafb',
            borderRadius: 12,
            color: '#6b7280'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <p>No variables defined yet.</p>
            <p style={{ fontSize: 13 }}>Add variables to share data between flows.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {variables.map(variable => (
              <div
                key={variable.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  backgroundColor: '#f9fafb',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    border: '1px solid #e5e7eb'
                  }}>
                    {getTypeIcon(variable.type)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{variable.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: '#e5e7eb',
                        color: '#374151'
                      }}>
                        {variable.type}
                      </span>
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: `${getScopeColor(variable.scope)}20`,
                        color: getScopeColor(variable.scope)
                      }}>
                        {variable.scope}
                      </span>
                      {variable.default_value && (
                        <span style={{ fontSize: 11, color: '#6b7280' }}>
                          Default: {variable.default_value}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteVariable(variable.id)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Close Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
