import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AffiliateAssets() {
  const [assets, setAssets] = useState(null);
  const [affiliateCode, setAffiliateCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('banners');
  const [copiedId, setCopiedId] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/affiliate/assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets);
        setAffiliateCode(data.affiliateCode);
      }
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateBannerCode = (banner) => {
    const trackingUrl = `${window.location.origin}/api/affiliate/r/${affiliateCode}`;
    return `<a href="${trackingUrl}" target="_blank"><img src="${window.location.origin}${banner.url}" alt="${banner.name}" width="${banner.size.split('x')[0]}" height="${banner.size.split('x')[1]}" /></a>`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'banners', label: 'Banners', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'logos', label: 'Logos', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
    { id: 'emails', label: 'Email Templates', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'social', label: 'Social Posts', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/affiliate/dashboard"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Marketing Assets
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Download banners, logos, and promotional materials
          </p>
        </div>

        {/* Affiliate Link Quick Copy */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Your Affiliate Link
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg font-mono text-sm text-gray-900 dark:text-white">
              {window.location.origin}/ref/{affiliateCode}
            </div>
            <button
              onClick={() => copyToClipboard(`${window.location.origin}/ref/${affiliateCode}`, 'main-link')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {copiedId === 'main-link' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Banners */}
            {activeTab === 'banners' && (
              <div className="space-y-6">
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Copy the HTML code to embed banners on your website. All banners include your affiliate tracking.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {assets?.banners?.map((banner) => (
                    <div key={banner.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4 flex items-center justify-center min-h-[120px]">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm">{banner.size}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{banner.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{banner.size}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(generateBannerCode(banner), `banner-${banner.id}`)}
                          className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          {copiedId === `banner-${banner.id}` ? 'Copied!' : 'Copy HTML'}
                        </button>
                        <button
                          className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Logos */}
            {activeTab === 'logos' && (
              <div className="space-y-6">
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Download our logo in different formats for your promotional content.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {assets?.logos?.map((logo) => (
                    <div key={logo.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-8 mb-4 flex items-center justify-center">
                        <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                      </div>

                      <h3 className="font-medium text-gray-900 dark:text-white mb-3">{logo.name}</h3>

                      <div className="flex gap-2">
                        <button className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          PNG
                        </button>
                        <button className="flex-1 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          SVG
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Templates */}
            {activeTab === 'emails' && (
              <div className="space-y-6">
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Ready-to-use email templates for your marketing campaigns.
                </p>

                {assets?.emailTemplates?.map((template) => (
                  <div key={template.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{template.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Subject: {template.subject}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(template.subject, `email-subject-${template.id}`)}
                          className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          {copiedId === `email-subject-${template.id}` ? 'Copied!' : 'Copy Subject'}
                        </button>
                        <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          View Template
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-400">
                      <p>Hi [Name],</p>
                      <p className="mt-2">Discover the power of AI chatbots with BotBuilder...</p>
                      <p className="mt-2 text-gray-400">[Preview continues...]</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Social Posts */}
            {activeTab === 'social' && (
              <div className="space-y-6">
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Pre-written social media posts optimized for each platform.
                </p>

                {assets?.socialPosts?.map((post) => (
                  <div key={post.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        post.platform === 'twitter' ? 'bg-blue-400' :
                        post.platform === 'linkedin' ? 'bg-blue-700' :
                        'bg-blue-600'
                      }`}>
                        {post.platform === 'twitter' && (
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                        )}
                        {post.platform === 'linkedin' && (
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        )}
                        {post.platform === 'facebook' && (
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white capitalize">{post.platform}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Ready to post</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                      <p className="text-gray-900 dark:text-white">
                        {post.content}
                      </p>
                      <p className="text-blue-600 mt-2 text-sm">
                        {window.location.origin}/ref/{affiliateCode}
                      </p>
                    </div>

                    <button
                      onClick={() => copyToClipboard(`${post.content}\n\n${window.location.origin}/ref/${affiliateCode}`, `social-${post.id}`)}
                      className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {copiedId === `social-${post.id}` ? 'Copied!' : 'Copy Post'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Guidelines */}
        <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
            Brand Guidelines
          </h3>
          <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Do not modify logos or banners</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>No misleading claims or false advertising</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Disclose your affiliate relationship in promotions</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>No spam or unsolicited messaging</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
