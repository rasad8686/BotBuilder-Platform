import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Award,
  Clock,
  BookOpen,
  Users,
  Star,
  CheckCircle,
  ArrowRight,
  Play,
  FileText,
  Target,
  Calendar,
  AlertCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CertificationDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [certification, setCertification] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetchCertification();
  }, [slug]);

  const fetchCertification = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/certifications/${slug}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await response.json();

      if (data.success) {
        setCertification(data.certification);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load certification');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login?redirect=/certifications/' + slug);
      return;
    }

    setStarting(true);
    try {
      const response = await fetch(`${API_BASE}/api/certifications/${slug}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        navigate(`/certifications/${slug}/exam`, { state: { examData: data } });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to start exam');
    } finally {
      setStarting(false);
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'beginner': return 'bg-green-500/20 text-green-400';
      case 'intermediate': return 'bg-blue-500/20 text-blue-400';
      case 'advanced': return 'bg-purple-500/20 text-purple-400';
      case 'expert': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !certification) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error || 'Certification not found'}
        </div>
      </div>
    );
  }

  const isCertified = certification.user_status?.is_certified;
  const hasAttempts = certification.user_status?.attempts?.length > 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/certifications" className="hover:text-white">Certifications</Link>
        <span>/</span>
        <span className="text-white">{certification.name}</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm ${getLevelColor(certification.level)}`}>
              {certification.level}
            </span>
            {isCertified && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                <CheckCircle className="w-4 h-4" />
                You're Certified
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-white">{certification.name}</h1>
          <p className="text-gray-400 text-lg">{certification.description}</p>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-6 pt-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Clock className="w-5 h-5" />
              <span>{certification.time_limit} minutes</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <BookOpen className="w-5 h-5" />
              <span>{certification.questions_count} questions</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Target className="w-5 h-5" />
              <span>{certification.required_score}% to pass</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Users className="w-5 h-5" />
              <span>{certification.holders_count} certified</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Calendar className="w-5 h-5" />
              <span>Valid for {certification.validity_months} months</span>
            </div>
          </div>
        </div>

        {/* Action Card */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div
            className="h-32 rounded-lg flex items-center justify-center mb-6"
            style={{ backgroundColor: certification.badge_color + '20' }}
          >
            {certification.badge_image ? (
              <img src={certification.badge_image} alt="" className="h-20" />
            ) : (
              <Award className="w-20 h-20" style={{ color: certification.badge_color }} />
            )}
          </div>

          <div className="text-center mb-6">
            <p className="text-3xl font-bold text-white">
              {certification.price > 0 ? `$${certification.price}` : 'Free'}
            </p>
            <p className="text-gray-400 text-sm">One-time fee</p>
          </div>

          {isCertified ? (
            <div className="space-y-3">
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
                <p className="text-green-400 font-medium">Certified</p>
                <p className="text-gray-400 text-sm">
                  Expires {new Date(certification.user_status.certificate.expires_at).toLocaleDateString()}
                </p>
              </div>
              <Link
                to="/certifications/my"
                className="block w-full py-3 bg-gray-700 text-white rounded-lg text-center hover:bg-gray-600"
              >
                View Certificate
              </Link>
            </div>
          ) : (
            <button
              onClick={handleStartExam}
              disabled={starting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {starting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Start Exam
                </>
              )}
            </button>
          )}

          {hasAttempts && !isCertified && (
            <p className="text-gray-400 text-sm text-center mt-3">
              Previous attempts: {certification.user_status.attempts.length}
            </p>
          )}
        </div>
      </div>

      {/* Study Guide */}
      {certification.study_guides?.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Study Guide
          </h2>
          <div className="space-y-3">
            {certification.study_guides.map((guide, index) => (
              <Link
                key={guide.id}
                to={`/certifications/${slug}/study-guide#section-${guide.id}`}
                className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-sm">
                    {index + 1}
                  </span>
                  <span className="text-white">{guide.title}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{guide.estimated_time} min</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
          <Link
            to={`/certifications/${slug}/study-guide`}
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mt-4"
          >
            View Complete Study Guide
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Skills Covered */}
      {certification.skills?.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Skills Covered</h2>
          <div className="flex flex-wrap gap-2">
            {certification.skills.map((skill, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Previous Attempts */}
      {hasAttempts && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Your Attempts</h2>
          <div className="space-y-3">
            {certification.user_status.attempts.map((attempt) => (
              <Link
                key={attempt.id}
                to={`/certifications/${slug}/results/${attempt.id}`}
                className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700"
              >
                <div className="flex items-center gap-3">
                  {attempt.passed ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  <div>
                    <p className="text-white">
                      {attempt.passed ? 'Passed' : 'Failed'} - {attempt.score}%
                    </p>
                    <p className="text-gray-400 text-sm">
                      {new Date(attempt.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Exam Info */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
        <h3 className="text-yellow-400 font-medium mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Exam Information
        </h3>
        <ul className="text-gray-400 text-sm space-y-1">
          <li>- You have {certification.time_limit} minutes to complete the exam</li>
          <li>- You need to score at least {certification.required_score}% to pass</li>
          <li>- The exam contains {certification.questions_count} questions</li>
          <li>- You can retake the exam if you don't pass</li>
          <li>- Certificate is valid for {certification.validity_months} months</li>
        </ul>
      </div>
    </div>
  );
}
