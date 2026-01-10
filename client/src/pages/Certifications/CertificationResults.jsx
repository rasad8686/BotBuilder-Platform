import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Award,
  Clock,
  Target,
  ArrowRight,
  Download,
  Share2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CertificationResults() {
  const { slug, attemptId } = useParams();
  const location = useLocation();
  const [loading, setLoading] = useState(!location.state?.results);
  const [results, setResults] = useState(location.state?.results || null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!location.state?.results) {
      fetchResults();
    }
  }, [attemptId]);

  const fetchResults = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/certifications/attempts/${attemptId}/results`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setAttempt(data.attempt);
        setQuestions(data.questions);
        setResults({
          score: data.attempt.score,
          passed: data.attempt.passed,
          time_taken: data.attempt.time_taken,
          points_earned: data.attempt.points_earned,
          total_points: data.attempt.total_points,
          certificate: data.certificate
        });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const toggleQuestion = (id) => {
    setExpandedQuestions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const passed = results?.passed;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Result Banner */}
      <div className={`rounded-xl p-8 text-center ${
        passed
          ? 'bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-500/30'
          : 'bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30'
      }`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
          passed ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          {passed ? (
            <Award className="w-10 h-10 text-green-400" />
          ) : (
            <XCircle className="w-10 h-10 text-red-400" />
          )}
        </div>

        <h1 className={`text-3xl font-bold mb-2 ${passed ? 'text-green-400' : 'text-red-400'}`}>
          {passed ? 'Congratulations!' : 'Not Quite There'}
        </h1>
        <p className="text-gray-400">
          {passed
            ? 'You passed the certification exam!'
            : "Don't give up! Review the material and try again."}
        </p>

        {/* Score Display */}
        <div className="mt-6 inline-flex items-center gap-8">
          <div className="text-center">
            <p className="text-5xl font-bold text-white">{results.score}%</p>
            <p className="text-gray-400 text-sm">Your Score</p>
          </div>
          <div className="w-px h-16 bg-gray-700" />
          <div className="text-center">
            <p className="text-5xl font-bold text-gray-400">{attempt?.required_score || 70}%</p>
            <p className="text-gray-400 text-sm">Required</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-5 h-5 text-blue-400" />
            <span className="text-gray-400">Points</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {results.points_earned} / {results.total_points}
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <span className="text-gray-400">Time Taken</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatTime(results.time_taken)}
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-gray-400">Correct Answers</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {questions.filter(q => attempt?.answers?.[q.id]?.is_correct).length} / {questions.length}
          </p>
        </div>
      </div>

      {/* Certificate Actions */}
      {passed && results.certificate && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium mb-1">Your Certificate</h3>
              <p className="text-gray-400 text-sm">
                Certificate Number: <span className="font-mono text-white">{results.certificate.number}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/certifications/my"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                View Certificate
              </Link>
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Review */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-white font-medium">Question Review</h3>
        </div>
        <div className="divide-y divide-gray-700">
          {questions.map((question, index) => {
            const userAnswer = attempt?.answers?.[question.id];
            const isCorrect = userAnswer?.is_correct;
            const isExpanded = expandedQuestions[question.id];

            return (
              <div key={question.id} className="p-4">
                <button
                  onClick={() => toggleQuestion(question.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className="text-white">
                      Question {index + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      isCorrect
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {userAnswer?.points || 0} / {question.points} pts
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-4 pl-8 space-y-4">
                    <p className="text-gray-300">{question.question}</p>

                    <div className="space-y-2">
                      <p className="text-sm text-gray-400">Your answer:</p>
                      <div className={`p-3 rounded-lg ${
                        isCorrect
                          ? 'bg-green-500/10 border border-green-500/30'
                          : 'bg-red-500/10 border border-red-500/30'
                      }`}>
                        <p className={isCorrect ? 'text-green-400' : 'text-red-400'}>
                          {Array.isArray(userAnswer?.user_answer)
                            ? userAnswer.user_answer.join(', ')
                            : userAnswer?.user_answer || 'No answer provided'}
                        </p>
                      </div>
                    </div>

                    {!isCorrect && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-400">Correct answer:</p>
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <p className="text-green-400">
                            {Array.isArray(question.correct_answer)
                              ? question.correct_answer.join(', ')
                              : question.correct_answer}
                          </p>
                        </div>
                      </div>
                    )}

                    {question.explanation && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-blue-400 text-sm">
                          <strong>Explanation:</strong> {question.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          to={`/certifications/${slug}`}
          className="flex-1 py-3 bg-gray-700 text-white rounded-lg text-center hover:bg-gray-600"
        >
          Back to Certification
        </Link>
        {!passed && (
          <Link
            to={`/certifications/${slug}`}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg text-center hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            Try Again
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
