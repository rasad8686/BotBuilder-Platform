import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, PenTool, BarChart3, Settings, MessageSquare, Code, Smartphone, TrendingUp, Folder, Bot } from 'lucide-react';

const categoryIcons = {
  research: Search,
  content: PenTool,
  data: BarChart3,
  automation: Settings,
  customer_service: MessageSquare,
  development: Code,
  marketing: Smartphone,
  analysis: TrendingUp
};

const categoryColors = {
  research: '#48bb78',
  content: '#ed8936',
  data: '#4299e1',
  automation: '#9f7aea',
  customer_service: '#38b2ac',
  development: '#667eea',
  marketing: '#f56565',
  analysis: '#ecc94b'
};

const AgentTemplates = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [customName, setCustomName] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let url = '/api/autonomous/templates';
      const params = new URLSearchParams();

      if (selectedCategory) {
        params.append('category', selectedCategory);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await res.json();
      setTemplates(data.templates || []);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;

    setIsCreating(true);

    try {
      const res = await fetch(`/api/autonomous/templates/${selectedTemplate.id}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: customName || selectedTemplate.name
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create agent');
      }

      const data = await res.json();
      navigate(`/autonomous/agents/${data.agent.id}/tasks`);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    if (selectedCategory && template.category !== selectedCategory) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (isLoading && templates.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6c757d' }}>{t('common.loading', 'Loading...')}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e9ecef', padding: '16px 32px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Link to="/autonomous" style={{ color: '#667eea', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
            ← {t('autonomous.backToAgents', 'Back to Agents')}
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '32px' }}>📦</span>
                {t('agentTemplates.title', 'Agent Templates')}
              </h1>
              <p style={{ margin: '8px 0 0 0', color: '#6c757d' }}>
                {t('agentTemplates.subtitle', 'Start with pre-built agent configurations')}
              </p>
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('agentTemplates.searchPlaceholder', 'Search templates...')}
                style={{
                  padding: '12px 16px 12px 40px',
                  border: '2px solid #e9ecef',
                  borderRadius: '10px',
                  fontSize: '14px',
                  width: '300px'
                }}
              />
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>🔍</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px' }}>
          {/* Sidebar - Categories */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', height: 'fit-content' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6c757d', textTransform: 'uppercase' }}>
              {t('agentTemplates.categories', 'Categories')}
            </h3>

            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '12px',
                background: !selectedCategory ? '#667eea10' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                color: !selectedCategory ? '#667eea' : '#495057',
                fontWeight: !selectedCategory ? '600' : '400',
                marginBottom: '4px'
              }}
            >
              <span>📋</span>
              {t('agentTemplates.allTemplates', 'All Templates')}
            </button>

            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '12px',
                  background: selectedCategory === category ? '#667eea10' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: selectedCategory === category ? '#667eea' : '#495057',
                  fontWeight: selectedCategory === category ? '600' : '400',
                  marginBottom: '4px',
                  textTransform: 'capitalize'
                }}
              >
                <span>{(() => { const Icon = categoryIcons[category] || Folder; return <Icon size={16} />; })()}</span>
                {category.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Templates Grid */}
          <div>
            {error && (
              <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '16px', marginBottom: '20px', color: '#c53030' }}>
                {error}
              </div>
            )}

            {filteredTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                <p style={{ color: '#6c757d' }}>{t('agentTemplates.noTemplates', 'No templates found')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {filteredTemplates.map(template => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    style={{
                      background: 'white',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: selectedTemplate?.id === template.id ? '2px solid #667eea' : '2px solid transparent'
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      padding: '20px',
                      background: `linear-gradient(135deg, ${categoryColors[template.category] || '#667eea'}20 0%, ${categoryColors[template.category] || '#667eea'}10 100%)`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '40px' }}>{(() => { const Icon = categoryIcons[template.category] || Bot; return <Icon size={40} />; })()}</span>
                        <span style={{
                          padding: '4px 10px',
                          background: categoryColors[template.category] || '#667eea',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          textTransform: 'capitalize'
                        }}>
                          {template.category?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '20px' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#1a1a2e' }}>{template.name}</h3>
                      <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6c757d', lineHeight: '1.5' }}>
                        {template.description}
                      </p>

                      {/* Capabilities */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(template.capabilities || []).slice(0, 3).map(cap => (
                          <span key={cap} style={{
                            padding: '4px 8px',
                            background: '#f8f9fa',
                            color: '#6c757d',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            {cap}
                          </span>
                        ))}
                        {(template.capabilities || []).length > 3 && (
                          <span style={{
                            padding: '4px 8px',
                            background: '#f8f9fa',
                            color: '#6c757d',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            +{template.capabilities.length - 3}
                          </span>
                        )}
                      </div>

                      {/* Footer */}
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#6c757d' }}>
                          {template.model || 'GPT-4'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTemplate(template);
                            setCustomName(template.name);
                          }}
                          style={{
                            padding: '8px 16px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500'
                          }}
                        >
                          {t('agentTemplates.useTemplate', 'Use Template')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {selectedTemplate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
            maxWidth: '500px'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e9ecef' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '40px' }}>{selectedTemplate.icon || '🤖'}</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', color: '#1a1a2e' }}>
                    {t('agentTemplates.createFromTemplate', 'Create from Template')}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6c757d' }}>
                    {selectedTemplate.name}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a1a2e' }}>
                {t('agentTemplates.agentName', 'Agent Name')}
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={selectedTemplate.name}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '2px solid #e9ecef',
                  borderRadius: '10px',
                  fontSize: '15px',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ marginTop: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '10px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1a1a2e' }}>
                  {t('agentTemplates.templateIncludes', 'This template includes:')}
                </h4>
                <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#6c757d', fontSize: '14px', lineHeight: '1.8' }}>
                  <li>Role: {selectedTemplate.role}</li>
                  <li>Model: {selectedTemplate.model}</li>
                  <li>Capabilities: {(selectedTemplate.capabilities || []).join(', ')}</li>
                  <li>Pre-configured system prompt</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  onClick={() => {
                    setSelectedTemplate(null);
                    setCustomName('');
                  }}
                  style={{
                    padding: '12px 24px',
                    background: '#e9ecef',
                    color: '#495057',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleCreateFromTemplate}
                  disabled={isCreating}
                  style={{
                    padding: '12px 24px',
                    background: isCreating ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isCreating ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isCreating ? (
                    <>
                      <span style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                      {t('common.creating', 'Creating...')}
                    </>
                  ) : (
                    <>
                      <span>+</span>
                      {t('agentTemplates.createAgent', 'Create Agent')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AgentTemplates;
