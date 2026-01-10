/**
 * My Purchases Page
 * View purchased and installed marketplace items
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Puzzle, ClipboardList, Link2, Palette, Package, Settings } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MyPurchases = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState([]);
  const [installed, setInstalled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('purchases');

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [token, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchPurchases(), fetchInstalled()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/my/purchases`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setPurchases(data.purchases || []);
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  };

  const fetchInstalled = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/my/installed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setInstalled(data.installations || []);
      }
    } catch (error) {
      console.error('Error fetching installed:', error);
    }
  };

  const handleInstall = async (slug) => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/${slug}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        alert(t('marketplace.installSuccess', 'Installed successfully!'));
        fetchInstalled();
      } else {
        alert(data.error || 'Installation failed');
      }
    } catch (error) {
      alert('Failed to install');
    }
  };

  const handleUninstall = async (slug) => {
    if (!confirm(t('marketplace.confirmUninstall', 'Are you sure you want to uninstall this item?'))) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/marketplace/${slug}/install`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        alert(t('marketplace.uninstallSuccess', 'Uninstalled successfully!'));
        fetchInstalled();
      } else {
        alert(data.error || 'Uninstall failed');
      }
    } catch (error) {
      alert('Failed to uninstall');
    }
  };

  const getTypeIcon = (itemType) => {
    const icons = { plugin: Puzzle, template: ClipboardList, integration: Link2, theme: Palette };
    const Icon = icons[itemType] || Package;
    return <Icon size={18} />;
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: { bg: '#d1fae5', color: '#065f46' },
      pending: { bg: '#fef3c7', color: '#92400e' },
      failed: { bg: '#fee2e2', color: '#991b1b' },
      refunded: { bg: '#e5e7eb', color: '#374151' }
    };
    const s = styles[status] || styles.pending;
    return (
      <span style={{
        padding: '4px 8px',
        backgroundColor: s.bg,
        color: s.color,
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
        textTransform: 'capitalize'
      }}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>{t('marketplace.myPurchases', 'My Purchases')}</h1>
        <button style={styles.browseButton} onClick={() => navigate('/marketplace')}>
          {t('marketplace.browseMore', 'Browse More')}
        </button>
      </header>

      <nav style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'purchases' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('purchases')}
        >
          {t('marketplace.purchases', 'Purchases')} ({purchases.length})
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'installed' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('installed')}
        >
          {t('marketplace.installed', 'Installed')} ({installed.length})
        </button>
      </nav>

      {activeTab === 'purchases' && (
        <div style={styles.content}>
          {purchases.length === 0 ? (
            <div style={styles.empty}>
              <span style={styles.emptyIcon}>📦</span>
              <h2 style={styles.emptyTitle}>{t('marketplace.noPurchases', 'No purchases yet')}</h2>
              <p style={styles.emptyText}>
                {t('marketplace.noPurchasesDesc', 'Browse the marketplace to find great plugins and templates!')}
              </p>
            </div>
          ) : (
            <div style={styles.list}>
              {purchases.map(purchase => (
                <div key={purchase.id} style={styles.listItem}>
                  <div style={styles.itemIcon}>
                    {purchase.icon_url ? (
                      <img src={purchase.icon_url} alt={purchase.item_name} style={styles.iconImage} />
                    ) : (
                      <span style={styles.iconEmoji}>{getTypeIcon(purchase.type)}</span>
                    )}
                  </div>
                  <div style={styles.itemInfo}>
                    <h3
                      style={styles.itemName}
                      onClick={() => navigate(`/marketplace/${purchase.item_slug}`)}
                    >
                      {purchase.item_name}
                    </h3>
                    <p style={styles.itemMeta}>
                      <span style={styles.itemType}>{purchase.type}</span>
                      <span style={styles.itemDate}>
                        {t('marketplace.purchasedOn', 'Purchased on')} {new Date(purchase.created_at).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                  <div style={styles.itemActions}>
                    <span style={styles.itemPrice}>
                      {purchase.price === 0 ? t('marketplace.free', 'Free') : `$${purchase.price.toFixed(2)}`}
                    </span>
                    {getStatusBadge(purchase.status)}
                    {purchase.status === 'completed' && (
                      <button
                        style={styles.installButton}
                        onClick={() => handleInstall(purchase.item_slug)}
                      >
                        {t('marketplace.install', 'Install')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'installed' && (
        <div style={styles.content}>
          {installed.length === 0 ? (
            <div style={styles.empty}>
              <span style={styles.emptyIcon}><Settings size={48} /></span>
              <h2 style={styles.emptyTitle}>{t('marketplace.noInstalled', 'No installed items')}</h2>
              <p style={styles.emptyText}>
                {t('marketplace.noInstalledDesc', 'Install purchased items to start using them!')}
              </p>
            </div>
          ) : (
            <div style={styles.list}>
              {installed.map(item => (
                <div key={item.id} style={styles.listItem}>
                  <div style={styles.itemIcon}>
                    {item.icon_url ? (
                      <img src={item.icon_url} alt={item.item_name} style={styles.iconImage} />
                    ) : (
                      <span style={styles.iconEmoji}>{getTypeIcon(item.type)}</span>
                    )}
                  </div>
                  <div style={styles.itemInfo}>
                    <h3
                      style={styles.itemName}
                      onClick={() => navigate(`/marketplace/${item.item_slug}`)}
                    >
                      {item.item_name}
                    </h3>
                    <p style={styles.itemMeta}>
                      <span style={styles.itemType}>{item.type}</span>
                      <span style={styles.itemVersion}>v{item.version}</span>
                      {item.version !== item.latest_version && (
                        <span style={styles.updateBadge}>
                          {t('marketplace.updateAvailable', 'Update available')} (v{item.latest_version})
                        </span>
                      )}
                    </p>
                    <p style={styles.installedDate}>
                      {t('marketplace.installedOn', 'Installed on')} {new Date(item.installed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={styles.itemActions}>
                    <button
                      style={styles.configureButton}
                      onClick={() => navigate(`/settings/plugins/${item.item_slug}`)}
                    >
                      {t('marketplace.configure', 'Configure')}
                    </button>
                    <button
                      style={styles.uninstallButton}
                      onClick={() => handleUninstall(item.item_slug)}
                    >
                      {t('marketplace.uninstall', 'Uninstall')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1000px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '100px 20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  browseButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px'
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  tabActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  },
  content: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px'
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px'
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px'
  },
  emptyTitle: {
    margin: '0 0 8px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  emptyText: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280'
  },
  list: {},
  listItem: {
    display: 'flex',
    gap: '16px',
    padding: '20px 0',
    borderBottom: '1px solid #e5e7eb',
    alignItems: 'center'
  },
  itemIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  iconImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '12px'
  },
  iconEmoji: {
    fontSize: '24px'
  },
  itemInfo: {
    flex: 1
  },
  itemName: {
    margin: '0 0 6px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e',
    cursor: 'pointer'
  },
  itemMeta: {
    margin: '0 0 4px 0',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    fontSize: '13px'
  },
  itemType: {
    color: '#3b82f6',
    textTransform: 'capitalize'
  },
  itemVersion: {
    color: '#6b7280'
  },
  itemDate: {
    color: '#6b7280'
  },
  installedDate: {
    margin: 0,
    fontSize: '12px',
    color: '#9ca3af'
  },
  updateBadge: {
    padding: '2px 8px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500'
  },
  itemActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  itemPrice: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginRight: '8px'
  },
  installButton: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  configureButton: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  uninstallButton: {
    padding: '8px 16px',
    backgroundColor: 'white',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  }
};

export default MyPurchases;
