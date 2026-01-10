import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Download,
  Share2,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function MyCertifications() {
  const [loading, setLoading] = useState(true);
  const [certifications, setCertifications] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [activeTab, setActiveTab] = useState('certificates');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');

      const [certsResponse, attemptsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/certifications/my/certificates`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/certifications/my/attempts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const certsData = await certsResponse.json();
      const attemptsData = await attemptsResponse.json();

      if (certsData.success) {
        setCertifications(certsData.certifications);
      }
      if (attemptsData.success) {
        setAttempts(attemptsData.attempts);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (cert) => {
    if (cert.is_revoked) {
      return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">Revoked</span>;
    }
    if (cert.is_expired) {
      return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">Expired</span>;
    }
    return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">Active</span>;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Certifications</h1>
        <p className="text-gray-400 mt-1">View and manage your earned certifications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Certifications</p>
          <p className="text-2xl font-bold text-white mt-1">{certifications.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Active</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {certifications.filter(c => c.is_valid).length}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Attempts</p>
          <p className="text-2xl font-bold text-white mt-1">{attempts.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Pass Rate</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {attempts.length > 0
              ? Math.round((attempts.filter(a => a.passed).length / attempts.length) * 100)
              : 0}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('certificates')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'certificates'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Certificates ({certifications.length})
          </button>
          <button
            onClick={() => setActiveTab('attempts')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'attempts'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Exam History ({attempts.length})
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'certificates' ? (
        certifications.length === 0 ? (
          <div className="text-center py-12">
            <Award className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">You haven't earned any certifications yet</p>
            <Link
              to="/certifications"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Browse Certifications
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certifications.map((cert) => (
              <div
                key={cert.id}
                className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
              >
                <div
                  className="h-24 flex items-center justify-center"
                  style={{ backgroundColor: cert.badge_color + '20' }}
                >
                  {cert.badge_image ? (
                    <img src={cert.badge_image} alt="" className="h-16" />
                  ) : (
                    <Award className="w-16 h-16" style={{ color: cert.badge_color }} />
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">{cert.certification_name}</h3>
                    {getStatusBadge(cert)}
                  </div>

                  <div className="space-y-2 text-sm text-gray-400 mb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>Score: {cert.score}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Issued: {formatDate(cert.issued_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Expires: {formatDate(cert.expires_at)}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 font-mono mb-4">
                    {cert.certificate_number}
                  </div>

                  <div className="flex gap-2">
                    <Link
                      to={`/certifications/verify/${cert.certificate_number}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View
                    </Link>
                    <button className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
                      <Download className="w-4 h-4" />
                    </button>
                    <button className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        attempts.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No exam attempts yet</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Certification
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Result
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Award className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-white font-medium">{attempt.certification_name}</p>
                          <p className="text-gray-500 text-sm capitalize">{attempt.level}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-white font-medium">{attempt.score || 0}%</span>
                    </td>
                    <td className="px-4 py-4">
                      {attempt.status === 'completed' ? (
                        attempt.passed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                            <CheckCircle className="w-3 h-3" />
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
                            <XCircle className="w-3 h-3" />
                            Failed
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
                          <AlertCircle className="w-3 h-3" />
                          {attempt.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-400 text-sm">
                      {attempt.completed_at
                        ? formatDate(attempt.completed_at)
                        : formatDate(attempt.started_at)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {attempt.status === 'completed' && (
                        <Link
                          to={`/certifications/${attempt.slug}/results/${attempt.id}`}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          View Details
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
