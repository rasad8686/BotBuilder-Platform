/**
 * Seller Item Editor Page
 * Create and edit marketplace items
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SellerItemEditor = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);

  const [form, setForm] = useState({
    type: 'plugin',
    name: '',
    description: '',
    long_description: '',
    price_type: 'free',
    price: 0,
    currency: 'USD',
    icon_url: '',
    screenshots: [],
    demo_url: '',
    version: '1.0.0',
    min_platform_version: '',
    categories: [],
    tags: []
  });

  const [tagInput, setTagInput] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchCategories();
    if (!isNew) {
      fetchItem();
    }
  }, [token, id, isNew, navigate]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/categories`);
      const data = await response.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchItem = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/seller/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        const item = data.items?.find(i => i.id === parseInt(id));
        if (item) {
          setForm({
            type: item.type || 'plugin',
            name: item.name || '',
            description: item.description || '',
            long_description: item.long_description || '',
            price_type: item.price_type || 'free',
            price: item.price || 0,
            currency: item.currency || 'USD',
            icon_url: item.icon_url || '',
            screenshots: typeof item.screenshots === 'string' ? JSON.parse(item.screenshots) : (item.screenshots || []),
            demo_url: item.demo_url || '',
            version: item.version || '1.0.0',
            min_platform_version: item.min_platform_version || '',
            categories: typeof item.categories === 'string' ? JSON.parse(item.categories) : (item.categories || []),
            tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || [])
          });
        }
      }
    } catch (error) {
      console.error('Error fetching item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      handleChange('tags', [...form.tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    handleChange('tags', form.tags.filter(t => t !== tag));
  };

  const handleCategoryToggle = (slug) => {
    if (form.categories.includes(slug)) {
      handleChange('categories', form.categories.filter(c => c !== slug));
    } else {
      handleChange('categories', [...form.categories, slug]);
    }
  };

  const handleAddScreenshot = () => {
    const url = prompt(t('seller.enterScreenshotUrl', 'Enter screenshot URL:'));
    if (url) {
      handleChange('screenshots', [...form.screenshots, url]);
    }
  };

  const handleRemoveScreenshot = (index) => {
    handleChange('screenshots', form.screenshots.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert(t('seller.nameRequired', 'Name is required'));
      return;
    }

    try {
      setSaving(true);

      const url = isNew
        ? `${API_URL}/api/marketplace/seller/items`
        : `${API_URL}/api/marketplace/seller/items/${id}`;

      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      if (data.success) {
        alert(isNew
          ? t('seller.itemCreated', 'Item created successfully!')
          : t('seller.itemUpdated', 'Item updated successfully!')
        );
        navigate('/seller/items');
      } else {
        alert(data.error || 'Failed to save item');
      }
    } catch (error) {
      alert('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!id || isNew) return;

    try {
      const response = await fetch(`${API_URL}/api/marketplace/seller/items/${id}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert(t('seller.submittedForReview', 'Item submitted for review!'));
        navigate('/seller/items');
      } else {
        alert(data.error || 'Failed to submit');
      }
    } catch (error) {
      alert('Failed to submit for review');
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <button style={styles.backButton} onClick={() => navigate('/seller/items')}>
            ← {t('common.back', 'Back')}
          </button>
          <h1 style={styles.title}>
            {isNew ? t('seller.createItem', 'Create Item') : t('seller.editItem', 'Edit Item')}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGrid}>
          {/* Left Column - Main Info */}
          <div style={styles.formColumn}>
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>{t('seller.basicInfo', 'Basic Information')}</h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.type', 'Type')} *</label>
                <select
                  value={form.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  style={styles.select}
                >
                  <option value="plugin">{t('marketplace.plugin', 'Plugin')}</option>
                  <option value="template">{t('marketplace.template', 'Template')}</option>
                  <option value="integration">{t('marketplace.integration', 'Integration')}</option>
                  <option value="theme">{t('marketplace.theme', 'Theme')}</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.name', 'Name')} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  style={styles.input}
                  placeholder={t('seller.namePlaceholder', 'Enter item name')}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.shortDescription', 'Short Description')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  style={styles.textarea}
                  rows={2}
                  placeholder={t('seller.shortDescPlaceholder', 'Brief description (max 200 chars)')}
                  maxLength={200}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.longDescription', 'Long Description')}</label>
                <textarea
                  value={form.long_description}
                  onChange={(e) => handleChange('long_description', e.target.value)}
                  style={styles.textarea}
                  rows={6}
                  placeholder={t('seller.longDescPlaceholder', 'Detailed description of your item...')}
                />
              </div>
            </section>

            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>{t('seller.pricing', 'Pricing')}</h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.priceType', 'Price Type')}</label>
                <select
                  value={form.price_type}
                  onChange={(e) => handleChange('price_type', e.target.value)}
                  style={styles.select}
                >
                  <option value="free">{t('marketplace.free', 'Free')}</option>
                  <option value="one_time">{t('marketplace.oneTime', 'One-time Purchase')}</option>
                  <option value="subscription">{t('marketplace.subscription', 'Subscription')}</option>
                </select>
              </div>

              {form.price_type !== 'free' && (
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('seller.price', 'Price')}</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                      style={styles.input}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t('seller.currency', 'Currency')}</label>
                    <select
                      value={form.currency}
                      onChange={(e) => handleChange('currency', e.target.value)}
                      style={styles.select}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
              )}

              <p style={styles.hint}>
                {t('seller.platformFee', 'Platform fee: 30% of sales price')}
              </p>
            </section>

            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>{t('seller.media', 'Media')}</h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.iconUrl', 'Icon URL')}</label>
                <input
                  type="url"
                  value={form.icon_url}
                  onChange={(e) => handleChange('icon_url', e.target.value)}
                  style={styles.input}
                  placeholder="https://..."
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.demoUrl', 'Demo URL')}</label>
                <input
                  type="url"
                  value={form.demo_url}
                  onChange={(e) => handleChange('demo_url', e.target.value)}
                  style={styles.input}
                  placeholder="https://..."
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.screenshots', 'Screenshots')}</label>
                <div style={styles.screenshotsList}>
                  {form.screenshots.map((url, idx) => (
                    <div key={idx} style={styles.screenshotItem}>
                      <img src={url} alt={`Screenshot ${idx + 1}`} style={styles.screenshotPreview} />
                      <button
                        type="button"
                        style={styles.removeButton}
                        onClick={() => handleRemoveScreenshot(idx)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" style={styles.addButton} onClick={handleAddScreenshot}>
                    + {t('seller.addScreenshot', 'Add Screenshot')}
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column - Categories & Tags */}
          <div style={styles.formColumn}>
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>{t('seller.technical', 'Technical Details')}</h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.version', 'Version')}</label>
                <input
                  type="text"
                  value={form.version}
                  onChange={(e) => handleChange('version', e.target.value)}
                  style={styles.input}
                  placeholder="1.0.0"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.minPlatformVersion', 'Min Platform Version')}</label>
                <input
                  type="text"
                  value={form.min_platform_version}
                  onChange={(e) => handleChange('min_platform_version', e.target.value)}
                  style={styles.input}
                  placeholder="1.0.0"
                />
              </div>
            </section>

            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>{t('seller.categories', 'Categories')}</h2>
              <div style={styles.categoriesGrid}>
                {categories.map(cat => (
                  <label key={cat.slug} style={styles.categoryCheckbox}>
                    <input
                      type="checkbox"
                      checked={form.categories.includes(cat.slug)}
                      onChange={() => handleCategoryToggle(cat.slug)}
                    />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>{t('seller.tags', 'Tags')}</h2>
              <div style={styles.tagsInput}>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  style={styles.tagInput}
                  placeholder={t('seller.addTag', 'Add tag...')}
                />
                <button type="button" style={styles.addTagButton} onClick={handleAddTag}>
                  +
                </button>
              </div>
              <div style={styles.tagsList}>
                {form.tags.map(tag => (
                  <span key={tag} style={styles.tag}>
                    {tag}
                    <button type="button" style={styles.removeTagButton} onClick={() => handleRemoveTag(tag)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button type="button" style={styles.cancelButton} onClick={() => navigate('/seller/items')}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="submit" style={styles.saveButton} disabled={saving}>
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
          {!isNew && (
            <button type="button" style={styles.submitButton} onClick={handleSubmitForReview}>
              {t('seller.submitForReview', 'Submit for Review')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '100px 20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  header: {
    marginBottom: '24px'
  },
  backButton: {
    padding: '0',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#3b82f6',
    fontSize: '14px',
    cursor: 'pointer',
    marginBottom: '8px'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  form: {},
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '24px'
  },
  formColumn: {},
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px'
  },
  sectionTitle: {
    margin: '0 0 20px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  formGroup: {
    marginBottom: '16px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: 'white'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  hint: {
    margin: '8px 0 0 0',
    fontSize: '12px',
    color: '#6b7280'
  },
  screenshotsList: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  screenshotItem: {
    position: 'relative'
  },
  screenshotPreview: {
    width: '100px',
    height: '60px',
    objectFit: 'cover',
    borderRadius: '6px',
    border: '1px solid #e5e7eb'
  },
  removeButton: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    width: '20px',
    height: '20px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: '1px dashed #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px'
  },
  categoryCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  tagsInput: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  tagInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px'
  },
  addTagButton: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer'
  },
  tagsList: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: '#eff6ff',
    color: '#3b82f6',
    borderRadius: '4px',
    fontSize: '13px'
  },
  removeTagButton: {
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
    color: '#3b82f6',
    fontSize: '16px',
    cursor: 'pointer'
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
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  saveButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  submitButton: {
    padding: '12px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }
};

export default SellerItemEditor;
