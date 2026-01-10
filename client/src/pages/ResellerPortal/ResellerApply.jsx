import React, { useState } from 'react';
import {
  Building2,
  Mail,
  Phone,
  Globe,
  User,
  MapPin,
  CheckCircle,
  ArrowRight,
  Award,
  DollarSign,
  Users,
  Palette
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ResellerApply() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company_name: '',
    phone: '',
    website: '',
    country: '',
    description: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/reseller/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const tiers = [
    {
      name: 'Silver',
      color: 'gray',
      commission: '10%',
      features: [
        'Basic partner dashboard',
        'Customer management',
        'Commission tracking',
        'Standard support'
      ]
    },
    {
      name: 'Gold',
      color: 'yellow',
      commission: '15%',
      features: [
        'Everything in Silver',
        'Custom logo branding',
        'Custom color scheme',
        'Priority support',
        'Quarterly reviews'
      ]
    },
    {
      name: 'Platinum',
      color: 'purple',
      commission: '20%',
      features: [
        'Everything in Gold',
        'Custom domain',
        'White-label emails',
        'Dedicated account manager',
        'Early access to features'
      ]
    }
  ];

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="p-4 bg-green-500/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Application Submitted!</h1>
          <p className="text-gray-400 mb-6">
            Thank you for your interest in becoming a BotBuilder partner.
            Our team will review your application and contact you within 2-3 business days.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return to Home
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-blue-600/20 to-gray-900 py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Become a BotBuilder Partner
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Join our reseller program and earn commissions while helping businesses
            build amazing chatbots and AI solutions.
          </p>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Why Partner With Us?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="p-3 bg-green-500/20 rounded-lg w-fit mb-4">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-white font-medium mb-2">Competitive Commissions</h3>
            <p className="text-gray-400 text-sm">
              Earn up to 20% recurring commission on every customer you refer.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="p-3 bg-blue-500/20 rounded-lg w-fit mb-4">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-white font-medium mb-2">Dedicated Support</h3>
            <p className="text-gray-400 text-sm">
              Get priority access to our support team and dedicated account manager.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="p-3 bg-purple-500/20 rounded-lg w-fit mb-4">
              <Palette className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-white font-medium mb-2">White-Label Options</h3>
            <p className="text-gray-400 text-sm">
              Customize the platform with your branding for a seamless experience.
            </p>
          </div>
        </div>
      </div>

      {/* Tiers Section */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Partner Tiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`bg-gray-800 rounded-xl p-6 border ${
                tier.name === 'Gold'
                  ? 'border-yellow-500/50 ring-2 ring-yellow-500/20'
                  : 'border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Award className={`w-5 h-5 ${
                  tier.color === 'yellow' ? 'text-yellow-400' :
                  tier.color === 'purple' ? 'text-purple-400' : 'text-gray-400'
                }`} />
                <h3 className="text-white font-medium">{tier.name}</h3>
              </div>
              <p className={`text-3xl font-bold mb-4 ${
                tier.color === 'yellow' ? 'text-yellow-400' :
                tier.color === 'purple' ? 'text-purple-400' : 'text-gray-400'
              }`}>
                {tier.commission}
              </p>
              <p className="text-gray-500 text-sm mb-4">Commission Rate</p>
              <ul className="space-y-2">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Application Form */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-6">Apply Now</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Full Name *
                  </div>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address *
                  </div>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company Name *
                </div>
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </div>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Website
                  </div>
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="https://"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Country
                </div>
              </label>
              <select
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Country</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
                <option value="AZ">Azerbaijan</option>
                <option value="TR">Turkey</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Tell us about your business
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                rows={4}
                placeholder="What type of clients do you work with? How do you plan to promote BotBuilder?"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  Submit Application
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-gray-500 text-sm text-center">
              By submitting, you agree to our Partner Terms and Conditions.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
