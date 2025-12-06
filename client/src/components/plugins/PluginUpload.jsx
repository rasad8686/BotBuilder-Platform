import React, { useState, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginUpload = ({ plugin, onUpload, onClose }) => {
  const [activeStep, setActiveStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [newVersion, setNewVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [pluginFile, setPluginFile] = useState(null);
  const [iconFile, setIconFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(plugin?.icon_url || null);
  const [bannerPreview, setBannerPreview] = useState(plugin?.banner_url || null);

  const pluginInputRef = useRef(null);
  const iconInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const token = localStorage.getItem('token');

  const incrementVersion = (current, type) => {
    const parts = current.split('.').map(Number);
    switch (type) {
      case 'major':
        return `${parts[0] + 1}.0.0`;
      case 'minor':
        return `${parts[0]}.${parts[1] + 1}.0`;
      case 'patch':
      default:
        return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    }
  };

  const handlePluginFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['.zip', '.tar.gz', '.tgz'];
      const isValid = validTypes.some(ext => file.name.endsWith(ext));
      if (!isValid) {
        alert('Please upload a .zip, .tar.gz, or .tgz file');
        return;
      }
      setPluginFile(file);
    }
  };

  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      setIconFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setIconPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setBannerPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!newVersion) {
      alert('Please specify a version number');
      return;
    }

    if (!pluginFile) {
      alert('Please select a plugin file to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('version', newVersion);
      formData.append('changelog', changelog);
      formData.append('plugin', pluginFile);

      if (iconFile) {
        formData.append('icon', iconFile);
      }

      if (bannerFile) {
        formData.append('banner', bannerFile);
      }

      // Simulating upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch(`${API_URL}/api/plugins/${plugin.id}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        const updatedPlugin = await response.json();
        setTimeout(() => {
          onUpload(updatedPlugin);
        }, 500);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to upload plugin');
        setUploading(false);
        setUploadProgress(0);
      }
    } catch (error) {
      console.error('Error uploading plugin:', error);
      alert('Failed to upload plugin');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="upload-overlay" onClick={onClose}>
      <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upload-header">
          <h2>Upload New Version</h2>
          <p className="plugin-name">{plugin.name}</p>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Progress Steps */}
        <div className="upload-steps">
          <div className={`step ${activeStep >= 1 ? 'active' : ''} ${activeStep > 1 ? 'completed' : ''}`}>
            <div className="step-number">{activeStep > 1 ? '✓' : '1'}</div>
            <span>Version Info</span>
          </div>
          <div className="step-line"></div>
          <div className={`step ${activeStep >= 2 ? 'active' : ''} ${activeStep > 2 ? 'completed' : ''}`}>
            <div className="step-number">{activeStep > 2 ? '✓' : '2'}</div>
            <span>Upload Files</span>
          </div>
          <div className="step-line"></div>
          <div className={`step ${activeStep >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <span>Review</span>
          </div>
        </div>

        <div className="upload-content">
          {/* Step 1: Version Info */}
          {activeStep === 1 && (
            <div className="step-content">
              <h3>Version Information</h3>

              <div className="current-version">
                <span className="label">Current Version:</span>
                <span className="value">v{plugin.version}</span>
              </div>

              <div className="version-buttons">
                <span className="label">Quick increment:</span>
                <div className="btn-group">
                  <button
                    className="btn-version"
                    onClick={() => setNewVersion(incrementVersion(plugin.version, 'patch'))}
                  >
                    Patch ({incrementVersion(plugin.version, 'patch')})
                  </button>
                  <button
                    className="btn-version"
                    onClick={() => setNewVersion(incrementVersion(plugin.version, 'minor'))}
                  >
                    Minor ({incrementVersion(plugin.version, 'minor')})
                  </button>
                  <button
                    className="btn-version"
                    onClick={() => setNewVersion(incrementVersion(plugin.version, 'major'))}
                  >
                    Major ({incrementVersion(plugin.version, 'major')})
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>New Version *</label>
                <input
                  type="text"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="e.g., 1.0.1"
                />
              </div>

              <div className="form-group">
                <label>Changelog</label>
                <textarea
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="What's new in this version?&#10;- Bug fixes&#10;- New features&#10;- Improvements"
                  rows={6}
                />
              </div>
            </div>
          )}

          {/* Step 2: Upload Files */}
          {activeStep === 2 && (
            <div className="step-content">
              <h3>Upload Files</h3>

              {/* Plugin Package */}
              <div className="upload-zone">
                <input
                  type="file"
                  ref={pluginInputRef}
                  onChange={handlePluginFileChange}
                  accept=".zip,.tar.gz,.tgz"
                  hidden
                />
                <div
                  className={`drop-area ${pluginFile ? 'has-file' : ''}`}
                  onClick={() => pluginInputRef.current.click()}
                >
                  {pluginFile ? (
                    <>
                      <span className="file-icon">📦</span>
                      <span className="file-name">{pluginFile.name}</span>
                      <span className="file-size">
                        {(pluginFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <button
                        className="btn-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPluginFile(null);
                        }}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="upload-icon">📤</span>
                      <span className="upload-title">Plugin Package *</span>
                      <span className="upload-hint">
                        Click to upload .zip, .tar.gz, or .tgz
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Icon & Banner */}
              <div className="media-uploads">
                <div className="media-upload">
                  <input
                    type="file"
                    ref={iconInputRef}
                    onChange={handleIconChange}
                    accept="image/*"
                    hidden
                  />
                  <label>Plugin Icon (Optional)</label>
                  <div
                    className="media-preview icon"
                    onClick={() => iconInputRef.current.click()}
                  >
                    {iconPreview ? (
                      <img src={iconPreview} alt="Icon preview" />
                    ) : (
                      <>
                        <span className="placeholder-icon">🖼️</span>
                        <span>512x512 px</span>
                      </>
                    )}
                  </div>
                  {iconPreview && (
                    <button
                      className="btn-remove-media"
                      onClick={() => {
                        setIconFile(null);
                        setIconPreview(plugin?.icon_url || null);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="media-upload">
                  <input
                    type="file"
                    ref={bannerInputRef}
                    onChange={handleBannerChange}
                    accept="image/*"
                    hidden
                  />
                  <label>Banner Image (Optional)</label>
                  <div
                    className="media-preview banner"
                    onClick={() => bannerInputRef.current.click()}
                  >
                    {bannerPreview ? (
                      <img src={bannerPreview} alt="Banner preview" />
                    ) : (
                      <>
                        <span className="placeholder-icon">🖼️</span>
                        <span>1200x400 px</span>
                      </>
                    )}
                  </div>
                  {bannerPreview && (
                    <button
                      className="btn-remove-media"
                      onClick={() => {
                        setBannerFile(null);
                        setBannerPreview(plugin?.banner_url || null);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {activeStep === 3 && (
            <div className="step-content">
              <h3>Review & Submit</h3>

              <div className="review-card">
                <div className="review-header">
                  <div className="plugin-icon">
                    {iconPreview ? (
                      <img src={iconPreview} alt={plugin.name} />
                    ) : (
                      <span>🧩</span>
                    )}
                  </div>
                  <div className="plugin-info">
                    <h4>{plugin.name}</h4>
                    <span className="version-badge">v{newVersion}</span>
                  </div>
                </div>

                <div className="review-details">
                  <div className="detail-row">
                    <span className="label">Package:</span>
                    <span className="value">{pluginFile?.name || 'Not selected'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Size:</span>
                    <span className="value">
                      {pluginFile ? `${(pluginFile.size / 1024 / 1024).toFixed(2)} MB` : '-'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Icon:</span>
                    <span className="value">{iconFile ? 'Updated' : 'No change'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Banner:</span>
                    <span className="value">{bannerFile ? 'Updated' : 'No change'}</span>
                  </div>
                </div>

                {changelog && (
                  <div className="changelog-preview">
                    <h5>Changelog</h5>
                    <pre>{changelog}</pre>
                  </div>
                )}
              </div>

              {uploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">
                    {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Processing...'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="upload-footer">
          {activeStep > 1 && (
            <button
              className="btn-back"
              onClick={() => setActiveStep(activeStep - 1)}
              disabled={uploading}
            >
              Back
            </button>
          )}
          <div className="spacer"></div>
          {activeStep < 3 ? (
            <button
              className="btn-next"
              onClick={() => setActiveStep(activeStep + 1)}
              disabled={activeStep === 1 && !newVersion}
            >
              Next
            </button>
          ) : (
            <button
              className="btn-upload"
              onClick={handleUpload}
              disabled={uploading || !pluginFile}
            >
              {uploading ? 'Uploading...' : 'Upload & Submit'}
            </button>
          )}
        </div>

        <style>{`
          .upload-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .upload-modal {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 600px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .upload-header {
            padding: 24px;
            border-bottom: 1px solid #e5e7eb;
            position: relative;
          }

          .upload-header h2 {
            margin: 0;
            font-size: 20px;
            color: #1a1a2e;
          }

          .plugin-name {
            color: #6b7280;
            font-size: 14px;
            margin-top: 4px;
          }

          .close-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            background: none;
            border: none;
            font-size: 28px;
            color: #6b7280;
            cursor: pointer;
          }

          .upload-steps {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f9fafb;
          }

          .step {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #9ca3af;
          }

          .step.active {
            color: #667eea;
          }

          .step.completed {
            color: #10b981;
          }

          .step-number {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 600;
          }

          .step.active .step-number {
            background: #667eea;
            color: white;
          }

          .step.completed .step-number {
            background: #10b981;
            color: white;
          }

          .step span {
            font-size: 13px;
            font-weight: 500;
          }

          .step-line {
            width: 40px;
            height: 2px;
            background: #e5e7eb;
            margin: 0 12px;
          }

          .upload-content {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
          }

          .step-content h3 {
            margin: 0 0 20px 0;
            font-size: 16px;
            color: #1a1a2e;
          }

          .current-version {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: #f3f4f6;
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .current-version .label {
            color: #6b7280;
            font-size: 14px;
          }

          .current-version .value {
            font-weight: 600;
            color: #1a1a2e;
          }

          .version-buttons {
            margin-bottom: 20px;
          }

          .version-buttons .label {
            display: block;
            color: #6b7280;
            font-size: 13px;
            margin-bottom: 8px;
          }

          .btn-group {
            display: flex;
            gap: 8px;
          }

          .btn-version {
            padding: 8px 12px;
            border: 1px solid #e5e7eb;
            background: white;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-version:hover {
            border-color: #667eea;
            color: #667eea;
          }

          .form-group {
            margin-bottom: 20px;
          }

          .form-group label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
          }

          .form-group input,
          .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
          }

          .form-group input:focus,
          .form-group textarea:focus {
            outline: none;
            border-color: #667eea;
          }

          .upload-zone {
            margin-bottom: 24px;
          }

          .drop-area {
            border: 2px dashed #e5e7eb;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
          }

          .drop-area:hover {
            border-color: #667eea;
            background: rgba(102, 126, 234, 0.02);
          }

          .drop-area.has-file {
            border-style: solid;
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.05);
          }

          .upload-icon, .file-icon {
            font-size: 48px;
            display: block;
            margin-bottom: 12px;
          }

          .upload-title {
            display: block;
            font-weight: 600;
            color: #1a1a2e;
            margin-bottom: 4px;
          }

          .upload-hint {
            font-size: 13px;
            color: #9ca3af;
          }

          .file-name {
            display: block;
            font-weight: 600;
            color: #1a1a2e;
            margin-bottom: 4px;
          }

          .file-size {
            display: block;
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 12px;
          }

          .btn-remove {
            padding: 6px 12px;
            background: #fee2e2;
            color: #dc2626;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
          }

          .media-uploads {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 16px;
          }

          .media-upload label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
          }

          .media-preview {
            border: 2px dashed #e5e7eb;
            border-radius: 12px;
            cursor: pointer;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }

          .media-preview:hover {
            border-color: #667eea;
          }

          .media-preview.icon {
            width: 120px;
            height: 120px;
          }

          .media-preview.banner {
            height: 120px;
          }

          .media-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .placeholder-icon {
            font-size: 32px;
            margin-bottom: 4px;
          }

          .media-preview span {
            font-size: 11px;
            color: #9ca3af;
          }

          .btn-remove-media {
            margin-top: 8px;
            padding: 4px 8px;
            background: none;
            border: none;
            color: #dc2626;
            font-size: 12px;
            cursor: pointer;
          }

          .review-card {
            background: #f9fafb;
            border-radius: 12px;
            padding: 20px;
          }

          .review-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e5e7eb;
          }

          .review-header .plugin-icon {
            width: 56px;
            height: 56px;
            border-radius: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }

          .review-header .plugin-icon img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .review-header .plugin-icon span {
            font-size: 28px;
          }

          .review-header h4 {
            margin: 0 0 4px 0;
            color: #1a1a2e;
          }

          .version-badge {
            display: inline-block;
            padding: 4px 10px;
            background: #667eea;
            color: white;
            font-size: 12px;
            font-weight: 600;
            border-radius: 20px;
          }

          .review-details {
            margin-bottom: 16px;
          }

          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
          }

          .detail-row .label {
            color: #6b7280;
          }

          .detail-row .value {
            color: #1a1a2e;
            font-weight: 500;
          }

          .changelog-preview {
            background: white;
            border-radius: 8px;
            padding: 16px;
          }

          .changelog-preview h5 {
            margin: 0 0 12px 0;
            font-size: 13px;
            color: #6b7280;
            text-transform: uppercase;
          }

          .changelog-preview pre {
            margin: 0;
            font-size: 13px;
            color: #374151;
            white-space: pre-wrap;
            font-family: inherit;
          }

          .upload-progress {
            margin-top: 20px;
            text-align: center;
          }

          .progress-bar {
            height: 8px;
            background: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 8px;
          }

          .progress-fill {
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 4px;
            transition: width 0.3s;
          }

          .progress-text {
            font-size: 13px;
            color: #6b7280;
          }

          .upload-footer {
            display: flex;
            align-items: center;
            padding: 20px 24px;
            border-top: 1px solid #e5e7eb;
          }

          .spacer {
            flex: 1;
          }

          .btn-back {
            padding: 12px 24px;
            border: 1px solid #e5e7eb;
            background: white;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
          }

          .btn-next, .btn-upload {
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }

          .btn-next:disabled, .btn-upload:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @media (max-width: 640px) {
            .media-uploads {
              grid-template-columns: 1fr;
            }

            .media-preview.icon {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default PluginUpload;
