import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Target, Bot, Wrench } from 'lucide-react';
import { AgentList, AgentForm, AgentTestPanel } from '../components/agents';

const AgentStudio = () => {
  const { t } = useTranslation();
  const { botId } = useParams();
  const navigate = useNavigate();

  const [bot, setBot] = useState(null);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bot selector state
  const [bots, setBots] = useState([]);
  const [loadingBots, setLoadingBots] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [testingAgent, setTestingAgent] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (botId) {
      fetchBotAndAgents();
    } else {
      setIsLoading(false);
      fetchBots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const fetchBots = async () => {
    try {
      setLoadingBots(true);
      const res = await fetch('/api/bots', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBots(Array.isArray(data) ? data : data.bots || []);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoadingBots(false);
    }
  };

  const fetchBotAndAgents = async () => {
    // Skip if no botId
    if (!botId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch bot info
      const botRes = await fetch(`/api/bots/${botId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!botRes.ok) {
        throw new Error('Failed to fetch bot');
      }

      const botData = await botRes.json();
      setBot(botData);

      // Fetch agents
      const agentsRes = await fetch(`/api/agents/bot/${botId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!agentsRes.ok) {
        throw new Error('Failed to fetch agents');
      }

      const agentsData = await agentsRes.json();
      setAgents(agentsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAgent(null);
    setShowForm(true);
  };

  const handleEdit = (agent) => {
    setEditingAgent(agent);
    setShowForm(true);
  };

  const handleDelete = async (agent) => {
    if (!window.confirm(t('agentStudio.deleteConfirm'))) {
      return;
    }

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to delete agent');
      }

      setAgents(prev => prev.filter(a => a.id !== agent.id));
    } catch (err) {
      alert(t('agentStudio.error') + ': ' + err.message);
    }
  };

  const handleTest = (agent) => {
    setTestingAgent(agent);
  };

  const handleSave = async (formData) => {
    setIsSaving(true);

    try {
      const url = editingAgent
        ? `/api/agents/${editingAgent.id}`
        : '/api/agents';

      const method = editingAgent ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        bot_id: parseInt(botId)
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save agent');
      }

      const savedAgent = await res.json();

      if (editingAgent) {
        setAgents(prev => prev.map(a => a.id === savedAgent.id ? savedAgent : a));
      } else {
        setAgents(prev => [...prev, savedAgent]);
      }

      setShowForm(false);
      setEditingAgent(null);
    } catch (err) {
      alert(t('agentStudio.error') + ': ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingAgent(null);
  };

  const handleCloseTest = () => {
    setTestingAgent(null);
  };

  // If no botId, show bot selector
  if (!botId) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Target size={32} style={{ color: '#667eea' }} />
              {t('agentStudio.title')}
            </h1>
            <p style={{ color: '#6c757d', margin: 0 }}>
              {t('agentStudio.subtitle')}
            </p>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e', marginTop: 0, marginBottom: '16px' }}>
              {t('agentStudio.selectBot')}
            </h2>
            <p style={{ color: '#6c757d', marginBottom: '24px' }}>
              {t('agentStudio.selectBotDesc')}
            </p>
            {loadingBots ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                {t('common.loading')}
              </div>
            ) : bots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><Bot size={48} style={{ color: '#667eea' }} /></div>
                <p style={{ color: '#6c757d', marginBottom: '16px' }}>{t('agentStudio.noBotsFound')}</p>
                <button
                  type="button"
                  onClick={() => navigate('/create-bot')}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {t('agentStudio.createFirstBot')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {bots.map(bot => (
                  <button
                    key={bot.id}
                    type="button"
                    onClick={() => navigate(`/bots/${bot.id}/agents`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      width: '100%'
                    }}
                  >
                    <Bot size={24} style={{ color: '#667eea' }} />
                    <div>
                      <div style={{ color: '#1a1a2e', fontWeight: '600', fontSize: '14px' }}>{bot.name}</div>
                      <div style={{ color: '#6c757d', fontSize: '12px', marginTop: '2px' }}>{bot.description || 'Bot'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="agent-studio loading">
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>{t('agentStudio.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="agent-studio error">
        <div className="error-container">
          <h2>{t('common.error')}</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/dashboard')}>{t('agentStudio.backToDashboard')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-studio">
      <header className="studio-header">
        <div className="header-left">
          <Link to="/dashboard" className="back-link">
            ← {t('agentStudio.backToDashboard')}
          </Link>
          <div className="header-title">
            <h1>{t('agentStudio.title')}</h1>
            {bot && <span className="bot-name">{bot.name}</span>}
          </div>
        </div>
        <div className="header-right">
          <Link to={`/bots/${botId}/tools`} className="btn btn-tools" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wrench size={16} /> {t('agentStudio.tools')}
          </Link>
          <Link to={`/bots/${botId}/workflows`} className="btn btn-secondary">
            {t('agentStudio.workflows')}
          </Link>
        </div>
      </header>

      <main className="studio-content">
        <AgentList
          agents={agents}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onTest={handleTest}
          onCreate={handleCreate}
        />
      </main>

      {showForm && (
        <AgentForm
          agent={editingAgent}
          onSave={handleSave}
          onCancel={handleCloseForm}
          isLoading={isSaving}
        />
      )}

      {testingAgent && (
        <AgentTestPanel
          agent={testingAgent}
          onClose={handleCloseTest}
        />
      )}

      <style>{`
        .agent-studio {
          min-height: 100vh;
          background: #f5f7fa;
        }

        .agent-studio.loading,
        .agent-studio.error {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner-container {
          text-align: center;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e9ecef;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-container {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .error-container h2 {
          color: #c53030;
          margin-bottom: 8px;
        }

        .error-container button {
          margin-top: 16px;
          padding: 10px 20px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }

        .studio-header {
          background: white;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e9ecef;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
        }

        .header-left {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .back-link {
          color: #667eea;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        .header-title {
          display: flex;
          align-items: baseline;
          gap: 12px;
        }

        .header-title h1 {
          margin: 0;
          font-size: 24px;
          color: #1a1a2e;
        }

        .bot-name {
          color: #6c757d;
          font-size: 16px;
        }

        .header-right {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: #e9ecef;
          color: #495057;
        }

        .btn-secondary:hover {
          background: #dee2e6;
        }

        .studio-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }
      `}</style>
    </div>
  );
};

export default AgentStudio;
