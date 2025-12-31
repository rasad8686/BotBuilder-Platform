/**
 * Phone Number Management Page
 * Purchase, manage, and configure phone numbers from Twilio
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const PhoneNumberManagement = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState(null);
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [bots, setBots] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);

  const [searchParams, setSearchParams] = useState({
    country: 'US',
    areaCode: '',
    contains: '',
    type: 'local'
  });

  const [showSearchPanel, setShowSearchPanel] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchPhoneNumbers();
    fetchBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPhoneNumbers = async () => {
    try {
      const res = await fetch('/api/voice/phone-numbers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPhoneNumbers(data.phoneNumbers || []);
      }
    } catch (err) {
      console.error('Failed to fetch phone numbers:', err);
    } finally {
      setLoading(false);
    }
  };

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
      console.error('Failed to fetch bots:', err);
    }
  };

  const searchAvailableNumbers = async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      params.append('country', searchParams.country);
      if (searchParams.areaCode) params.append('areaCode', searchParams.areaCode);
      if (searchParams.contains) params.append('contains', searchParams.contains);
      params.append('type', searchParams.type);

      const res = await fetch(`/api/voice/phone-numbers/available?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setAvailableNumbers(data.numbers || []);
      }
    } catch (err) {
      console.error('Failed to search numbers:', err);
    } finally {
      setSearching(false);
    }
  };

  const purchaseNumber = async (number) => {
    setPurchasing(number.phoneNumber);
    try {
      const res = await fetch('/api/voice/phone-numbers/purchase', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: number.phoneNumber,
          friendlyName: number.friendlyName || number.phoneNumber
        })
      });

      if (res.ok) {
        await fetchPhoneNumbers();
        setAvailableNumbers(prev => prev.filter(n => n.phoneNumber !== number.phoneNumber));
        setShowSearchPanel(false);
      }
    } catch (err) {
      console.error('Failed to purchase number:', err);
    } finally {
      setPurchasing(null);
    }
  };

  const releaseNumber = async (numberId) => {
    if (!window.confirm(t('voice.confirmRelease', 'Are you sure you want to release this phone number? This action cannot be undone.'))) {
      return;
    }

    try {
      const res = await fetch(`/api/voice/phone-numbers/${numberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setPhoneNumbers(prev => prev.filter(n => n.id !== numberId));
        setSelectedNumber(null);
      }
    } catch (err) {
      console.error('Failed to release number:', err);
    }
  };

  const assignBot = async (numberId, botId) => {
    try {
      const res = await fetch(`/api/voice/phone-numbers/${numberId}/assign`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ botId })
      });

      if (res.ok) {
        await fetchPhoneNumbers();
      }
    } catch (err) {
      console.error('Failed to assign bot:', err);
    }
  };

  const formatPhoneNumber = (number) => {
    if (!number) return '-';
    // Simple US format
    if (number.startsWith('+1') && number.length === 12) {
      return `${number.slice(0, 2)} (${number.slice(2, 5)}) ${number.slice(5, 8)}-${number.slice(8)}`;
    }
    return number;
  };

  const getCapabilityBadges = (capabilities) => {
    if (!capabilities) return null;
    const caps = [];
    if (capabilities.voice) caps.push({ label: 'Voice', color: '#4CAF50' });
    if (capabilities.sms) caps.push({ label: 'SMS', color: '#2196F3' });
    if (capabilities.mms) caps.push({ label: 'MMS', color: '#FF9800' });
    if (capabilities.fax) caps.push({ label: 'Fax', color: '#9C27B0' });
    return caps;
  };

  if (loading) {
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
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>📱</span>
              {t('voice.phoneNumbers', 'Phone Numbers')}
            </h1>
            <p style={{ color: '#6c757d', margin: 0 }}>
              {t('voice.phoneNumbersDesc', 'Purchase and manage your voice-enabled phone numbers')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => navigate('/voice/bots')}
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
              ← {t('voice.backToBots', 'Back to Bots')}
            </button>
            <button
              onClick={() => setShowSearchPanel(true)}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              + {t('voice.buyNumber', 'Buy Number')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e' }}>{phoneNumbers.length}</div>
            <div style={{ fontSize: '13px', color: '#6c757d' }}>{t('voice.totalNumbers', 'Total Numbers')}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#2e7d32' }}>
              {phoneNumbers.filter(n => n.assigned_bot_id).length}
            </div>
            <div style={{ fontSize: '13px', color: '#6c757d' }}>{t('voice.assigned', 'Assigned')}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#ff9800' }}>
              {phoneNumbers.filter(n => !n.assigned_bot_id).length}
            </div>
            <div style={{ fontSize: '13px', color: '#6c757d' }}>{t('voice.unassigned', 'Unassigned')}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1565c0' }}>
              {phoneNumbers.filter(n => n.capabilities?.voice).length}
            </div>
            <div style={{ fontSize: '13px', color: '#6c757d' }}>{t('voice.voiceEnabled', 'Voice Enabled')}</div>
          </div>
        </div>

        {/* Phone Numbers Grid */}
        {phoneNumbers.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '16px', padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📞</div>
            <h3 style={{ color: '#1a1a2e', marginBottom: '8px' }}>{t('voice.noNumbers', 'No Phone Numbers')}</h3>
            <p style={{ color: '#6c757d', marginBottom: '24px' }}>{t('voice.noNumbersDesc', 'Purchase your first phone number to start receiving calls')}</p>
            <button
              onClick={() => setShowSearchPanel(true)}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              + {t('voice.buyFirstNumber', 'Buy Your First Number')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
            {phoneNumbers.map(number => {
              const assignedBot = bots.find(b => b.id === number.assigned_bot_id);
              const capabilities = getCapabilityBadges(number.capabilities);

              return (
                <div
                  key={number.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: selectedNumber === number.id ? '0 0 0 2px #667eea' : '0 2px 8px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setSelectedNumber(selectedNumber === number.id ? null : number.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#1a1a2e', fontFamily: 'monospace' }}>
                        {formatPhoneNumber(number.phone_number)}
                      </h3>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6c757d' }}>
                        {number.friendly_name || number.phone_number}
                      </p>
                    </div>
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: assignedBot ? '#d4edda' : '#fff3cd',
                      color: assignedBot ? '#155724' : '#856404'
                    }}>
                      {assignedBot ? t('voice.assigned', 'Assigned') : t('voice.unassigned', 'Unassigned')}
                    </div>
                  </div>

                  {/* Capabilities */}
                  {capabilities && capabilities.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                      {capabilities.map((cap, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            background: `${cap.color}20`,
                            color: cap.color
                          }}
                        >
                          {cap.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Assigned Bot */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6c757d', marginBottom: '6px' }}>
                      {t('voice.assignedBot', 'Assigned Bot')}
                    </label>
                    <select
                      value={number.assigned_bot_id || ''}
                      onChange={(e) => {
                        e.stopPropagation();
                        assignBot(number.id, e.target.value || null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white'
                      }}
                    >
                      <option value="">{t('voice.selectBot', '-- Select Bot --')}</option>
                      {bots.map(bot => (
                        <option key={bot.id} value={bot.id}>{bot.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  {selectedNumber === number.id && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e9ecef' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/voice/calls?number=${number.phone_number}`);
                        }}
                        style={{
                          flex: 1,
                          padding: '10px',
                          background: '#e3f2fd',
                          color: '#1565c0',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}
                      >
                        📋 {t('voice.viewCalls', 'View Calls')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          releaseNumber(number.id);
                        }}
                        style={{
                          padding: '10px 16px',
                          background: '#f8d7da',
                          color: '#721c24',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}
                      >
                        🗑️ {t('voice.release', 'Release')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search & Purchase Panel */}
      {showSearchPanel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#1a1a2e' }}>
                {t('voice.searchNumbers', 'Search Available Numbers')}
              </h2>
              <button
                onClick={() => setShowSearchPanel(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6c757d' }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              {/* Search Form */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#6c757d', marginBottom: '8px' }}>
                    {t('voice.country', 'Country')}
                  </label>
                  <select
                    value={searchParams.country}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, country: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px' }}
                  >
                    <option value="US">United States (+1)</option>
                    <option value="GB">United Kingdom (+44)</option>
                    <option value="CA">Canada (+1)</option>
                    <option value="AU">Australia (+61)</option>
                    <option value="DE">Germany (+49)</option>
                    <option value="FR">France (+33)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#6c757d', marginBottom: '8px' }}>
                    {t('voice.type', 'Type')}
                  </label>
                  <select
                    value={searchParams.type}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, type: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px' }}
                  >
                    <option value="local">{t('voice.local', 'Local')}</option>
                    <option value="tollFree">{t('voice.tollFree', 'Toll-Free')}</option>
                    <option value="mobile">{t('voice.mobile', 'Mobile')}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#6c757d', marginBottom: '8px' }}>
                    {t('voice.areaCode', 'Area Code')}
                  </label>
                  <input
                    type="text"
                    value={searchParams.areaCode}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, areaCode: e.target.value }))}
                    placeholder="e.g. 415"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#6c757d', marginBottom: '8px' }}>
                    {t('voice.contains', 'Contains')}
                  </label>
                  <input
                    type="text"
                    value={searchParams.contains}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, contains: e.target.value }))}
                    placeholder="e.g. 2023"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e9ecef', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button
                onClick={searchAvailableNumbers}
                disabled={searching}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: searching ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: searching ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '24px'
                }}
              >
                {searching ? t('voice.searching', 'Searching...') : t('voice.searchNumbers', 'Search Numbers')}
              </button>

              {/* Results */}
              {availableNumbers.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e', marginBottom: '16px' }}>
                    {t('voice.availableNumbers', 'Available Numbers')} ({availableNumbers.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                    {availableNumbers.map((number, idx) => {
                      const capabilities = getCapabilityBadges(number.capabilities);
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            background: '#f8f9fa',
                            borderRadius: '8px'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e', fontFamily: 'monospace' }}>
                              {formatPhoneNumber(number.phoneNumber)}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                              {capabilities && capabilities.map((cap, i) => (
                                <span
                                  key={i}
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    background: `${cap.color}20`,
                                    color: cap.color
                                  }}
                                >
                                  {cap.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {number.monthlyPrice && (
                              <span style={{ fontSize: '14px', color: '#6c757d' }}>
                                ${number.monthlyPrice}/mo
                              </span>
                            )}
                            <button
                              onClick={() => purchaseNumber(number)}
                              disabled={purchasing === number.phoneNumber}
                              style={{
                                padding: '8px 16px',
                                background: purchasing === number.phoneNumber ? '#ccc' : '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: purchasing === number.phoneNumber ? 'not-allowed' : 'pointer',
                                fontSize: '13px',
                                fontWeight: '500'
                              }}
                            >
                              {purchasing === number.phoneNumber ? t('voice.purchasing', 'Purchasing...') : t('voice.purchase', 'Purchase')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {availableNumbers.length === 0 && !searching && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6c757d' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
                  <p>{t('voice.searchToFindNumbers', 'Search to find available phone numbers')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneNumberManagement;
