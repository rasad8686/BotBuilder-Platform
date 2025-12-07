import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ToolList, ToolForm, ToolTestPanel, ToolAssignModal } from '../components/tools';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ToolStudio = () => {
  const { t } = useTranslation();
  const { botId } = useParams();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchTools();
  }, [botId]);

  const fetchTools = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/tools/bot/${botId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tools');
      }

      const data = await response.json();
      setTools(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedTool(null);
    setShowForm(true);
  };

  const handleEdit = (tool) => {
    setSelectedTool(tool);
    setShowForm(true);
  };

  const handleTest = (tool) => {
    setSelectedTool(tool);
    setShowTest(true);
  };

  const handleAssign = (tool) => {
    setSelectedTool(tool);
    setShowAssignModal(true);
  };

  const handleDelete = async (tool) => {
    if (!confirm(`Are you sure you want to delete "${tool.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/tools/${tool.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete tool');
      }

      setTools(tools.filter(t => t.id !== tool.id));
    } catch (err) {
      alert('Error deleting tool: ' + err.message);
    }
  };

  const handleSave = async (formData) => {
    try {
      const url = selectedTool
        ? `${API_URL}/api/tools/${selectedTool.id}`
        : `${API_URL}/api/tools`;

      const response = await fetch(url, {
        method: selectedTool ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          bot_id: parseInt(botId)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save tool');
      }

      const savedTool = await response.json();

      if (selectedTool) {
        setTools(tools.map(t => t.id === savedTool.id ? savedTool : t));
      } else {
        setTools([...tools, savedTool]);
      }

      setShowForm(false);
      setSelectedTool(null);
    } catch (err) {
      alert('Error saving tool: ' + err.message);
    }
  };

  const handleExecute = async (toolId, input) => {
    const response = await fetch(`${API_URL}/api/tools/${toolId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ input })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Execution failed');
    }

    return await response.json();
  };

  if (loading) {
    return (
      <div className="tool-studio loading">
        <div className="spinner"></div>
        <p>{t('toolStudio.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tool-studio error">
        <p>{t('common.error')}: {error}</p>
        <button onClick={fetchTools}>{t('common.tryAgain')}</button>
      </div>
    );
  }

  return (
    <div className="tool-studio">
      <ToolList
        tools={tools}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTest={handleTest}
        onAssign={handleAssign}
      />

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <ToolForm
              tool={selectedTool}
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {showTest && selectedTool && (
        <div className="modal-overlay" onClick={() => setShowTest(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <ToolTestPanel
              tool={selectedTool}
              onClose={() => setShowTest(false)}
              onExecute={handleExecute}
            />
          </div>
        </div>
      )}

      {showAssignModal && selectedTool && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <ToolAssignModal
              tool={selectedTool}
              botId={botId}
              onClose={() => setShowAssignModal(false)}
              onSave={() => fetchTools()}
            />
          </div>
        </div>
      )}

      <style>{`
        .tool-studio {
          min-height: 100vh;
          background: #f5f6fa;
        }

        .tool-studio.loading,
        .tool-studio.error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .modal-content.modal-large {
          max-width: 700px;
        }
      `}</style>
    </div>
  );
};

export default ToolStudio;
