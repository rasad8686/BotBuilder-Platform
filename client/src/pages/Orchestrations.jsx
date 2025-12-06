import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Orchestrations() {
  const navigate = useNavigate();
  const { botId } = useParams();
  const [orchestrations, setOrchestrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrchestration, setEditingOrchestration] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [bots, setBots] = useState([]);
  const [loadingBots, setLoadingBots] = useState(false);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    if (botId) {
      fetchOrchestrations();
    } else {
      setLoading(false);
      fetchBots();
    }
  }, [botId]);

  const fetchBots = async () => {
    try {
      setLoadingBots(true);
      const res = await fetch(`${API_URL}/api/bots`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBots(Array.isArray(data) ? data : data.bots || []);
      }
    } catch (error) {
      // Silent fail
    } finally {
      setLoadingBots(false);
    }
  };

  const fetchOrchestrations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/orchestrations?bot_id=${botId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrchestrations(data.data || []);
      }
    } catch (error) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch(`${API_URL}/api/orchestrations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bot_id: botId,
          name: formData.name,
          description: formData.description
        })
      });
      if (res.ok) {
        setShowCreateModal(false);
        setFormData({ name: '', description: '' });
        fetchOrchestrations();
      }
    } catch (error) {
      // Silent fail
    }
  };

  const handleUpdate = async () => {
    try {
      const res = await fetch(`${API_URL}/api/orchestrations/${editingOrchestration.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description
        })
      });
      if (res.ok) {
        setEditingOrchestration(null);
        setFormData({ name: '', description: '' });
        fetchOrchestrations();
      }
    } catch (error) {
      // Silent fail
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this orchestration?')) return;
    try {
      const res = await fetch(`${API_URL}/api/orchestrations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        fetchOrchestrations();
      }
    } catch (error) {
      // Silent fail
    }
  };

  const openEditModal = (orch) => {
    setEditingOrchestration(orch);
    setFormData({ name: orch.name, description: orch.description || '' });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6b7280' }}>Loading orchestrations...</p>
        </div>
      </div>
    );
  }

  // No bot selected - show bot selector
  if (!botId) {
    return (
      <div style={{ padding: 32, backgroundColor: '#f9fafb', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32 }}>🔀</span>
              Multi-Flow Orchestrations
            </h1>
            <p style={{ color: '#6b7280', marginTop: 4 }}>
              Connect multiple flows together to create complex conversation journeys
            </p>
          </div>
        </div>
        <div style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', marginBottom: 16 }}>
            Select a Bot
          </h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>
            Choose a bot to manage its orchestrations
          </p>
          {loadingBots ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
              Loading bots...
            </div>
          ) : bots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
              <p style={{ color: '#6b7280', marginBottom: 16 }}>No bots found</p>
              <button
                onClick={() => navigate('/create-bot')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Create Your First Bot
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {bots.map(bot => (
                <button
                  key={bot.id}
                  onClick={() => navigate(`/bots/${bot.id}/orchestrations`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#8b5cf6';
                    e.currentTarget.style.backgroundColor = '#f9f5ff';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: '#f3e8ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24
                  }}>
                    🤖
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{bot.name}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {bot.platform || 'telegram'} • {bot.description || 'No description'}
                    </div>
                  </div>
                  <span style={{ color: '#8b5cf6', fontSize: 20 }}>→</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 32 }}>🔀</span>
            Multi-Flow Orchestrations
          </h1>
          <p style={{ color: '#6b7280', marginTop: 4 }}>
            Connect multiple flows together to create complex conversation journeys
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>+</span> New Orchestration
        </button>
      </div>

      {/* Orchestrations Grid */}
      {orchestrations.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 64,
          backgroundColor: 'white',
          borderRadius: 16,
          border: '2px dashed #e5e7eb'
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔀</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>
            No Orchestrations Yet
          </h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>
            Create your first orchestration to connect multiple flows together
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Create Orchestration
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
          {orchestrations.map(orch => (
            <div
              key={orch.id}
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 24,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #e5e7eb'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: '#f3e8ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24
                  }}>
                    🔀
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: 0 }}>{orch.name}</h3>
                    <span style={{
                      fontSize: 12,
                      padding: '2px 8px',
                      borderRadius: 12,
                      backgroundColor: orch.is_active ? '#dcfce7' : '#fee2e2',
                      color: orch.is_active ? '#166534' : '#991b1b'
                    }}>
                      {orch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16, minHeight: 40 }}>
                {orch.description || 'No description'}
              </p>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate(`/bots/${botId}/orchestrations/${orch.id}`)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: 14
                  }}
                >
                  Open Builder
                </button>
                <button
                  onClick={() => openEditModal(orch)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: 14
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(orch.id)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: 14
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
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
            maxWidth: 480
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Create New Orchestration</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Customer Support Flow"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this orchestration does..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCreateModal(false); setFormData({ name: '', description: '' }); }}
                style={{
                  padding: '10px 20px',
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
                onClick={handleCreate}
                disabled={!formData.name}
                style={{
                  padding: '10px 20px',
                  backgroundColor: formData.name ? '#8b5cf6' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: formData.name ? 'pointer' : 'not-allowed',
                  fontWeight: 500
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingOrchestration && (
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
            maxWidth: 480
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Edit Orchestration</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setEditingOrchestration(null); setFormData({ name: '', description: '' }); }}
                style={{
                  padding: '10px 20px',
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
                onClick={handleUpdate}
                disabled={!formData.name}
                style={{
                  padding: '10px 20px',
                  backgroundColor: formData.name ? '#8b5cf6' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: formData.name ? 'pointer' : 'not-allowed',
                  fontWeight: 500
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
