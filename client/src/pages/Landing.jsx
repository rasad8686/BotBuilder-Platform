import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, Brain, TrendingUp, Send, Key, Link2, Check, ArrowRight } from 'lucide-react';
import Footer from '../components/Footer';

function Landing() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const features = [
    {
      icon: <Brain className="w-10 h-10 text-purple-600" />,
      title: 'Multi-AI Provider Support',
      description: 'Integrate with OpenAI GPT-4, Claude, and other leading AI models seamlessly.'
    },
    {
      icon: <Send className="w-10 h-10 text-blue-500" />,
      title: 'Telegram Integration',
      description: 'Deploy your bots directly to Telegram with one-click integration.'
    },
    {
      icon: <TrendingUp className="w-10 h-10 text-green-500" />,
      title: 'Advanced Analytics',
      description: 'Track usage, monitor conversations, and optimize bot performance with detailed insights.'
    },
    {
      icon: <Link2 className="w-10 h-10 text-orange-500" />,
      title: 'Webhook Management',
      description: 'Connect your bots to external services with powerful webhook capabilities.'
    },
    {
      icon: <Key className="w-10 h-10 text-indigo-500" />,
      title: 'API Token Management',
      description: 'Secure API tokens for programmatic access and integrations.'
    },
    {
      icon: <Bot className="w-10 h-10 text-pink-500" />,
      title: 'White-Label Ready',
      description: 'Customize branding, colors, and domain to match your business identity.'
    }
  ];

  const steps = [
    {
      number: '01',
      title: 'Create Your Bot',
      description: 'Set up your chatbot in minutes with our intuitive bot builder interface.'
    },
    {
      number: '02',
      title: 'Configure AI',
      description: 'Choose your AI provider, customize prompts, and fine-tune behavior.'
    },
    {
      number: '03',
      title: 'Deploy & Monitor',
      description: 'Launch your bot and track performance with real-time analytics.'
    }
  ];

  const pricingTiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for testing and small projects',
      features: [
        '1 Bot',
        '100 messages/month',
        'Basic analytics',
        'Community support',
        'OpenAI integration'
      ],
      cta: 'Get Started',
      highlighted: false
    },
    {
      name: 'Pro',
      price: '$49',
      period: 'per month',
      description: 'Ideal for growing businesses',
      features: [
        'Unlimited bots',
        '10,000 messages/month',
        'Advanced analytics',
        'Priority support',
        'All AI providers',
        'Custom webhooks',
        'API access'
      ],
      cta: 'Start Free Trial',
      highlighted: true
    },
    {
      name: 'Enterprise',
      price: '$299',
      period: 'per month',
      description: 'For large-scale deployments',
      features: [
        'Unlimited everything',
        'White-label branding',
        'Dedicated support',
        'Custom integrations',
        'SLA guarantee',
        'Advanced security',
        'Custom domain'
      ],
      cta: 'Contact Sales',
      highlighted: false
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-sm dark:shadow-slate-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Bot className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                BotBuilder
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition">{t('landing.features')}</a>
              <a href="#how-it-works" className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition">{t('landing.howItWorks')}</a>
              <a href="#pricing" className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition">{t('landing.pricing')}</a>
              <button
                onClick={() => navigate('/login')}
                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold transition"
              >
                {t('auth.login')}
              </button>
              <button
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition transform hover:-translate-y-0.5"
              >
                {t('landing.getStarted')}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center space-x-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-full text-sm font-semibold mb-6 animate-pulse">
              <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full"></span>
              <span>{t('landing.multiTenant')}</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6">
              {t('landing.heroTitle1')}{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {t('landing.heroTitle2')}
              </span>
              {' '}{t('landing.heroTitle3')}
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
              {t('landing.heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-2xl transition transform hover:-translate-y-1 flex items-center justify-center space-x-2"
              >
                <span>{t('landing.startFreeTrial')}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/demo')}
                className="w-full sm:w-auto bg-white text-purple-600 px-8 py-4 rounded-xl font-bold text-lg border-2 border-purple-600 hover:bg-purple-50 transition"
              >
                {t('landing.viewDemo')}
              </button>
            </div>
            <div className="mt-12 flex items-center justify-center space-x-8 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>{t('landing.noCreditCard')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>{t('landing.freeTrial')}</span>
              </div>
            </div>
          </div>

          {/* Hero Image/Illustration */}
          <div className="mt-16 relative">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-8 max-w-5xl mx-auto">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="space-y-4">
                  <div className="bg-gray-100 dark:bg-slate-700 h-8 rounded w-1/3"></div>
                  <div className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 h-32 rounded-lg flex items-center justify-center">
                    <Bot className="w-16 h-16 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-100 dark:bg-slate-700 h-20 rounded"></div>
                    <div className="bg-gray-100 dark:bg-slate-700 h-20 rounded"></div>
                    <div className="bg-gray-100 dark:bg-slate-700 h-20 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {t('landing.featuresTitle')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              {t('landing.featuresSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-8 rounded-2xl border-2 border-gray-100 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-700 hover:shadow-xl transition transform hover:-translate-y-1 bg-white dark:bg-slate-800"
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {t('landing.stepsTitle')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              {t('landing.stepsSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-2">
                  <div className="text-6xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{step.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="w-8 h-8 text-purple-300 dark:text-purple-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {t('landing.pricingTitle')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              {t('landing.pricingSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <div
                key={index}
                className={`rounded-2xl p-8 ${
                  tier.highlighted
                    ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-2xl transform scale-105'
                    : 'bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700'
                }`}
              >
                {tier.highlighted && (
                  <div className="bg-white text-purple-600 text-sm font-bold px-4 py-1 rounded-full inline-block mb-4">
                    {t('landing.mostPopular')}
                  </div>
                )}
                <h3 className={`text-2xl font-bold mb-2 ${tier.highlighted ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {tier.name}
                </h3>
                <div className="mb-4">
                  <span className={`text-5xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {tier.price}
                  </span>
                  <span className={`text-lg ${tier.highlighted ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                    /{tier.period}
                  </span>
                </div>
                <p className={`mb-6 ${tier.highlighted ? 'text-white/90' : 'text-gray-600 dark:text-gray-300'}`}>
                  {tier.description}
                </p>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center space-x-3">
                      <Check className={`w-4 h-4 ${tier.highlighted ? 'text-white' : 'text-green-500'}`} />
                      <span className={tier.highlighted ? 'text-white' : 'text-gray-700 dark:text-gray-300'}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/register')}
                  className={`w-full py-3 rounded-xl font-bold transition ${
                    tier.highlighted
                      ? 'bg-white text-purple-600 hover:bg-gray-100'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {t('landing.ctaTitle')}
          </h2>
          <p className="text-xl text-white/90 mb-10">
            {t('landing.ctaSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto bg-white text-purple-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition transform hover:-translate-y-1"
            >
              {t('landing.startFreeTrial')}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto bg-transparent text-white px-8 py-4 rounded-xl font-bold text-lg border-2 border-white hover:bg-white/10 transition"
            >
              {t('landing.signIn')}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Landing;
