import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const CloneDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    voice: 0,
    style: 0,
    personality: 0,
    ready: 0,
    training: 0
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('type', filter);

      const res = await fetch(`/api/clones/jobs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch clone jobs');

      const data = await res.json();
      setJobs(data.jobs || []);

      // Calculate stats
      const allJobs = data.jobs || [];
      setStats({
        total: allJobs.length,
        voice: allJobs.filter(j => j.type === 'voice').length,
        style: allJobs.filter(j => j.type === 'style').length,
        personality: allJobs.filter(j => j.type === 'personality').length,
        ready: allJobs.filter(j => j.status === 'ready').length,
        training: allJobs.filter(j => j.status === 'training').length
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'voice': return '🎙️';
      case 'style': return '✍️';
      case 'personality': return '🎭';
      case 'full': return '🔮';
      default: return '📦';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready': return { bg: '#c6f6d5', text: '#22543d' };
      case 'training': return { bg: '#bee3f8', text: '#2a4365' };
      case 'processing': return { bg: '#fefcbf', text: '#744210' };
      case 'pending': return { bg: '#e2e8f0', text: '#4a5568' };
      case 'failed': return { bg: '#fed7d7', text: '#742a2a' };
      default: return { bg: '#e2e8f0', text: '#4a5568' };
    }
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm(t('clone.deleteJobConfirm'))) return;

    try {
      const res = await fetch(`/api/clones/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const navigateToCloneType = (type) => {
    switch (type) {
      case 'voice': navigate('/clone/voice'); break;
      case 'style': navigate('/clone/style'); break;
      case 'personality': navigate('/clone/personality'); break;
      default: navigate('/clone/voice');
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

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a202c', margin: 0 }}>
            {t('clone.dashboard.title', 'Clone Studio')}
          </h1>
          <p style={{ color: '#718096', marginTop: '4px' }}>
            {t('clone.dashboard.subtitle', 'Create voice, style, and personality clones for your bots')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate('/clone/voice')}
            style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🎙️ {t('clone.newVoice', 'New Voice Clone')}
          </button>
          <button
            onClick={() => navigate('/clone/style')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            ✍️ {t('clone.newStyle', 'New Style Clone')}
          </button>
          <button
            onClick={() => navigate('/clone/personality')}
            style={{
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🎭 {t('clone.newPersonality', 'New Personality Clone')}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.stats.total', 'Total Clones')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2d3748' }}>{stats.total}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>🎙️ {t('clone.stats.voice', 'Voice')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f5576c' }}>{stats.voice}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>✍️ {t('clone.stats.style', 'Style')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>{stats.style}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>🎭 {t('clone.stats.personality', 'Personality')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#38ef7d' }}>{stats.personality}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.stats.ready', 'Ready')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#48bb78' }}>{stats.ready}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('clone.stats.training', 'Training')}</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4299e1' }}>{stats.training}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['all', 'voice', 'style', 'personality'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: filter === f ? '#667eea' : 'white',
              color: filter === f ? 'white' : '#4a5568',
              fontWeight: '500',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
            }}
          >
            {f === 'all' ? t('common.all', 'All') : `${getTypeIcon(f)} ${t(`clone.types.${f}`, f)}`}
          </button>
        ))}
      </div>

      {/* Clone Jobs List */}
      {error ? (
        <div style={{ background: '#fed7d7', color: '#742a2a', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ background: 'white', padding: '60px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔮</div>
          <h3 style={{ color: '#2d3748', marginBottom: '8px' }}>{t('clone.noClones', 'No clones yet')}</h3>
          <p style={{ color: '#718096', marginBottom: '24px' }}>
            {t('clone.noClones.description', 'Create your first clone to get started')}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/clone/voice')}
              style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              🎙️ {t('clone.createVoice', 'Create Voice Clone')}
            </button>
            <button
              onClick={() => navigate('/clone/style')}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              ✍️ {t('clone.createStyle', 'Create Style Clone')}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {jobs.map(job => {
            const statusColors = getStatusColor(job.status);
            return (
              <div
                key={job.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer'
                }}
                onClick={() => navigateToCloneType(job.type)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                }}
              >
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px'
                      }}>
                        {getTypeIcon(job.type)}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#2d3748' }}>
                          {job.name}
                        </h3>
                        <span style={{ fontSize: '13px', color: '#a0aec0', textTransform: 'capitalize' }}>
                          {job.type} Clone
                        </span>
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: statusColors.bg,
                      color: statusColors.text,
                      textTransform: 'capitalize'
                    }}>
                      {job.status}
                    </span>
                  </div>

                  {job.description && (
                    <p style={{ color: '#718096', fontSize: '14px', margin: '0 0 16px', lineHeight: '1.5' }}>
                      {job.description.length > 100 ? job.description.slice(0, 100) + '...' : job.description}
                    </p>
                  )}

                  {job.status === 'training' && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', color: '#718096' }}>{t('clone.training', 'Training Progress')}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#667eea' }}>{job.training_progress || 0}%</span>
                      </div>
                      <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${job.training_progress || 0}%`,
                          background: 'linear-gradient(90deg, #667eea, #764ba2)',
                          borderRadius: '3px',
                          transition: 'width 0.3s'
                        }}></div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: '#a0aec0' }}>{t('clone.samples', 'Samples')}</span>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748' }}>{job.sample_count || 0}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#a0aec0' }}>{t('clone.versions', 'Versions')}</span>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748' }}>{job.version_count || 0}</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(job.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid #e2e8f0',
                        color: '#e53e3e',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {t('common.delete', 'Delete')}
                    </button>
                  </div>
                </div>

                <div style={{
                  borderTop: '1px solid #e2e8f0',
                  padding: '12px 20px',
                  background: '#f7fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#a0aec0'
                }}>
                  <span>{t('clone.created', 'Created')}: {new Date(job.created_at).toLocaleDateString()}</span>
                  {job.training_completed_at && (
                    <span>{t('clone.trained', 'Trained')}: {new Date(job.training_completed_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginTop: '32px', background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ margin: '0 0 16px', color: '#2d3748', fontSize: '18px' }}>{t('clone.quickActions', 'Quick Actions')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <button
            onClick={() => navigate('/work-clone')}
            style={{
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📝</div>
            <div style={{ fontWeight: '500', color: '#2d3748' }}>{t('clone.legacyClones', 'Legacy Work Clones')}</div>
            <div style={{ fontSize: '13px', color: '#718096' }}>{t('clone.legacyClones.desc', 'View old style work clones')}</div>
          </button>
          <button
            onClick={() => navigate('/clone-training')}
            style={{
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎓</div>
            <div style={{ fontWeight: '500', color: '#2d3748' }}>{t('clone.trainingCenter', 'Training Center')}</div>
            <div style={{ fontSize: '13px', color: '#718096' }}>{t('clone.trainingCenter.desc', 'Manage training data')}</div>
          </button>
          <button
            onClick={() => navigate('/clone-settings')}
            style={{
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚙️</div>
            <div style={{ fontWeight: '500', color: '#2d3748' }}>{t('clone.settings', 'Clone Settings')}</div>
            <div style={{ fontSize: '13px', color: '#718096' }}>{t('clone.settings.desc', 'Configure clone preferences')}</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloneDashboard;
