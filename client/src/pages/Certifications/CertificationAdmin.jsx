import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Edit,
  Trash2,
  Eye,
  Save,
  X,
  BookOpen,
  HelpCircle,
  Settings
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CertificationAdmin() {
  const [loading, setLoading] = useState(true);
  const [certifications, setCertifications] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    level: 'beginner',
    required_score: 70,
    time_limit: 60,
    questions_count: 20,
    price: 0,
    badge_color: '#3B82F6',
    validity_months: 24,
    category: '',
    skills: [],
    status: 'draft'
  });

  useEffect(() => {
    fetchCertifications();
  }, []);

  const fetchCertifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/certifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setCertifications(data.certifications);
      }
    } catch (err) {
      setError('Failed to load certifications');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const url = selectedCert
        ? `${API_BASE}/api/certifications/admin/${selectedCert.id}`
        : `${API_BASE}/api/certifications/admin`;

      const response = await fetch(url, {
        method: selectedCert ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(selectedCert ? 'Certification updated' : 'Certification created');
        fetchCertifications();
        if (!selectedCert) {
          setSelectedCert(data.certification);
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to save certification');
    }
  };

  const handleAddQuestion = async (questionData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/certifications/admin/${selectedCert.id}/questions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(questionData)
        }
      );

      const data = await response.json();

      if (data.success) {
        setQuestions([...questions, data.question]);
        setSuccess('Question added');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to add question');
    }
  };

  const selectCertification = (cert) => {
    setSelectedCert(cert);
    setFormData({
      name: cert.name,
      slug: cert.slug,
      description: cert.description || '',
      level: cert.level,
      required_score: cert.required_score,
      time_limit: cert.time_limit,
      questions_count: cert.questions_count,
      price: cert.price,
      badge_color: cert.badge_color,
      validity_months: cert.validity_months,
      category: cert.category || '',
      skills: cert.skills || [],
      status: cert.status
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setSelectedCert(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      level: 'beginner',
      required_score: 70,
      time_limit: 60,
      questions_count: 20,
      price: 0,
      badge_color: '#3B82F6',
      validity_months: 24,
      category: '',
      skills: [],
      status: 'draft'
    });
    setShowForm(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Certification Admin</h1>
          <p className="text-gray-400 mt-1">Manage certifications and exam questions</p>
        </div>
        <button
          onClick={resetForm}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Certification
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Certifications List */}
        <div className="lg:col-span-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-white font-medium">Certifications</h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400">Loading...</div>
            ) : certifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400">No certifications</div>
            ) : (
              <div className="divide-y divide-gray-700">
                {certifications.map((cert) => (
                  <button
                    key={cert.id}
                    onClick={() => selectCertification(cert)}
                    className={`w-full p-4 text-left hover:bg-gray-700/50 transition-colors ${
                      selectedCert?.id === cert.id ? 'bg-gray-700/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Award className="w-5 h-5" style={{ color: cert.badge_color }} />
                      <div>
                        <p className="text-white font-medium">{cert.name}</p>
                        <p className="text-gray-400 text-sm capitalize">
                          {cert.level} - {cert.status}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Form / Details */}
        <div className="lg:col-span-2">
          {showForm ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              {/* Tabs */}
              <div className="border-b border-gray-700 px-4">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'details'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-gray-400'
                    }`}
                  >
                    <Settings className="w-4 h-4 inline mr-2" />
                    Details
                  </button>
                  {selectedCert && (
                    <button
                      onClick={() => setActiveTab('questions')}
                      className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'questions'
                          ? 'border-blue-500 text-blue-400'
                          : 'border-transparent text-gray-400'
                      }`}
                    >
                      <HelpCircle className="w-4 h-4 inline mr-2" />
                      Questions
                    </button>
                  )}
                </div>
              </div>

              {activeTab === 'details' ? (
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Slug *</label>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Level</label>
                      <select
                        value={formData.level}
                        onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Category</label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Time (min)</label>
                      <input
                        type="number"
                        value={formData.time_limit}
                        onChange={(e) => setFormData({ ...formData, time_limit: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Questions</label>
                      <input
                        type="number"
                        value={formData.questions_count}
                        onChange={(e) => setFormData({ ...formData, questions_count: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Pass Score (%)</label>
                      <input
                        type="number"
                        value={formData.required_score}
                        onChange={(e) => setFormData({ ...formData, required_score: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Badge Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.badge_color}
                          onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.badge_color}
                          onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                          className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">Validity (months)</label>
                      <input
                        type="number"
                        value={formData.validity_months}
                        onChange={(e) => setFormData({ ...formData, validity_months: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Save className="w-4 h-4" />
                      {selectedCert ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-6">
                  <QuestionManager
                    certificationId={selectedCert?.id}
                    onAddQuestion={handleAddQuestion}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
              <Award className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                Select a certification to edit or create a new one
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionManager({ certificationId, onAddQuestion }) {
  const [questions, setQuestions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    question: '',
    question_type: 'single',
    options: ['', '', '', ''],
    correct_answer: '',
    explanation: '',
    points: 1
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    const data = {
      ...formData,
      options: formData.options.filter(o => o.trim()),
      correct_answer: formData.question_type === 'multiple'
        ? formData.correct_answer.split(',').map(a => a.trim())
        : formData.correct_answer
    };

    onAddQuestion(data);
    setFormData({
      question: '',
      question_type: 'single',
      options: ['', '', '', ''],
      correct_answer: '',
      explanation: '',
      points: 1
    });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Questions</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-700/50 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Question *</label>
            <textarea
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Type</label>
              <select
                value={formData.question_type}
                onChange={(e) => setFormData({ ...formData, question_type: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="single">Single Choice</option>
                <option value="multiple">Multiple Choice</option>
                <option value="code">Code</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Points</label>
              <input
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>
          </div>

          {(formData.question_type === 'single' || formData.question_type === 'multiple') && (
            <div>
              <label className="block text-gray-400 text-sm mb-2">Options</label>
              {formData.options.map((option, index) => (
                <input
                  key={index}
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...formData.options];
                    newOptions[index] = e.target.value;
                    setFormData({ ...formData, options: newOptions });
                  }}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-2"
                  placeholder={`Option ${index + 1}`}
                />
              ))}
            </div>
          )}

          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Correct Answer {formData.question_type === 'multiple' && '(comma separated)'}
            </label>
            <input
              type="text"
              value={formData.correct_answer}
              onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Explanation</label>
            <textarea
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Add Question
            </button>
          </div>
        </form>
      )}

      <p className="text-gray-400 text-sm">
        Questions are saved automatically. Add questions to build your certification exam.
      </p>
    </div>
  );
}
