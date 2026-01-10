import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const CATEGORIES = ['news', 'tutorial', 'case-study', 'announcement'];
const STATUSES = ['draft', 'published', 'archived'];

function BlogAdmin() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    category: 'news',
    tags: '',
    featuredImage: '',
    metaTitle: '',
    metaDescription: '',
    status: 'draft'
  });

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/blog/admin/blog', {
        params: { status: statusFilter || undefined }
      });
      setPosts(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const resetForm = () => {
    setForm({
      title: '',
      content: '',
      excerpt: '',
      category: 'news',
      tags: '',
      featuredImage: '',
      metaTitle: '',
      metaDescription: '',
      status: 'draft'
    });
    setEditingPost(null);
  };

  const handleEdit = (post) => {
    const tags = typeof post.tags === 'string' ? JSON.parse(post.tags) : post.tags;
    setForm({
      title: post.title || '',
      content: post.content || '',
      excerpt: post.excerpt || '',
      category: post.category || 'news',
      tags: Array.isArray(tags) ? tags.join(', ') : '',
      featuredImage: post.featured_image || '',
      metaTitle: post.meta_title || '',
      metaDescription: post.meta_description || '',
      status: post.status || 'draft'
    });
    setEditingPost(post);
    setShowEditor(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      alert('Title and content are required');
      return;
    }

    try {
      setSaving(true);
      const data = {
        title: form.title,
        content: form.content,
        excerpt: form.excerpt,
        category: form.category,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        featuredImage: form.featuredImage,
        metaTitle: form.metaTitle,
        metaDescription: form.metaDescription,
        status: form.status
      };

      if (editingPost) {
        await axios.put(`/api/blog/admin/blog/${editingPost.id}`, data);
      } else {
        await axios.post('/api/blog/admin/blog', data);
      }

      fetchPosts();
      setShowEditor(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save post:', error);
      alert('Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      await axios.delete(`/api/blog/admin/blog/${postId}`);
      fetchPosts();
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Blog Admin</h1>
        <button
          onClick={() => { resetForm(); setShowEditor(true); }}
          style={styles.createBtn}
        >
          + Create Post
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={styles.select}
        >
          <option value="">All Status</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Posts Table */}
      {loading ? (
        <div style={styles.loading}>Loading posts...</div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Title</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Author</th>
                <th style={styles.th}>Views</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id}>
                  <td style={styles.td}>
                    <div style={styles.postTitle}>{post.title}</div>
                    <div style={styles.postSlug}>/blog/{post.slug}</div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.categoryBadge}>{post.category}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: post.status === 'published' ? '#dcfce7' :
                                      post.status === 'draft' ? '#fef3c7' : '#fee2e2',
                      color: post.status === 'published' ? '#16a34a' :
                             post.status === 'draft' ? '#d97706' : '#dc2626'
                    }}>
                      {post.status}
                    </span>
                  </td>
                  <td style={styles.td}>{post.author_name}</td>
                  <td style={styles.td}>{post.views_count}</td>
                  <td style={styles.td}>{formatDate(post.created_at)}</td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button
                        onClick={() => handleEdit(post)}
                        style={styles.editBtn}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        style={styles.deleteBtn}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h2>{editingPost ? 'Edit Post' : 'Create Post'}</h2>
              <button onClick={() => setShowEditor(false)} style={styles.closeBtn}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Content *</label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    style={styles.textarea}
                    rows={10}
                    required
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Excerpt</label>
                  <textarea
                    value={form.excerpt}
                    onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                    style={styles.textareaSmall}
                    rows={3}
                  />
                </div>
              </div>

              <div style={styles.formRowGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={styles.select}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    style={styles.select}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    style={styles.input}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Featured Image URL</label>
                  <input
                    type="text"
                    value={form.featuredImage}
                    onChange={(e) => setForm({ ...form, featuredImage: e.target.value })}
                    style={styles.input}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div style={styles.formRowGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Meta Title</label>
                  <input
                    type="text"
                    value={form.metaTitle}
                    onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Meta Description</label>
                  <input
                    type="text"
                    value={form.metaDescription}
                    onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formActions}>
                <button type="button" onClick={() => setShowEditor(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={styles.saveBtn}>
                  {saving ? 'Saving...' : (editingPost ? 'Update Post' : 'Create Post')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  createBtn: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  filters: {
    marginBottom: '24px'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '14px'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280'
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
    borderBottom: '1px solid #e5e7eb'
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    borderBottom: '1px solid #f3f4f6'
  },
  postTitle: {
    fontWeight: '500',
    color: '#111827'
  },
  postSlug: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '2px'
  },
  categoryBadge: {
    padding: '2px 8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    fontSize: '12px'
  },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  editBtn: {
    padding: '4px 12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  deleteBtn: {
    padding: '4px 12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280'
  },
  form: {
    padding: '24px'
  },
  formRow: {
    marginBottom: '20px'
  },
  formRowGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '20px'
  },
  formGroup: {},
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '6px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'monospace'
  },
  textareaSmall: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb'
  },
  cancelBtn: {
    padding: '10px 20px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  saveBtn: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  }
};

export default BlogAdmin;
