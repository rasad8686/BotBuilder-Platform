import React, { useState, useRef } from 'react';
import { FileText } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const DocumentUpload = ({ knowledgeBaseId, onUploaded }) => {
  const [uploadType, setUploadType] = useState('file');
  const [url, setUrl] = useState('');
  const [urlName, setUrlName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const token = localStorage.getItem('token');

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file) => {
    const allowedTypes = ['.txt', '.md', '.pdf', '.docx', '.doc'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
      setError(`Unsupported file type: ${ext}. Allowed: ${allowedTypes.join(', ')}`);
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`${API_URL}/api/knowledge/${knowledgeBaseId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Upload failed');
      }

      const doc = await response.json();
      onUploaded(doc);

      setTimeout(() => {
        setProgress(0);
        setUploading(false);
      }, 500);

    } catch (err) {
      setError(err.message);
      setUploading(false);
      setProgress(0);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 300);

      const response = await fetch(`${API_URL}/api/knowledge/${knowledgeBaseId}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: url.trim(),
          name: urlName.trim() || url.trim()
        })
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Upload failed');
      }

      const doc = await response.json();
      onUploaded(doc);
      setUrl('');
      setUrlName('');

      setTimeout(() => {
        setProgress(0);
        setUploading(false);
      }, 500);

    } catch (err) {
      setError(err.message);
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="document-upload">
      <div className="upload-tabs">
        <button
          className={`upload-tab ${uploadType === 'file' ? 'active' : ''}`}
          onClick={() => setUploadType('file')}
        >
          File Upload
        </button>
        <button
          className={`upload-tab ${uploadType === 'url' ? 'active' : ''}`}
          onClick={() => setUploadType('url')}
        >
          URL Import
        </button>
      </div>

      {error && (
        <div className="upload-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {uploadType === 'file' ? (
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx,.doc"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {uploading ? (
            <div className="upload-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <span>{progress}% - Processing...</span>
            </div>
          ) : (
            <>
              <span className="drop-icon"><FileText size={48} /></span>
              <h4>Drop files here</h4>
              <p>or click to browse</p>
              <span className="file-types">Supported: TXT, MD, PDF, DOCX</span>
            </>
          )}
        </div>
      ) : (
        <form className="url-form" onSubmit={handleUrlSubmit}>
          <div className="form-group">
            <label>URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
              disabled={uploading}
            />
          </div>
          <div className="form-group">
            <label>Name (optional)</label>
            <input
              type="text"
              value={urlName}
              onChange={e => setUrlName(e.target.value)}
              placeholder="Document name"
              disabled={uploading}
            />
          </div>

          {uploading && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <span>{progress}% - Fetching and processing...</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? 'Importing...' : 'Import URL'}
          </button>
        </form>
      )}

      <style>{`
        .document-upload {
          padding: 20px 0;
        }

        .upload-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }

        .upload-tab {
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .upload-tab.active {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .upload-error {
          background: #fee2e2;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .upload-error button {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #dc2626;
        }

        .drop-zone {
          border: 2px dashed #d1d5db;
          border-radius: 12px;
          padding: 48px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .drop-zone:hover {
          border-color: #667eea;
          background: #f8f9ff;
        }

        .drop-zone.dragging {
          border-color: #667eea;
          background: rgba(102, 126, 234, 0.1);
        }

        .drop-zone.uploading {
          cursor: default;
          background: #f9fafb;
        }

        .drop-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 12px;
        }

        .drop-zone h4 {
          margin: 0 0 8px 0;
          color: #1a1a2e;
        }

        .drop-zone p {
          margin: 0 0 12px 0;
          color: #6b7280;
        }

        .file-types {
          font-size: 12px;
          color: #9ca3af;
        }

        .upload-progress {
          text-align: center;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          transition: width 0.3s;
        }

        .upload-progress span {
          font-size: 13px;
          color: #6b7280;
        }

        .url-form {
          max-width: 500px;
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

        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-group input:disabled {
          background: #f3f4f6;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default DocumentUpload;
