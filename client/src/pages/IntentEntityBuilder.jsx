import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function IntentEntityBuilder() {
  const { t } = useTranslation();
  const { botId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('intents');
  const [botName, setBotName] = useState('');
  const [loading, setLoading] = useState(true);

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
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎯 {t('intentEntity.title')}</h1>
        <span style={styles.botName}>{botName}</span>
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
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {activeTab === 'intents' ? (
          <>
            {/* Intents List */}
            <div style={styles.leftPanel}>
              <button type="button" style={styles.addButton} onClick={createIntent}>
                + {t('intentEntity.createIntent')}
              </button>
              <div style={styles.list}>
                {intents.map(intent => (
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
                      {intent.is_active && <span style={styles.activeBadge}>Active</span>}
                    </div>
                    <div style={styles.cardMeta}>
                      <span style={styles.cardCode}>{intent.name}</span>
                      <span style={styles.cardCount}>{intent.example_count || 0} examples</span>
                    </div>
                  </div>
                ))}
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
        ) : (
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
    alignItems: 'center'
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
  }
};
