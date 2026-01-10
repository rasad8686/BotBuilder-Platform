/**
 * @fileoverview Email Domain Management Page
 * @description Admin panel for managing sending domains with DKIM/SPF/DMARC verification
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  verifying: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  verified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
};

export default function DomainManagement() {
  const { t } = useTranslation();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDNSModal, setShowDNSModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [newDomain, setNewDomain] = useState('');
  const [subdomain, setSubdomain] = useState('mail');
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState({});
  const [dnsRecords, setDnsRecords] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/email-domains');
      setDomains(response.data.domains || []);
    } catch (error) {
      console.error('Failed to fetch domains:', error);
      setError('Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    if (!newDomain) return;

    try {
      setAdding(true);
      setError(null);
      const response = await api.post('/api/email-domains', {
        domain: newDomain,
        subdomain
      });

      setDomains([response.data.domain, ...domains]);
      setShowAddModal(false);
      setNewDomain('');
      setSubdomain('mail');
      setSuccess('Domain added successfully. Add DNS records to verify.');

      // Show DNS records
      setSelectedDomain(response.data.domain);
      setDnsRecords(response.data.domain.dnsRecords);
      setShowDNSModal(true);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleVerifyDomain = async (domainId) => {
    try {
      setVerifying({ ...verifying, [domainId]: true });
      setError(null);
      const response = await api.post(`/api/email-domains/${domainId}/verify`);

      // Update domain in list
      setDomains(domains.map(d =>
        d.id === domainId
          ? { ...d, ...response.data, status: response.data.allVerified ? 'verified' : 'pending' }
          : d
      ));

      if (response.data.allVerified) {
        setSuccess('Domain verified successfully!');
      } else {
        setError('Some DNS records are not yet propagated. Please try again later.');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to verify domain');
    } finally {
      setVerifying({ ...verifying, [domainId]: false });
    }
  };

  const handleDeleteDomain = async (domainId) => {
    if (!confirm(t('email.domains.confirmDelete', 'Are you sure you want to delete this domain?'))) {
      return;
    }

    try {
      await api.delete(`/api/email-domains/${domainId}`);
      setDomains(domains.filter(d => d.id !== domainId));
      setSuccess('Domain deleted successfully');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete domain');
    }
  };

  const handleSetDefault = async (domainId) => {
    try {
      await api.post(`/api/email-domains/${domainId}/set-default`);
      setDomains(domains.map(d => ({
        ...d,
        is_default: d.id === domainId
      })));
      setSuccess('Default domain updated');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to set default domain');
    }
  };

  const handleShowDNS = async (domain) => {
    try {
      setSelectedDomain(domain);
      const response = await api.get(`/api/email-domains/${domain.id}/dns-records`);
      setDnsRecords(response.data.records);
      setShowDNSModal(true);
    } catch (error) {
      setError('Failed to load DNS records');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard');
    setTimeout(() => setSuccess(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('email.domains.title', 'Email Domain Verification')}
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            {t('email.domains.description', 'Verify your sending domains with DKIM, SPF, and DMARC')}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('email.domains.addDomain', 'Add Domain')}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg flex justify-between items-center">
          {success}
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
          {t('email.domains.whyVerify', 'Why verify your domain?')}
        </h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>{t('email.domains.benefit1', 'Improve email deliverability and avoid spam filters')}</li>
          <li>{t('email.domains.benefit2', 'Authenticate your emails with DKIM signatures')}</li>
          <li>{t('email.domains.benefit3', 'Protect your brand from email spoofing with DMARC')}</li>
          <li>{t('email.domains.benefit4', 'Build trust with email providers (Gmail, Outlook, etc.)')}</li>
        </ul>
      </div>

      {/* Domain List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('email.domains.domain', 'Domain')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('email.domains.status', 'Status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  DKIM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  SPF
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  DMARC
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {domains.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                    </svg>
                    <p>{t('email.domains.noDomains', 'No domains added yet')}</p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-4 text-indigo-600 hover:text-indigo-800"
                    >
                      {t('email.domains.addFirst', 'Add your first domain')}
                    </button>
                  </td>
                </tr>
              ) : (
                domains.map((domain) => (
                  <tr key={domain.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {domain.domain}
                        </span>
                        {domain.is_default && (
                          <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {domain.provider && domain.provider !== 'smtp' && (
                          <span className="capitalize">{domain.provider}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[domain.status]}`}>
                        {domain.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusIcon verified={domain.dkim_verified} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusIcon verified={domain.spf_verified} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusIcon verified={domain.dmarc_verified} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleShowDNS(domain)}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded"
                          title={t('email.domains.viewDNS', 'View DNS Records')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleVerifyDomain(domain.id)}
                          disabled={verifying[domain.id]}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-50"
                          title={t('email.domains.verify', 'Verify')}
                        >
                          {verifying[domain.id] ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                          )}
                        </button>
                        {!domain.is_default && domain.status === 'verified' && (
                          <button
                            onClick={() => handleSetDefault(domain.id)}
                            className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
                            title={t('email.domains.setDefault', 'Set as Default')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDomain(domain.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title={t('common.delete', 'Delete')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step by Step Guide */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('email.domains.setupGuide', 'Domain Setup Guide')}
        </h2>
        <div className="space-y-4">
          <Step
            number={1}
            title={t('email.domains.step1Title', 'Add your domain')}
            description={t('email.domains.step1Desc', 'Click "Add Domain" and enter your sending domain (e.g., yourdomain.com)')}
          />
          <Step
            number={2}
            title={t('email.domains.step2Title', 'Add DNS records')}
            description={t('email.domains.step2Desc', 'Copy the DKIM, SPF, and DMARC records to your DNS provider')}
          />
          <Step
            number={3}
            title={t('email.domains.step3Title', 'Wait for propagation')}
            description={t('email.domains.step3Desc', 'DNS changes can take up to 48 hours to propagate')}
          />
          <Step
            number={4}
            title={t('email.domains.step4Title', 'Verify your domain')}
            description={t('email.domains.step4Desc', 'Click the verify button to check if all records are correctly configured')}
          />
        </div>
      </div>

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('email.domains.addDomain', 'Add Domain')}
              </h2>
              <form onSubmit={handleAddDomain}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('email.domains.domainName', 'Domain Name')}
                    </label>
                    <input
                      type="text"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                      placeholder="example.com"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {t('email.domains.domainHint', 'Enter the domain you want to send emails from')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('email.domains.subdomain', 'Subdomain')} ({t('common.optional', 'Optional')})
                    </label>
                    <input
                      type="text"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                      placeholder="mail"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {t('email.domains.subdomainHint', 'Usually "mail" - used for tracking links')}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={adding || !newDomain}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {adding ? t('common.adding', 'Adding...') : t('email.domains.add', 'Add')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DNS Records Modal */}
      {showDNSModal && selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  DNS Records for {selectedDomain.domain}
                </h2>
                <button
                  onClick={() => setShowDNSModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Required Records */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                    {t('email.domains.requiredRecords', 'Required DNS Records')}
                  </h3>
                  <div className="space-y-4">
                    {dnsRecords?.required?.map((record, index) => (
                      <DNSRecordCard
                        key={index}
                        record={record}
                        onCopy={copyToClipboard}
                      />
                    ))}
                  </div>
                </div>

                {/* Optional Records */}
                {dnsRecords?.optional?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                      {t('email.domains.optionalRecords', 'Optional DNS Records')}
                    </h3>
                    <div className="space-y-4">
                      {dnsRecords.optional.map((record, index) => (
                        <DNSRecordCard
                          key={index}
                          record={record}
                          onCopy={copyToClipboard}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Provider Records */}
                {dnsRecords?.providerRecords && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {t('email.domains.providerRecords', 'Provider-specific Records')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('email.domains.providerNote', 'Additional records from your email provider may be shown above')}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-between items-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('email.domains.propagationNote', 'DNS changes can take up to 48 hours to propagate')}
                </p>
                <button
                  onClick={() => {
                    setShowDNSModal(false);
                    handleVerifyDomain(selectedDomain.id);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  {t('email.domains.verifyNow', 'Verify Now')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Status Icon Component
function StatusIcon({ verified }) {
  return verified ? (
    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
    </svg>
  ) : (
    <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/>
    </svg>
  );
}

// Step Component
function Step({ number, title, description }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-semibold">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </div>
  );
}

// DNS Record Card Component
function DNSRecordCard({ record, onCopy }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-mono rounded ${
            record.type === 'TXT' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
            record.type === 'CNAME' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
            'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
          }`}>
            {record.type}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">{record.purpose}</span>
        </div>
        {record.verified !== undefined && (
          <StatusIcon verified={record.verified} />
        )}
      </div>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Name / Host</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
              {record.name}
            </code>
            <button
              onClick={() => onCopy(record.name)}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Value</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm font-mono text-gray-800 dark:text-gray-200 break-all max-h-24 overflow-y-auto">
              {record.value}
            </code>
            <button
              onClick={() => onCopy(record.value)}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
