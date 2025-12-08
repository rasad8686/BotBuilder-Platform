import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function IntentEntityBuilder() {
  const { t } = useTranslation();
  const { botId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('intents');
  const [botName, setBotName] = useState('');
  const [loading, setLoading] = useState(true);

  // File input refs
  const intentFileRef = useRef(null);
  const entityFileRef = useRef(null);

  // Bot selector state (when no botId)
  const [bots, setBots] = useState([]);
  const [loadingBots, setLoadingBots] = useState(false);

  // Intents state
  const [intents, setIntents] = useState([]);
  const [selectedIntent, setSelectedIntent] = useState(null);
  const [intentForm, setIntentForm] = useState({
    name: '',
    displayName: '',
    description: '',
    confidenceThreshold: 0.7
  });
  const [examples, setExamples] = useState([]);
  const [newExample, setNewExample] = useState('');

  // Entities state
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityForm, setEntityForm] = useState({
    name: '',
    displayName: '',
    type: 'text'
  });
  const [values, setValues] = useState([]);
  const [newValue, setNewValue] = useState('');
  const [newSynonyms, setNewSynonyms] = useState('');

  // NLU Test state
  const [testMessage, setTestMessage] = useState('');
  const [nluResult, setNluResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Import/Export state
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Conflicts state
  const [conflictsData, setConflictsData] = useState(null);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictThreshold, setConflictThreshold] = useState(0.7);

  const token = localStorage.getItem('token');

  // Fetch bot name or bots list
  useEffect(() => {
    if (botId) {
      fetchBotName();
      fetchIntents();
      fetchEntities();
    } else {
      setLoading(false);
      fetchBots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const fetchBots = async () => {
    try {
      setLoadingBots(true);
      const res = await fetch(`${API_URL}/api/bots`, {
        headers: { Authorization: `Bearer ${token}` }
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

  const fetchBotName = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bots/${botId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const bot = await res.json();
        setBotName(bot.name);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const fetchIntents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/intents?bot_id=${botId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIntents(data);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const fetchEntities = async () => {
    try {
      const res = await fetch(`${API_URL}/api/entities?bot_id=${botId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEntities(data);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const fetchExamples = async (intentId) => {
    try {
      const res = await fetch(`${API_URL}/api/intents/${intentId}/examples`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExamples(data);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const fetchValues = async (entityId) => {
    try {
      const res = await fetch(`${API_URL}/api/entities/${entityId}/values`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setValues(data);
      }
    } catch (err) {
      // Silent fail
    }
  };

  // Intent handlers
  const selectIntent = (intent) => {
    setSelectedIntent(intent);
    setIntentForm({
      name: intent.name,
      displayName: intent.display_name || '',
      description: intent.description || '',
      confidenceThreshold: parseFloat(intent.confidence_threshold) || 0.7
    });
    fetchExamples(intent.id);
  };

  const createIntent = async () => {
    try {
      const res = await fetch(`${API_URL}/api/intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bot_id: parseInt(botId),
          name: 'new_intent',
          displayName: 'New Intent',
          description: '',
          confidenceThreshold: 0.7
        })
      });
      if (res.ok) {
        const intent = await res.json();
        setIntents([intent, ...intents]);
        selectIntent(intent);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const saveIntent = async () => {
    if (!selectedIntent) return;
    try {
      const res = await fetch(`${API_URL}/api/intents/${selectedIntent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(intentForm)
      });
      if (res.ok) {
        const updated = await res.json();
        setIntents(intents.map(i => i.id === updated.id ? updated : i));
        setSelectedIntent(updated);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const deleteIntent = async () => {
    if (!selectedIntent || !confirm('Bu intent-i silmək istədiyinizə əminsiniz?')) return;
    try {
      const res = await fetch(`${API_URL}/api/intents/${selectedIntent.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setIntents(intents.filter(i => i.id !== selectedIntent.id));
        setSelectedIntent(null);
        setExamples([]);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const addExample = async () => {
    if (!selectedIntent || !newExample.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/intents/${selectedIntent.id}/examples`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: newExample.trim(), language: 'az' })
      });
      if (res.ok) {
        const example = await res.json();
        setExamples([example, ...examples]);
        setNewExample('');
        // Update count in list
        setIntents(intents.map(i =>
          i.id === selectedIntent.id
            ? { ...i, example_count: (parseInt(i.example_count) || 0) + 1 }
            : i
        ));
      }
    } catch (err) {
      // Silent fail
    }
  };

  const deleteExample = async (exampleId) => {
    try {
      const res = await fetch(`${API_URL}/api/intents/${selectedIntent.id}/examples/${exampleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setExamples(examples.filter(e => e.id !== exampleId));
        setIntents(intents.map(i =>
          i.id === selectedIntent.id
            ? { ...i, example_count: Math.max(0, (parseInt(i.example_count) || 0) - 1) }
            : i
        ));
      }
    } catch (err) {
      // Silent fail
    }
  };

  // Entity handlers
  const selectEntity = (entity) => {
    setSelectedEntity(entity);
    setEntityForm({
      name: entity.name,
      displayName: entity.display_name || '',
      type: entity.type || 'text'
    });
    fetchValues(entity.id);
  };

  const createEntity = async () => {
    try {
      const res = await fetch(`${API_URL}/api/entities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bot_id: parseInt(botId),
          name: 'new_entity',
          displayName: 'New Entity',
          type: 'text'
        })
      });
      if (res.ok) {
        const entity = await res.json();
        setEntities([entity, ...entities]);
        selectEntity(entity);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const saveEntity = async () => {
    if (!selectedEntity) return;
    try {
      const res = await fetch(`${API_URL}/api/entities/${selectedEntity.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(entityForm)
      });
      if (res.ok) {
        const updated = await res.json();
        setEntities(entities.map(e => e.id === updated.id ? updated : e));
        setSelectedEntity(updated);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const deleteEntity = async () => {
    if (!selectedEntity || !confirm('Bu entity-ni silmək istədiyinizə əminsiniz?')) return;
    try {
      const res = await fetch(`${API_URL}/api/entities/${selectedEntity.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEntities(entities.filter(e => e.id !== selectedEntity.id));
        setSelectedEntity(null);
        setValues([]);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const addValue = async () => {
    if (!selectedEntity || !newValue.trim()) return;
    try {
      const synonymsArray = newSynonyms.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${API_URL}/api/entities/${selectedEntity.id}/values`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ value: newValue.trim(), synonyms: synonymsArray })
      });
      if (res.ok) {
        const value = await res.json();
        setValues([value, ...values]);
        setNewValue('');
        setNewSynonyms('');
        setEntities(entities.map(e =>
          e.id === selectedEntity.id
            ? { ...e, value_count: (parseInt(e.value_count) || 0) + 1 }
            : e
        ));
      }
    } catch (err) {
      // Silent fail
    }
  };

  const deleteValue = async (valueId) => {
    try {
      const res = await fetch(`${API_URL}/api/entities/${selectedEntity.id}/values/${valueId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setValues(values.filter(v => v.id !== valueId));
        setEntities(entities.map(e =>
          e.id === selectedEntity.id
            ? { ...e, value_count: Math.max(0, (parseInt(e.value_count) || 0) - 1) }
            : e
        ));
      }
    } catch (err) {
      // Silent fail
    }
  };

  // NLU Test
  const analyzeMessage = async () => {
    if (!testMessage.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_URL}/api/nlu/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ botId: parseInt(botId), message: testMessage })
      });
      if (res.ok) {
        const result = await res.json();
        setNluResult(result);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setAnalyzing(false);
    }
  };

  // Import/Export functions
  const handleImportIntents = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bot_id', botId);

      const res = await fetch(`${API_URL}/api/nlu/import/intents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Import successful: ${result.imported} new, ${result.updated} updated`);
        fetchIntents();
      } else {
        const error = await res.json();
        alert(`Import failed: ${error.error}`);
      }
    } catch (err) {
      alert('Import failed');
    } finally {
      setImportLoading(false);
      setShowImportMenu(false);
      e.target.value = '';
    }
  };

  const handleImportEntities = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bot_id', botId);

      const res = await fetch(`${API_URL}/api/nlu/import/entities`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Import successful: ${result.imported} new, ${result.updated} updated`);
        fetchEntities();
      } else {
        const error = await res.json();
        alert(`Import failed: ${error.error}`);
      }
    } catch (err) {
      alert('Import failed');
    } finally {
      setImportLoading(false);
      setShowImportMenu(false);
      e.target.value = '';
    }
  };

  const handleExport = async (type, format) => {
    setExportLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/nlu/export/${type}?bot_id=${botId}&format=${format}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${botId}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Export failed');
    } finally {
      setExportLoading(false);
      setShowExportMenu(false);
    }
  };

  // Analytics functions
  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const [summaryRes, intentsRes, dailyRes, confidenceRes, lowConfRes, gapsRes] = await Promise.all([
        fetch(`${API_URL}/api/nlu/analytics/summary?bot_id=${botId}&days=30`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/nlu/analytics/intents?bot_id=${botId}&days=30`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/nlu/analytics/daily?bot_id=${botId}&days=30`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/nlu/analytics/confidence?bot_id=${botId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/nlu/analytics/low-confidence?bot_id=${botId}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/nlu/analytics/training-gaps?bot_id=${botId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const summary = summaryRes.ok ? await summaryRes.json() : {};
      const intentsData = intentsRes.ok ? await intentsRes.json() : { intents: [] };
      const daily = dailyRes.ok ? await dailyRes.json() : { daily: [] };
      const confidence = confidenceRes.ok ? await confidenceRes.json() : { ranges: [] };
      const lowConf = lowConfRes.ok ? await lowConfRes.json() : { messages: [] };
      const gaps = gapsRes.ok ? await gapsRes.json() : { gaps: [] };

      setAnalyticsData({
        summary,
        topIntents: intentsData.intents.slice(0, 5),
        daily: daily.daily,
        confidence: confidence.ranges,
        lowConfidence: lowConf.messages,
        trainingGaps: gaps.gaps.filter(g => g.priority !== 'low').slice(0, 10)
      });
    } catch (err) {
      // Silent fail
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Conflicts functions
  const fetchConflicts = async () => {
    setConflictsLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/nlu/conflicts?bot_id=${botId}&threshold=${conflictThreshold}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        setConflictsData(data);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setConflictsLoading(false);
    }
  };

  const resolveConflict = async (action, params) => {
    try {
      const res = await fetch(`${API_URL}/api/nlu/resolve-conflict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, ...params })
      });

      if (res.ok) {
        fetchConflicts();
        fetchIntents();
      }
    } catch (err) {
      // Silent fail
    }
  };

  // Load analytics/conflicts when tab changes
  useEffect(() => {
    if (activeTab === 'analytics' && botId && !analyticsData) {
      fetchAnalytics();
    } else if (activeTab === 'conflicts' && botId && !conflictsData) {
      fetchConflicts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, botId]);

  const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const entityTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'list', label: 'List' },
    { value: 'regex', label: 'Regex' }
  ];

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>{t('common.loading')}</div>
      </div>
    );
  }

  // No bot selected - show bot selector
  if (!botId) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>🎯 {t('intentEntity.title')}</h1>
        </div>
        <div style={styles.botSelectorPanel}>
          <h2 style={styles.botSelectorTitle}>{t('common.selectBot')}</h2>
          <p style={styles.botSelectorDesc}>{t('common.selectBotDesc')}</p>
          {loadingBots ? (
            <div style={styles.loading}>{t('common.loading')}</div>
          ) : bots.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
              <p>{t('agentStudio.noBotsFound')}</p>
              <button
                style={styles.addButton}
                onClick={() => navigate('/create-bot')}
              >
                {t('agentStudio.createFirstBot')}
              </button>
            </div>
          ) : (
            <div style={styles.botGrid}>
              {bots.map(bot => (
                <button
                  key={bot.id}
                  style={styles.botCard}
                  onClick={() => navigate(`/bots/${bot.id}/intents`)}
                >
                  <span style={{ fontSize: '24px' }}>🤖</span>
                  <div>
                    <div style={styles.botCardName}>{bot.name}</div>
                    <div style={styles.botCardDesc}>{bot.description || 'Bot'}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Hidden file inputs */}
      <input
        ref={intentFileRef}
        type="file"
        accept=".csv,.json"
        style={{ display: 'none' }}
        onChange={handleImportIntents}
      />
      <input
        ref={entityFileRef}
        type="file"
        accept=".csv,.json"
        style={{ display: 'none' }}
        onChange={handleImportEntities}
      />

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎯 {t('intentEntity.title')}</h1>
        <div style={styles.headerActions}>
          {/* Import Dropdown */}
          <div style={styles.dropdown}>
            <button
              style={styles.headerButton}
              onClick={() => { setShowImportMenu(!showImportMenu); setShowExportMenu(false); }}
              disabled={importLoading}
            >
              📥 {importLoading ? 'Importing...' : 'Import'}
            </button>
            {showImportMenu && (
              <div style={styles.dropdownMenu}>
                <button style={styles.dropdownItem} onClick={() => intentFileRef.current?.click()}>
                  🎯 Import Intents (CSV/JSON)
                </button>
                <button style={styles.dropdownItem} onClick={() => entityFileRef.current?.click()}>
                  📦 Import Entities (CSV/JSON)
                </button>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div style={styles.dropdown}>
            <button
              style={styles.headerButton}
              onClick={() => { setShowExportMenu(!showExportMenu); setShowImportMenu(false); }}
              disabled={exportLoading}
            >
              📤 {exportLoading ? 'Exporting...' : 'Export'}
            </button>
            {showExportMenu && (
              <div style={styles.dropdownMenu}>
                <button style={styles.dropdownItem} onClick={() => handleExport('intents', 'csv')}>
                  🎯 Export Intents (CSV)
                </button>
                <button style={styles.dropdownItem} onClick={() => handleExport('intents', 'json')}>
                  🎯 Export Intents (JSON)
                </button>
                <button style={styles.dropdownItem} onClick={() => handleExport('entities', 'csv')}>
                  📦 Export Entities (CSV)
                </button>
                <button style={styles.dropdownItem} onClick={() => handleExport('entities', 'json')}>
                  📦 Export Entities (JSON)
                </button>
              </div>
            )}
          </div>

          <span style={styles.botName}>{botName}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'intents' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('intents')}
        >
          🎯 {t('intentEntity.intents')} ({intents.length})
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'entities' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('entities')}
        >
          📦 {t('intentEntity.entities')} ({entities.length})
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'analytics' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'conflicts' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('conflicts')}
        >
          ⚠️ Conflicts {conflictsData?.summary?.totalConflicts > 0 && `(${conflictsData.summary.totalConflicts})`}
        </button>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {activeTab === 'intents' && (
          <>
            {/* Intents List */}
            <div style={styles.leftPanel}>
              <button type="button" style={styles.addButton} onClick={createIntent}>
                + {t('intentEntity.createIntent')}
              </button>
              <div style={styles.list}>
                {intents.map(intent => {
                  const exCount = parseInt(intent.example_count) || 0;
                  const exampleQuality = exCount === 0 ? 'critical' : exCount < 3 ? 'warning' : exCount < 5 ? 'medium' : 'good';
                  return (
                    <div
                      key={intent.id}
                      style={{
                        ...styles.card,
                        ...(selectedIntent?.id === intent.id ? styles.selectedCard : {})
                      }}
                      onClick={() => selectIntent(intent)}
                    >
                      <div style={styles.cardHeader}>
                        <span style={styles.cardName}>{intent.display_name || intent.name}</span>
                        <div style={styles.cardBadges}>
                          {intent.is_active && <span style={styles.activeBadge}>Active</span>}
                        </div>
                      </div>
                      <div style={styles.cardMeta}>
                        <span style={styles.cardCode}>{intent.name}</span>
                        <span style={{
                          ...styles.exampleBadge,
                          backgroundColor: exampleQuality === 'critical' ? 'rgba(239,68,68,0.2)' :
                            exampleQuality === 'warning' ? 'rgba(245,158,11,0.2)' :
                            exampleQuality === 'medium' ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)',
                          color: exampleQuality === 'critical' ? '#ef4444' :
                            exampleQuality === 'warning' ? '#f59e0b' :
                            exampleQuality === 'medium' ? '#3b82f6' : '#10b981'
                        }}>
                          {exCount} examples
                        </span>
                      </div>
                    </div>
                  );
                })}
                {intents.length === 0 && (
                  <div style={styles.emptyState}>{t('intentEntity.noIntents')}</div>
                )}
              </div>
            </div>

            {/* Intent Details */}
            <div style={styles.rightPanel}>
              {selectedIntent ? (
                <>
                  <h3 style={styles.panelTitle}>Intent Details</h3>
                  <div style={styles.form}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Name (kod)</label>
                      <input
                        type="text"
                        style={styles.input}
                        value={intentForm.name}
                        onChange={e => setIntentForm({ ...intentForm, name: e.target.value })}
                        placeholder="order_product"
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Display Name</label>
                      <input
                        type="text"
                        style={styles.input}
                        value={intentForm.displayName}
                        onChange={e => setIntentForm({ ...intentForm, displayName: e.target.value })}
                        placeholder="Məhsul Sifarişi"
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Description</label>
                      <textarea
                        style={styles.textarea}
                        value={intentForm.description}
                        onChange={e => setIntentForm({ ...intentForm, description: e.target.value })}
                        placeholder="Bu intent nə zaman tetiklenməlidir..."
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        Confidence Threshold: {intentForm.confidenceThreshold.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="1"
                        step="0.05"
                        style={styles.slider}
                        value={intentForm.confidenceThreshold}
                        onChange={e => setIntentForm({ ...intentForm, confidenceThreshold: parseFloat(e.target.value) })}
                      />
                    </div>

                    {/* Examples */}
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Examples</label>
                      <div style={styles.addRow}>
                        <input
                          type="text"
                          style={styles.input}
                          value={newExample}
                          onChange={e => setNewExample(e.target.value)}
                          placeholder="Sifariş vermək istəyirəm"
                          onKeyPress={e => e.key === 'Enter' && addExample()}
                        />
                        <button type="button" style={styles.addSmallButton} onClick={addExample}>+</button>
                      </div>
                      <div style={styles.exampleList}>
                        {examples.map(ex => (
                          <div key={ex.id} style={styles.exampleItem}>
                            <span>{ex.text}</span>
                            <button
                              type="button"
                              style={styles.deleteSmallButton}
                              onClick={() => deleteExample(ex.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={styles.buttonRow}>
                      <button type="button" style={styles.saveButton} onClick={saveIntent}>
                        💾 {t('common.save')}
                      </button>
                      <button type="button" style={styles.deleteButton} onClick={deleteIntent}>
                        🗑️ {t('common.delete')}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={styles.emptyState}>Bir intent seçin</div>
              )}
            </div>
          </>
        )}

        {activeTab === 'entities' && (
          <>
            {/* Entities List */}
            <div style={styles.leftPanel}>
              <button type="button" style={styles.addButton} onClick={createEntity}>
                + {t('intentEntity.createEntity')}
              </button>
              <div style={styles.list}>
                {entities.map(entity => (
                  <div
                    key={entity.id}
                    style={{
                      ...styles.card,
                      ...(selectedEntity?.id === entity.id ? styles.selectedCard : {})
                    }}
                    onClick={() => selectEntity(entity)}
                  >
                    <div style={styles.cardHeader}>
                      <span style={styles.cardName}>{entity.display_name || entity.name}</span>
                      <span style={styles.typeBadge}>{entity.type}</span>
                    </div>
                    <div style={styles.cardMeta}>
                      <span style={styles.cardCode}>{entity.name}</span>
                      <span style={styles.cardCount}>{entity.value_count || 0} values</span>
                      {entity.is_system && <span style={styles.systemBadge}>System</span>}
                    </div>
                  </div>
                ))}
                {entities.length === 0 && (
                  <div style={styles.emptyState}>{t('intentEntity.noEntities')}</div>
                )}
              </div>
            </div>

            {/* Entity Details */}
            <div style={styles.rightPanel}>
              {selectedEntity ? (
                <>
                  <h3 style={styles.panelTitle}>Entity Details</h3>
                  <div style={styles.form}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Name (kod)</label>
                      <input
                        type="text"
                        style={styles.input}
                        value={entityForm.name}
                        onChange={e => setEntityForm({ ...entityForm, name: e.target.value })}
                        placeholder="city"
                        disabled={selectedEntity.is_system}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Display Name</label>
                      <input
                        type="text"
                        style={styles.input}
                        value={entityForm.displayName}
                        onChange={e => setEntityForm({ ...entityForm, displayName: e.target.value })}
                        placeholder="Şəhər"
                        disabled={selectedEntity.is_system}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Type</label>
                      <select
                        style={styles.select}
                        value={entityForm.type}
                        onChange={e => setEntityForm({ ...entityForm, type: e.target.value })}
                        disabled={selectedEntity.is_system}
                      >
                        {entityTypes.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Values */}
                    {!selectedEntity.is_system && (
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Values</label>
                        <div style={styles.addRow}>
                          <input
                            type="text"
                            style={{ ...styles.input, flex: 1 }}
                            value={newValue}
                            onChange={e => setNewValue(e.target.value)}
                            placeholder="Bakı"
                          />
                          <input
                            type="text"
                            style={{ ...styles.input, flex: 1 }}
                            value={newSynonyms}
                            onChange={e => setNewSynonyms(e.target.value)}
                            placeholder="Sinonimler: Baki, Baku"
                          />
                          <button type="button" style={styles.addSmallButton} onClick={addValue}>+</button>
                        </div>
                        <div style={styles.valueList}>
                          {values.map(val => (
                            <div key={val.id} style={styles.valueItem}>
                              <div>
                                <strong>{val.value}</strong>
                                {val.synonyms && val.synonyms.length > 0 && (
                                  <span style={styles.synonyms}>
                                    ({Array.isArray(val.synonyms) ? val.synonyms.join(', ') : val.synonyms})
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                style={styles.deleteSmallButton}
                                onClick={() => deleteValue(val.id)}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!selectedEntity.is_system && (
                      <div style={styles.buttonRow}>
                        <button type="button" style={styles.saveButton} onClick={saveEntity}>
                          💾 {t('common.save')}
                        </button>
                        <button type="button" style={styles.deleteButton} onClick={deleteEntity}>
                          🗑️ {t('common.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={styles.emptyState}>Bir entity seçin</div>
              )}
            </div>
          </>
        )}

        {activeTab === 'analytics' && (
          /* Analytics Tab */
          <div style={styles.analyticsContainer}>
            {analyticsLoading ? (
              <div style={styles.loading}>Loading analytics...</div>
            ) : analyticsData ? (
              <>
                {/* Summary Cards */}
                <div style={styles.summaryCards}>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryValue}>{analyticsData.summary.totalQueries || 0}</div>
                    <div style={styles.summaryLabel}>Total Queries</div>
                  </div>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryValue}>{intents.length}</div>
                    <div style={styles.summaryLabel}>Total Intents</div>
                  </div>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryValue}>{entities.length}</div>
                    <div style={styles.summaryLabel}>Total Entities</div>
                  </div>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryValue}>{((analyticsData.summary.avgConfidence || 0) * 100).toFixed(0)}%</div>
                    <div style={styles.summaryLabel}>Avg Confidence</div>
                  </div>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryValue}>{analyticsData.summary.matchRate || 0}%</div>
                    <div style={styles.summaryLabel}>Match Rate</div>
                  </div>
                </div>

                {/* Charts Row */}
                <div style={styles.chartsRow}>
                  {/* Daily Usage Chart */}
                  <div style={styles.chartContainer}>
                    <h4 style={styles.chartTitle}>📈 Daily Usage (Last 30 Days)</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={analyticsData.daily?.slice().reverse() || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3a" />
                        <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #2d2d3a' }} />
                        <Line type="monotone" dataKey="totalQueries" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Confidence Distribution */}
                  <div style={styles.chartContainer}>
                    <h4 style={styles.chartTitle}>📊 Confidence Distribution</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analyticsData.confidence || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3a" />
                        <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 9 }} />
                        <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #2d2d3a' }} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Top Intents Pie Chart */}
                  <div style={styles.chartContainer}>
                    <h4 style={styles.chartTitle}>🎯 Top 5 Intents</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={analyticsData.topIntents || []}
                          dataKey="hitCount"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {(analyticsData.topIntents || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #2d2d3a' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Tables Row */}
                <div style={styles.tablesRow}>
                  {/* Low Confidence Messages */}
                  <div style={styles.tableContainer}>
                    <h4 style={styles.chartTitle}>⚠️ Low Confidence Messages</h4>
                    <div style={styles.table}>
                      {(analyticsData.lowConfidence || []).length === 0 ? (
                        <div style={styles.emptyState}>No low confidence messages</div>
                      ) : (
                        analyticsData.lowConfidence.map((msg, i) => (
                          <div key={i} style={styles.tableRow}>
                            <div style={styles.tableMessage}>{msg.message}</div>
                            <div style={styles.tableIntent}>{msg.detectedIntent || 'Unknown'}</div>
                            <div style={{
                              ...styles.tableConfidence,
                              color: msg.confidence < 0.3 ? '#ef4444' : '#f59e0b'
                            }}>
                              {(msg.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Training Gaps */}
                  <div style={styles.tableContainer}>
                    <h4 style={styles.chartTitle}>📚 Training Gaps</h4>
                    <div style={styles.table}>
                      {(analyticsData.trainingGaps || []).length === 0 ? (
                        <div style={styles.emptyState}>All intents have sufficient examples</div>
                      ) : (
                        analyticsData.trainingGaps.map((gap, i) => (
                          <div key={i} style={styles.tableRow}>
                            <div style={styles.tableMessage}>{gap.name}</div>
                            <div style={styles.tableIntent}>{gap.exampleCount} examples</div>
                            <div style={{
                              ...styles.priorityBadge,
                              backgroundColor: gap.priority === 'critical' ? 'rgba(239,68,68,0.2)' :
                                gap.priority === 'high' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)',
                              color: gap.priority === 'critical' ? '#ef4444' :
                                gap.priority === 'high' ? '#f59e0b' : '#3b82f6'
                            }}>
                              {gap.priority}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <button style={styles.refreshButton} onClick={fetchAnalytics}>
                  🔄 Refresh Analytics
                </button>
              </>
            ) : (
              <div style={styles.emptyState}>No analytics data available</div>
            )}
          </div>
        )}

        {activeTab === 'conflicts' && (
          /* Conflicts Tab */
          <div style={styles.conflictsContainer}>
            {/* Threshold Slider */}
            <div style={styles.conflictControls}>
              <label style={styles.label}>
                Similarity Threshold: {(conflictThreshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                style={styles.slider}
                value={conflictThreshold}
                onChange={e => setConflictThreshold(parseFloat(e.target.value))}
              />
              <button
                style={styles.scanButton}
                onClick={fetchConflicts}
                disabled={conflictsLoading}
              >
                {conflictsLoading ? '🔄 Scanning...' : '🔍 Scan for Conflicts'}
              </button>
            </div>

            {conflictsLoading ? (
              <div style={styles.loading}>Scanning for conflicts...</div>
            ) : conflictsData ? (
              <>
                {/* Summary */}
                <div style={styles.conflictSummary}>
                  <span>Found <strong>{conflictsData.summary?.totalConflicts || 0}</strong> conflicts</span>
                  {conflictsData.summary?.critical > 0 && (
                    <span style={styles.criticalBadge}>🔴 {conflictsData.summary.critical} Critical</span>
                  )}
                  {conflictsData.summary?.high > 0 && (
                    <span style={styles.highBadge}>🟠 {conflictsData.summary.high} High</span>
                  )}
                </div>

                {/* Conflict List */}
                <div style={styles.conflictList}>
                  {(conflictsData.conflicts || []).length === 0 ? (
                    <div style={styles.emptyState}>✅ No conflicts found! Your intents are well-defined.</div>
                  ) : (
                    conflictsData.conflicts.map((conflict, i) => (
                      <div key={i} style={styles.conflictCard}>
                        <div style={styles.conflictHeader}>
                          <span style={{
                            ...styles.similarityBadge,
                            backgroundColor: conflict.similarity >= 0.9 ? 'rgba(239,68,68,0.2)' :
                              conflict.similarity >= 0.8 ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)',
                            color: conflict.similarity >= 0.9 ? '#ef4444' :
                              conflict.similarity >= 0.8 ? '#f59e0b' : '#3b82f6'
                          }}>
                            {(conflict.similarity * 100).toFixed(0)}% similar
                          </span>
                        </div>
                        <div style={styles.conflictIntents}>
                          <div style={styles.conflictIntent}>
                            <strong>{conflict.intent1.name}</strong>
                            <div style={styles.conflictExample}>"{conflict.intent1.example}"</div>
                          </div>
                          <div style={styles.conflictVs}>vs</div>
                          <div style={styles.conflictIntent}>
                            <strong>{conflict.intent2.name}</strong>
                            <div style={styles.conflictExample}>"{conflict.intent2.example}"</div>
                          </div>
                        </div>
                        <div style={styles.conflictActions}>
                          <button
                            style={styles.conflictActionButton}
                            onClick={() => resolveConflict('delete', { example_id: conflict.intent1.example_id })}
                            title="Delete first example"
                          >
                            🗑️ Delete 1st
                          </button>
                          <button
                            style={styles.conflictActionButton}
                            onClick={() => resolveConflict('delete', { example_id: conflict.intent2.example_id })}
                            title="Delete second example"
                          >
                            🗑️ Delete 2nd
                          </button>
                          <button
                            style={styles.conflictActionButton}
                            onClick={() => resolveConflict('merge', {
                              source_intent_id: conflict.intent2.id,
                              target_intent_id: conflict.intent1.id
                            })}
                            title="Merge intents"
                          >
                            🔀 Merge
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div style={styles.emptyState}>Click "Scan for Conflicts" to analyze your intents</div>
            )}
          </div>
        )}
      </div>

      {/* NLU Test Panel */}
      <div style={styles.testPanel}>
        <h3 style={styles.testTitle}>🧪 Test NLU</h3>
        <div style={styles.testRow}>
          <input
            type="text"
            style={styles.testInput}
            value={testMessage}
            onChange={e => setTestMessage(e.target.value)}
            placeholder="Mesaj yazın... (məs: Bakıya bilet almaq istəyirəm)"
            onKeyPress={e => e.key === 'Enter' && analyzeMessage()}
          />
          <button
            type="button"
            style={styles.analyzeButton}
            onClick={analyzeMessage}
            disabled={analyzing}
          >
            {analyzing ? '...' : '🔍 Analyze'}
          </button>
        </div>
        {nluResult && (
          <div style={styles.resultBox}>
            <div style={styles.resultSection}>
              <strong>Intent:</strong>{' '}
              {nluResult.intent?.name ? (
                <span style={styles.intentResult}>
                  {nluResult.intent.name} ({(nluResult.intent.confidence * 100).toFixed(0)}%)
                </span>
              ) : (
                <span style={styles.noResult}>Tapılmadı</span>
              )}
            </div>
            <div style={styles.resultSection}>
              <strong>Entities:</strong>{' '}
              {nluResult.entities?.length > 0 ? (
                nluResult.entities.map((e, i) => (
                  <span key={i} style={styles.entityResult}>
                    {e.name}: {e.value}
                  </span>
                ))
              ) : (
                <span style={styles.noResult}>Tapılmadı</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#0a0a0f'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#fff',
    margin: 0
  },
  botName: {
    fontSize: '16px',
    color: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    padding: '8px 16px',
    borderRadius: '8px'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px'
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: '1px solid #2d2d3a',
    borderRadius: '8px',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  activeTab: {
    backgroundColor: '#8b5cf6',
    border: '1px solid #8b5cf6',
    color: '#fff'
  },
  mainContent: {
    display: 'flex',
    gap: '24px',
    marginBottom: '24px'
  },
  leftPanel: {
    width: '350px',
    flexShrink: 0
  },
  rightPanel: {
    flex: 1,
    backgroundColor: '#12121a',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #2d2d3a'
  },
  addButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '16px'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '500px',
    overflowY: 'auto'
  },
  card: {
    backgroundColor: '#12121a',
    borderRadius: '8px',
    padding: '12px 16px',
    border: '1px solid #2d2d3a',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  selectedCard: {
    border: '1px solid #8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  cardName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: '14px'
  },
  cardMeta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  cardBadges: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
  },
  exampleBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500'
  },
  cardCode: {
    color: '#6b7280',
    fontSize: '12px',
    fontFamily: 'monospace'
  },
  cardCount: {
    color: '#6b7280',
    fontSize: '12px'
  },
  activeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#10b981',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px'
  },
  typeBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px'
  },
  systemBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px'
  },
  panelTitle: {
    color: '#fff',
    marginTop: 0,
    marginBottom: '20px',
    fontSize: '18px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    color: '#9ca3af',
    fontSize: '13px'
  },
  input: {
    backgroundColor: '#1a1a24',
    border: '1px solid #2d2d3a',
    borderRadius: '6px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none'
  },
  textarea: {
    backgroundColor: '#1a1a24',
    border: '1px solid #2d2d3a',
    borderRadius: '6px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    minHeight: '80px',
    resize: 'vertical'
  },
  select: {
    backgroundColor: '#1a1a24',
    border: '1px solid #2d2d3a',
    borderRadius: '6px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none'
  },
  slider: {
    width: '100%',
    accentColor: '#8b5cf6'
  },
  addRow: {
    display: 'flex',
    gap: '8px'
  },
  addSmallButton: {
    width: '40px',
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '18px'
  },
  exampleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '200px',
    overflowY: 'auto'
  },
  exampleItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a24',
    padding: '8px 12px',
    borderRadius: '6px',
    color: '#e5e7eb',
    fontSize: '13px'
  },
  valueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '200px',
    overflowY: 'auto'
  },
  valueItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a24',
    padding: '8px 12px',
    borderRadius: '6px',
    color: '#e5e7eb',
    fontSize: '13px'
  },
  synonyms: {
    color: '#6b7280',
    marginLeft: '8px',
    fontSize: '12px'
  },
  deleteSmallButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '0 4px'
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px'
  },
  saveButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  deleteButton: {
    padding: '12px 24px',
    backgroundColor: '#ef4444',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  emptyState: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '40px',
    fontSize: '14px'
  },
  loading: {
    textAlign: 'center',
    color: '#9ca3af',
    padding: '60px',
    fontSize: '16px'
  },
  testPanel: {
    backgroundColor: '#12121a',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2d2d3a'
  },
  testTitle: {
    color: '#fff',
    marginTop: 0,
    marginBottom: '16px',
    fontSize: '16px'
  },
  testRow: {
    display: 'flex',
    gap: '12px'
  },
  testInput: {
    flex: 1,
    backgroundColor: '#1a1a24',
    border: '1px solid #2d2d3a',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none'
  },
  analyzeButton: {
    padding: '12px 24px',
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  resultBox: {
    marginTop: '16px',
    backgroundColor: '#1a1a24',
    borderRadius: '8px',
    padding: '16px'
  },
  resultSection: {
    marginBottom: '8px',
    color: '#e5e7eb',
    fontSize: '14px'
  },
  intentResult: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    padding: '2px 8px',
    borderRadius: '4px',
    marginLeft: '8px'
  },
  entityResult: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    padding: '2px 8px',
    borderRadius: '4px',
    marginLeft: '8px',
    marginRight: '4px'
  },
  noResult: {
    color: '#6b7280',
    fontStyle: 'italic'
  },
  botSelectorPanel: {
    backgroundColor: '#12121a',
    borderRadius: '16px',
    padding: '32px',
    border: '1px solid #2d2d3a'
  },
  botSelectorTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    marginTop: 0,
    marginBottom: '8px'
  },
  botSelectorDesc: {
    color: '#6b7280',
    marginBottom: '24px',
    fontSize: '14px'
  },
  botGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px'
  },
  botCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#1a1a24',
    border: '1px solid #2d2d3a',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
    width: '100%'
  },
  botCardName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: '14px'
  },
  botCardDesc: {
    color: '#6b7280',
    fontSize: '12px',
    marginTop: '2px'
  },
  // Header Actions
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  dropdown: {
    position: 'relative'
  },
  headerButton: {
    padding: '8px 16px',
    backgroundColor: '#1a1a24',
    border: '1px solid #2d2d3a',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    backgroundColor: '#1a1a24',
    border: '1px solid #2d2d3a',
    borderRadius: '8px',
    padding: '8px 0',
    minWidth: '200px',
    zIndex: 100,
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
  },
  dropdownItem: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#e5e7eb',
    cursor: 'pointer',
    fontSize: '14px',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  // Analytics styles
  analyticsContainer: {
    flex: 1,
    padding: '24px',
    backgroundColor: '#12121a',
    borderRadius: '12px',
    border: '1px solid #2d2d3a'
  },
  summaryCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  summaryCard: {
    backgroundColor: '#1a1a24',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    border: '1px solid #2d2d3a'
  },
  summaryValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#8b5cf6',
    marginBottom: '4px'
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#9ca3af'
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  chartContainer: {
    backgroundColor: '#1a1a24',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #2d2d3a'
  },
  chartTitle: {
    color: '#fff',
    fontSize: '14px',
    marginTop: 0,
    marginBottom: '12px'
  },
  tablesRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  tableContainer: {
    backgroundColor: '#1a1a24',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #2d2d3a'
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '250px',
    overflowY: 'auto'
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: '#12121a',
    borderRadius: '6px',
    gap: '12px'
  },
  tableMessage: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: '13px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  tableIntent: {
    color: '#9ca3af',
    fontSize: '12px',
    minWidth: '100px'
  },
  tableConfidence: {
    fontSize: '12px',
    fontWeight: '600',
    minWidth: '50px',
    textAlign: 'right'
  },
  priorityBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  refreshButton: {
    padding: '12px 24px',
    backgroundColor: '#2d2d3a',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px'
  },
  // Conflicts styles
  conflictsContainer: {
    flex: 1,
    padding: '24px',
    backgroundColor: '#12121a',
    borderRadius: '12px',
    border: '1px solid #2d2d3a'
  },
  conflictControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#1a1a24',
    borderRadius: '8px',
    border: '1px solid #2d2d3a'
  },
  scanButton: {
    padding: '10px 20px',
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    marginLeft: 'auto'
  },
  conflictSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
    color: '#e5e7eb',
    fontSize: '14px'
  },
  criticalBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '13px'
  },
  highBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '13px'
  },
  conflictList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '500px',
    overflowY: 'auto'
  },
  conflictCard: {
    backgroundColor: '#1a1a24',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #2d2d3a'
  },
  conflictHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  similarityBadge: {
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600'
  },
  conflictIntents: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '12px'
  },
  conflictIntent: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#12121a',
    borderRadius: '8px'
  },
  conflictVs: {
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: '600'
  },
  conflictExample: {
    color: '#9ca3af',
    fontSize: '12px',
    marginTop: '6px',
    fontStyle: 'italic'
  },
  conflictActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  conflictActionButton: {
    padding: '8px 12px',
    backgroundColor: '#2d2d3a',
    border: 'none',
    borderRadius: '6px',
    color: '#e5e7eb',
    cursor: 'pointer',
    fontSize: '12px'
  }
};
