import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const dataTypes = [
  { value: 'email', label: 'Email', icon: '✉️' },
  { value: 'document', label: 'Document', icon: '📄' },
  { value: 'chat', label: 'Chat Message', icon: '💬' },
  { value: 'social', label: 'Social Post', icon: '📱' },
  { value: 'custom', label: 'Custom', icon: '⚙️' }
];

const CloneTraining = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [clone, setClone] = useState(null);
  const [trainingData, setTrainingData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingResult, setTrainingResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [formData, setFormData] = useState({
    data_type: 'email',
    source: '',
    original_content: ''
  });

  const [bulkContent, setBulkContent] = useState('');
  const [showBulkForm, setShowBulkForm] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cloneRes, trainingRes] = await Promise.all([
        fetch(`/api/clones/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/clones/${id}/training`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!cloneRes.ok) throw new Error('Clone not found');

      const cloneData = await cloneRes.json();
      const trainingDataRes = await trainingRes.json();

      setClone(cloneData.clone);
      setTrainingData(trainingDataRes.trainingData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSample = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/clones/${id}/training`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add sample');
      }

      const result = await res.json();
      setTrainingData(prev => [result.data, ...prev]);
      setShowAddForm(false);
      setFormData({ data_type: 'email', source: '', original_content: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkContent.trim()) return;
    setIsSaving(true);
    try {
      // Split by double newlines to get separate samples
      const samples = bulkContent.split(/\n\n+/).filter(s => s.trim().length > 10);
      const items = samples.map(content => ({
        data_type: formData.data_type,
        source: 'bulk_import',
        original_content: content.trim()
      }));

      const res = await fetch(`/api/clones/${id}/training/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ items })
      });

      if (!res.ok) throw new Error('Failed to add samples');

      const result = await res.json();
      alert(t('clone.bulkAddSuccess', { added: result.added, skipped: result.skipped }));
      setShowBulkForm(false);
      setBulkContent('');
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSample = async (dataId) => {
    if (!window.confirm(t('clone.deleteSampleConfirm'))) return;
    try {
      const res = await fetch(`/api/clones/${id}/training/${dataId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete');
      setTrainingData(prev => prev.filter(d => d.id !== dataId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTrain = async () => {
    if (trainingData.length < 3) {
      alert(t('clone.minimumSamples'));
      return;
    }

    setIsTraining(true);
    setTrainingResult(null);
    try {
      const res = await fetch(`/api/clones/${id}/train`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Training failed');

      setTrainingResult(result);
      fetchData(); // Refresh to get updated clone status
    } catch (err) {
      setTrainingResult({ error: err.message });
    } finally {
      setIsTraining(false);
    }
  };

  const handleAnalyze = async (content) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/clones/analyze-style', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: content })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setAnalysisResult(result.analysis);
      setShowAnalysis(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsAnalyzing(false);
    }
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
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <p style={{ color: '#e53e3e' }}>{error}</p>
          <button onClick={() => navigate('/work-clone')} style={{ marginTop: '16px', padding: '10px 24px', borderRadius: '8px', background: '#667eea', color: 'white', border: 'none', cursor: 'pointer' }}>
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/work-clone')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#667eea' }}>
            ←
          </button>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', margin: 0 }}>
              {t('clone.trainingTitle')}: {clone?.name}
            </h1>
            <p style={{ color: '#718096', marginTop: '4px' }}>{t('clone.trainingSubtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowBulkForm(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #667eea',
              background: 'white',
              color: '#667eea',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {t('clone.bulkAdd')}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            + {t('clone.addSample')}
          </button>
        </div>
      </div>

      {/* Stats & Training */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.totalSamples')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2d3748' }}>{trainingData.length}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.processedSamples')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2d3748' }}>{trainingData.filter(d => d.is_processed).length}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.trainingScore')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#48bb78' }}>{clone?.training_score || 0}%</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.status')}</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: clone?.status === 'ready' ? '#48bb78' : '#ed8936' }}>
            {t(`clone.status.${clone?.status}`) || clone?.status}
          </div>
        </div>
      </div>

      {/* Train Button */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', color: '#2d3748' }}>{t('clone.startTraining')}</h3>
            <p style={{ margin: 0, color: '#718096', fontSize: '14px' }}>
              {trainingData.length < 3
                ? t('clone.needMoreSamples', { count: 3 - trainingData.length })
                : t('clone.readyToTrain')}
            </p>
          </div>
          <button
            onClick={handleTrain}
            disabled={isTraining || trainingData.length < 3}
            style={{
              padding: '12px 32px',
              borderRadius: '8px',
              border: 'none',
              background: trainingData.length >= 3 ? 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)' : '#e2e8f0',
              color: trainingData.length >= 3 ? 'white' : '#a0aec0',
              fontWeight: '600',
              cursor: isTraining || trainingData.length < 3 ? 'not-allowed' : 'pointer',
              fontSize: '15px'
            }}
          >
            {isTraining ? t('clone.trainingInProgress') : t('clone.startTraining')}
          </button>
        </div>

        {trainingResult && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            borderRadius: '8px',
            background: trainingResult.error ? '#fed7d7' : '#c6f6d5',
            color: trainingResult.error ? '#c53030' : '#276749'
          }}>
            {trainingResult.error
              ? trainingResult.error
              : t('clone.trainingComplete', { score: trainingResult.trainingScore, samples: trainingResult.samplesUsed })}
          </div>
        )}
      </div>

      {/* Training Data List */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, color: '#2d3748' }}>{t('clone.trainingSamples')}</h3>
        </div>

        {trainingData.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
            <p style={{ color: '#718096' }}>{t('clone.noSamples')}</p>
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflow: 'auto' }}>
            {trainingData.map((data, index) => (
              <div key={data.id} style={{
                padding: '16px 20px',
                borderBottom: index < trainingData.length - 1 ? '1px solid #e2e8f0' : 'none',
                display: 'flex',
                gap: '16px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: '#f7fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  flexShrink: 0
                }}>
                  {dataTypes.find(dt => dt.value === data.data_type)?.icon || '📄'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: '#edf2f7',
                        color: '#4a5568',
                        fontSize: '11px',
                        fontWeight: '500',
                        marginRight: '8px'
                      }}>
                        {data.data_type}
                      </span>
                      {data.is_processed && (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: '#c6f6d5',
                          color: '#276749',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          {t('clone.processed')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleAnalyze(data.original_content)}
                        disabled={isAnalyzing}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea', fontSize: '14px' }}
                        title={t('clone.analyze')}
                      >
                        🔍
                      </button>
                      <button
                        onClick={() => handleDeleteSample(data.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e', fontSize: '14px' }}
                        title={t('common.delete')}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <p style={{
                    margin: 0,
                    color: '#4a5568',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {data.original_content}
                  </p>
                  {data.quality_score > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#a0aec0' }}>
                      {t('clone.qualityScore')}: {data.quality_score}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Sample Modal */}
      {showAddForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
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
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>{t('clone.addSample')}</h2>
            </div>
            <form onSubmit={handleAddSample} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.dataType')}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {dataTypes.map(dt => (
                    <button
                      key={dt.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, data_type: dt.value }))}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: formData.data_type === dt.value ? '#667eea' : '#e2e8f0',
                        background: formData.data_type === dt.value ? '#667eea10' : 'white',
                        color: formData.data_type === dt.value ? '#667eea' : '#4a5568',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>{dt.icon}</span>
                      <span>{dt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.source')}
                </label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px'
                  }}
                  placeholder={t('clone.sourcePlaceholder')}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.content')} *
                </label>
                <textarea
                  value={formData.original_content}
                  onChange={e => setFormData(prev => ({ ...prev, original_content: e.target.value }))}
                  required
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder={t('clone.contentPlaceholder')}
                />
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#a0aec0' }}>
                  {formData.original_content.length} {t('clone.characters')}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: 'white',
                    color: '#4a5568',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: '500',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.7 : 1
                  }}
                >
                  {isSaving ? t('common.saving') : t('clone.addSample')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {showBulkForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
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
            maxWidth: '700px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>{t('clone.bulkAdd')}</h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.dataType')}
                </label>
                <select
                  value={formData.data_type}
                  onChange={e => setFormData(prev => ({ ...prev, data_type: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px'
                  }}
                >
                  {dataTypes.map(dt => (
                    <option key={dt.value} value={dt.value}>{dt.icon} {dt.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                  {t('clone.bulkContent')}
                </label>
                <textarea
                  value={bulkContent}
                  onChange={e => setBulkContent(e.target.value)}
                  rows={12}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    resize: 'vertical',
                    fontFamily: 'monospace'
                  }}
                  placeholder={t('clone.bulkContentPlaceholder')}
                />
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#a0aec0' }}>
                  {t('clone.bulkHint')}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkForm(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: 'white',
                    color: '#4a5568',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleBulkAdd}
                  disabled={isSaving || !bulkContent.trim()}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: '500',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving || !bulkContent.trim() ? 0.7 : 1
                  }}
                >
                  {isSaving ? t('common.saving') : t('clone.importSamples')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {showAnalysis && analysisResult && (
        <div style={{
          position: 'fixed',
          inset: 0,
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
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>{t('clone.styleAnalysis')}</h2>
              <button onClick={() => setShowAnalysis(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#a0aec0' }}>×</button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ color: '#a0aec0', fontSize: '12px', marginBottom: '4px' }}>{t('clone.wordCount')}</div>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>{analysisResult.wordCount}</div>
                </div>
                <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ color: '#a0aec0', fontSize: '12px', marginBottom: '4px' }}>{t('clone.sentenceCount')}</div>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>{analysisResult.sentenceCount}</div>
                </div>
                <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ color: '#a0aec0', fontSize: '12px', marginBottom: '4px' }}>{t('clone.avgWordsPerSentence')}</div>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>{analysisResult.avgWordsPerSentence}</div>
                </div>
                <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ color: '#a0aec0', fontSize: '12px', marginBottom: '4px' }}>{t('clone.formality')}</div>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>{analysisResult.formality?.level}</div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '12px', color: '#4a5568' }}>{t('clone.tone')}</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    background: '#667eea20',
                    color: '#667eea',
                    fontSize: '13px'
                  }}>
                    {analysisResult.tone?.dominant || 'neutral'}
                  </span>
                  {analysisResult.tone?.isPositive && (
                    <span style={{ padding: '4px 12px', borderRadius: '16px', background: '#48bb7820', color: '#48bb78', fontSize: '13px' }}>
                      Positive
                    </span>
                  )}
                  {analysisResult.tone?.isFriendly && (
                    <span style={{ padding: '4px 12px', borderRadius: '16px', background: '#ed893620', color: '#ed8936', fontSize: '13px' }}>
                      Friendly
                    </span>
                  )}
                  {analysisResult.tone?.isConfident && (
                    <span style={{ padding: '4px 12px', borderRadius: '16px', background: '#9f7aea20', color: '#9f7aea', fontSize: '13px' }}>
                      Confident
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: '12px', color: '#4a5568' }}>{t('clone.vocabulary')}</h4>
                <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#718096', fontSize: '13px' }}>{t('clone.uniqueWords')}: </span>
                    <span style={{ fontWeight: '600' }}>{analysisResult.vocabulary?.uniqueWords}</span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#718096', fontSize: '13px' }}>{t('clone.vocabularyRichness')}: </span>
                    <span style={{ fontWeight: '600' }}>{Math.round((analysisResult.vocabulary?.vocabularyRichness || 0) * 100)}%</span>
                  </div>
                  <div>
                    <span style={{ color: '#718096', fontSize: '13px' }}>{t('clone.avgWordLength')}: </span>
                    <span style={{ fontWeight: '600' }}>{analysisResult.vocabulary?.avgWordLength}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloneTraining;
