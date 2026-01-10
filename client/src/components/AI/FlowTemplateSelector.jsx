import React, { useState, useEffect } from 'react';
import { Headphones, Briefcase, Calendar, ShoppingCart, Star, Bot } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CATEGORY_ICONS = {
  support: Headphones,
  sales: Briefcase,
  scheduling: Calendar,
  ecommerce: ShoppingCart,
  feedback: Star,
  default: Bot
};

const DIFFICULTY_COLORS = {
  beginner: { bg: '#dcfce7', text: '#15803d' },
  intermediate: { bg: '#fef3c7', text: '#92400e' },
  advanced: { bg: '#fee2e2', text: '#dc2626' }
};

export default function FlowTemplateSelector({ onSelectTemplate, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [, setLoadingPreview] = useState(false);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`${API_URL}/api/ai/flow/templates?${params}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
        if (data.categories) setCategories(data.categories);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (templateId) => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`${API_URL}/api/ai/flow/templates/${templateId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      const data = await res.json();
      if (data.success) {
        setPreviewTemplate(data.template);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleUseTemplate = () => {
    if (previewTemplate && onSelectTemplate) {
      onSelectTemplate(previewTemplate.flow);
    }
  };

  if (previewTemplate) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Preview Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px'
        }}>
          <div>
            <button
              onClick={() => setPreviewTemplate(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: '14px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ← Back to templates
            </button>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
              {previewTemplate.name}
            </h2>
            <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
              {previewTemplate.description}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              &times;
            </button>
          )}
        </div>

        {/* Template Info */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '4px' }}>
              {(() => { const Icon = CATEGORY_ICONS[previewTemplate.category] || CATEGORY_ICONS.default; return <Icon size={24} />; })()}
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Category</div>
            <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>
              {previewTemplate.category}
            </div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>📊</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Nodes</div>
            <div style={{ fontWeight: '500' }}>{previewTemplate.estimatedNodes}</div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>⚡</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Difficulty</div>
            <div style={{
              fontWeight: '500',
              textTransform: 'capitalize',
              color: DIFFICULTY_COLORS[previewTemplate.difficulty]?.text
            }}>
              {previewTemplate.difficulty}
            </div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>🔗</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Connections</div>
            <div style={{ fontWeight: '500' }}>{previewTemplate.flow?.edges?.length || 0}</div>
          </div>
        </div>

        {/* Features */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Features
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {previewTemplate.features?.map((feature, index) => (
              <span
                key={index}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  borderRadius: '20px',
                  fontSize: '13px'
                }}
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Node List */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Flow Structure ({previewTemplate.flow?.nodes?.length || 0} nodes)
          </h3>
          <div style={{
            maxHeight: '200px',
            overflow: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '12px'
          }}>
            {previewTemplate.flow?.nodes?.map((node, index) => (
              <div
                key={node.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: index < previewTemplate.flow.nodes.length - 1 ? '1px solid #e5e7eb' : 'none'
                }}
              >
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>
                  {node.type}
                </span>
                <span style={{ fontWeight: '500' }}>{node.data?.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Use Template Button */}
        <button
          onClick={handleUseTemplate}
          style={{
            width: '100%',
            padding: '14px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '16px'
          }}
        >
          Use This Template
        </button>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '32px',
      maxWidth: '900px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
            Flow Templates
          </h2>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '14px' }}>
            Start with a pre-built template and customize it
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            &times;
          </button>
        )}
      </div>

      {/* Search and Filter */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid #d1d5db',
              fontSize: '15px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid #d1d5db',
            fontSize: '15px',
            minWidth: '150px'
          }}
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.count})
            </option>
          ))}
        </select>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          backgroundColor: '#f9fafb',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <p style={{ color: '#6b7280' }}>No templates found</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          {templates.map(template => (
            <div
              key={template.id}
              onClick={() => { setSelectedTemplate(template.id); handlePreview(template.id); }}
              style={{
                padding: '20px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: selectedTemplate === template.id ? '0 0 0 2px #3b82f6' : 'none'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Template Header */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {(() => { const Icon = CATEGORY_ICONS[template.category] || CATEGORY_ICONS.default; return <Icon size={24} />; })()}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                    {template.name}
                  </h3>
                  <span style={{
                    display: 'inline-block',
                    marginTop: '4px',
                    padding: '2px 8px',
                    backgroundColor: DIFFICULTY_COLORS[template.difficulty]?.bg || '#f3f4f6',
                    color: DIFFICULTY_COLORS[template.difficulty]?.text || '#6b7280',
                    borderRadius: '4px',
                    fontSize: '11px',
                    textTransform: 'capitalize'
                  }}>
                    {template.difficulty}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p style={{
                margin: '0 0 12px',
                color: '#6b7280',
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                {template.description}
              </p>

              {/* Features */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {template.features?.slice(0, 3).map((feature, index) => (
                  <span
                    key={index}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#4b5563'
                    }}
                  >
                    {feature}
                  </span>
                ))}
                {template.features?.length > 3 && (
                  <span style={{
                    padding: '4px 8px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#4b5563'
                  }}>
                    +{template.features.length - 3}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div style={{
                display: 'flex',
                gap: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #e5e7eb',
                fontSize: '13px',
                color: '#6b7280'
              }}>
                <span>📊 {template.estimatedNodes} nodes</span>
                <span style={{ textTransform: 'capitalize' }}>📁 {template.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
