/**
 * API Versions Page
 * View API versions, compare features, and access migration guides
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const APIVersions = () => {
  const { t } = useTranslation();
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [migrationGuide, setMigrationGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  const token = localStorage.getItem('token');

  // Fetch versions
  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/api-versions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch versions');

      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      setError(err.message);
      // Use mock data
      setVersions([
        {
          version: 'v1',
          status: 'current',
          deprecated: false,
          sunset: null,
          releaseDate: '2024-01-01',
          description: 'Stable API version with full feature support',
          isDefault: true,
          isSupported: true
        },
        {
          version: 'v2',
          status: 'beta',
          deprecated: false,
          sunset: null,
          releaseDate: '2025-01-15',
          description: 'Beta API with new features and improved response formats',
          isDefault: false,
          isSupported: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch version details
  const fetchVersionDetails = async (version) => {
    try {
      const response = await fetch(`${API_URL}/api/api-versions/${version}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch version details');

      const data = await response.json();
      setSelectedVersion(data);
    } catch (err) {
      // Use mock data
      setSelectedVersion({
        version,
        status: version === 'v1' ? 'current' : 'beta',
        description: version === 'v1'
          ? 'Stable API version with full feature support'
          : 'Beta API with new features and improved response formats',
        changelog: version === 'v1' ? [
          'Initial release',
          'Bot management endpoints',
          'Conversation APIs',
          'Analytics endpoints',
          'Webhook integrations'
        ] : [
          'Improved error response format',
          'Pagination using cursor-based approach',
          'New batch operations endpoints',
          'Enhanced filtering options',
          'WebSocket real-time events',
          'Rate limit headers on all responses'
        ],
        breakingChanges: version === 'v2' ? [
          {
            endpoint: '/api/v2/bots',
            change: 'Response structure changed - bots now in "data" field',
            migration: 'Access bots via response.data instead of response.bots'
          },
          {
            endpoint: '/api/v2/conversations',
            change: 'Pagination uses cursor instead of page number',
            migration: 'Use "cursor" parameter instead of "page"'
          }
        ] : [],
        features: {
          batchOperations: version === 'v2',
          realTimeEvents: version === 'v2',
          advancedFiltering: version === 'v2',
          cursorPagination: version === 'v2'
        },
        rateLimits: {
          requestsPerMinute: version === 'v1' ? 100 : 200,
          requestsPerDay: version === 'v1' ? 10000 : 20000
        }
      });
    }
  };

  // Fetch feature comparison
  const fetchComparison = async () => {
    try {
      const response = await fetch(`${API_URL}/api/api-versions/compare/features`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch comparison');

      const data = await response.json();
      setComparison(data);
    } catch (err) {
      // Use mock data
      setComparison({
        versions: ['v1', 'v2'],
        features: {
          batchOperations: { v1: false, v2: true },
          realTimeEvents: { v1: false, v2: true },
          advancedFiltering: { v1: false, v2: true },
          cursorPagination: { v1: false, v2: true }
        },
        rateLimits: {
          v1: { requestsPerMinute: 100, requestsPerDay: 10000 },
          v2: { requestsPerMinute: 200, requestsPerDay: 20000 }
        }
      });
    }
  };

  // Fetch migration guide
  const fetchMigrationGuide = async (from, to) => {
    try {
      const response = await fetch(`${API_URL}/api/api-versions/migration/${from}/${to}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('No migration guide found');

      const data = await response.json();
      setMigrationGuide(data);
      setShowMigrationModal(true);
    } catch (err) {
      // Use mock data
      setMigrationGuide({
        from: 'v1',
        to: 'v2',
        title: 'Migrating from v1 to v2',
        sections: [
          {
            title: 'Response Format Changes',
            description: 'All list endpoints now wrap results in a "data" field',
            before: '{ "bots": [...], "total": 10 }',
            after: '{ "data": [...], "meta": { "total": 10, "cursor": "..." } }'
          },
          {
            title: 'Pagination Changes',
            description: 'Switched from page-based to cursor-based pagination',
            before: 'GET /api/v1/bots?page=2&limit=10',
            after: 'GET /api/v2/bots?cursor=abc123&limit=10'
          },
          {
            title: 'Error Response Format',
            description: 'Error responses now include error code and details',
            before: '{ "error": "Not found" }',
            after: '{ "error": { "code": "NOT_FOUND", "message": "Bot not found", "details": {} } }'
          },
          {
            title: 'Date Format',
            description: 'All dates are now in ISO 8601 format',
            before: '"created_at": "2024-01-15 10:30:00"',
            after: '"created_at": "2024-01-15T10:30:00Z"'
          }
        ]
      });
      setShowMigrationModal(true);
    }
  };

  useEffect(() => {
    fetchVersions();
    fetchComparison();
  }, [fetchVersions]);

  const getStatusColor = (status) => {
    const colors = {
      current: '#10b981',
      beta: '#3b82f6',
      deprecated: '#f59e0b',
      sunset: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      current: t('versions.current', 'Current'),
      beta: t('versions.beta', 'Beta'),
      deprecated: t('versions.deprecated', 'Deprecated'),
      sunset: t('versions.sunset', 'Sunset')
    };
    return labels[status] || status;
  };

  const formatFeatureName = (feature) => {
    return feature
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  if (loading) {
    return (
      <div style={styles.container} role="status" aria-busy="true">
        <div style={styles.loading}>
          <div style={styles.spinner} aria-hidden="true" />
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{t('versions.title', 'API Versions')}</h1>
          <p style={styles.subtitle}>
            {t('versions.subtitle', 'View available API versions, compare features, and access migration guides')}
          </p>
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner} role="alert">
          {t('versions.usingDemo', 'Using demo data. Connect to API for real version info.')}
        </div>
      )}

      {/* Tabs */}
      <nav style={styles.tabs} role="tablist" aria-label={t('versions.navigation', 'Version navigation')}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'overview' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('overview')}
          role="tab"
          aria-selected={activeTab === 'overview'}
        >
          {t('versions.overview', 'Overview')}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'comparison' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('comparison')}
          role="tab"
          aria-selected={activeTab === 'comparison'}
        >
          {t('versions.comparison', 'Feature Comparison')}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'breaking' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('breaking')}
          role="tab"
          aria-selected={activeTab === 'breaking'}
        >
          {t('versions.breakingChanges', 'Breaking Changes')}
        </button>
      </nav>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <section style={styles.content}>
          <div style={styles.versionGrid} role="list" aria-label={t('versions.list', 'API versions')}>
            {versions.map(v => (
              <article
                key={v.version}
                style={{
                  ...styles.versionCard,
                  borderColor: v.isDefault ? '#3b82f6' : '#e5e7eb'
                }}
                role="listitem"
                onClick={() => fetchVersionDetails(v.version)}
              >
                <div style={styles.versionHeader}>
                  <h2 style={styles.versionName}>{v.version.toUpperCase()}</h2>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: `${getStatusColor(v.status)}20`,
                      color: getStatusColor(v.status)
                    }}
                  >
                    {getStatusLabel(v.status)}
                  </span>
                </div>

                {v.isDefault && (
                  <span style={styles.defaultBadge}>
                    {t('versions.default', 'Default')}
                  </span>
                )}

                <p style={styles.versionDescription}>{v.description}</p>

                <div style={styles.versionMeta}>
                  <span style={styles.metaItem}>
                    <span style={styles.metaLabel}>{t('versions.released', 'Released')}:</span>
                    {v.releaseDate}
                  </span>
                  {v.deprecated && v.sunset && (
                    <span style={{ ...styles.metaItem, color: '#ef4444' }}>
                      <span style={styles.metaLabel}>{t('versions.sunsetDate', 'Sunset')}:</span>
                      {v.sunset}
                    </span>
                  )}
                </div>

                <button
                  style={styles.detailsButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchVersionDetails(v.version);
                  }}
                  aria-label={t('versions.viewDetails', 'View details for {{version}}', { version: v.version })}
                >
                  {t('versions.viewDetails', 'View Details')}
                </button>
              </article>
            ))}
          </div>

          {/* Deprecation Policy */}
          <div style={styles.policySection}>
            <h3 style={styles.policySectionTitle}>{t('versions.deprecationPolicy', 'Deprecation Policy')}</h3>
            <p style={styles.policyText}>
              {t('versions.policyDescription', 'We provide at least 6 months notice before deprecating an API version. Deprecated versions remain functional for at least 12 months after deprecation announcement.')}
            </p>
          </div>
        </section>
      )}

      {/* Comparison Tab */}
      {activeTab === 'comparison' && comparison && (
        <section style={styles.content}>
          <div style={styles.comparisonSection}>
            <h2 style={styles.sectionTitle}>{t('versions.featureMatrix', 'Feature Matrix')}</h2>
            <div style={styles.tableContainer}>
              <table style={styles.table} aria-label={t('versions.featureComparison', 'Feature comparison table')}>
                <thead>
                  <tr>
                    <th scope="col" style={styles.th}>{t('versions.feature', 'Feature')}</th>
                    {comparison.versions.map(v => (
                      <th key={v} scope="col" style={styles.th}>{v.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(comparison.features).map(([feature, support]) => (
                    <tr key={feature}>
                      <td style={styles.td}>{formatFeatureName(feature)}</td>
                      {comparison.versions.map(v => (
                        <td key={v} style={styles.td}>
                          {support[v] ? (
                            <span style={styles.checkMark} aria-label={t('versions.supported', 'Supported')}>✓</span>
                          ) : (
                            <span style={styles.crossMark} aria-label={t('versions.notSupported', 'Not supported')}>✗</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={{ ...styles.sectionTitle, marginTop: '32px' }}>{t('versions.rateLimits', 'Rate Limits')}</h2>
            <div style={styles.tableContainer}>
              <table style={styles.table} aria-label={t('versions.rateLimitsComparison', 'Rate limits comparison')}>
                <thead>
                  <tr>
                    <th scope="col" style={styles.th}>{t('versions.limit', 'Limit')}</th>
                    {comparison.versions.map(v => (
                      <th key={v} scope="col" style={styles.th}>{v.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.td}>{t('versions.requestsPerMinute', 'Requests / Minute')}</td>
                    {comparison.versions.map(v => (
                      <td key={v} style={styles.td}>
                        {comparison.rateLimits[v]?.requestsPerMinute?.toLocaleString() || '-'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={styles.td}>{t('versions.requestsPerDay', 'Requests / Day')}</td>
                    {comparison.versions.map(v => (
                      <td key={v} style={styles.td}>
                        {comparison.rateLimits[v]?.requestsPerDay?.toLocaleString() || '-'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Migration Guide CTA */}
          <div style={styles.migrationCta}>
            <h3>{t('versions.readyToUpgrade', 'Ready to upgrade?')}</h3>
            <p>{t('versions.migrationCtaText', 'View our comprehensive migration guide to upgrade from v1 to v2')}</p>
            <button
              style={styles.migrationButton}
              onClick={() => fetchMigrationGuide('v1', 'v2')}
            >
              {t('versions.viewMigrationGuide', 'View Migration Guide')} →
            </button>
          </div>
        </section>
      )}

      {/* Breaking Changes Tab */}
      {activeTab === 'breaking' && (
        <section style={styles.content}>
          <h2 style={styles.sectionTitle}>{t('versions.breakingChangesV2', 'Breaking Changes in v2')}</h2>

          <div style={styles.breakingChangesList} role="list">
            {[
              {
                endpoint: '/api/v2/bots',
                change: 'Response structure changed - bots now in "data" field',
                migration: 'Access bots via response.data instead of response.bots'
              },
              {
                endpoint: '/api/v2/conversations',
                change: 'Pagination uses cursor instead of page number',
                migration: 'Use "cursor" parameter instead of "page"'
              },
              {
                endpoint: '/api/v2/analytics',
                change: 'Date format changed to ISO 8601',
                migration: 'Use ISO date strings (YYYY-MM-DDTHH:mm:ssZ)'
              }
            ].map((item, index) => (
              <div key={index} style={styles.breakingChangeItem} role="listitem">
                <div style={styles.changeEndpoint}>
                  <code style={styles.endpointCode}>{item.endpoint}</code>
                </div>
                <div style={styles.changeDetails}>
                  <h4 style={styles.changeTitle}>{item.change}</h4>
                  <div style={styles.migrationTip}>
                    <span style={styles.tipLabel}>{t('versions.migration', 'Migration')}:</span>
                    <span>{item.migration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.deprecationTimeline}>
            <h3 style={styles.sectionTitle}>{t('versions.timeline', 'Deprecation Timeline')}</h3>
            <div style={styles.timelineContainer}>
              <div style={styles.timelineItem}>
                <div style={{ ...styles.timelineDot, backgroundColor: '#10b981' }} />
                <div style={styles.timelineContent}>
                  <span style={styles.timelineDate}>Jan 2024</span>
                  <span style={styles.timelineEvent}>{t('versions.v1Released', 'v1 Released (Current)')}</span>
                </div>
              </div>
              <div style={styles.timelineItem}>
                <div style={{ ...styles.timelineDot, backgroundColor: '#3b82f6' }} />
                <div style={styles.timelineContent}>
                  <span style={styles.timelineDate}>Jan 2025</span>
                  <span style={styles.timelineEvent}>{t('versions.v2Beta', 'v2 Beta Released')}</span>
                </div>
              </div>
              <div style={styles.timelineItem}>
                <div style={{ ...styles.timelineDot, backgroundColor: '#6b7280' }} />
                <div style={styles.timelineContent}>
                  <span style={styles.timelineDate}>Jul 2025</span>
                  <span style={styles.timelineEvent}>{t('versions.v2Stable', 'v2 Stable (Planned)')}</span>
                </div>
              </div>
              <div style={styles.timelineItem}>
                <div style={{ ...styles.timelineDot, backgroundColor: '#f59e0b' }} />
                <div style={styles.timelineContent}>
                  <span style={styles.timelineDate}>Jan 2026</span>
                  <span style={styles.timelineEvent}>{t('versions.v1Deprecated', 'v1 Deprecated (Planned)')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Version Details Modal */}
      {selectedVersion && (
        <div
          style={styles.modalOverlay}
          onClick={() => setSelectedVersion(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="version-modal-title"
        >
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 id="version-modal-title" style={styles.modalTitle}>
                {selectedVersion.version.toUpperCase()} Details
              </h2>
              <button
                style={styles.closeButton}
                onClick={() => setSelectedVersion(null)}
                aria-label={t('common.close', 'Close')}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={styles.modalDescription}>{selectedVersion.description}</p>

              <h3 style={styles.modalSectionTitle}>{t('versions.changelog', 'Changelog')}</h3>
              <ul style={styles.changelogList}>
                {selectedVersion.changelog?.map((item, i) => (
                  <li key={i} style={styles.changelogItem}>• {item}</li>
                ))}
              </ul>

              <h3 style={styles.modalSectionTitle}>{t('versions.features', 'Features')}</h3>
              <div style={styles.featureGrid}>
                {Object.entries(selectedVersion.features || {}).map(([feature, enabled]) => (
                  <div key={feature} style={styles.featureItem}>
                    <span style={enabled ? styles.checkMark : styles.crossMark}>
                      {enabled ? '✓' : '✗'}
                    </span>
                    <span>{formatFeatureName(feature)}</span>
                  </div>
                ))}
              </div>

              <h3 style={styles.modalSectionTitle}>{t('versions.rateLimits', 'Rate Limits')}</h3>
              <div style={styles.rateLimitsGrid}>
                <div style={styles.rateLimitItem}>
                  <span style={styles.rateLimitValue}>
                    {selectedVersion.rateLimits?.requestsPerMinute?.toLocaleString()}
                  </span>
                  <span style={styles.rateLimitLabel}>{t('versions.perMinute', 'per minute')}</span>
                </div>
                <div style={styles.rateLimitItem}>
                  <span style={styles.rateLimitValue}>
                    {selectedVersion.rateLimits?.requestsPerDay?.toLocaleString()}
                  </span>
                  <span style={styles.rateLimitLabel}>{t('versions.perDay', 'per day')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Migration Guide Modal */}
      {showMigrationModal && migrationGuide && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowMigrationModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="migration-modal-title"
        >
          <div style={{ ...styles.modal, maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 id="migration-modal-title" style={styles.modalTitle}>
                {migrationGuide.title}
              </h2>
              <button
                style={styles.closeButton}
                onClick={() => setShowMigrationModal(false)}
                aria-label={t('common.close', 'Close')}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              {migrationGuide.sections?.map((section, index) => (
                <div key={index} style={styles.migrationSection}>
                  <h3 style={styles.migrationSectionTitle}>{section.title}</h3>
                  <p style={styles.migrationDescription}>{section.description}</p>

                  <div style={styles.codeComparison}>
                    <div style={styles.codeBlock}>
                      <span style={styles.codeLabel}>{t('versions.before', 'Before (v1)')}</span>
                      <pre style={styles.codeContent}>{section.before}</pre>
                    </div>
                    <div style={styles.codeArrow}>→</div>
                    <div style={styles.codeBlock}>
                      <span style={styles.codeLabel}>{t('versions.after', 'After (v2)')}</span>
                      <pre style={styles.codeContent}>{section.after}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  header: {
    marginBottom: '24px'
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  subtitle: {
    margin: 0,
    fontSize: '16px',
    color: '#6b7280'
  },
  errorBanner: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '24px'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '12px'
  },
  tab: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  tabActive: {
    backgroundColor: '#3b82f6',
    color: 'white'
  },
  content: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  versionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },
  versionCard: {
    backgroundColor: 'white',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  versionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  versionName: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600'
  },
  defaultBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    marginBottom: '12px'
  },
  versionDescription: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '16px',
    lineHeight: '1.5'
  },
  versionMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '16px'
  },
  metaItem: {
    fontSize: '13px',
    color: '#374151'
  },
  metaLabel: {
    color: '#6b7280',
    marginRight: '4px'
  },
  detailsButton: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  policySection: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '8px'
  },
  policySectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  policyText: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6'
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  tableContainer: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb'
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#374151',
    borderBottom: '1px solid #f3f4f6'
  },
  checkMark: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: '16px'
  },
  crossMark: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: '16px'
  },
  comparisonSection: {
    marginBottom: '32px'
  },
  migrationCta: {
    backgroundColor: '#eff6ff',
    padding: '24px',
    borderRadius: '12px',
    textAlign: 'center'
  },
  migrationButton: {
    marginTop: '16px',
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  breakingChangesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '32px'
  },
  breakingChangeItem: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '16px'
  },
  changeEndpoint: {
    marginBottom: '8px'
  },
  endpointCode: {
    backgroundColor: '#1a1a2e',
    color: '#a7f3d0',
    padding: '4px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '13px'
  },
  changeDetails: {},
  changeTitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#991b1b'
  },
  migrationTip: {
    fontSize: '13px',
    color: '#374151'
  },
  tipLabel: {
    fontWeight: '600',
    marginRight: '4px'
  },
  deprecationTimeline: {
    marginTop: '32px'
  },
  timelineContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'relative',
    paddingLeft: '24px'
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    position: 'relative'
  },
  timelineDot: {
    position: 'absolute',
    left: '-24px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    marginTop: '4px'
  },
  timelineContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  timelineDate: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280'
  },
  timelineEvent: {
    fontSize: '14px',
    color: '#374151'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb'
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  closeButton: {
    width: '32px',
    height: '32px',
    border: 'none',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto'
  },
  modalDescription: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '24px',
    lineHeight: '1.6'
  },
  modalSectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase'
  },
  changelogList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 24px 0'
  },
  changelogItem: {
    fontSize: '14px',
    color: '#374151',
    padding: '4px 0'
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '24px'
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px'
  },
  rateLimitsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px'
  },
  rateLimitItem: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '8px',
    textAlign: 'center'
  },
  rateLimitValue: {
    display: 'block',
    fontSize: '24px',
    fontWeight: '700',
    color: '#3b82f6'
  },
  rateLimitLabel: {
    fontSize: '12px',
    color: '#6b7280'
  },
  migrationSection: {
    marginBottom: '24px',
    paddingBottom: '24px',
    borderBottom: '1px solid #f3f4f6'
  },
  migrationSectionTitle: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  migrationDescription: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '16px'
  },
  codeComparison: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap'
  },
  codeBlock: {
    flex: 1,
    minWidth: '200px'
  },
  codeLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: '4px',
    textTransform: 'uppercase'
  },
  codeContent: {
    backgroundColor: '#1a1a2e',
    color: '#a7f3d0',
    padding: '12px',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '12px',
    overflow: 'auto',
    margin: 0
  },
  codeArrow: {
    fontSize: '24px',
    color: '#6b7280'
  }
};

export default APIVersions;
