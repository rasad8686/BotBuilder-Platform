/**
 * Seller Dashboard Page
 * Overview of seller's items, earnings, and stats
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, CheckCircle, Download, DollarSign, Star, Banknote, ShoppingCart, Puzzle, ClipboardList, Link, Palette } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SellerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);

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
      await Promise.all([fetchItems(), fetchEarnings()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/seller/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchEarnings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/seller/earnings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setEarnings(data);
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      published: { bg: '#d1fae5', color: '#065f46' },
      pending: { bg: '#fef3c7', color: '#92400e' },
      draft: { bg: '#e5e7eb', color: '#374151' },
      rejected: { bg: '#fee2e2', color: '#991b1b' }
    };
    const s = styles[status] || styles.draft;
    return (
      <span style={{
        padding: '4px 10px',
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

  const getTypeIcon = (itemType) => {
    const icons = { plugin: Puzzle, template: ClipboardList, integration: Link, theme: Palette };
    const Icon = icons[itemType] || Package;
    return <Icon size={18} />;
  };

  const totalDownloads = items.reduce((sum, item) => sum + (item.downloads || 0), 0);
  const publishedItems = items.filter(item => item.status === 'published').length;

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
        <div>
          <h1 style={styles.title}>{t('seller.dashboard', 'Seller Dashboard')}</h1>
          <p style={styles.subtitle}>
            {t('seller.dashboardDesc', 'Manage your marketplace items and track earnings')}
          </p>
        </div>
        <button style={styles.createButton} onClick={() => navigate('/seller/items/new')}>
          + {t('seller.createItem', 'Create Item')}
        </button>
      </header>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statIcon}><Package size={24} /></span>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{items.length}</span>
            <span style={styles.statLabel}>{t('seller.totalItems', 'Total Items')}</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statIcon}><CheckCircle size={24} /></span>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{publishedItems}</span>
            <span style={styles.statLabel}>{t('seller.published', 'Published')}</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statIcon}><Download size={24} /></span>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{totalDownloads.toLocaleString()}</span>
            <span style={styles.statLabel}>{t('seller.downloads', 'Downloads')}</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statIcon}><DollarSign size={24} /></span>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>${earnings?.summary?.total_net?.toFixed(2) || '0.00'}</span>
            <span style={styles.statLabel}>{t('seller.totalEarnings', 'Total Earnings')}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={styles.quickActions}>
        <button style={styles.actionButton} onClick={() => navigate('/seller/items')}>
          <Package size={16} className="inline mr-1" /> {t('seller.manageItems', 'Manage Items')}
        </button>
        <button style={styles.actionButton} onClick={() => navigate('/seller/earnings')}>
          <Banknote size={16} className="inline mr-1" /> {t('seller.viewEarnings', 'View Earnings')}
        </button>
        <button style={styles.actionButton} onClick={() => navigate('/marketplace')}>
          <ShoppingCart size={16} className="inline mr-1" /> {t('seller.viewMarketplace', 'View Marketplace')}
        </button>
      </div>

      {/* Earnings Summary */}
      {earnings && (
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>{t('seller.earningsSummary', 'Earnings Summary')}</h2>
            <button style={styles.linkButton} onClick={() => navigate('/seller/earnings')}>
              {t('common.viewAll', 'View All')} →
            </button>
          </div>
          <div style={styles.earningsGrid}>
            <div style={styles.earningsCard}>
              <span style={styles.earningsLabel}>{t('seller.available', 'Available')}</span>
              <span style={styles.earningsValue}>${earnings.summary?.available?.toFixed(2) || '0.00'}</span>
              <button style={styles.withdrawButton} onClick={() => navigate('/seller/earnings')}>
                {t('seller.withdraw', 'Withdraw')}
              </button>
            </div>
            <div style={styles.earningsCard}>
              <span style={styles.earningsLabel}>{t('seller.pending', 'Pending')}</span>
              <span style={styles.earningsValueSmall}>${earnings.summary?.pending?.toFixed(2) || '0.00'}</span>
            </div>
            <div style={styles.earningsCard}>
              <span style={styles.earningsLabel}>{t('seller.paid', 'Paid Out')}</span>
              <span style={styles.earningsValueSmall}>${earnings.summary?.paid?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </section>
      )}

      {/* Recent Items */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>{t('seller.yourItems', 'Your Items')}</h2>
          <button style={styles.linkButton} onClick={() => navigate('/seller/items')}>
            {t('common.viewAll', 'View All')} →
          </button>
        </div>

        {items.length === 0 ? (
          <div style={styles.empty}>
            <span style={styles.emptyIcon}><Package size={48} /></span>
            <h3 style={styles.emptyTitle}>{t('seller.noItems', 'No items yet')}</h3>
            <p style={styles.emptyText}>
              {t('seller.noItemsDesc', 'Create your first marketplace item and start earning!')}
            </p>
            <button style={styles.emptyButton} onClick={() => navigate('/seller/items/new')}>
              {t('seller.createFirstItem', 'Create Your First Item')}
            </button>
          </div>
        ) : (
          <div style={styles.itemsList}>
            {items.slice(0, 5).map(item => (
              <div key={item.id} style={styles.itemRow}>
                <div style={styles.itemIcon}>
                  {item.icon_url ? (
                    <img src={item.icon_url} alt={item.name} style={styles.iconImage} />
                  ) : (
                    <span style={styles.iconEmoji}>{getTypeIcon(item.type)}</span>
                  )}
                </div>
                <div style={styles.itemInfo}>
                  <h3 style={styles.itemName}>{item.name}</h3>
                  <p style={styles.itemMeta}>
                    <span style={styles.itemType}>{item.type}</span>
                    <span><Download size={12} style={{ display: 'inline', marginRight: '4px' }} />{item.downloads}</span>
                    <span>★ {item.rating.toFixed(1)}</span>
                  </p>
                </div>
                <div style={styles.itemStatus}>
                  {getStatusBadge(item.status)}
                </div>
                <button
                  style={styles.editButton}
                  onClick={() => navigate(`/seller/items/${item.id}`)}
                >
                  {t('common.edit', 'Edit')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Earnings */}
      {earnings?.recentEarnings?.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>{t('seller.recentEarnings', 'Recent Earnings')}</h2>
          <div style={styles.earningsList}>
            {earnings.recentEarnings.slice(0, 5).map(earning => (
              <div key={earning.id} style={styles.earningRow}>
                <div style={styles.earningInfo}>
                  <span style={styles.earningItem}>{earning.item_name}</span>
                  <span style={styles.earningDate}>
                    {new Date(earning.created_at).toLocaleDateString()}
                  </span>
                </div>
                <span style={styles.earningAmount}>+${earning.net_amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
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
    alignItems: 'flex-start',
    marginBottom: '32px'
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
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb'
  },
  statIcon: {
    fontSize: '32px'
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280'
  },
  quickActions: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px',
    flexWrap: 'wrap'
  },
  actionButton: {
    padding: '12px 20px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  sectionTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  linkButton: {
    padding: '0',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#3b82f6',
    fontSize: '14px',
    cursor: 'pointer'
  },
  earningsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px'
  },
  earningsCard: {
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    textAlign: 'center'
  },
  earningsLabel: {
    display: 'block',
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '8px'
  },
  earningsValue: {
    display: 'block',
    fontSize: '28px',
    fontWeight: '700',
    color: '#10b981',
    marginBottom: '12px'
  },
  earningsValueSmall: {
    display: 'block',
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  withdrawButton: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  empty: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px'
  },
  emptyTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  emptyText: {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: '#6b7280'
  },
  emptyButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  itemsList: {},
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 0',
    borderBottom: '1px solid #e5e7eb'
  },
  itemIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
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
    borderRadius: '10px'
  },
  iconEmoji: {
    fontSize: '24px'
  },
  itemInfo: {
    flex: 1
  },
  itemName: {
    margin: '0 0 4px 0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  itemMeta: {
    margin: 0,
    display: 'flex',
    gap: '12px',
    fontSize: '13px',
    color: '#6b7280'
  },
  itemType: {
    color: '#3b82f6',
    textTransform: 'capitalize'
  },
  itemStatus: {},
  editButton: {
    padding: '8px 16px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  earningsList: {},
  earningRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #e5e7eb'
  },
  earningInfo: {
    display: 'flex',
    flexDirection: 'column'
  },
  earningItem: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1a1a2e'
  },
  earningDate: {
    fontSize: '12px',
    color: '#6b7280'
  },
  earningAmount: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#10b981'
  }
};

export default SellerDashboard;
