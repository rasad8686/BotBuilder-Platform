import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' }
];

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' }
];

function TutorialAdmin() {
  const navigate = useNavigate();
  const [tutorials, setTutorials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [filter, setFilter] = useState({ status: '', page: 1 });

  const [form, setForm] = useState({
    title: '',
    description: '',
    difficulty: 'beginner',
    estimatedTime: 30,
    prerequisites: [],
    seriesId: '',
    seriesOrder: '',
    status: 'draft',
    steps: [{ title: '', content: '', codeSnippet: '', codeLanguage: 'javascript' }]
  });

  const fetchTutorials = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/blog/admin/tutorials', {
        params: { page: filter.page, status: filter.status || undefined }
      });
      setTutorials(response.data.data || []);
      setPagination(response.data.pagination || { page: 1, pages: 1 });
    } catch (error) {
      console.error('Failed to fetch tutorials:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTutorials();
  }, [fetchTutorials]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        seriesId: form.seriesId ? parseInt(form.seriesId) : null,
        seriesOrder: form.seriesOrder ? parseInt(form.seriesOrder) : null,
        estimatedTime: parseInt(form.estimatedTime)
      };

      if (editingTutorial) {
        await axios.put(`/api/blog/admin/tutorials/${editingTutorial.id}`, payload);
      } else {
        await axios.post('/api/blog/admin/tutorials', payload);
      }

      setShowForm(false);
      setEditingTutorial(null);
      resetForm();
      fetchTutorials();
    } catch (error) {
      console.error('Failed to save tutorial:', error);
      alert('Failed to save tutorial');
    }
  };

  const handleEdit = (tutorial) => {
    setEditingTutorial(tutorial);
    setForm({
      title: tutorial.title || '',
      description: tutorial.description || '',
      difficulty: tutorial.difficulty || 'beginner',
      estimatedTime: tutorial.estimated_time || 30,
      prerequisites: typeof tutorial.prerequisites === 'string'
        ? JSON.parse(tutorial.prerequisites)
        : tutorial.prerequisites || [],
      seriesId: tutorial.series_id || '',
      seriesOrder: tutorial.series_order || '',
      status: tutorial.status || 'draft',
      steps: tutorial.steps || [{ title: '', content: '', codeSnippet: '', codeLanguage: 'javascript' }]
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this tutorial?')) return;
    try {
      await axios.delete(`/api/blog/admin/tutorials/${id}`);
      fetchTutorials();
    } catch (error) {
      console.error('Failed to delete tutorial:', error);
      alert('Failed to delete tutorial');
    }
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      difficulty: 'beginner',
      estimatedTime: 30,
      prerequisites: [],
      seriesId: '',
      seriesOrder: '',
      status: 'draft',
      steps: [{ title: '', content: '', codeSnippet: '', codeLanguage: 'javascript' }]
    });
  };

  const addStep = () => {
    setForm({
      ...form,
      steps: [...form.steps, { title: '', content: '', codeSnippet: '', codeLanguage: 'javascript' }]
    });
  };

  const removeStep = (index) => {
    if (form.steps.length <= 1) return;
    setForm({
      ...form,
      steps: form.steps.filter((_, i) => i !== index)
    });
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...form.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setForm({ ...form, steps: newSteps });
  };

  const moveStep = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= form.steps.length) return;
    const newSteps = [...form.steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setForm({ ...form, steps: newSteps });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Tutorial Management</h1>
        <button
          onClick={() => { setShowForm(true); setEditingTutorial(null); resetForm(); }}
          style={styles.primaryBtn}
        >
          + New Tutorial
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value, page: 1 })}
          style={styles.select}
        >
          <option value="">All Status</option>
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Tutorial List */}
      {loading ? (
        <div style={styles.loading}>Loading tutorials...</div>
      ) : tutorials.length === 0 ? (
        <div style={styles.empty}>No tutorials found</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Title</th>
                <th style={styles.th}>Difficulty</th>
                <th style={styles.th}>Time</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Views</th>
                <th style={styles.th}>Completions</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tutorials.map(tutorial => (
                <tr key={tutorial.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.tutorialTitle}>{tutorial.title}</div>
                    <div style={styles.tutorialSlug}>/tutorials/{tutorial.slug}</div>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      backgroundColor:
                        tutorial.difficulty === 'beginner' ? '#d1fae5' :
                        tutorial.difficulty === 'intermediate' ? '#fef3c7' : '#fee2e2',
                      color:
                        tutorial.difficulty === 'beginner' ? '#065f46' :
                        tutorial.difficulty === 'intermediate' ? '#92400e' : '#991b1b'
                    }}>
                      {tutorial.difficulty}
                    </span>
                  </td>
                  <td style={styles.td}>{tutorial.estimated_time} min</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: tutorial.status === 'published' ? '#d1fae5' : '#f3f4f6',
                      color: tutorial.status === 'published' ? '#065f46' : '#374151'
                    }}>
                      {tutorial.status}
                    </span>
                  </td>
                  <td style={styles.td}>{tutorial.views_count || 0}</td>
                  <td style={styles.td}>{tutorial.completions_count || 0}</td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button
                        onClick={() => navigate(`/tutorials/${tutorial.slug}`)}
                        style={styles.actionBtn}
                        title="View"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(tutorial)}
                        style={styles.actionBtn}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(tutorial.id)}
                        style={{ ...styles.actionBtn, color: '#dc2626' }}
                        title="Delete"
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

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={() => setFilter({ ...filter, page: filter.page - 1 })}
            disabled={filter.page <= 1}
            style={styles.pageBtn}
          >
            Previous
          </button>
          <span>Page {filter.page} of {pagination.pages}</span>
          <button
            onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
            disabled={filter.page >= pagination.pages}
            style={styles.pageBtn}
          >
            Next
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingTutorial ? 'Edit Tutorial' : 'New Tutorial'}
              </h2>
              <button onClick={() => setShowForm(false)} style={styles.closeBtn}>X</button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    style={styles.input}
                    placeholder="Tutorial title"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Difficulty</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                    style={styles.input}
                  >
                    {DIFFICULTIES.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Estimated Time (minutes)</label>
                  <input
                    type="number"
                    value={form.estimatedTime}
                    onChange={(e) => setForm({ ...form, estimatedTime: e.target.value })}
                    min="1"
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    style={styles.input}
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Series ID (optional)</label>
                  <input
                    type="number"
                    value={form.seriesId}
                    onChange={(e) => setForm({ ...form, seriesId: e.target.value })}
                    style={styles.input}
                    placeholder="1, 2, 3..."
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Series Order (optional)</label>
                  <input
                    type="number"
                    value={form.seriesOrder}
                    onChange={(e) => setForm({ ...form, seriesOrder: e.target.value })}
                    style={styles.input}
                    placeholder="1, 2, 3..."
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ ...styles.input, minHeight: '100px' }}
                  placeholder="Tutorial description..."
                />
              </div>

              {/* Steps */}
              <div style={styles.stepsSection}>
                <div style={styles.stepsSectionHeader}>
                  <h3 style={styles.stepsTitle}>Tutorial Steps</h3>
                  <button type="button" onClick={addStep} style={styles.addStepBtn}>
                    + Add Step
                  </button>
                </div>

                {form.steps.map((step, index) => (
                  <div key={index} style={styles.stepCard}>
                    <div style={styles.stepHeader}>
                      <span style={styles.stepNumber}>Step {index + 1}</span>
                      <div style={styles.stepActions}>
                        <button
                          type="button"
                          onClick={() => moveStep(index, -1)}
                          disabled={index === 0}
                          style={styles.stepMoveBtn}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(index, 1)}
                          disabled={index === form.steps.length - 1}
                          style={styles.stepMoveBtn}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(index)}
                          style={styles.stepRemoveBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => updateStep(index, 'title', e.target.value)}
                      placeholder="Step title"
                      style={styles.input}
                    />

                    <textarea
                      value={step.content}
                      onChange={(e) => updateStep(index, 'content', e.target.value)}
                      placeholder="Step content (supports markdown)"
                      style={{ ...styles.input, minHeight: '100px', marginTop: '8px' }}
                    />

                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <select
                        value={step.codeLanguage}
                        onChange={(e) => updateStep(index, 'codeLanguage', e.target.value)}
                        style={{ ...styles.input, width: '150px' }}
                      >
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="typescript">TypeScript</option>
                        <option value="json">JSON</option>
                        <option value="bash">Bash</option>
                        <option value="html">HTML</option>
                        <option value="css">CSS</option>
                      </select>
                      <textarea
                        value={step.codeSnippet}
                        onChange={(e) => updateStep(index, 'codeSnippet', e.target.value)}
                        placeholder="Code snippet (optional)"
                        style={{ ...styles.input, flex: 1, minHeight: '80px', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.formActions}>
                <button type="button" onClick={() => setShowForm(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn}>
                  {editingTutorial ? 'Update Tutorial' : 'Create Tutorial'}
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
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
    color: '#111827',
    margin: 0
  },
  primaryBtn: {
    padding: '10px 20px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  filters: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '14px',
    minWidth: '150px'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280'
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    borderRadius: '8px'
  },
  tableWrapper: {
    overflowX: 'auto',
    backgroundColor: 'white',
    borderRadius: '8px',
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
    borderBottom: '1px solid #e5e7eb',
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase'
  },
  tr: {
    borderBottom: '1px solid #e5e7eb'
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#374151'
  },
  tutorialTitle: {
    fontWeight: '600',
    color: '#111827'
  },
  tutorialSlug: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '2px'
  },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  actionBtn: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: '13px'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '20px'
  },
  pageBtn: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    borderRadius: '6px',
    cursor: 'pointer'
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
    zIndex: 1000,
    padding: '20px'
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '900px',
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
  modalTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: 0
  },
  closeBtn: {
    width: '32px',
    height: '32px',
    border: 'none',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  form: {
    padding: '24px'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  },
  formGroup: {
    marginBottom: '16px'
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
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  stepsSection: {
    marginTop: '24px',
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px'
  },
  stepsSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  stepsTitle: {
    fontSize: '16px',
    fontWeight: '600',
    margin: 0
  },
  addStepBtn: {
    padding: '6px 12px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  stepCard: {
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '12px',
    border: '1px solid #e5e7eb'
  },
  stepHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  stepNumber: {
    fontWeight: '600',
    color: '#8b5cf6'
  },
  stepActions: {
    display: 'flex',
    gap: '8px'
  },
  stepMoveBtn: {
    padding: '4px 8px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  stepRemoveBtn: {
    padding: '4px 8px',
    border: 'none',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
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
  submitBtn: {
    padding: '10px 20px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  }
};

export default TutorialAdmin;
