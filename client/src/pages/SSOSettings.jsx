import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  Key,
  Globe,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  FileText,
  Clock,
  User,
  Mail,
  Loader2,
  Users,
  BarChart3,
  Link2,
  Download,
  TrendingUp
} from 'lucide-react';
import api from '../api/axios';

const SSOSettings = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState(null);
  const [domains, setDomains] = useState([]);
  const [logs, setLogs] = useState([]);
  const [testResults, setTestResults] = useState(null);
  const [activeTab, setActiveTab] = useState('config');
  const [showSecret, setShowSecret] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [verifyingDomain, setVerifyingDomain] = useState(null);

  // Phase 2 state
  const [scimTokens, setScimTokens] = useState([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState(null);
  const [groupMappings, setGroupMappings] = useState([]);
  const [attributeMappings, setAttributeMappings] = useState([]);
  const [roles, setRoles] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // New group mapping form
  const [newGroupMapping, setNewGroupMapping] = useState({
    external_group_id: '',
    external_group_name: '',
    role_id: '',
    is_default: false,
    priority: 0
  });

  // New attribute mapping form
  const [newAttrMapping, setNewAttrMapping] = useState({
    source_attribute: '',
    target_field: '',
    transform: '',
    default_value: '',
    is_required: false
  });

  // Form state
  const [formData, setFormData] = useState({
    provider_type: 'saml',
    name: '',
    is_enabled: false,
    is_enforced: false,
    // SAML fields
    metadata_url: '',
    entity_id: '',
    certificate: '',
    // OIDC fields
    client_id: '',
    client_secret: '',
    issuer_url: '',
    scopes: 'openid profile email',
    // Settings
    settings: {
      auto_provision: true,
      default_role_id: 2
    }
  });

  const providers = [
    { id: 'saml', name: 'SAML 2.0', icon: Shield, description: t('sso.samlDesc', 'Generic SAML 2.0 Provider') },
    { id: 'azure_ad', name: 'Azure AD', icon: Globe, description: t('sso.azureDesc', 'Microsoft Azure Active Directory') },
    { id: 'okta', name: 'Okta', icon: Key, description: t('sso.oktaDesc', 'Okta Identity Provider') },
    { id: 'google', name: 'Google Workspace', icon: Mail, description: t('sso.googleDesc', 'Google Workspace SSO') },
    { id: 'oidc', name: 'OpenID Connect', icon: Shield, description: t('sso.oidcDesc', 'Generic OIDC Provider') }
  ];

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/sso/config');
      if (response.data.config) {
        setConfig(response.data.config);
        setDomains(response.data.config.domains || []);
        setFormData({
          ...formData,
          ...response.data.config,
          settings: response.data.config.settings || { auto_provision: true, default_role_id: 2 }
        });
      }
    } catch (error) {
      console.error('Error fetching SSO config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!config?.id) return;
    try {
      const response = await api.get(`/api/sso/config/${config.id}/logs`);
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && config?.id) {
      fetchLogs();
    }
    if (activeTab === 'scim' && config?.id) {
      fetchScimTokens();
    }
    if (activeTab === 'groups' && config?.id) {
      fetchGroupMappings();
      fetchRoles();
    }
    if (activeTab === 'attributes' && config?.id) {
      fetchAttributeMappings();
    }
    if (activeTab === 'analytics' && config?.id) {
      fetchAnalytics();
    }
  }, [activeTab, config?.id]);

  // Phase 2 fetch functions
  const fetchScimTokens = async () => {
    if (!config?.id) return;
    try {
      const response = await api.get(`/api/sso/config/${config.id}/scim/tokens`);
      setScimTokens(response.data.tokens || []);
    } catch (error) {
      console.error('Error fetching SCIM tokens:', error);
    }
  };

  const fetchGroupMappings = async () => {
    if (!config?.id) return;
    try {
      const response = await api.get(`/api/sso/config/${config.id}/groups`);
      setGroupMappings(response.data.mappings || []);
    } catch (error) {
      console.error('Error fetching group mappings:', error);
    }
  };

  const fetchAttributeMappings = async () => {
    if (!config?.id) return;
    try {
      const response = await api.get(`/api/sso/config/${config.id}/attributes`);
      setAttributeMappings(response.data.mappings || []);
    } catch (error) {
      console.error('Error fetching attribute mappings:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.get('/api/roles');
      setRoles(response.data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchAnalytics = async () => {
    if (!config?.id) return;
    try {
      setAnalyticsLoading(true);
      const response = await api.get(`/api/sso/config/${config.id}/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // SCIM Token handlers
  const handleGenerateToken = async () => {
    if (!config?.id) return;
    try {
      const response = await api.post(`/api/sso/config/${config.id}/scim/tokens`, {
        name: newTokenName || 'SCIM Token'
      });
      setGeneratedToken(response.data.token);
      setNewTokenName('');
      fetchScimTokens();
    } catch (error) {
      console.error('Error generating SCIM token:', error);
      alert(t('sso.scim.tokenError', 'Failed to generate token'));
    }
  };

  const handleRevokeToken = async (tokenId) => {
    if (!window.confirm(t('sso.scim.confirmRevoke', 'Are you sure you want to revoke this token?'))) return;
    try {
      await api.delete(`/api/sso/config/${config.id}/scim/tokens/${tokenId}`);
      fetchScimTokens();
    } catch (error) {
      console.error('Error revoking token:', error);
    }
  };

  // Group Mapping handlers
  const handleAddGroupMapping = async () => {
    if (!config?.id || !newGroupMapping.external_group_id || !newGroupMapping.role_id) return;
    try {
      await api.post(`/api/sso/config/${config.id}/groups`, newGroupMapping);
      setNewGroupMapping({ external_group_id: '', external_group_name: '', role_id: '', is_default: false, priority: 0 });
      fetchGroupMappings();
    } catch (error) {
      console.error('Error adding group mapping:', error);
      alert(t('sso.groups.addError', 'Failed to add group mapping'));
    }
  };

  const handleDeleteGroupMapping = async (mappingId) => {
    if (!window.confirm(t('sso.groups.confirmDelete', 'Are you sure you want to delete this mapping?'))) return;
    try {
      await api.delete(`/api/sso/config/${config.id}/groups/${mappingId}`);
      fetchGroupMappings();
    } catch (error) {
      console.error('Error deleting group mapping:', error);
    }
  };

  // Attribute Mapping handlers
  const handleAddAttrMapping = async () => {
    if (!config?.id || !newAttrMapping.source_attribute || !newAttrMapping.target_field) return;
    try {
      await api.post(`/api/sso/config/${config.id}/attributes`, newAttrMapping);
      setNewAttrMapping({ source_attribute: '', target_field: '', transform: '', default_value: '', is_required: false });
      fetchAttributeMappings();
    } catch (error) {
      console.error('Error adding attribute mapping:', error);
      alert(t('sso.attributes.addError', 'Failed to add attribute mapping'));
    }
  };

  const handleDeleteAttrMapping = async (mappingId) => {
    if (!window.confirm(t('sso.attributes.confirmDelete', 'Are you sure you want to delete this mapping?'))) return;
    try {
      await api.delete(`/api/sso/config/${config.id}/attributes/${mappingId}`);
      fetchAttributeMappings();
    } catch (error) {
      console.error('Error deleting attribute mapping:', error);
    }
  };

  // Export analytics
  const handleExportAnalytics = async () => {
    if (!config?.id) return;
    try {
      const response = await api.get(`/api/sso/config/${config.id}/analytics/export`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sso-analytics-${config.id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting analytics:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const payload = {
        ...formData,
        settings: JSON.stringify(formData.settings)
      };

      let response;
      if (config?.id) {
        response = await api.put(`/api/sso/config/${config.id}`, payload);
      } else {
        response = await api.post('/api/sso/config', payload);
      }

      setConfig(response.data.config);
      alert(t('sso.saveSuccess', 'SSO configuration saved successfully'));
    } catch (error) {
      console.error('Error saving SSO config:', error);
      alert(error.response?.data?.error || t('sso.saveError', 'Failed to save SSO configuration'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config?.id) return;
    try {
      setTesting(true);
      const response = await api.post(`/api/sso/config/${config.id}/test`);
      setTestResults(response.data);
    } catch (error) {
      console.error('Error testing SSO:', error);
      setTestResults({ success: false, checks: [{ name: 'Connection', status: 'error', message: error.message }] });
    } finally {
      setTesting(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    try {
      const response = await api.post('/api/sso/domains', { domain: newDomain.trim() });
      setDomains([...domains, response.data.domain]);
      setNewDomain('');
      alert(t('sso.domainAdded', 'Domain added. Please verify DNS record.'));
    } catch (error) {
      console.error('Error adding domain:', error);
      alert(error.response?.data?.error || t('sso.domainError', 'Failed to add domain'));
    }
  };

  const handleVerifyDomain = async (domainId) => {
    try {
      setVerifyingDomain(domainId);
      const response = await api.post(`/api/sso/domains/${domainId}/verify`);
      if (response.data.success) {
        setDomains(domains.map(d => d.id === domainId ? { ...d, is_verified: true } : d));
        alert(t('sso.domainVerified', 'Domain verified successfully!'));
      } else {
        alert(response.data.message || t('sso.verifyFailed', 'Verification failed'));
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      alert(error.response?.data?.error || t('sso.verifyError', 'Failed to verify domain'));
    } finally {
      setVerifyingDomain(null);
    }
  };

  const handleDeleteDomain = async (domainId) => {
    if (!window.confirm(t('sso.confirmDeleteDomain', 'Are you sure you want to delete this domain?'))) return;
    try {
      await api.delete(`/api/sso/domains/${domainId}`);
      setDomains(domains.filter(d => d.id !== domainId));
    } catch (error) {
      console.error('Error deleting domain:', error);
      alert(error.response?.data?.error || t('sso.deleteError', 'Failed to delete domain'));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(t('common.copied', 'Copied to clipboard'));
  };

  const baseUrl = window.location.origin.replace(':3001', ':3000');
  const acsUrl = `${baseUrl}/api/sso/saml/acs`;
  const metadataUrl = config?.id ? `${baseUrl}/api/sso/config/${config.id}/metadata` : '';
  const callbackUrl = `${baseUrl}/api/sso/oidc/callback`;

  const isSAML = ['saml', 'azure_ad', 'okta'].includes(formData.provider_type);
  const isOIDC = ['oidc', 'google'].includes(formData.provider_type);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-7 h-7 text-blue-600" />
          {t('sso.title', 'Enterprise SSO')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('sso.description', 'Configure Single Sign-On for your organization')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'config'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          {t('sso.configuration', 'Configuration')}
        </button>
        <button
          onClick={() => setActiveTab('domains')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'domains'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Globe className="w-4 h-4 inline mr-2" />
          {t('sso.domains', 'Domains')}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          {t('sso.loginLogs', 'Login Logs')}
        </button>
        <button
          onClick={() => setActiveTab('scim')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'scim'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Link2 className="w-4 h-4 inline mr-2" />
          {t('sso.scim.title', 'SCIM')}
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'groups'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          {t('sso.groups.title', 'Groups')}
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'analytics'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          {t('sso.analytics.title', 'Analytics')}
        </button>
      </div>

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Enable/Enforce toggles */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('sso.enableSSO', 'Enable SSO')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('sso.enableDesc', 'Allow users to sign in with SSO')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_enabled}
                  onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('sso.enforce', 'Enforce SSO')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('sso.enforceDesc', 'Require all users to use SSO (disables password login)')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_enforced}
                  onChange={(e) => setFormData({ ...formData, is_enforced: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              {t('sso.selectProvider', 'Select Identity Provider')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((provider) => {
                const Icon = provider.icon;
                return (
                  <button
                    key={provider.id}
                    onClick={() => setFormData({ ...formData, provider_type: provider.id })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      formData.provider_type === provider.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-2 ${
                      formData.provider_type === provider.id ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <h4 className="font-medium text-gray-900 dark:text-white">{provider.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{provider.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Provider Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-4">
              {t('sso.serviceProviderInfo', 'Service Provider Information')}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
              {t('sso.spInfoDesc', 'Use these values when configuring your Identity Provider')}
            </p>

            {isSAML && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded">
                  <div>
                    <span className="text-xs text-gray-500">{t('sso.acsUrl', 'ACS URL')}</span>
                    <p className="font-mono text-sm">{acsUrl}</p>
                  </div>
                  <button onClick={() => copyToClipboard(acsUrl)} className="text-blue-600 hover:text-blue-700">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {metadataUrl && (
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded">
                    <div>
                      <span className="text-xs text-gray-500">{t('sso.metadataUrl', 'SP Metadata URL')}</span>
                      <p className="font-mono text-sm">{metadataUrl}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => copyToClipboard(metadataUrl)} className="text-blue-600 hover:text-blue-700">
                        <Copy className="w-4 h-4" />
                      </button>
                      <a href={metadataUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isOIDC && (
              <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded">
                <div>
                  <span className="text-xs text-gray-500">{t('sso.callbackUrl', 'Callback URL')}</span>
                  <p className="font-mono text-sm">{callbackUrl}</p>
                </div>
                <button onClick={() => copyToClipboard(callbackUrl)} className="text-blue-600 hover:text-blue-700">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* SAML Configuration */}
          {isSAML && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                {t('sso.samlConfig', 'SAML Configuration')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('sso.metadataUrlLabel', 'IdP Metadata URL')}
                  </label>
                  <input
                    type="url"
                    value={formData.metadata_url || ''}
                    onChange={(e) => setFormData({ ...formData, metadata_url: e.target.value })}
                    placeholder="https://idp.example.com/metadata.xml"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('sso.entityId', 'Entity ID / Issuer')}
                  </label>
                  <input
                    type="text"
                    value={formData.entity_id || ''}
                    onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
                    placeholder="https://idp.example.com"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('sso.certificate', 'X.509 Certificate')}
                  </label>
                  <textarea
                    value={formData.certificate || ''}
                    onChange={(e) => setFormData({ ...formData, certificate: e.target.value })}
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* OIDC Configuration */}
          {isOIDC && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('sso.oidcConfig', 'OpenID Connect Configuration')}
                </h3>
                {formData.discovery_status && (
                  <span className={`px-2 py-1 rounded text-xs ${
                    formData.discovery_status === 'success'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {formData.discovery_status === 'success' ? 'Auto-discovered' : 'Discovery failed'}
                  </span>
                )}
              </div>
              <div className="space-y-4">
                {/* Issuer URL with Auto-Discover */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('sso.issuer', 'Issuer URL')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.issuer_url || ''}
                      onChange={(e) => setFormData({ ...formData, issuer_url: e.target.value })}
                      placeholder="https://accounts.google.com"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={async () => {
                        if (!formData.issuer_url) return;
                        try {
                          setFormData({ ...formData, discovery_status: 'loading' });
                          const response = await api.post('/api/sso/oidc/discover', { issuerUrl: formData.issuer_url });
                          const disc = response.data.discovery;
                          setFormData(prev => ({
                            ...prev,
                            authorization_url: disc.authorization_endpoint,
                            token_url: disc.token_endpoint,
                            userinfo_url: disc.userinfo_endpoint,
                            jwks_url: disc.jwks_uri,
                            scopes: disc.scopes_supported?.slice(0, 5).join(' ') || 'openid profile email',
                            discovery_status: 'success'
                          }));
                        } catch (error) {
                          console.error('Discovery failed:', error);
                          setFormData(prev => ({ ...prev, discovery_status: 'error' }));
                          alert('Failed to discover configuration: ' + (error.response?.data?.error || error.message));
                        }
                      }}
                      disabled={!formData.issuer_url || formData.discovery_status === 'loading'}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                    >
                      {formData.discovery_status === 'loading' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Auto-Discover
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter issuer URL and click Auto-Discover to fetch endpoints automatically
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('sso.clientId', 'Client ID')}
                    </label>
                    <input
                      type="text"
                      value={formData.client_id || ''}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('sso.clientSecret', 'Client Secret')}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={formData.client_secret || ''}
                        onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                        placeholder={config?.has_client_secret ? '••••••••' : ''}
                        className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Auto-filled endpoints */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Authorization Endpoint
                    </label>
                    <input
                      type="url"
                      value={formData.authorization_url || ''}
                      onChange={(e) => setFormData({ ...formData, authorization_url: e.target.value })}
                      placeholder="Auto-filled from discovery"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Token Endpoint
                    </label>
                    <input
                      type="url"
                      value={formData.token_url || ''}
                      onChange={(e) => setFormData({ ...formData, token_url: e.target.value })}
                      placeholder="Auto-filled from discovery"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      UserInfo Endpoint
                    </label>
                    <input
                      type="url"
                      value={formData.userinfo_url || ''}
                      onChange={(e) => setFormData({ ...formData, userinfo_url: e.target.value })}
                      placeholder="Auto-filled from discovery"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      JWKS URI
                    </label>
                    <input
                      type="url"
                      value={formData.jwks_url || ''}
                      onChange={(e) => setFormData({ ...formData, jwks_url: e.target.value })}
                      placeholder="Auto-filled from discovery"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('sso.scopes', 'Scopes')}
                  </label>
                  <input
                    type="text"
                    value={formData.scopes || ''}
                    onChange={(e) => setFormData({ ...formData, scopes: e.target.value })}
                    placeholder="openid profile email"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* PKCE Info */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">PKCE (S256) Enabled</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Proof Key for Code Exchange is automatically enabled for enhanced security.
                        This is the recommended OAuth 2.0 extension for public clients.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test Results */}
          {testResults && (
            <div className={`rounded-lg p-6 border ${
              testResults.success
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <h3 className={`font-semibold mb-4 ${
                testResults.success ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
              }`}>
                {testResults.success ? t('sso.testSuccess', 'Connection Test Passed') : t('sso.testFailed', 'Connection Test Failed')}
              </h3>
              <ul className="space-y-2">
                {testResults.checks?.map((check, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    {check.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {check.status === 'error' && <XCircle className="w-4 h-4 text-red-600" />}
                    {check.status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                    <span className="font-medium">{check.name}:</span>
                    <span className="text-gray-600 dark:text-gray-400">{check.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <button
              onClick={handleTest}
              disabled={testing || !config?.id}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t('sso.testConnection', 'Test Connection')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {t('sso.saveConfig', 'Save Configuration')}
            </button>
          </div>
        </div>
      )}

      {/* Domains Tab */}
      {activeTab === 'domains' && (
        <div className="space-y-6">
          {/* Add Domain */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              {t('sso.addDomain', 'Add Domain')}
            </h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="company.com"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleAddDomain}
                disabled={!newDomain.trim() || !config?.id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('sso.add', 'Add')}
              </button>
            </div>
            {!config?.id && (
              <p className="text-sm text-yellow-600 mt-2">
                {t('sso.saveConfigFirst', 'Please save SSO configuration first before adding domains')}
              </p>
            )}
          </div>

          {/* Domains List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('sso.verifiedDomains', 'Verified Domains')}
              </h3>
            </div>
            {domains.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {t('sso.noDomains', 'No domains configured yet')}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {domains.map((domain) => (
                  <li key={domain.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{domain.domain}</p>
                        {!domain.is_verified && (
                          <div className="mt-1 text-xs text-gray-500">
                            <p>{t('sso.dnsRecord', 'Add DNS TXT record:')}</p>
                            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              _sso-verify.{domain.domain} TXT "{domain.verification_token}"
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {domain.is_verified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          {t('sso.verified', 'Verified')}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleVerifyDomain(domain.id)}
                          disabled={verifyingDomain === domain.id}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {verifyingDomain === domain.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            t('sso.verify', 'Verify')
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteDomain(domain.id)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t('sso.recentLogins', 'Recent SSO Login Attempts')}
            </h3>
            <button
              onClick={fetchLogs}
              className="text-blue-600 hover:text-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t('sso.noLogs', 'No login attempts recorded yet')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.time', 'Time')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.email', 'Email')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.status', 'Status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.ipAddress', 'IP Address')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {log.email || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : log.status === 'failed'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {log.status === 'success' && <CheckCircle className="w-3 h-3" />}
                          {log.status === 'failed' && <XCircle className="w-3 h-3" />}
                          {log.status === 'pending' && <Clock className="w-3 h-3" />}
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                        {log.ip_address || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SCIM Tab */}
      {activeTab === 'scim' && (
        <div className="space-y-6">
          {/* SCIM Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              {t('sso.scim.info', 'SCIM 2.0 Provisioning')}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
              {t('sso.scim.infoDesc', 'Use SCIM to automatically provision and deprovision users from your Identity Provider.')}
            </p>
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded">
              <div>
                <span className="text-xs text-gray-500">{t('sso.scim.endpoint', 'SCIM Endpoint')}</span>
                <p className="font-mono text-sm">{window.location.origin.replace(':3001', ':3000')}/scim/v2</p>
              </div>
              <button
                onClick={() => copyToClipboard(`${window.location.origin.replace(':3001', ':3000')}/scim/v2`)}
                className="text-blue-600 hover:text-blue-700"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Generated Token Alert */}
          {generatedToken && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {t('sso.scim.tokenGenerated', 'Token Generated - Copy Now!')}
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                {t('sso.scim.tokenWarning', 'This token will only be shown once. Copy it now and store it securely.')}
              </p>
              <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded">
                <code className="font-mono text-sm break-all">{generatedToken}</code>
                <button
                  onClick={() => copyToClipboard(generatedToken)}
                  className="ml-2 text-blue-600 hover:text-blue-700 flex-shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setGeneratedToken(null)}
                className="mt-4 text-sm text-yellow-700 hover:underline"
              >
                {t('sso.scim.dismissToken', 'I have copied the token, dismiss this')}
              </button>
            </div>
          )}

          {/* Generate New Token */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              {t('sso.scim.generateToken', 'Generate SCIM Token')}
            </h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder={t('sso.scim.tokenName', 'Token name (optional)')}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleGenerateToken}
                disabled={!config?.id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                {t('sso.scim.generate', 'Generate')}
              </button>
            </div>
          </div>

          {/* Tokens List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('sso.scim.activeTokens', 'Active Tokens')}
              </h3>
            </div>
            {scimTokens.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {t('sso.scim.noTokens', 'No SCIM tokens generated yet')}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {scimTokens.map((token) => (
                  <li key={token.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{token.name}</p>
                      <p className="text-sm text-gray-500">
                        {t('sso.scim.prefix', 'Prefix')}: <code>{token.token_prefix}...</code>
                        {token.last_used_at && (
                          <span className="ml-3">
                            {t('sso.scim.lastUsed', 'Last used')}: {new Date(token.last_used_at).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {token.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs rounded-full">
                          {t('sso.scim.active', 'Active')}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 dark:bg-gray-700 text-xs rounded-full">
                          {t('sso.scim.revoked', 'Revoked')}
                        </span>
                      )}
                      {token.is_active && (
                        <button
                          onClick={() => handleRevokeToken(token.id)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Add Group Mapping */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              {t('sso.groups.addMapping', 'Add Group Mapping')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('sso.groups.mappingDesc', 'Map IdP groups to application roles. Higher priority mappings take precedence.')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('sso.groups.externalId', 'External Group ID')}
                </label>
                <input
                  type="text"
                  value={newGroupMapping.external_group_id}
                  onChange={(e) => setNewGroupMapping({ ...newGroupMapping, external_group_id: e.target.value })}
                  placeholder="group-id-from-idp"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('sso.groups.externalName', 'External Group Name')}
                </label>
                <input
                  type="text"
                  value={newGroupMapping.external_group_name}
                  onChange={(e) => setNewGroupMapping({ ...newGroupMapping, external_group_name: e.target.value })}
                  placeholder="Admins"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('sso.groups.role', 'Application Role')}
                </label>
                <select
                  value={newGroupMapping.role_id}
                  onChange={(e) => setNewGroupMapping({ ...newGroupMapping, role_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">{t('sso.groups.selectRole', 'Select role...')}</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('sso.groups.priority', 'Priority')}
                </label>
                <input
                  type="number"
                  value={newGroupMapping.priority}
                  onChange={(e) => setNewGroupMapping({ ...newGroupMapping, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newGroupMapping.is_default}
                  onChange={(e) => setNewGroupMapping({ ...newGroupMapping, is_default: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('sso.groups.isDefault', 'Default mapping for new users')}
                </span>
              </label>
              <button
                onClick={handleAddGroupMapping}
                disabled={!newGroupMapping.external_group_id || !newGroupMapping.role_id}
                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('sso.groups.add', 'Add Mapping')}
              </button>
            </div>
          </div>

          {/* Group Mappings List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('sso.groups.mappings', 'Group Mappings')}
              </h3>
            </div>
            {groupMappings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {t('sso.groups.noMappings', 'No group mappings configured yet')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.groups.externalGroup', 'External Group')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.groups.appRole', 'App Role')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.groups.priority', 'Priority')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.groups.default', 'Default')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {groupMappings.map((mapping) => (
                      <tr key={mapping.id}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{mapping.external_group_name || mapping.external_group_id}</p>
                          <p className="text-xs text-gray-500">{mapping.external_group_id}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {mapping.role_name || `Role ${mapping.role_id}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {mapping.priority}
                        </td>
                        <td className="px-4 py-3">
                          {mapping.is_default && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteGroupMapping(mapping.id)}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          {analyticsLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : analytics ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('sso.analytics.totalLogins', 'Total Logins')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.totals?.totalLogins || 0}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('sso.analytics.successRate', 'Success Rate')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.successRate || 0}%</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('sso.analytics.newUsers', 'New Users')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.totals?.newUsers || 0}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <Clock className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('sso.analytics.avgLoginTime', 'Avg Login Time')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.avgLoginTime || 0}ms</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Data */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {t('sso.analytics.dailyData', 'Daily Login Data')}
                  </h3>
                  <button
                    onClick={handleExportAnalytics}
                    className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4" />
                    {t('sso.analytics.export', 'Export CSV')}
                  </button>
                </div>
                {analytics.dailyData?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.analytics.date', 'Date')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.analytics.total', 'Total')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.analytics.successful', 'Successful')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.analytics.failed', 'Failed')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sso.analytics.uniqueUsers', 'Unique Users')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {analytics.dailyData.slice(-10).reverse().map((day, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                              {new Date(day.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{day.total}</td>
                            <td className="px-4 py-3 text-sm text-green-600">{day.successful}</td>
                            <td className="px-4 py-3 text-sm text-red-600">{day.failed}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{day.uniqueUsers}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    {t('sso.analytics.noData', 'No analytics data available')}
                  </div>
                )}
              </div>

              {/* Error Breakdown */}
              {analytics.errorBreakdown && Object.keys(analytics.errorBreakdown).length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {t('sso.analytics.errorBreakdown', 'Error Breakdown')}
                    </h3>
                  </div>
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {Object.entries(analytics.errorBreakdown).map(([type, count]) => (
                      <li key={type} className="p-4 flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{type}</span>
                        <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-sm rounded-full">
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('sso.analytics.noAnalytics', 'No analytics data available yet')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SSOSettings;
