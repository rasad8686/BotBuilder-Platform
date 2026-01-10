import React from 'react';
import { CheckCircle, Heart } from 'lucide-react';

export default function SurveyThankYou({
  message,
  primaryColor = '#8b5cf6'
}) {
  const defaultMessage = 'Fikriniz ucun tesekkur edirik!';

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '20px 0',
        animation: 'surveyFadeIn 0.3s ease'
      }}
    >
      {/* Success Icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: `${primaryColor}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px'
        }}
      >
        <CheckCircle
          size={36}
          color={primaryColor}
          strokeWidth={2}
        />
      </div>

      {/* Thank You Message */}
      <h3
        style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '8px'
        }}
      >
        Tesekkurler!
      </h3>

      <p
        style={{
          fontSize: '14px',
          color: '#6b7280',
          lineHeight: '1.5',
          margin: 0
        }}
      >
        {message || defaultMessage}
      </p>

      {/* Heart Animation */}
      <div
        style={{
          marginTop: '20px',
          display: 'flex',
          justifyContent: 'center',
          gap: '4px'
        }}
      >
        {[0, 1, 2].map((i) => (
          <Heart
            key={i}
            size={16}
            fill={primaryColor}
            color={primaryColor}
            style={{
              animation: `heartPulse 1s ease-in-out ${i * 0.2}s infinite`,
              opacity: 0.8
            }}
          />
        ))}
      </div>

      <style>
        {`
          @keyframes heartPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
          }
        `}
      </style>
    </div>
  );
}
