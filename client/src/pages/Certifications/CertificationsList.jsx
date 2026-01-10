import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Search,
  Clock,
  Users,
  Star,
  CheckCircle,
  ArrowRight,
  Filter,
  BookOpen
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CertificationsList() {
  const [loading, setLoading] = useState(true);
  const [certifications, setCertifications] = useState([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCertifications();
  }, [levelFilter]);

  const fetchCertifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        ...(levelFilter && { level: levelFilter }),
        ...(search && { search })
      });

      const response = await fetch(`${API_BASE}/api/certifications?${params}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await response.json();

      if (data.success) {
        setCertifications(data.certifications);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load certifications');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCertifications();
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'beginner': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'intermediate': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'advanced': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'expert': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getLevelIcon = (level) => {
    const stars = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4
    };
    return Array(stars[level] || 1).fill(0).map((_, i) => (
      <Star key={i} className="w-3 h-3 fill-current" />
    ));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full text-blue-400 mb-4">
          <Award className="w-4 h-4" />
          <span>BotBuilder Certification Program</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">
          Prove Your Expertise
        </h1>
        <p className="text-gray-400">
          Earn industry-recognized certifications and showcase your skills
          in chatbot development and AI integration.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 max-w-4xl mx-auto">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search certifications..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </form>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-4xl mx-auto bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Certifications Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      ) : certifications.length === 0 ? (
        <div className="text-center py-12">
          <Award className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No certifications found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {certifications.map((cert) => (
            <div
              key={cert.id}
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
            >
              {/* Badge Header */}
              <div
                className="h-24 flex items-center justify-center"
                style={{ backgroundColor: cert.badge_color + '20' }}
              >
                {cert.badge_image ? (
                  <img src={cert.badge_image} alt={cert.name} className="h-16 w-16" />
                ) : (
                  <Award className="w-16 h-16" style={{ color: cert.badge_color }} />
                )}
              </div>

              <div className="p-5">
                {/* Level Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getLevelColor(cert.level)}`}>
                    {getLevelIcon(cert.level)}
                    <span className="capitalize">{cert.level}</span>
                  </span>

                  {cert.user_status?.certified && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                      <CheckCircle className="w-3 h-3" />
                      Certified
                    </span>
                  )}
                </div>

                {/* Title & Description */}
                <h3 className="text-lg font-semibold text-white mb-2">{cert.name}</h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {cert.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{cert.time_limit} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    <span>{cert.questions_count} questions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{cert.holders_count}</span>
                  </div>
                </div>

                {/* Price & Action */}
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">
                    {cert.price > 0 ? `$${cert.price}` : 'Free'}
                  </span>
                  <Link
                    to={`/certifications/${cert.slug}`}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    View Details
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Benefits Section */}
      <div className="max-w-4xl mx-auto mt-12 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-8 border border-blue-500/30">
        <h2 className="text-xl font-bold text-white mb-6 text-center">
          Why Get Certified?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="p-3 bg-blue-500/20 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
              <Award className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-white font-medium mb-1">Industry Recognition</h3>
            <p className="text-gray-400 text-sm">
              Validate your skills with credentials recognized by employers
            </p>
          </div>
          <div className="text-center">
            <div className="p-3 bg-purple-500/20 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-white font-medium mb-1">Career Advancement</h3>
            <p className="text-gray-400 text-sm">
              Stand out in the job market and unlock new opportunities
            </p>
          </div>
          <div className="text-center">
            <div className="p-3 bg-green-500/20 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-white font-medium mb-1">Verified Expertise</h3>
            <p className="text-gray-400 text-sm">
              Digital badges that can be shared on LinkedIn and portfolios
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
