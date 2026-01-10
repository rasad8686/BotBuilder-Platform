import React from 'react';

const EmailHealthScore = ({ overview }) => {
  // Calculate health score based on various factors
  const calculateScore = () => {
    if (!overview) return { score: 0, factors: [] };

    let score = 100;
    const factors = [];

    // Delivery rate factor
    const deliveryRate = overview.deliveryRate || 98;
    if (deliveryRate < 95) {
      score -= (95 - deliveryRate) * 2;
      factors.push({
        name: 'Delivery Rate',
        value: `${deliveryRate.toFixed(1)}%`,
        status: 'warning',
        message: 'Below optimal (95%+)'
      });
    } else {
      factors.push({
        name: 'Delivery Rate',
        value: `${deliveryRate.toFixed(1)}%`,
        status: 'good',
        message: 'Excellent delivery'
      });
    }

    // Bounce rate factor
    const bounceRate = overview.bounceRate || 1.5;
    if (bounceRate > 2) {
      score -= (bounceRate - 2) * 5;
      factors.push({
        name: 'Bounce Rate',
        value: `${bounceRate.toFixed(1)}%`,
        status: 'warning',
        message: 'Above threshold (2%)'
      });
    } else {
      factors.push({
        name: 'Bounce Rate',
        value: `${bounceRate.toFixed(1)}%`,
        status: 'good',
        message: 'Within healthy range'
      });
    }

    // Open rate factor
    const openRate = overview.openRate || 25;
    if (openRate < 20) {
      score -= (20 - openRate);
      factors.push({
        name: 'Open Rate',
        value: `${openRate.toFixed(1)}%`,
        status: 'warning',
        message: 'Below industry average'
      });
    } else {
      factors.push({
        name: 'Open Rate',
        value: `${openRate.toFixed(1)}%`,
        status: 'good',
        message: 'Above industry average'
      });
    }

    // Unsubscribe rate factor
    const unsubRate = overview.unsubscribeRate || 0.3;
    if (unsubRate > 0.5) {
      score -= (unsubRate - 0.5) * 10;
      factors.push({
        name: 'Unsubscribe Rate',
        value: `${unsubRate.toFixed(2)}%`,
        status: 'warning',
        message: 'Higher than expected'
      });
    } else {
      factors.push({
        name: 'Unsubscribe Rate',
        value: `${unsubRate.toFixed(2)}%`,
        status: 'good',
        message: 'Healthy engagement'
      });
    }

    // Spam complaints factor
    const spamRate = overview.spamRate || 0.01;
    if (spamRate > 0.1) {
      score -= 20;
      factors.push({
        name: 'Spam Complaints',
        value: `${spamRate.toFixed(2)}%`,
        status: 'critical',
        message: 'Requires immediate attention'
      });
    } else {
      factors.push({
        name: 'Spam Complaints',
        value: `${spamRate.toFixed(2)}%`,
        status: 'good',
        message: 'Very low complaints'
      });
    }

    return { score: Math.max(0, Math.min(100, Math.round(score))), factors };
  };

  const { score, factors } = calculateScore();

  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Improvement';
    return 'Critical';
  };

  const getScoreRingColor = () => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    return '#ef4444';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'good':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'critical':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Email Health Score</h3>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Score Ring */}
        <div className="flex flex-col items-center">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={getScoreRingColor()}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40 * score / 100} ${2 * Math.PI * 40}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${getScoreColor()}`}>{score}</span>
              <span className="text-sm text-gray-500">out of 100</span>
            </div>
          </div>
          <span className={`mt-2 font-medium ${getScoreColor()}`}>{getScoreLabel()}</span>
        </div>

        {/* Factors */}
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Health Factors</h4>
          <div className="space-y-3">
            {factors.map((factor, index) => (
              <div key={index} className="flex items-center gap-3">
                {getStatusIcon(factor.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{factor.name}</span>
                    <span className="text-sm text-gray-600">{factor.value}</span>
                  </div>
                  <p className={`text-xs ${
                    factor.status === 'good' ? 'text-green-600' :
                    factor.status === 'warning' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {factor.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="md:w-64">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Recommendations</h4>
          <div className="space-y-2">
            {score < 80 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Clean your list regularly to remove inactive subscribers
                </p>
              </div>
            )}
            {score < 90 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  A/B test your subject lines to improve open rates
                </p>
              </div>
            )}
            {score >= 80 && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  Great job! Your email health is excellent. Keep up the good work!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailHealthScore;
