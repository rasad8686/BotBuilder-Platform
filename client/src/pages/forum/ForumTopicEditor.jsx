/**
 * @fileoverview Forum Topic Editor
 * @description Create or edit a forum topic
 */

import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { AuthContext } from '../../context/AuthContext';

export default function ForumTopicEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authContext = useContext(AuthContext);
  const user = authContext?.user || null;

  const preselectedCategory = searchParams.get('category');

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    category_id: '',
    title: '',
    content: '',
    tags: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadCategories();
  }, [user]);

  const loadCategories = async () => {
    try {
      const res = await api.get('/api/forum/categories');
      setCategories(res.data.data || []);

      // Set preselected category if provided
      if (preselectedCategory) {
        const cat = res.data.data.find(c => c.slug === preselectedCategory);
        if (cat) {
          setFormData(prev => ({ ...prev, category_id: cat.id }));
        }
      }
    } catch (err) {
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.category_id || !formData.title.trim() || !formData.content.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const tags = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const res = await api.post('/api/forum/topics', {
        category_id: formData.category_id,
        title: formData.title.trim(),
        content: formData.content.trim(),
        tags
      });

      navigate(`/forum/topic/${res.data.data.slug}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create topic');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link to="/forum" style={styles.breadcrumbLink}>Forum</Link>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbCurrent}>New Topic</span>
      </div>

      <div style={styles.formCard}>
        <h1 style={styles.title}>Create New Topic</h1>
        <p style={styles.subtitle}>Share your question or start a discussion</p>

        {error && (
          <div style={styles.errorBanner}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Category */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Category <span style={styles.required}>*</span>
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => handleChange('category_id', e.target.value)}
              style={styles.select}
              required
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Title <span style={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="What's your question or topic?"
              style={styles.input}
              maxLength={255}
              required
            />
            <span style={styles.charCount}>
              {formData.title.length}/255
            </span>
          </div>

          {/* Content */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Content <span style={styles.required}>*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => handleChange('content', e.target.value)}
              placeholder="Describe your question or topic in detail. Include any relevant code, error messages, or context that would help others understand and respond."
              style={styles.textarea}
              rows={12}
              required
            />
            <div style={styles.helpText}>
              Tip: Be specific and provide enough context for others to help you effectively.
            </div>
          </div>

          {/* Tags */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Tags</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              placeholder="javascript, react, api (comma separated)"
              style={styles.input}
            />
            <div style={styles.helpText}>
              Add up to 5 tags to help others find your topic.
            </div>
          </div>

          {/* Guidelines */}
          <div style={styles.guidelines}>
            <h3 style={styles.guidelinesTitle}>Posting Guidelines</h3>
            <ul style={styles.guidelinesList}>
              <li>Search first to see if your question has been asked before</li>
              <li>Use a clear, descriptive title</li>
              <li>Include relevant code snippets or error messages</li>
              <li>Be respectful and constructive</li>
              <li>Mark helpful replies as solutions to help others</li>
            </ul>
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                ...styles.submitButton,
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? 'Creating...' : 'Create Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px'
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '24px',
    fontSize: '14px'
  },
  breadcrumbLink: {
    color: '#3b82f6',
    textDecoration: 'none'
  },
  breadcrumbSep: {
    color: '#9ca3af'
  },
  breadcrumbCurrent: {
    color: '#374151'
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '32px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '24px'
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '24px',
    fontSize: '14px'
  },
  formGroup: {
    marginBottom: '24px',
    position: 'relative'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px'
  },
  required: {
    color: '#ef4444'
  },
  select: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: '1.6'
  },
  charCount: {
    position: 'absolute',
    right: '12px',
    bottom: '-20px',
    fontSize: '12px',
    color: '#9ca3af'
  },
  helpText: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '8px'
  },
  guidelines: {
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px'
  },
  guidelinesTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '12px'
  },
  guidelinesList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.8'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb'
  },
  cancelButton: {
    padding: '12px 24px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151'
  },
  submitButton: {
    padding: '12px 32px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  }
};
