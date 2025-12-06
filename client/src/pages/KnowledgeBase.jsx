import React, { useState, useEffect } from 'react';
import KBList from '../components/knowledge/KBList';
import DocumentUpload from '../components/knowledge/DocumentUpload';
import DocumentList from '../components/knowledge/DocumentList';
import SearchTest from '../components/knowledge/SearchTest';
import KBAssignModal from '../components/knowledge/KBAssignModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const KnowledgeBase = () => {
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedKB, setSelectedKB] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningKB, setAssigningKB] = useState(null);
  const [activeTab, setActiveTab] = useState('documents');

  const [newKB, setNewKB] = useState({
    name: '',
    description: '',
    chunk_size: 1000,
    chunk_overlap: 200
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  useEffect(() => {
    if (selectedKB) {
      fetchDocuments(selectedKB.id);
    }
  }, [selectedKB]);

  const fetchKnowledgeBases = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/knowledge`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch knowledge bases');
      const data = await response.json();
      setKnowledgeBases(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (kbId) => {
    try {
      const response = await fetch(`${API_URL}/api/knowledge/${kbId}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const handleCreateKB = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newKB)
      });
      if (!response.ok) throw new Error('Failed to create knowledge base');
      const created = await response.json();
      setKnowledgeBases([created, ...knowledgeBases]);
      setShowCreateModal(false);
      setNewKB({ name: '', description: '', chunk_size: 1000, chunk_overlap: 200 });
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteKB = async (kb) => {
    if (!confirm(`Delete "${kb.name}"? This will remove all documents and chunks.`)) return;
    try {
      const response = await fetch(`${API_URL}/api/knowledge/${kb.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete');
      setKnowledgeBases(knowledgeBases.filter(k => k.id !== kb.id));
      if (selectedKB?.id === kb.id) {
        setSelectedKB(null);
        setDocuments([]);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDocumentUploaded = (doc) => {
    setDocuments([doc, ...documents]);
    fetchKnowledgeBases(); // Refresh counts
  };

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      const response = await fetch(`${API_URL}/api/knowledge/${selectedKB.id}/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete document');
      setDocuments(documents.filter(d => d.id !== docId));
      fetchKnowledgeBases();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="kb-page loading">
        <div className="spinner"></div>
        <p>Loading knowledge bases...</p>
      </div>
    );
  }

  return (
    <div className="kb-page">
      <div className="kb-header">
        <h1>Knowledge Base</h1>
        <p>Manage your AI knowledge bases with vector embeddings for semantic search</p>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Knowledge Base
        </button>
      </div>

      <div className="kb-content">
        <div className="kb-sidebar">
          <KBList
            knowledgeBases={knowledgeBases}
            selectedKB={selectedKB}
            onSelect={setSelectedKB}
            onDelete={handleDeleteKB}
            onAssign={(kb) => {
              setAssigningKB(kb);
              setShowAssignModal(true);
            }}
          />
        </div>

        {selectedKB ? (
          <div className="kb-main">
            <div className="kb-detail-header">
              <h2>{selectedKB.name}</h2>
              <p>{selectedKB.description || 'No description'}</p>
              <div className="kb-stats">
                <span>{selectedKB.document_count || 0} documents</span>
                <span>{selectedKB.total_chunks || 0} chunks</span>
                <span>Chunk size: {selectedKB.chunk_size}</span>
              </div>
            </div>

            <div className="kb-tabs">
              <button
                className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveTab('documents')}
              >
                Documents
              </button>
              <button
                className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                Upload
              </button>
              <button
                className={`tab ${activeTab === 'search' ? 'active' : ''}`}
                onClick={() => setActiveTab('search')}
              >
                Search Test
              </button>
            </div>

            <div className="tab-content">
              {activeTab === 'documents' && (
                <DocumentList
                  documents={documents}
                  onDelete={handleDeleteDocument}
                  onRefresh={() => fetchDocuments(selectedKB.id)}
                />
              )}
              {activeTab === 'upload' && (
                <DocumentUpload
                  knowledgeBaseId={selectedKB.id}
                  onUploaded={handleDocumentUploaded}
                />
              )}
              {activeTab === 'search' && (
                <SearchTest knowledgeBaseId={selectedKB.id} />
              )}
            </div>
          </div>
        ) : (
          <div className="kb-main empty">
            <div className="empty-state">
              <span className="empty-icon">🧠</span>
              <h3>Select a Knowledge Base</h3>
              <p>Choose a knowledge base from the list or create a new one to get started.</p>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Create Knowledge Base</h2>
            <form onSubmit={handleCreateKB}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={newKB.name}
                  onChange={e => setNewKB({ ...newKB, name: e.target.value })}
                  placeholder="e.g., Product Documentation"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newKB.description}
                  onChange={e => setNewKB({ ...newKB, description: e.target.value })}
                  placeholder="What knowledge will this contain?"
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Chunk Size</label>
                  <input
                    type="number"
                    value={newKB.chunk_size}
                    onChange={e => setNewKB({ ...newKB, chunk_size: parseInt(e.target.value) })}
                    min={100}
                    max={4000}
                  />
                </div>
                <div className="form-group">
                  <label>Chunk Overlap</label>
                  <input
                    type="number"
                    value={newKB.chunk_overlap}
                    onChange={e => setNewKB({ ...newKB, chunk_overlap: parseInt(e.target.value) })}
                    min={0}
                    max={1000}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && assigningKB && (
        <KBAssignModal
          knowledgeBase={assigningKB}
          onClose={() => {
            setShowAssignModal(false);
            setAssigningKB(null);
          }}
        />
      )}

      <style>{`
        .kb-page {
          padding: 24px;
          min-height: 100vh;
          background: #f5f6fa;
        }

        .kb-page.loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .kb-header {
          margin-bottom: 24px;
        }

        .kb-header h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          color: #1a1a2e;
        }

        .kb-header p {
          color: #6b7280;
          margin: 0 0 16px 0;
        }

        .kb-content {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 24px;
        }

        .kb-sidebar {
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          height: fit-content;
        }

        .kb-main {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .kb-main.empty {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .empty-state {
          text-align: center;
          color: #6b7280;
        }

        .empty-icon {
          font-size: 64px;
          display: block;
          margin-bottom: 16px;
        }

        .kb-detail-header h2 {
          margin: 0 0 8px 0;
          color: #1a1a2e;
        }

        .kb-detail-header p {
          color: #6b7280;
          margin: 0 0 12px 0;
        }

        .kb-stats {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #6b7280;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 16px;
        }

        .kb-stats span {
          background: #f3f4f6;
          padding: 4px 10px;
          border-radius: 4px;
        }

        .kb-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }

        .tab {
          padding: 10px 20px;
          border: none;
          background: #f3f4f6;
          color: #6b7280;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .tab:hover {
          background: #e5e7eb;
        }

        .tab.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 24px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-content h2 {
          margin: 0 0 20px 0;
          color: #1a1a2e;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #374151;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        @media (max-width: 768px) {
          .kb-content {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default KnowledgeBase;
