import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Phone, ArrowDownCircle, ArrowUpCircle, Bot, User } from 'lucide-react';

const statusColors = {
  completed: { bg: '#d4edda', color: '#155724' },
  'in-progress': { bg: '#fff3cd', color: '#856404' },
  failed: { bg: '#f8d7da', color: '#721c24' },
  initiated: { bg: '#e9ecef', color: '#495057' },
  ringing: { bg: '#cce5ff', color: '#004085' },
  busy: { bg: '#f8d7da', color: '#721c24' },
  'no-answer': { bg: '#fff3cd', color: '#856404' }
};

const CallHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [calls, setCalls] = useState([]);
  const [bots, setBots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [filters, setFilters] = useState({
    botId: searchParams.get('botId') || '',
    status: '',
    direction: ''
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchBots();
    fetchCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchBots = async () => {
    try {
      const res = await fetch('/api/voice/bots', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
      }
    } catch (err) {
      // Error fetching bots - silent fail
    }
  };

  const fetchCalls = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.botId) params.append('botId', filters.botId);
      if (filters.status) params.append('status', filters.status);
      if (filters.direction) params.append('direction', filters.direction);

      const res = await fetch(`/api/voice/calls?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch calls');
      const data = await res.json();
      setCalls(data.calls || []);
    } catch (err) {
      // Error fetching calls - silent fail
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCallDetails = async (callId) => {
    try {
      const res = await fetch(`/api/voice/calls/${callId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedCall(data);
      }
    } catch (err) {
      // Error fetching call details - silent fail
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="status" aria-busy="true" aria-label="Loading call history">
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} aria-hidden="true"></div>
          <p style={{ color: '#6c757d' }}>{t('common.loading')}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ClipboardList style={{ width: '32px', height: '32px', color: '#667eea' }} />
              {t('voice.callHistory', 'Call History')}
            </h1>
            <p style={{ color: '#6c757d', margin: 0 }}>
              {t('voice.callHistoryDesc', 'View and analyze your voice bot call logs')}
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '12px 24px',
              background: '#e3f2fd',
              color: '#1565c0',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← {t('voice.back', 'Back')}
          </button>
        </div>

        {/* Filters */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="filter-bot" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#6c757d' }}>{t('voice.bot', 'Bot')}</label>
            <select
              id="filter-bot"
              value={filters.botId}
              onChange={(e) => setFilters({ ...filters, botId: e.target.value })}
              style={{ padding: '10px 16px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', minWidth: '200px' }}
            >
              <option value="">{t('voice.allBots', 'All Bots')}</option>
              {bots.map(bot => (
                <option key={bot.id} value={bot.id}>{bot.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-status" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#6c757d' }}>{t('voice.status', 'Status')}</label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              style={{ padding: '10px 16px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', minWidth: '150px' }}
            >
              <option value="">{t('voice.allStatuses', 'All Statuses')}</option>
              <option value="completed">{t('voice.completed', 'Completed')}</option>
              <option value="in-progress">{t('voice.inProgress', 'In Progress')}</option>
              <option value="failed">{t('voice.failed', 'Failed')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-direction" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#6c757d' }}>{t('voice.direction', 'Direction')}</label>
            <select
              id="filter-direction"
              value={filters.direction}
              onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
              style={{ padding: '10px 16px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', minWidth: '150px' }}
            >
              <option value="">{t('voice.allDirections', 'All')}</option>
              <option value="inbound">{t('voice.inbound', 'Inbound')}</option>
              <option value="outbound">{t('voice.outbound', 'Outbound')}</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e' }}>{calls.length}</div>
            <div style={{ fontSize: '13px', color: '#6c757d' }}>{t('voice.totalCalls', 'Total Calls')}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#2e7d32' }}>{calls.filter(c => c.status === 'completed').length}</div>
            <div style={{ fontSize: '13px', color: '#6c757d' }}>{t('voice.completed', 'Completed')}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1565c0' }}>{calls.filter(c => c.direction === 'inbound').length}</div>
            <div style={{ fontSize: '13px', color: '#6c757d' }}>{t('voice.inbound', 'Inbound')}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#6c757d' }}>
              {formatDuration(calls.reduce((sum, c) => sum + (c.duration || 0), 0))}
            </div>
            <div style={{ fontSize: '13px', color: '#6c757d' }}>{t('voice.totalDuration', 'Total Duration')}</div>
          </div>
        </div>

        {/* Calls Table */}
        <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          {calls.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 40px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <Phone style={{ width: '48px', height: '48px', color: '#667eea' }} />
              </div>
              <h3 style={{ color: '#1a1a2e', marginBottom: '8px' }}>{t('voice.noCalls', 'No Calls Yet')}</h3>
              <p style={{ color: '#6c757d' }}>{t('voice.noCallsDesc', 'Call history will appear here')}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }} role="table" aria-label="Call history">
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th scope="col" style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#1a1a2e', fontSize: '13px' }}>{t('voice.bot', 'Bot')}</th>
                  <th scope="col" style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#1a1a2e', fontSize: '13px' }}>{t('voice.direction', 'Direction')}</th>
                  <th scope="col" style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#1a1a2e', fontSize: '13px' }}>{t('voice.from', 'From')}</th>
                  <th scope="col" style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#1a1a2e', fontSize: '13px' }}>{t('voice.to', 'To')}</th>
                  <th scope="col" style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#1a1a2e', fontSize: '13px' }}>{t('voice.duration', 'Duration')}</th>
                  <th scope="col" style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#1a1a2e', fontSize: '13px' }}>{t('voice.status', 'Status')}</th>
                  <th scope="col" style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#1a1a2e', fontSize: '13px' }}>{t('voice.date', 'Date')}</th>
                  <th scope="col" style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#1a1a2e', fontSize: '13px' }}>{t('common.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {calls.map(call => (
                  <tr key={call.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#1a1a2e' }}>{call.bot_name}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: call.direction === 'inbound' ? '#e3f2fd' : '#fff3e0',
                        color: call.direction === 'inbound' ? '#1565c0' : '#e65100'
                      }}>
                        {call.direction === 'inbound' ? <ArrowDownCircle style={{ width: '12px', height: '12px', display: 'inline', marginRight: '4px' }} /> : <ArrowUpCircle style={{ width: '12px', height: '12px', display: 'inline', marginRight: '4px' }} />} {call.direction}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#6c757d' }}>{call.from_number || '-'}</td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#6c757d' }}>{call.to_number || '-'}</td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#1a1a2e', fontWeight: '500' }}>{formatDuration(call.duration)}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: statusColors[call.status]?.bg || '#e9ecef',
                        color: statusColors[call.status]?.color || '#495057'
                      }}>
                        {call.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '13px', color: '#6c757d' }}>{formatDate(call.created_at)}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button
                        onClick={() => fetchCallDetails(call.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#e3f2fd',
                          color: '#1565c0',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                        aria-label={`View details for call from ${call.from_number || 'unknown'} to ${call.to_number || 'unknown'}`}
                      >
                        {t('common.view', 'View')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Call Details Modal */}
      {selectedCall && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} role="dialog" aria-modal="true" aria-labelledby="call-details-title">
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="call-details-title" style={{ margin: 0, fontSize: '20px', color: '#1a1a2e' }}>{t('voice.callDetails', 'Call Details')}</h2>
              <button onClick={() => setSelectedCall(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6c757d' }} aria-label="Close call details">×</button>
            </div>

            <div style={{ padding: '24px' }}>
              {/* Call Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>{t('voice.from', 'From')}</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>{selectedCall.call.from_number}</div>
                </div>
                <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>{t('voice.to', 'To')}</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>{selectedCall.call.to_number}</div>
                </div>
                <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>{t('voice.duration', 'Duration')}</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>{formatDuration(selectedCall.call.duration)}</div>
                </div>
                <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>{t('voice.status', 'Status')}</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>{selectedCall.call.status}</div>
                </div>
              </div>

              {/* Transcription */}
              {selectedCall.call.transcription && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e', marginBottom: '12px' }}>{t('voice.transcription', 'Transcription')}</h3>
                  <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', fontSize: '14px', lineHeight: '1.6', color: '#495057' }}>
                    {selectedCall.call.transcription}
                  </div>
                </div>
              )}

              {/* Conversation Segments */}
              {selectedCall.segments && selectedCall.segments.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e', marginBottom: '12px' }}>{t('voice.conversation', 'Conversation')}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedCall.segments.map((segment, idx) => (
                      <div key={idx} style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: segment.speaker === 'bot' ? '#e3f2fd' : '#f5f5f5',
                        marginLeft: segment.speaker === 'bot' ? '0' : '40px',
                        marginRight: segment.speaker === 'bot' ? '40px' : '0'
                      }}>
                        <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {segment.speaker === 'bot' ? <Bot style={{ width: '12px', height: '12px' }} /> : <User style={{ width: '12px', height: '12px' }} />}
                          {segment.speaker === 'bot' ? 'Bot' : 'Caller'}
                        </div>
                        <div style={{ fontSize: '14px', color: '#1a1a2e' }}>{segment.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recording */}
              {selectedCall.call.recording_url && (
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e', marginBottom: '12px' }}>{t('voice.recording', 'Recording')}</h3>
                  <audio controls style={{ width: '100%' }} src={selectedCall.call.recording_url} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallHistory;
