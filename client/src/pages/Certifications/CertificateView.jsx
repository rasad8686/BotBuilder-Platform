import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Award,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Shield,
  ExternalLink
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CertificateView() {
  const { number } = useParams();
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCertificate();
  }, [number]);

  const fetchCertificate = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/certifications/verify/${number}`);
      const data = await response.json();

      if (data.success) {
        setCertificate(data.certificate);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to verify certificate');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="p-4 bg-red-500/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Certificate Not Found</h1>
          <p className="text-gray-400 mb-6">
            The certificate number you entered could not be verified.
            Please check the number and try again.
          </p>
          <Link
            to="/certifications"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Browse Certifications
          </Link>
        </div>
      </div>
    );
  }

  const isValid = certificate.valid;

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Verification Status */}
        <div className={`rounded-xl p-6 mb-8 text-center ${
          isValid
            ? 'bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-500/30'
            : 'bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30'
        }`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isValid ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            {isValid ? (
              <Shield className="w-8 h-8 text-green-400" />
            ) : (
              <XCircle className="w-8 h-8 text-red-400" />
            )}
          </div>

          <h2 className={`text-xl font-bold mb-2 ${isValid ? 'text-green-400' : 'text-red-400'}`}>
            {isValid ? 'Valid Certificate' : 'Invalid Certificate'}
          </h2>
          <p className="text-gray-400">
            {isValid
              ? 'This certificate has been verified as authentic.'
              : certificate.is_revoked
                ? 'This certificate has been revoked.'
                : 'This certificate has expired.'}
          </p>
        </div>

        {/* Certificate Card */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {/* Badge Header */}
          <div
            className="h-32 flex items-center justify-center"
            style={{ backgroundColor: (certificate.badge_color || '#3B82F6') + '20' }}
          >
            {certificate.badge_image ? (
              <img src={certificate.badge_image} alt="" className="h-20" />
            ) : (
              <Award className="w-20 h-20" style={{ color: certificate.badge_color || '#3B82F6' }} />
            )}
          </div>

          <div className="p-6">
            {/* Certificate Title */}
            <div className="text-center mb-6">
              <p className="text-gray-400 text-sm mb-2">This certifies that</p>
              <h1 className="text-2xl font-bold text-white mb-2">
                {certificate.holder}
              </h1>
              <p className="text-gray-400">has successfully completed</p>
            </div>

            {/* Certification Name */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-blue-400">
                {certificate.certification}
              </h2>
              <p className="text-gray-400 text-sm capitalize">{certificate.level} Level</p>
            </div>

            {/* Score */}
            {certificate.score && (
              <div className="text-center mb-6">
                <p className="text-gray-400 text-sm">with a score of</p>
                <p className="text-3xl font-bold text-white">{certificate.score}%</p>
              </div>
            )}

            {/* Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Issued</span>
                </div>
                <p className="text-white font-medium">
                  {formatDate(certificate.issued_at)}
                </p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Expires</span>
                </div>
                <p className="text-white font-medium">
                  {formatDate(certificate.expires_at)}
                </p>
              </div>
            </div>

            {/* Certificate Number */}
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Certificate Number</p>
              <p className="font-mono text-white bg-gray-700/50 rounded-lg py-2 px-4 inline-block">
                {certificate.certificate_number}
              </p>
            </div>

            {/* Revocation Reason */}
            {certificate.is_revoked && certificate.revocation_reason && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">
                  <strong>Revocation Reason:</strong> {certificate.revocation_reason}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm mb-4">
            Verified by BotBuilder Certification Program
          </p>
          <Link
            to="/certifications"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            <ExternalLink className="w-4 h-4" />
            Learn more about our certifications
          </Link>
        </div>
      </div>
    </div>
  );
}
